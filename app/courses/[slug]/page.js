"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

function toEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      if (u.pathname.startsWith("/live/")) {
        const videoId = u.pathname.split("/")[2];
        return `https://www.youtube.com/embed/${videoId}`;
      }
      if (u.pathname.endsWith("/live")) return url;
      let videoId = u.searchParams.get("v");
      if (u.hostname.includes("youtu.be")) videoId = u.pathname.slice(1);
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return `https://player.vimeo.com/video/${id}`;
    }
    if (u.hostname.includes("drive.google.com")) return url.replace("/view", "/preview");
    return url;
  } catch {
    return url;
  }
}

function isEmbeddable(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.pathname.endsWith("/live") && !u.pathname.startsWith("/live/")) return false;
    return true;
  } catch {
    return true;
  }
}

export default function CoursePage() {
  const router = useRouter();
  const params = useParams();
  const [userId, setUserId] = useState(null);
  const [course, setCourse] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [resourcesByChapter, setResourcesByChapter] = useState({});
  const [activeResource, setActiveResource] = useState(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [quizzes, setQuizzes] = useState([]);
  const [bestByQuiz, setBestByQuiz] = useState({});
  const [loading, setLoading] = useState(true);
  const [gestureResource, setGestureResource] = useState(null);
  const [resourceLoading, setResourceLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data: courseData } = await supabase.from("courses").select("*").eq("slug", params.slug).eq("status", "published").single();
      if (!courseData) { setLoading(false); return; }
      setCourse(courseData);

      const { data: chapterData } = await supabase.from("chapters").select("*").eq("course_id", courseData.id).eq("status", "published").order("position", { ascending: true });
      setChapters(chapterData || []);

      const { data: quizData } = await supabase.from("quizzes").select("id, title, status").eq("course_id", courseData.id).order("created_at", { ascending: true });
      setQuizzes(quizData || []);

      if (quizData?.length) {
        const { data: attemptData } = await supabase.from("quiz_attempts").select("quiz_id, score, total").eq("user_id", user.id).in("quiz_id", quizData.map((q) => q.id));
        const best = {};
        (attemptData || []).forEach((a) => {
          const prev = best[a.quiz_id];
          if (!prev || a.score / a.total > prev.score / prev.total) best[a.quiz_id] = a;
        });
        setBestByQuiz(best);
      }

      if (chapterData?.length) {
        const chapterIds = chapterData.map((c) => c.id);
        const { data: resourceData } = await supabase.from("resources").select("id,chapter_id,title,description,type,thumbnail_url,position,status,created_at,updated_at").in("chapter_id", chapterIds).eq("status", "published").order("position", { ascending: true });
        const grouped = {};
        (resourceData || []).forEach((r) => {
          if (!grouped[r.chapter_id]) grouped[r.chapter_id] = [];
          grouped[r.chapter_id].push(r);
        });
        setResourcesByChapter(grouped);

        const { data: progressData } = await supabase.from("progress").select("resource_id").eq("user_id", user.id);
        setCompletedIds(new Set((progressData || []).map((p) => p.resource_id)));
      }
      setLoading(false);
    }
    load();
  }, [params.slug, router]);

  useEffect(() => {
    const onLongPress = (event) => {
      const id = event.detail?.resourceId;
      if (!id) return;
      const resource = Object.values(resourcesByChapter).flat().find((r) => String(r.id) === String(id));
      if (resource) setGestureResource(resource);
    };
    window.addEventListener("studyhub:longpress", onLongPress);
    return () => window.removeEventListener("studyhub:longpress", onLongPress);
  }, [resourcesByChapter]);

  async function toggleComplete(resourceId, e) {
    e.stopPropagation();
    if (!userId) return;
    const isDone = completedIds.has(resourceId);
    if (isDone) {
      await supabase.from("progress").delete().eq("user_id", userId).eq("resource_id", resourceId);
      setCompletedIds((prev) => { const next = new Set(prev); next.delete(resourceId); return next; });
    } else {
      await supabase.from("progress").insert({ user_id: userId, resource_id: resourceId });
      setCompletedIds((prev) => new Set(prev).add(resourceId));
    }
  }

  async function openResource(res) {
    if (resourceLoading) return;
    setResourceLoading(true);
    setIframeLoading(true);
    try {
      // Resolve Google Drive server-side and return only a short-lived proxy URL.
      const { data, error } = await supabase.functions.invoke("get-resource-access", {
        body: { resource_id: res.id },
      });
      if (error || !data?.url) {
        console.error("Resource access error:", error);
        setIframeLoading(false);
        return;
      }
      setActiveResource({ ...res, url: data.url, access: data.access, expires_at: data.expires_at });
      if (userId) {
        supabase.from("last_activity").upsert({
          user_id: userId,
          resource_id: res.id,
          opened_at: new Date().toISOString(),
        }).then(() => {});
      }
    } catch (error) {
      console.error("Resource access request failed:", error);
      setIframeLoading(false);
    } finally {
      setResourceLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 dark:bg-[#0e0e17]">Loading...</div>;
  if (!course) return <div className="min-h-screen flex items-center justify-center text-gray-400 dark:bg-[#0e0e17]">Course not found.</div>;

  const totalResources = Object.values(resourcesByChapter).flat().length;
  const donePct = totalResources > 0 ? Math.round((completedIds.size / totalResources) * 100) : 0;

  return (
    <div className="min-h-screen dark:bg-[#0e0e17]">
      <nav className="bg-white/80 dark:bg-[#1c1c2b]/80 backdrop-blur-md shadow-sm px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/" className="text-sm text-accent font-semibold">← Back</Link>
          <h1 className="text-lg font-extrabold text-ink dark:text-gray-100">{course.title}</h1>
        </div>
        {totalResources > 0 && <div className="progress-track h-2 w-full"><div className="progress-fill" style={{ width: `${donePct}%` }} /></div>}
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {chapters.length === 0 && <p className="text-gray-400 text-sm">No chapters published yet.</p>}
        {chapters.map((chapter) => (
          <div key={chapter.id} className="bg-white dark:bg-[#1c1c2b] rounded-3xl shadow-sm p-5">
            <h2 className="font-bold text-ink dark:text-gray-100 mb-3">{chapter.title}</h2>
            <div className="space-y-2">
              {(resourcesByChapter[chapter.id] || []).map((res) => {
                const done = completedIds.has(res.id);
                return (
                  <div key={res.id} data-gesture-resource={res.id} data-gesture-resource-title={res.title || ""} onClick={() => openResource(res)}
                    className={`w-full text-left flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm cursor-pointer transition ${done ? "bg-brand-gradient-soft border border-accent/30" : "border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#25253a]"}`}>
                    <button onClick={(e) => toggleComplete(res.id, e)} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${done ? "bg-brand-gradient text-white" : "border-2 dark:border-gray-500"}`}>{done ? "✓" : ""}</button>
                    <span className="text-xs uppercase tracking-wide text-accent font-bold w-14 shrink-0">{res.type === "live" ? "🔴 Live" : res.type}</span>
                    <span className="text-ink dark:text-gray-100">{res.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {quizzes.length > 0 && (
          <div className="bg-white dark:bg-[#1c1c2b] rounded-3xl shadow-sm p-5">
            <h2 className="font-bold text-ink dark:text-gray-100 mb-3">Quizzes</h2>
            <div className="space-y-2">
              {quizzes.map((q) => {
                const best = bestByQuiz[q.id];
                return <Link key={q.id} href={`/quiz/${q.id}`} className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#25253a] transition">
                  <span className="text-xs uppercase tracking-wide text-accent font-bold w-14 shrink-0">Quiz</span>
                  <span className="flex-1 text-ink dark:text-gray-100">{q.title}</span>
                  {q.status !== "published" && <span className="text-xs font-semibold text-amber-600 dark:text-amber-300 shrink-0">Draft</span>}
                  {best && <span className="text-xs font-semibold text-accent shrink-0">Best {best.score}/{best.total}</span>}
                </Link>;
              })}
            </div>
          </div>
        )}
      </main>

      {gestureResource && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4 z-[60]" onClick={() => setGestureResource(null)}>
          <div className="bg-white dark:bg-[#1c1c2b] rounded-3xl w-full max-w-md p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-ink dark:text-gray-100">Resource actions</h3>
              <button onClick={() => setGestureResource(null)} className="text-gray-400 text-sm">Close</button>
            </div>
            <p className="text-sm font-semibold text-ink dark:text-gray-100 mb-4">{gestureResource.title}</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { openResource(gestureResource); setGestureResource(null); }} className="rounded-2xl px-4 py-3 bg-brand-gradient text-white text-sm font-semibold">Open</button>
              <button onClick={(e) => { toggleComplete(gestureResource.id, e); setGestureResource(null); }} className="rounded-2xl px-4 py-3 border dark:border-gray-700 text-sm font-semibold">{completedIds.has(gestureResource.id) ? "Mark incomplete" : "Mark complete"}</button>
            </div>
          </div>
        </div>
      )}

      {activeResource && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setActiveResource(null)}>
          <div className="bg-white dark:bg-[#1c1c2b] rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 py-3 border-b dark:border-gray-700">
              <h3 className="font-bold text-ink dark:text-gray-100">{activeResource.title}</h3>
              <button onClick={() => setActiveResource(null)} className="text-gray-400 dark:text-gray-400 text-sm">Close</button>
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-[#0e0e17] relative">
              {isEmbeddable(activeResource.url) ? (
                <>
                  {iframeLoading && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-[#0e0e17]"><div className="w-10 h-10 rounded-full border-4 border-accent/20 border-t-accent animate-spin" /><p className="text-xs text-gray-400 dark:text-gray-500">Loading content...</p></div>}
                  <iframe src={toEmbedUrl(activeResource.url)} className="w-full h-[70vh]" allow="autoplay; fullscreen" allowFullScreen onLoad={() => setIframeLoading(false)} />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-[50vh] gap-4 px-6 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">This live stream can't be embedded directly. Open it on YouTube instead.</p>
                  <a href={activeResource.url} target="_blank" rel="noopener noreferrer" className="bg-brand-gradient text-white rounded-full px-5 py-2 text-sm font-semibold">Open Live Stream</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
