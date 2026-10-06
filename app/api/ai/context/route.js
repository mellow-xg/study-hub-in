import { consumeRateLimit, jsonResponse, readJsonBody, requireAuth } from "../../../../lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const rate = await consumeRateLimit({ userId: auth.user.id, bucket: "ai_context", limit: 30, windowSeconds: 600, client: auth.client });
  if (!rate.allowed) return jsonResponse({ error: "AI context rate limit reached. Try again later." }, 429);

  const bodyResult = await readJsonBody(request, { maxBytes: 8192, maxKeys: 2 });
  if (!bodyResult.ok) return bodyResult.response;

  const { courseId, resourceId } = bodyResult.body;
  for (const [name, value] of [["courseId", courseId], ["resourceId", resourceId]]) {
    if (value !== undefined && value !== null &&
        (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value))) {
      return jsonResponse({ error: "Invalid " + name + "." }, 400);
    }
  }

  const client = auth.client;
  let courseQuery = client.from("courses").select("id,title,slug,description").eq("status", "published");
  if (courseId) courseQuery = courseQuery.eq("id", courseId);
  const { data: courses, error: courseError } = await courseQuery;
  if (courseError || (courseId && !courses?.length)) return jsonResponse({ error: "Course not found." }, 404);

  const selectedCourseIds = new Set((courses || []).map((c) => c.id));
  let chapterQuery = client.from("chapters")
    .select("id,course_id,title,position,resources!inner(id,title,description,type,url,position,status)")
    .eq("status", "published").eq("resources.status", "published").order("position");
  if (courseId) chapterQuery = chapterQuery.eq("course_id", courseId);

  const { data: chapters, error: chapterError } = await chapterQuery;
  if (chapterError) return jsonResponse({ error: "Could not load course resources." }, 500);

  const resources = [];
  const resourceToChapter = {};
  const chapterRows = [];
  for (const chapter of chapters || []) {
    const course = (courses || []).find((c) => c.id === chapter.course_id);
    if (!course || !selectedCourseIds.has(course.id)) continue;
    const publishedResources = chapter.resources || [];
    chapterRows.push({ id: chapter.id, courseId: course.id, title: chapter.title, total: publishedResources.length });
    for (const resource of publishedResources) {
      resourceToChapter[resource.id] = chapter.id;
      if (!resourceId || resource.id === resourceId) {
        resources.push({
          id: resource.id, title: resource.title, description: resource.description,
          type: resource.type, url: resource.url, courseId: course.id,
          courseTitle: course.title, chapterTitle: chapter.title,
        });
      }
    }
  }

  if (resourceId && !resources.length) return jsonResponse({ error: "Resource not found in this course." }, 404);

  const resourceIds = Object.keys(resourceToChapter);
  let progress = [];
  let bookmarks = [];
  if (resourceIds.length) {
    const [{ data: progressData }, { data: bookmarkData }] = await Promise.all([
      client.from("progress").select("resource_id,completed_at").eq("user_id", auth.user.id).in("resource_id", resourceIds),
      client.from("bookmarks").select("resource_id").eq("profile_id", auth.user.id).in("resource_id", resourceIds),
    ]);
    progress = progressData || [];
    bookmarks = bookmarkData || [];
  }

  const completed = new Set(progress.map((p) => p.resource_id));
  const bookmarked = new Set(bookmarks.map((b) => b.resource_id));
  const topicStats = chapterRows.map((chapter) => {
    const done = Object.entries(resourceToChapter).filter(([id, chapterId]) => chapterId === chapter.id && completed.has(id)).length;
    const pct = chapter.total ? Math.round((done / chapter.total) * 100) : 0;
    return { id: chapter.id, title: chapter.title, done, total: chapter.total, pct };
  }).filter((topic) => topic.total > 0).sort((a, b) => a.pct - b.pct);

  const { data: quizList } = await client.from("quizzes").select("id,title,course_id").eq("status", "published");
  const quizIds = (quizList || []).filter((q) => selectedCourseIds.has(q.course_id)).map((q) => q.id);
  let quizPerformance = [];
  if (quizIds.length) {
    const { data: attempts } = await client.from("quiz_attempts").select("quiz_id,score,total,completed_at")
      .eq("user_id", auth.user.id).in("quiz_id", quizIds).order("completed_at", { ascending: false });
    const best = {};
    for (const attempt of attempts || []) {
      const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
      best[attempt.quiz_id] = Math.max(best[attempt.quiz_id] || 0, pct);
    }
    quizPerformance = (quizList || []).filter((q) => best[q.id] !== undefined).map((q) => ({
      id: q.id, title: q.title, courseId: q.course_id, best: best[q.id],
    })).sort((a, b) => a.best - b.best);
  }

  const selectedCourse = courses?.[0] || null;
  return jsonResponse({
    course: selectedCourse,
    sources: resources.slice(0, 30),
    bookmarkedResourceIds: [...bookmarked],
    progress: {
      completed: completed.size,
      total: resourceIds.length,
      pct: resourceIds.length ? Math.round((completed.size / resourceIds.length) * 100) : 0,
    },
    weakTopics: topicStats.filter((topic) => topic.pct < 50).slice(0, 5),
    quizPerformance: quizPerformance.slice(0, 5),
  });
}

