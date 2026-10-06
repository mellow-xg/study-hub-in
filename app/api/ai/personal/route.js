import {
  consumeRateLimit,
  jsonResponse,
  readJsonBody,
  requireAuth,
  validateText,
  writeAuditLog,
} from "../../../../lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function calculateStreak(dates) {
  const unique = [...new Set(dates.map((d) => new Date(d).toISOString().slice(0, 10)))].sort().reverse();
  if (!unique.length) return 0;
  const todayKey = new Date().toISOString().slice(0, 10);
  if (unique[0] !== todayKey) return 0;
  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    const previous = new Date(unique[i - 1] + "T00:00:00Z");
    const current = new Date(unique[i] + "T00:00:00Z");
    if (Math.round((previous - current) / 86400000) !== 1) break;
    streak++;
  }
  return streak;
}

async function getPersonalData(client, userId, courseId) {
  let course = null;
  let chapterIds = null;

  if (courseId) {
    const { data, error } = await client.from("courses").select("id,title,description").eq("id", courseId).eq("status", "published").maybeSingle();
    if (error || !data) return { error: "Course not found." };
    course = data;
    const { data: chapters } = await client.from("chapters").select("id").eq("course_id", courseId).eq("status", "published");
    chapterIds = (chapters || []).map((c) => c.id);
  }

  let resourcesQuery = client.from("resources").select("id,chapter_id").eq("status", "published");
  if (chapterIds) {
    resourcesQuery = chapterIds.length ? resourcesQuery.in("chapter_id", chapterIds) : resourcesQuery.eq("chapter_id", "00000000-0000-0000-0000-000000000000");
  }

  const [{ data: resources }, { data: progress }, { data: attempts }, { data: quizzes }] = await Promise.all([
    resourcesQuery,
    client.from("progress").select("resource_id,completed_at").eq("user_id", userId),
    client.from("quiz_attempts").select("quiz_id,score,total,completed_at").eq("user_id", userId).order("completed_at", { ascending: false }).limit(100),
    client.from("quizzes").select("id,title,course_id").eq("status", "published"),
  ]);

  const resourceIds = new Set((resources || []).map((r) => r.id));
  const completed = (progress || []).filter((p) => resourceIds.has(p.resource_id));
  const total = resourceIds.size;
  const quizRows = (attempts || []).filter((a) => (quizzes || []).some((q) => q.id === a.quiz_id && (!courseId || q.course_id === courseId)));
  const best = {};
  for (const attempt of quizRows) {
    const scorePct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
    best[attempt.quiz_id] = Math.max(best[attempt.quiz_id] || 0, scorePct);
  }
  const quizPerformance = (quizzes || []).filter((q) => best[q.id] !== undefined && (!courseId || q.course_id === courseId))
    .map((q) => ({ title: q.title, best: best[q.id] })).sort((a, b) => a.best - b.best).slice(0, 5);
  const activityDates = [...completed.map((p) => p.completed_at), ...quizRows.map((a) => a.completed_at)];

  return {
    course,
    progress: { completed: completed.length, total, pct: total ? Math.round((completed.length / total) * 100) : 0 },
    quizPerformance,
    streak: calculateStreak(activityDates),
  };
}

