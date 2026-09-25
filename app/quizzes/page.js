"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function QuizCenter() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState([]);
  const [courses, setCourses] = useState({});
  const [attempts, setAttempts] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }

        const { data: quizData } = await supabase
          .from("quizzes")
          .select("id,title,description,course_id,status,created_at")
          .eq("status", "published")
          .order("created_at", { ascending: true });

        const list = quizData || [];
        if (!active) return;
        setQuizzes(list);

        const courseIds = [...new Set(list.map(q => q.course_id).filter(Boolean))];
        if (courseIds.length) {
          const { data: courseData } = await supabase
            .from("courses")
            .select("id,title,slug")
            .in("id", courseIds);
          const map = {};
          (courseData || []).forEach(c => { map[c.id] = c; });
          if (active) setCourses(map);
        }

        if (list.length) {
          const { data: attemptData } = await supabase
            .from("quiz_attempts")
            .select("quiz_id,score,total,completed_at")
            .eq("user_id", user.id)
            .in("quiz_id", list.map(q => q.id));

          const best = {};
          (attemptData || []).forEach(a => {
            const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
            best[a.quiz_id] = Math.max(best[a.quiz_id] || 0, pct);
          });
          if (active) setAttempts(best);
        }
      } catch (e) {
        console.error("Quiz Center load failed:", e);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [router]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quizzes.filter(q => {
      const course = courses[q.course_id];
      return !term || q.title.toLowerCase().includes(term) || course?.title?.toLowerCase().includes(term);
    });
  }, [quizzes, courses, search]);

  const attempted = Object.keys(attempts).length;
  const best = attempted ? Math.max(...Object.values(attempts)) : 0;

  if (loading) return <div className="min-h-screen app-shell flex items-center justify-center text-gray-500">Loading Quiz Center…</div>;

  return (
    <div className="min-h-screen app-shell pb-20">
      <header className="sticky top-0 z-30 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-[#11111d]/85 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-500 text-xl">←</Link>
          <div className="flex-1">
            <p className="section-label">PRACTICE ZONE</p>
            <h1 className="text-xl font-black text-ink dark:text-white">Quiz Center</h1>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">{quizzes.length} quizzes</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <section className="quiz-promo mb-6">
          <div>
            <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Test your knowledge</p>
            <h2 className="text-2xl font-black text-white mt-1">Practice. Learn. Improve.</h2>
            <p className="text-white/70 text-sm mt-1">Your best score is tracked automatically.</p>
          </div>
          <div className="text-right mt-4 sm:mt-0">
            <div className="text-3xl font-black text-white">{best}%</div>
            <div className="text-xs text-white/60">best score</div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="stat-card"><span className="stat-icon">📝</span><strong>{attempted}/{quizzes.length}</strong><span>Attempted</span></div>
          <div className="stat-card"><span className="stat-icon">🎯</span><strong>{Math.max(0, quizzes.length - attempted)}</strong><span>Remaining</span></div>
        </div>

        <div className="relative mb-5">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quizzes or subjects…" className="search-box pl-10" />
        </div>

        <div className="space-y-3">
          {filtered.map((quiz, i) => {
            const course = courses[quiz.course_id];
            const score = attempts[quiz.id];
            return (
              <Link key={quiz.id} href={`/quiz/${quiz.id}`} className="quiz-list-card course-card flex items-center gap-4 group">
                <div className="continue-icon flex-shrink-0 text-lg">🧠</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-accent mb-1">{course?.title || "Study Hub"}</p>
                  <h3 className="font-extrabold text-base text-ink dark:text-white leading-snug">{quiz.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{score !== undefined ? `Best score: ${score}%` : "Not attempted yet"}</p>
                </div>
                <span className="text-accent font-black group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            );
          })}
          {!filtered.length && <div className="empty-card">No quizzes match your search.</div>}
        </div>
      </main>
    </div>
  );
}
