"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function HomePage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [progressByCourse, setProgressByCourse] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [continueItem, setContinueItem] = useState(null);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);
  }, []);

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(profileData);

      const { data: courseData } = await supabase
        .from("courses")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      setCourses(courseData || []);

      if (courseData && courseData.length > 0) {
        const courseIds = courseData.map((c) => c.id);

        const { data: chapterData } = await supabase
          .from("chapters")
          .select("id, course_id")
          .in("course_id", courseIds)
          .eq("status", "published");

        const chapterIds = (chapterData || []).map((c) => c.id);
        const chapterToCourse = {};
        (chapterData || []).forEach((c) => (chapterToCourse[c.id] = c.course_id));

        let resourceData = [];
        if (chapterIds.length > 0) {
          const { data } = await supabase
            .from("resources")
            .select("id, chapter_id, title")
            .in("chapter_id", chapterIds)
            .eq("status", "published");
          resourceData = data || [];
        }

        const totalByCourse = {};
        const resourceToCourse = {};
        const resourceLookup = {};
        resourceData.forEach((r) => {
          const courseId = chapterToCourse[r.chapter_id];
          totalByCourse[courseId] = (totalByCourse[courseId] || 0) + 1;
          resourceToCourse[r.id] = courseId;
          resourceLookup[r.id] = r;
        });

        const { data: progressData } = await supabase
          .from("progress")
          .select("resource_id")
          .eq("user_id", user.id);

        const doneByCourse = {};
        (progressData || []).forEach((p) => {
          const courseId = resourceToCourse[p.resource_id];
          if (courseId) doneByCourse[courseId] = (doneByCourse[courseId] || 0) + 1;
        });

        const merged = {};
        courseData.forEach((c) => {
          const total = totalByCourse[c.id] || 0;
          const done = doneByCourse[c.id] || 0;
          merged[c.id] = { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
        });
        setProgressByCourse(merged);

        const { data: lastActivity } = await supabase
          .from("last_activity")
          .select("resource_id, opened_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (lastActivity && resourceLookup[lastActivity.resource_id]) {
          const res = resourceLookup[lastActivity.resource_id];
          const courseId = resourceToCourse[res.id];
          const course = courseData.find((c) => c.id === courseId);
          if (course) {
            setContinueItem({
              resourceTitle: res.title,
              courseTitle: course.title,
              courseSlug: course.slug
            });
          }
        }
      }

      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 dark:bg-[#0e0e17]">
        Loading...
      </div>
    );
  }

  const filteredCourses = courses.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.title.toLowerCase().includes(term) ||
      (c.keywords && c.keywords.toLowerCase().includes(term))
    );
  });

  return (
    <div className="min-h-screen dark:bg-[#0e0e17]">
      <nav className="bg-white/80 dark:bg-[#1c1c2b]/80 backdrop-blur-md shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-extrabold bg-brand-gradient bg-clip-text text-transparent">
          Study Hub ✨
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleDarkMode}
            className="text-sm text-gray-500 dark:text-gray-300 border dark:border-gray-600 rounded-full px-3 py-1"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
          {profile?.role === "admin" && (
            <Link
              href="/admin"
              className="text-sm bg-brand-gradient text-white font-semibold rounded-full px-4 py-1.5"
            >
              Admin
            </Link>
          )}
          <button onClick={handleSignOut} className="text-sm text-gray-500 dark:text-gray-300">
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {profile?.full_name && (
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-ink dark:text-gray-100">
              Hey, {profile.full_name.split(" ")[0]} 👋
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Let's keep the streak going.</p>
          </div>
        )}

        {continueItem && (
          <Link
            href={`/courses/${continueItem.courseSlug}`}
            className="block bg-brand-gradient rounded-3xl p-5 mb-6 text-white shadow-lg shadow-accent/30"
          >
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-1">
              Continue where you left off
            </p>
            <p className="font-bold">{continueItem.resourceTitle}</p>
            <p className="text-sm opacity-90">{continueItem.courseTitle}</p>
          </Link>
        )}

        <div className="relative mb-5">
          <input
            type="text"
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border dark:border-gray-600 dark:bg-[#1c1c2b] dark:text-gray-100 rounded-full px-5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
            >
              ✕
            </button>
          )}
        </div>

        <h2 className="text-lg font-bold text-ink dark:text-gray-100 mb-4">Your Courses</h2>
        {filteredCourses.length === 0 ? (
          <p className="text-gray-400 text-sm">
            {searchTerm ? `No courses match "${searchTerm}"` : "No courses published yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filteredCourses.map((course) => {
              const prog = progressByCourse[course.id] || { total: 0, done: 0, pct: 0 };
              return (
                <Link
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  className="aspect-square flex flex-col justify-between bg-white dark:bg-[#1c1c2b] rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all p-4 border border-transparent hover:border-accent/30"
                >
                  <div className="flex-1 flex items-center justify-center text-center">
                    <h3 className="font-bold text-ink dark:text-gray-100 text-sm leading-snug line-clamp-4">
                      {course.title}
                    </h3>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      <span>{prog.pct}%</span>
                      <span>
                        {prog.done}/{prog.total}
                      </span>
                    </div>
                    <div className="progress-track h-1.5 w-full">
                      <div className="progress-fill" style={{ width: `${prog.pct}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
