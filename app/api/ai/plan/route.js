import { consumeRateLimit, createServiceClient, jsonResponse, readJsonBody, requireAuth, validateText } from "../../../../lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function buildPlan({ goal, course, topics, resources, quizPerformance }) {
  const weak = topics.filter((t) => t.pct < 70).slice(0, 6);
  const focus = weak.length ? weak : topics.slice(0, 6);
  const items = focus.map((topic, index) => ({
    day: index + 1,
    title: "Review " + topic.title,
    topicId: topic.id,
    minutes: topic.pct < 30 ? 35 : 25,
    tasks: [
      "Review the " + topic.title + " resources",
      topic.pct < 50 ? "Ask Student AI to teach this topic step by step" : "Ask Student AI for an exam-focused summary",
      "Complete one practice quiz or recall exercise",
    ],
    completed: false,
  }));
  if (!items.length) items.push({
    day: 1, title: "Start a focused study session", minutes: 30, tasks: ["Choose a course resource", "Study for 25 minutes", "Use Student AI for a 5-minute recap"], completed: false,
  });
  return {
    goal,
    courseId: course?.id || null,
    courseTitle: course?.title || "General Study Hub",
    generatedAt: new Date().toISOString(),
    items,
    quizPerformance: quizPerformance.slice(0, 3),
    resourceCount: resources.length,
  };
}

