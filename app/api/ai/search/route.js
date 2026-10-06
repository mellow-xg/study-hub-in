import { consumeRateLimit, createServiceClient, jsonResponse, readJsonBody, requireAuth, validateText } from "../../../../lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const rate = await consumeRateLimit({ userId: auth.user.id, bucket: "ai_search", limit: 30, windowSeconds: 600 });
  if (!rate.allowed) return jsonResponse({ error: "AI search rate limit reached. Try again later." }, 429);

  const bodyResult = await readJsonBody(request, { maxBytes: 8192, maxKeys: 2 });
  if (!bodyResult.ok) return bodyResult.response;

  const queryResult = validateText(bodyResult.body.query, { name: "query", min: 2, max: 160 });
  if (!queryResult.ok) return jsonResponse({ error: queryResult.error }, 400);

  const courseId = bodyResult.body.courseId;
  if (courseId !== undefined && courseId !== null &&
      (typeof courseId !== "string" || !/^[0-9a-f-]{36}$/i.test(courseId))) {
    return jsonResponse({ error: "Invalid courseId." }, 400);
  }

  const service = createServiceClient();
  const { data: courses } = await service.from("courses").select("id,title,slug").eq("status", "published");
  const courseList = courses || [];
  const allowedCourseIds = new Set(courseList.map((c) => c.id));
  if (courseId && !allowedCourseIds.has(courseId)) return jsonResponse({ error: "Course not found." }, 404);

  let query = service.from("chapters")
    .select("id,course_id,title,position,resources!inner(id,title,description,type,url,position,status)")
    .eq("status", "published")
    .eq("resources.status", "published")
    .order("position");

  if (courseId) query = query.eq("course_id", courseId);

  const { data: chapters, error } = await query;
  if (error) {
    console.error("AI resource search failed:", error);
    return jsonResponse({ error: "Could not search course resources." }, 500);
  }

  const term = queryResult.value.toLowerCase();
  const results = [];
  for (const chapter of chapters || []) {
    const course = courseList.find((c) => c.id === chapter.course_id);
    for (const resource of chapter.resources || []) {
      const haystack = [
        course?.title || "", chapter.title || "", resource.title || "",
        resource.description || "", resource.type || "",
      ].join(" ").toLowerCase();
      const words = term.split(/\s+/).filter(Boolean);
      const score = words.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0);
      if (score > 0) {
        results.push({
          id: resource.id,
          title: resource.title,
          description: resource.description,
          type: resource.type,
          url: resource.url,
          courseId: chapter.course_id,
          courseTitle: course?.title || "Course",
          chapterTitle: chapter.title,
          score,
        });
      }
    }
  }

  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return jsonResponse({ results: results.slice(0, 12).map(({ score, ...item }) => item) });
}
