"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

export default function StudyPlanPage() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [goal, setGoal] = useState("Prepare for my next exams");
  const [personal, setPersonal] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function authFetch(path, options = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Please sign in again.");
    return fetch(path, { ...options, headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token, ...(options.headers || {}) } });
  }

  async function load() {
    const [{ data: courseData }] = await Promise.all([
      supabase.from("courses").select("id,title").eq("status", "published").order("title"),
    ]);
    setCourses(courseData || []);
    try {
      const response = await authFetch("/api/ai/personal" + (courseId ? "?courseId=" + encodeURIComponent(courseId) : ""));
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load study analytics.");
      setPersonal(payload);
      setPlans(payload.plans || []);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [courseId]);

  async function generate() {
    setGenerating(true); setError("");
    try {
      const response = await authFetch("/api/ai/personal", { method: "POST", body: JSON.stringify({ goal, courseId: courseId || undefined }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not generate plan.");
      setPersonal(payload.personal);
      setPlans((prev) => [payload.plan, ...prev.filter((p) => p.id !== payload.plan.id)]);
    } catch (err) { setError(err.message); } finally { setGenerating(false); }
  }

  if (loading) return <div className="min-h-screen app-shell flex items-center justify-center text-sm text-gray-500">Loading your study plan…</div>;

  return (
    <div className="min-h-screen app-shell">
      <header className="sticky top-0 z-30 border-b border-black/5 dark:border-white/5 bg-white/85 dark:bg-[#11111d]/85 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/ai" className="text-accent font-bold">← Student AI</Link>
          <div className="flex-1"><p className="font-black text-ink dark:text-white">Personal Learning</p><p className="text-[11px] text-gray-500">Adaptive study plan + analytics</p></div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        <section className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-3xl bg-white dark:bg-[#1c1c2b] p-5"><p className="text-xs text-gray-500">Course progress</p><p className="text-3xl font-black mt-1">{personal?.progress?.pct || 0}%</p><p className="text-xs text-gray-500">{personal?.progress?.completed || 0} / {personal?.progress?.total || 0} resources</p></div>
          <div className="rounded-3xl bg-white dark:bg-[#1c1c2b] p-5"><p className="text-xs text-gray-500">Study streak</p><p className="text-3xl font-black mt-1">🔥 {personal?.streak || 0}</p><p className="text-xs text-gray-500">consecutive active days</p></div>
          <div className="rounded-3xl bg-white dark:bg-[#1c1c2b] p-5"><p className="text-xs text-gray-500">Weakest quiz</p><p className="text-lg font-black mt-2 truncate">{personal?.quizPerformance?.[0]?.title || "No quiz data yet"}</p><p className="text-xs text-gray-500">{personal?.quizPerformance?.[0] ? personal.quizPerformance[0].best + "%" : "Take a quiz to personalize this."}</p></div>
        </section>
        <section className="rounded-3xl bg-white dark:bg-[#1c1c2b] p-5">
          <p className="section-label">ADAPTIVE PLAN</p><h1 className="text-2xl font-black text-ink dark:text-white mt-1">What are you trying to achieve?</h1>
          <div className="grid sm:grid-cols-[1fr_220px_auto] gap-2 mt-4">
            <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={500} className="search-box" placeholder="e.g. Finish semester revision" />
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="search-box"><option value="">All courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
            <button disabled={generating || goal.trim().length < 3} onClick={generate} className="compact-action bg-brand-gradient text-white border-0 disabled:opacity-40">{generating ? "Generating…" : "Create 7-day plan"}</button>
          </div>
          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </section>
        {plans.map((plan) => (
          <section key={plan.id} className="rounded-3xl bg-white dark:bg-[#1c1c2b] p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="section-label">7-DAY PLAN</p><h2 className="text-xl font-black text-ink dark:text-white">{plan.title}</h2><p className="text-xs text-gray-500 mt-1">{plan.goal}</p></div><span className="text-xs rounded-full px-3 py-1 bg-green-100 text-green-700">Active</span></div>
            <div className="grid md:grid-cols-2 gap-3 mt-5">{(plan.plan || []).map((day) => <article key={day.day} className="rounded-2xl border dark:border-white/10 p-4"><p className="text-xs font-black text-accent">DAY {day.day}</p><h3 className="font-extrabold text-ink dark:text-white mt-1">{day.focus || day.title}</h3><ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">{(day.tasks || []).map((task, i) => <li key={i}>• {task}</li>)}</ul></article>)}</div>
          </section>
        ))}
      </main>
    </div>
  );
}