export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  const rate = await consumeRateLimit({ userId: auth.user.id, bucket: "ai_analytics", limit: 30, windowSeconds: 600 });
  if (!rate.allowed) return jsonResponse({ error: "Analytics rate limit reached. Try again later." }, 429);

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId") || "";
  if (courseId && !/^[0-9a-f-]{36}$/i.test(courseId)) return jsonResponse({ error: "Invalid courseId." }, 400);

  let courseQuery = service.from("courses").select("id,title,slug").eq("status", "published");
  if (courseId) courseQuery = courseQuery.eq("id", courseId);
  const { data: courses, error: courseError } = await courseQuery;
  if (courseError || (courseId && !courses?.length)) return jsonResponse({ error: "Course not found." }, 404);
  const selectedIds = (courses || []).map((c) => c.id);

  const { data: chapters } = await service.from("chapters")
    .select("id,course_id,title,position,resources!inner(id,title,status)")
    .eq("status", "published").eq("resources.status", "published");
  const relevantChapters = (chapters || []).filter((c) => selectedIds.includes(c.course_id));
  const resourceIds = relevantChapters.flatMap((c) => (c.resources || []).map((r) => r.id));
  const { data: progress } = resourceIds.length
    ? await service.from("progress").select("resource_id,completed_at").eq("user_id", auth.user.id).in("resource_id", resourceIds)
    : { data: [] };
  const completed = new Set((progress || []).map((p) => p.resource_id));

  const topics = relevantChapters.map((c) => {
    const rs = c.resources || [];
    const done = rs.filter((r) => completed.has(r.id)).length;
    return { id: c.id, title: c.title, done, total: rs.length, pct: rs.length ? Math.round(done * 100 / rs.length) : 0 };
  }).filter((t) => t.total).sort((a, b) => a.pct - b.pct);

  const { data: quizzes } = await service.from("quizzes").select("id,title,course_id").eq("status", "published");
  const quizIds = (quizzes || []).filter((q) => selectedIds.includes(q.course_id)).map((q) => q.id);
  const { data: attempts } = quizIds.length
    ? await service.from("quiz_attempts").select("quiz_id,score,total,completed_at").eq("user_id", auth.user.id).in("quiz_id", quizIds).order("completed_at", { ascending: false })
    : { data: [] };
  const best = {};
  for (const a of attempts || []) best[a.quiz_id] = Math.max(best[a.quiz_id] || 0, a.total ? Math.round(a.score * 100 / a.total) : 0);
  const quizPerformance = (quizzes || []).filter((q) => best[q.id] !== undefined).map((q) => ({ id: q.id, title: q.title, best: best[q.id] })).sort((a,b) => a.best-b.best);

  const { data: activity } = await service.from("last_activity").select("opened_at").eq("user_id", auth.user.id);
  const { data: recentProgress } = await service.from("progress").select("completed_at").eq("user_id", auth.user.id).order("completed_at", { ascending: false }).limit(100);
  const dates = new Set([...(activity || []).map(x => dayKey(x.opened_at)), ...(recentProgress || []).map(x => dayKey(x.completed_at))]);
  let streak = 0;
  const cursor = new Date();
  while (dates.has(cursor.toISOString().slice(0,10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  const total = resourceIds.length;
  const done = completed.size;
  return jsonResponse({
    course: courses?.[0] || null,
    progress: { completed: done, total, pct: total ? Math.round(done * 100 / total) : 0 },
    topics: topics.slice(0, 12),
    weakTopics: topics.filter(t => t.pct < 50).slice(0, 6),
    quizPerformance: quizPerformance.slice(0, 8),
    streak,
    studyDays: dates.size,
    recentActivity: [...dates].sort().reverse().slice(0, 14),
    recommendation: topics.find(t => t.pct < 50)?.title || (quizPerformance[0]?.title || "Keep building your study streak"),
  });
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  const rate = await consumeRateLimit({ userId: auth.user.id, bucket: "ai_planner", limit: 10, windowSeconds: 600 });
  if (!rate.allowed) return jsonResponse({ error: "Planner rate limit reached. Try again later." }, 429);
  const bodyResult = await readJsonBody(request, { maxBytes: 8192, maxKeys: 3 });
  if (!bodyResult.ok) return bodyResult.response;
  const { goal, courseId } = bodyResult.body;
  const goalResult = validateText(goal, { min: 3, max: 1000 });
  if (!goalResult.ok) return jsonResponse({ error: goalResult.error }, 400);
  if (courseId !== undefined && courseId !== null && (typeof courseId !== "string" || !/^[0-9a-f-]{36}$/i.test(courseId))) {
    return jsonResponse({ error: "Invalid courseId." }, 400);
  }

  const service = createServiceClient();
  let course = null;
  if (courseId) {
    const { data } = await service.from("courses").select("id,title").eq("id", courseId).eq("status","published").maybeSingle();
    if (!data) return jsonResponse({ error: "Course not found." }, 404);
    course = data;
  }
  const { data: chapters } = await service.from("chapters").select("id,title,course_id,resources!inner(id,title,status)")
    .eq("status","published").eq("resources.status","published");
  const selected = (chapters || []).filter(c => !courseId || c.course_id === courseId);
  const resourceIds = selected.flatMap(c => (c.resources || []).map(r => r.id));
  const { data: progress } = resourceIds.length ? await service.from("progress").select("resource_id").eq("user_id",auth.user.id).in("resource_id",resourceIds) : {data:[]};
  const completed = new Set((progress || []).map(p => p.resource_id));
  const topics = selected.map(c => {
    const rs=c.resources||[], done=rs.filter(r=>completed.has(r.id)).length;
    return {id:c.id,title:c.title,done,total:rs.length,pct:rs.length?Math.round(done*100/rs.length):0};
  }).filter(t=>t.total).sort((a,b)=>a.pct-b.pct);
  const plan = buildPlan({ goal: goalResult.value, course, topics, resources: resourceIds, quizPerformance: [] });

  const { data: saved, error } = await service.from("ai_study_plans").insert({
    user_id: auth.user.id, course_id: course?.id || null, title: course ? course.title + " plan" : "My study plan",
    goal: goalResult.value, status: "active", plan,
  }).select("id,title,goal,status,plan,created_at,updated_at").single();
  if (error) return jsonResponse({ error: "Could not save study plan." }, 500);
  return jsonResponse({ plan: saved }, 201);
}