export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId") || "";
  if (courseId && !/^[0-9a-f-]{36}$/i.test(courseId)) return jsonResponse({ error: "Invalid courseId." }, 400);

  const client = auth.client;
  const [personal, plans, saved] = await Promise.all([
    getPersonalData(client, auth.user.id, courseId || null),
    client.from("ai_study_plans").select("id,course_id,title,goal,status,plan,created_at,updated_at").eq("user_id", auth.user.id).eq("status", "active").order("updated_at", { ascending: false }).limit(5),
    client.from("ai_saved_answers").select("id,title,content,conversation_id,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (personal.error) return jsonResponse({ error: personal.error }, 404);
  return jsonResponse({ ...personal, plans: plans.data || [], savedAnswers: saved.data || [] });
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  const rate = await consumeRateLimit({ userId: auth.user.id, bucket: "ai_personal_plan", limit: 5, windowSeconds: 600, client: auth.client });
  if (!rate.allowed) return jsonResponse({ error: "Personal plan rate limit reached. Try again later." }, 429);

  const bodyResult = await readJsonBody(request, { maxBytes: 8192, maxKeys: 2 });
  if (!bodyResult.ok) return bodyResult.response;
  const goalResult = validateText(bodyResult.body.goal, { name: "goal", min: 3, max: 500 });
  if (!goalResult.ok) return jsonResponse({ error: goalResult.error }, 400);

  const courseId = bodyResult.body.courseId;
  if (courseId !== undefined && courseId !== null && courseId !== "" && (typeof courseId !== "string" || !/^[0-9a-f-]{36}$/i.test(courseId))) {
    return jsonResponse({ error: "Invalid courseId." }, 400);
  }

  const personal = await getPersonalData(auth.client, auth.user.id, courseId || null);
  if (personal.error) return jsonResponse({ error: personal.error }, 404);
  const fallback = Array.from({ length: 7 }, (_, i) => ({
    day: i + 1,
    focus: personal.quizPerformance[i % Math.max(personal.quizPerformance.length, 1)]?.title || (personal.course?.title || "your current subjects"),
    tasks: ["Review one weak topic for 20 minutes.", "Complete 3 practice questions.", "Write a 5-minute recap from memory."],
  }));

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return jsonResponse({ error: "Student AI is not configured yet." }, 503);

  const prompt = [
    "Create a practical 7-day study plan for a student.",
    "Return ONLY valid JSON: an array of 7 objects with keys day, focus, tasks.",
    "tasks must be an array of 2-4 short actionable strings.",
    "Use the student's course, progress, quiz performance, and streak to personalize the plan.",
    "Do not invent specific resources that are not supplied.",
    JSON.stringify({ goal: goalResult.value, course: personal.course, progress: personal.progress, quizPerformance: personal.quizPerformance, streak: personal.streak }),
  ].join("\n");

  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://study-hub-in-vert.vercel.app",
        "X-Title": "Study Hub Student AI",
      },
      body: JSON.stringify({ model: "openrouter/auto", messages: [
        { role: "system", content: "You are a study planner. Follow the requested JSON format exactly." },
        { role: "user", content: prompt },
      ], max_tokens: 1000, temperature: 0.3 }),
      cache: "no-store",
    });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      await writeAuditLog({ userId: auth.user.id, event: "ai_study_plan_upstream_error", request, metadata: { status: upstream.status } });
      return jsonResponse({ error: "Could not generate a study plan right now." }, 502);
    }
    const raw = payload?.choices?.[0]?.message?.content || "";
    const cleaned = raw.replace(/^\`\`\`json\s*/i, "").replace(/\s*\`\`\`$/i, "").trim();
    let plan;
    try { plan = JSON.parse(cleaned); } catch { plan = fallback; }
    if (!Array.isArray(plan) || plan.length !== 7) plan = fallback;
    plan = plan.map((item, index) => ({
      day: index + 1,
      focus: String(item?.focus || fallback[index].focus).slice(0, 200),
      tasks: Array.isArray(item?.tasks) ? item.tasks.slice(0, 4).map((t) => String(t).slice(0, 300)) : fallback[index].tasks,
    }));

    const { data, error } = await auth.client.from("ai_study_plans").insert({
      user_id: auth.user.id, course_id: courseId || null, title: "7-Day Study Plan", goal: goalResult.value, plan,
    }).select("id,course_id,title,goal,status,plan,created_at,updated_at").single();
    if (error) {
      console.error("Study plan save failed:", error);
      return jsonResponse({ error: "Plan generated but could not be saved." }, 500);
    }
    await writeAuditLog({ userId: auth.user.id, event: "ai_study_plan_created", request, metadata: { course_id: courseId || null } });
    return jsonResponse({ plan: data, personal });
  } catch (error) {
    console.error("Study plan generation failed:", error);
    return jsonResponse({ error: "Study plan is temporarily unavailable." }, 504);
  }
}

