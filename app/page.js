"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";

const quickActions = [
  { href: "#courses", icon: "📚", label: "Courses", tone: "violet" },
  { href: "/study-tools", icon: "★", label: "Study Tools", tone: "violet" },
  { href: "/quizzes", icon: "🧠", label: "Quiz Center", tone: "pink" },
  { href: "#progress", icon: "📈", label: "Progress", tone: "blue" },
  { href: "#recent", icon: "🕘", label: "Recent", tone: "amber" },
];

export default function HomePage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [progressByCourse, setProgressByCourse] = useState({});
  const [resourceCountByCourse, setResourceCountByCourse] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [semester, setSemester] = useState("1");
  const [branch, setBranch] = useState("ALL");
  const [continueItem, setContinueItem] = useState(null);
  const [quizSummary, setQuizSummary] = useState({ total: 0, attempted: 0, best: 0 });
  const [recentItems, setRecentItems] = useState([]);
  const [searchIndexByCourse, setSearchIndexByCourse] = useState({});

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const [{ data: profileData }, { data: courseData }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase.from("courses").select("*").eq("status", "published").order("created_at", { ascending: false }),
        ]);

        if (!active) return;
        setProfile(profileData);
        const publishedCourses = courseData || [];
        setCourses(publishedCourses);

        if (!publishedCourses.length) return;

        const courseIds = publishedCourses.map((c) => c.id);
        const { data: chapterData } = await supabase
          .from("chapters").select("id, course_id, title, position").in("course_id", courseIds).eq("status", "published").order("position");

        const chapters = chapterData || [];
        const chapterIds = chapters.map((c) => c.id);
        const chapterToCourse = Object.fromEntries(chapters.map((c) => [c.id, c.course_id]));
        const chapterToTitle = Object.fromEntries(chapters.map((c) => [c.id, c.title]));
        const nextSearchIndexByCourse = {};

        let resources = [];
        if (chapterIds.length) {
          const { data } = await supabase
            .from("resources").select("id, chapter_id, title, type").in("chapter_id", chapterIds).eq("status", "published");
          resources = data || [];
        }

        const resourceToCourse = {};
        const resourceLookup = {};
        const totalByCourse = {};
        resources.forEach((r) => {
          const courseId = chapterToCourse[r.chapter_id];
          resourceToCourse[r.id] = courseId;
          resourceLookup[r.id] = { ...r, chapterTitle: chapterToTitle[r.chapter_id] || "" };
          const chapterTitle = chapterToTitle[r.chapter_id] || "";
          nextSearchIndexByCourse[courseId] = [
            ...(nextSearchIndexByCourse[courseId] ? [nextSearchIndexByCourse[courseId]] : []),
            chapterTitle,
            r.title || "",
            r.type || "",
          ].join(" ");
          totalByCourse[courseId] = (totalByCourse[courseId] || 0) + 1;
        });

        if (active) {
          setSearchIndexByCourse(nextSearchIndexByCourse);
          setResourceCountByCourse(totalByCourse);
        }

        const [{ data: progressData }, { data: lastActivityData }] = await Promise.all([
          supabase.from("progress").select("resource_id").eq("user_id", user.id),
          supabase.from("last_activity")
            .select("resource_id, opened_at").eq("user_id", user.id)
            .order("opened_at", { ascending: false }).limit(5),
        ]);

        const doneByCourse = {};
        (progressData || []).forEach((p) => {
          const courseId = resourceToCourse[p.resource_id];
          if (courseId) doneByCourse[courseId] = (doneByCourse[courseId] || 0) + 1;
        });

        const merged = {};
        publishedCourses.forEach((c) => {
          const total = totalByCourse[c.id] || 0;
          const done = doneByCourse[c.id] || 0;
          merged[c.id] = { total, done, pct: total ? Math.min(100, Math.round((done / total) * 100)) : 0 };
        });
        if (active) setProgressByCourse(merged);

        const recent = (lastActivityData || []).map((item) => {
          const resource = resourceLookup[item.resource_id];
          if (!resource) return null;
          const course = publishedCourses.find((c) => c.id === resourceToCourse[resource.id]);
          if (!course) return null;
          return { ...resource, courseTitle: course.title, courseSlug: course.slug, openedAt: item.opened_at };
        }).filter(Boolean);

        if (active) {
          setRecentItems(recent);
          if (recent[0]) setContinueItem(recent[0]);
        }

        const { data: quizzes } = await supabase
          .from("quizzes").select("id, title, course_id").eq("status", "published");

        const quizList = quizzes || [];
        if (quizList.length) {
          const quizIds = quizList.map((q) => q.id);
          const { data: attempts } = await supabase
            .from("quiz_attempts").select("quiz_id, score, total, completed_at")
            .eq("user_id", user.id).in("quiz_id", quizIds).order("completed_at", { ascending: false });

          const bestByQuiz = {};
          (attempts || []).forEach((a) => {
            const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
            bestByQuiz[a.quiz_id] = Math.max(bestByQuiz[a.quiz_id] || 0, pct);
          });
          const bestScores = Object.values(bestByQuiz);
          if (active) setQuizSummary({
            total: quizList.length,
            attempted: bestScores.length,
            best: bestScores.length ? Math.max(...bestScores) : 0,
          });
        }
      } catch (error) {
        console.error("Study Hub dashboard load failed:", error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  useEffect(() => {
    const savedSemester = localStorage.getItem("studyhub_semester");
    const savedBranch = localStorage.getItem("studyhub_branch");
    if (savedSemester) setSemester(savedSemester);
    if (savedBranch) setBranch(savedBranch);
  }, []);
  useEffect(() => { localStorage.setItem("studyhub_semester", semester); }, [semester]);
  useEffect(() => { localStorage.setItem("studyhub_branch", branch); }, [branch]);

  const filteredCourses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesAcademic = String(course.semester || "") === semester && (course.branch === "ALL" || course.branch === branch);
      const matchesSearch = !term ||
        course.title?.toLowerCase().includes(term) ||
        course.keywords?.toLowerCase().includes(term) ||
        searchIndexByCourse[course.id]?.toLowerCase().includes(term);
      const progress = progressByCourse[course.id]?.pct || 0;
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && progress > 0 && progress < 100) ||
        (filter === "completed" && progress >= 100);
      return matchesAcademic && matchesSearch && matchesFilter;
    });
  }, [courses, progressByCourse, searchTerm, filter]);

  const overallProgress = useMemo(() => {
    const values = Object.values(progressByCourse);
    if (!values.length) return 0;
    const total = values.reduce((sum, p) => sum + p.total, 0);
    const done = values.reduce((sum, p) => sum + p.done, 0);
    return total ? Math.round((done / total) * 100) : 0;
  }, [progressByCourse]);

  if (loading) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center">
        <div className="text-center">
          <div className="brand-orb mx-auto mb-4">S</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Preparing your study space…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-shell pb-24">
      <nav className="sticky top-0 z-30 border-b border-black/5 dark:border-white/5 bg-white/75 dark:bg-[#11111d]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="brand-orb brand-orb-sm">S</span>
            <div>
              <h1 className="text-base font-black tracking-tight text-ink dark:text-white">Study Hub</h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 -mt-0.5">Your learning space</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <div className="desktop-links"><a href="#courses">Courses</a><Link href="/quizzes">Quizzes</Link><Link href="/study-tools">Study tools</Link></div>
            <Link href="/help" className="compact-action hidden sm:inline-flex">Help</Link>
            <button onClick={toggleDarkMode} className="icon-button" aria-label="Toggle theme">{darkMode ? "☀️" : "🌙"}</button>
            {profile?.role === "admin" && <Link href="/admin" className="hidden sm:inline-flex compact-action">Admin</Link>}
            <button onClick={handleSignOut} className="compact-action hidden sm:inline-flex">Sign out</button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <section className="dashboard-hero mb-6">
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70 mb-2">Your learning dashboard</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Make today count, {profile?.full_name?.split(" ")[0] || "Learner"}.
            </h2>
            <p className="text-sm sm:text-base text-white/75 mt-2 max-w-xl">
              A focused place for your lectures, notes, quizzes, and progress. Choose a subject and keep moving.
            </p>
            <div className="flex flex-wrap gap-2 mt-5">
              <Link href="/quizzes" className="hero-button">🧠 Take a quiz</Link>
              <a href="#courses" className="hero-button hero-button-muted">📚 Browse courses</a>
            </div>
          </div>
          <div className="hero-progress">
            <div className="text-4xl font-black text-white">{overallProgress}%</div>
            <div className="text-xs text-white/70 mt-1">overall progress</div>
            <div className="progress-track bg-white/15 h-2 mt-4">
              <div className="progress-fill" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>
        </section>

        {continueItem && (
          <section className="mb-7">
            <div className="section-label">CONTINUE LEARNING</div>
            <Link href={"/courses/" + continueItem.courseSlug} className="continue-card group">
              <div className="continue-icon">▶</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-accent uppercase tracking-wide mb-1">Resume</p>
                <h3 className="font-extrabold text-lg truncate text-ink dark:text-white">{continueItem.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{continueItem.courseTitle}</p>
              </div>
              <span className="resume-arrow group-hover:translate-x-1">→</span>
            </Link>
          </section>
        )}

        <section className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          {quickActions.map((item) => (
            <Link key={item.label} href={item.href} className="quick-card">
              <span className={"quick-icon quick-" + item.tone}>{item.icon}</span>
              <span className="text-xs sm:text-sm font-bold text-ink dark:text-gray-100">{item.label}</span>
            </Link>
          ))}
        </section>

        <section id="progress" className="grid grid-cols-3 gap-3 mb-8">
          <div className="stat-card"><span className="stat-icon">📚</span><strong>{courses.length}</strong><span>Courses</span></div>
          <div className="stat-card"><span className="stat-icon">🧠</span><strong>{quizSummary.attempted}/{quizSummary.total}</strong><span>Quizzes done</span></div>
          <div className="stat-card"><span className="stat-icon">🏆</span><strong>{quizSummary.best}%</strong><span>Best score</span></div>
        </section>

        <section id="courses" className="scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
            <div>
              <div className="section-label">YOUR LIBRARY</div>
              <h2 className="text-2xl font-black text-ink dark:text-white">Courses</h2>
            </div>
            <div className="relative sm:w-72">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
              <input type="text" placeholder="Search courses, chapters, or resources…" value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} className="search-box pl-10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
              <select value={semester} onChange={(e) => setSemester(e.target.value)} className="search-box">
                {Array.from({ length: 8 }, (_, i) => <option key={i + 1} value={String(i + 1)}>Semester {i + 1}</option>)}
              </select>
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className="search-box">
                <option value="ALL">All branches</option>
                <option value="CSE">CSE</option>
                <option value="AIML">AIML</option>
                <option value="CIVIL">Civil</option>
                <option value="EEE">Electrical</option>
                <option value="ME">Mechanical</option>
                <option value="ECE">ECE</option>
              </select>
            </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
            {[["all", "All"], ["active", "In progress"], ["completed", "Completed"]].map(([value, label]) => (
              <button key={value} onClick={() => setFilter(value)}
                className={"filter-chip " + (filter === value ? "filter-chip-active" : "")}>{label}</button>
            ))}
          </div>

          {filteredCourses.length === 0 ? (
            <div className="empty-card">
              <div className="text-3xl mb-2">🔎</div>
              <p className="font-bold text-ink dark:text-white">No matching courses</p>
              <p className="text-sm text-gray-500 mt-1">Try another search or filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCourses.map((course, index) => {
                const prog = progressByCourse[course.id] || { total: 0, done: 0, pct: 0 };
                return (
                  <Link key={course.id} href={"/courses/" + course.slug} className="course-card course-card-modern group">
                    <div className={"course-visual subject-" + (index % 6)}>
                      <div className="course-brand">
                        <span className="course-brand-mark">S</span>
                        <span>Study Hub</span>
                      </div>
                      <span className="course-semester">{course.semester ? `Semester ${course.semester}` : "Course"}</span>
                      <div className="course-illustration" aria-hidden="true">
                        <span className="course-symbol">{index % 6 === 0 ? "∑" : index % 6 === 1 ? "⚡" : index % 6 === 2 ? "⌬" : index % 6 === 3 ? "AI" : index % 6 === 4 ? "⚙" : "⌁"}</span>
                        <span className="course-orbit">✦</span>
                        <span className="course-grid">⌁</span>
                      </div>
                    </div>
                    <div className="course-card-body">
                      <div className="course-card-top">
                        <span className="course-number">{String(index + 1).padStart(2, "0")}</span>
                        {prog.pct >= 100 ? <span className="complete-pill">✓ Complete</span> :
                          prog.pct > 0 ? <span className="live-pill">In progress</span> :
                          <span className="new-pill">Start learning</span>}
                      </div>
                      <h3 className="course-title">{course.title}</h3>
                      <p className="course-description">Build your understanding with lectures, notes, resources and practice material.</p>
                      <div className="course-meta">
                        <span>📚 {resourceCountByCourse[course.id] ?? 0} resources</span>
                        <span>📈 {prog.pct}% complete</span>
                      </div>
                      <div className="mt-3">
                        <div className="progress-track h-2"><div className="progress-fill" style={{ width: `${prog.pct}%` }} /></div>
                      </div>
                      <div className="course-cta">
                        <span>{prog.pct ? "Continue learning" : "Start learning"}</span>
                        <span className="course-arrow group-hover:translate-x-1">→</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {recentItems.length > 0 && (
          <section id="recent" className="mt-10 scroll-mt-24">
            <div className="section-label">RECENTLY OPENED</div>
            <div className="space-y-2">
              {recentItems.slice(0, 4).map((item) => (
                <Link key={item.id + "-" + item.openedAt} href={"/courses/" + item.courseSlug} className="recent-row">
                  <span className="recent-dot">↗</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-sm text-ink dark:text-gray-100 truncate">{item.title}</span>
                    <span className="block text-xs text-gray-500 truncate">{item.courseTitle}</span>
                  </span>
                  <span className="text-gray-400">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10 quiz-promo">
          <div>
            <div className="text-2xl mb-2">🧠</div>
            <h2 className="text-xl font-black text-white">Practice before the exam</h2>
            <p className="text-sm text-white/70 mt-1">Jump into quizzes and track your best scores.</p>
          </div>
          <Link href="/quizzes" className="hero-button mt-4 sm:mt-0">Open Quiz Center →</Link>
        </section>
      </main>

      <nav className="mobile-bottom-nav">
        <Link href="/" className="mobile-nav-active"><span>⌂</span><small>Home</small></Link>
        <a href="#courses"><span>📚</span><small>Courses</small></a>
        <Link href="/quizzes"><span>🧠</span><small>Quizzes</small></Link>
        <Link href="/study-tools"><span>★</span><small>Tools</small></Link>
        <Link href="/help"><span>?</span><small>Help</small></Link>
      </nav>
    </div>
  );
}
