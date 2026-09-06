"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function AdminPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");

  const [courseForm, setCourseForm] = useState({ title: "", slug: "", description: "", keywords: "" });
  const [chapterForm, setChapterForm] = useState({ title: "", position: 1 });
  const [resourceForm, setResourceForm] = useState({ title: "", type: "video", url: "", position: 1 });
  const [message, setMessage] = useState("");

  async function loadCourses() {
    const { data } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
    setCourses(data || []);
  }

  async function loadChapters(courseId) {
    const { data } = await supabase
      .from("chapters")
      .select("*")
      .eq("course_id", courseId)
      .order("position", { ascending: true });
    setChapters(data || []);
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (profileData?.role !== "admin") {
        router.push("/");
        return;
      }
      setProfile(profileData);
      await loadCourses();
      setLoading(false);
    }
    init();
  }, [router]);

  async function handleCreateCourse(e) {
    e.preventDefault();
    setMessage("");
    const cleanSlug = courseForm.slug.trim().toLowerCase().replace(/\s+/g, "-");
    const { error } = await supabase.from("courses").insert({
      title: courseForm.title.trim(),
      slug: cleanSlug,
      description: courseForm.description.trim(),
      status: "published"
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Course created 🎉");
      setCourseForm({ title: "", slug: "", description: "" });
      loadCourses();
    }
  }

  async function handleCreateChapter(e) {
    e.preventDefault();
    setMessage("");
    if (!selectedCourse) return setMessage("Select a course first.");
    const { error } = await supabase.from("chapters").insert({
      course_id: selectedCourse,
      title: chapterForm.title,
      position: Number(chapterForm.position),
      status: "published"
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Chapter created 🎉");
      setChapterForm({ title: "", position: 1 });
      loadChapters(selectedCourse);
    }
  }

  async function handleCreateResource(e) {
    e.preventDefault();
    setMessage("");
    if (!selectedChapter) return setMessage("Select a chapter first.");
    const { error } = await supabase.from("resources").insert({
      chapter_id: selectedChapter,
      title: resourceForm.title,
      type: resourceForm.type,
      url: resourceForm.url,
      position: Number(resourceForm.position),
      status: "published"
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Resource added 🎉");
      setResourceForm({ title: "", type: "video", url: "", position: 1 });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 dark:bg-[#0e0e17]">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen dark:bg-[#0e0e17]">
      <nav className="bg-white/80 dark:bg-[#1c1c2b]/80 backdrop-blur-md shadow-sm px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/" className="text-sm text-accent font-semibold">
          ← Back
        </Link>
        <h1 className="text-lg font-extrabold text-ink dark:text-gray-100">Admin</h1>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {message && (
          <p className="text-sm font-semibold text-accent bg-brand-gradient-soft p-3 rounded-2xl">
            {message}
          </p>
        )}

        <section className="bg-white dark:bg-[#1c1c2b] rounded-3xl shadow-sm p-5">
          <h2 className="font-bold text-ink dark:text-gray-100 mb-3">New Course</h2>
          <form onSubmit={handleCreateCourse} className="space-y-3">
            <input
              placeholder="Title"
              value={courseForm.title}
              onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
              className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm"
              required
            />
            <input
              placeholder="Slug (e.g. calculus-101, hyphens not spaces)"
              value={courseForm.slug}
              onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })}
              className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm"
              required
            />
            <textarea
              placeholder="Description"
              value={courseForm.description}
              onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
              className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm"
            />
            <button className="bg-brand-gradient text-white rounded-2xl px-4 py-2.5 text-sm font-bold shadow-lg shadow-accent/30">
              Create Course
            </button>
          </form>
        </section>

        <section className="bg-white dark:bg-[#1c1c2b] rounded-3xl shadow-sm p-5">
          <h2 className="font-bold text-ink dark:text-gray-100 mb-3">New Chapter</h2>
          <select
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              loadChapters(e.target.value);
            }}
            className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm mb-3"
          >
            <option value="">Select course...</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <form onSubmit={handleCreateChapter} className="space-y-3">
            <input
              placeholder="Chapter title"
              value={chapterForm.title}
              onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
              className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm"
              required
            />
            <input
              type="number"
              placeholder="Position"
              value={chapterForm.position}
              onChange={(e) => setChapterForm({ ...chapterForm, position: e.target.value })}
              className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm"
            />
            <button className="bg-brand-gradient text-white rounded-2xl px-4 py-2.5 text-sm font-bold shadow-lg shadow-accent/30">
              Create Chapter
            </button>
          </form>
        </section>

        <section className="bg-white dark:bg-[#1c1c2b] rounded-3xl shadow-sm p-5">
          <h2 className="font-bold text-ink dark:text-gray-100 mb-3">New Resource</h2>
          <select
            value={selectedChapter}
            onChange={(e) => setSelectedChapter(e.target.value)}
            className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm mb-3"
          >
            <option value="">Select chapter...</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <form onSubmit={handleCreateResource} className="space-y-3">
            <input
              placeholder="Resource title"
              value={resourceForm.title}
              onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
              className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm"
              required
            />
            <select
              value={resourceForm.type}
              onChange={(e) => setResourceForm({ ...resourceForm, type: e.target.value })}
              className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm"
            >
              <option value="video">Video</option>
              <option value="live">Live Stream</option>
              <option value="notes">Notes</option>
              <option value="link">Link</option>
              <option value="book">Book</option>
              <option value="quiz">Quiz</option>
            </select>
            <input
              placeholder="URL (YouTube/Vimeo/Drive/PDF link)"
              value={resourceForm.url}
              onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })}
              className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm"
              required
            />
            <input
              type="number"
              placeholder="Position"
              value={resourceForm.position}
              onChange={(e) => setResourceForm({ ...resourceForm, position: e.target.value })}
              className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm"
            />
            <button className="bg-brand-gradient text-white rounded-2xl px-4 py-2.5 text-sm font-bold shadow-lg shadow-accent/30">
              Add Resource
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
