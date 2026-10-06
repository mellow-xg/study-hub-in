"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const MODES = [
  ["Explain", "Explain a concept simply", "explain"],
  ["Teach me", "Teach this step by step", "teach"],
  ["Summarize", "Summarize the topic", "summarize"],
  ["Quiz me", "Quiz me on this topic", "quiz"],
  ["Step-by-step", "Work through it step by step", "step-by-step"],
  ["Exam mode", "Give exam-focused help", "exam"],
  ["Flashcards", "Make revision flashcards", "flashcards"],
];

function renderContent(content) {
  return String(content || "").split("\n").map((line, i) => {
    const key = String(i) + "-" + line.slice(0, 12);
    if (line.startsWith("### ")) return <h3 key={key} className="font-bold mt-3 mb-1">{line.slice(4)}</h3>;
    if (line.startsWith("## ")) return <h2 key={key} className="font-extrabold text-lg mt-3 mb-1">{line.slice(3)}</h2>;
    if (line.startsWith("# ")) return <h2 key={key} className="font-black text-xl mt-3 mb-1">{line.slice(2)}</h2>;
    if (/^[-*] /.test(line)) return <div key={key} className="flex gap-2"><span>•</span><span>{line.slice(2)}</span></div>;
    if (!line.trim()) return <div key={key} className="h-2" />;
    return <p key={key}>{line}</p>;
  });
}

export default function StudentAIPage() {
  const router = useRouter();
  const bottomRef = useRef(null);
  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [activeMode, setActiveMode] = useState("chat");
  const [flashcards, setFlashcards] = useState([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const selectedCourse = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId]);

  async function loadConversations(userId) {
    const { data } = await supabase.from("ai_conversations").select("id, course_id, title, created_at, updated_at")
      .eq("user_id", userId).order("updated_at", { ascending: false }).limit(50);
    setConversations(data || []);
  }

  async function loadConversation(id) {
    setError("");
    setConversationId(id);
    const { data, error: readError } = await supabase.from("ai_messages").select("id, role, content, created_at")
      .eq("conversation_id", id).order("created_at", { ascending: true });
    if (readError) { setError("Could not load that conversation."); return; }
    const conversation = conversations.find((item) => item.id === id);
    setCourseId(conversation?.course_id || "");
    setMessages(data || []);
  }

  function startNew() {
    setConversationId(null);
    setMessages([]);
    setInput("");
    setError("");
  }

  useEffect(() => {
    let active = true;
    async function init() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) { router.replace("/login"); return; }
      if (!active) return;
      setUser(currentUser);
      const [{ data: courseData }, { data: conversationData }] = await Promise.all([
        supabase.from("courses").select("id,title,slug,semester,branch").eq("status", "published").order("title"),
        supabase.from("ai_conversations").select("id,course_id,title,created_at,updated_at")
          .eq("user_id", currentUser.id).order("updated_at", { ascending: false }).limit(50),
      ]);
      if (!active) return;
      setCourses(courseData || []);
      setConversations(conversationData || []);
      if (conversationData?.[0]) {
        setConversationId(conversationData[0].id);
        setCourseId(conversationData[0].course_id || "");
        const { data: messageData } = await supabase.from("ai_messages").select("id,role,content,created_at")
          .eq("conversation_id", conversationData[0].id).order("created_at", { ascending: true });
        if (active) setMessages(messageData || []);
      }
      setLoading(false);
    }
    init();
    return () => { active = false; };
  }, [router]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  async function sendMessage(text = input, selectedMode = activeMode) {
    const message = text.trim();
    if (!message || sending) return;
    setError(""); setSending(true); setInput("");
    const optimisticId = "local-" + Date.now();
    setMessages((prev) => [...prev, { id: optimisticId, role: "user", content: message, created_at: new Date().toISOString() }]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session expired. Please sign in again.");
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token },
        body: JSON.stringify({ message, conversationId: conversationId || undefined, courseId: courseId || undefined, mode: selectedMode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Student AI could not answer.");
      if (!conversationId) setConversationId(payload.conversationId);
      const assistantContent = payload.message.content;
      if (selectedMode === "flashcards") {
        const cards = [];
        const matches = assistantContent.match(/Q:\s*(.+)\nA:\s*([\\s\\S]*?)(?=\nQ:|$)/g) || [];
        matches.forEach((block) => {
          const m = block.match(/Q:\s*(.+)\nA:\s*([\\s\\S]*)/);
          if (m) cards.push({ question: m[1].trim(), answer: m[2].trim() });
        });
        if (cards.length) { setFlashcards(cards); setFlashcardIndex(0); }
      }
      setMessages((prev) => [...prev, { id: "assistant-" + Date.now(), role: "assistant", content: assistantContent, created_at: new Date().toISOString(), mode: selectedMode }]);
      await loadConversations(user.id);
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.id !== optimisticId));
      setError(err.message || "Something went wrong.");
    } finally { setSending(false); }
  }

  async function copyMessage(message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {}
  }

  async function deleteConversation(id) {
    if (!confirm("Delete this AI conversation?")) return;
    await supabase.from("ai_conversations").delete().eq("id", id).eq("user_id", user.id);
    const remaining = conversations.filter((item) => item.id !== id);
    setConversations(remaining);
    if (conversationId === id) {
      if (remaining[0]) await loadConversation(remaining[0].id);
      else startNew();
    }
  }

  if (loading) return <div className="min-h-screen app-shell flex items-center justify-center"><div className="text-sm text-gray-500">Loading Student AI…</div></div>;

  return (
    <div className="min-h-screen app-shell">
      <header className="sticky top-0 z-30 border-b border-black/5 dark:border-white/5 bg-white/85 dark:bg-[#11111d]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-accent font-bold">←</Link>
          <div className="min-w-0 flex-1">
            <p className="font-black text-ink dark:text-white">Student AI</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{selectedCourse ? "Studying: " + selectedCourse.title : "Your study assistant"}</p>
          </div>
          <button onClick={startNew} className="compact-action">＋ New chat</button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-3 sm:px-5 py-4">
        <div className="grid lg:grid-cols-[250px_minmax(0,1fr)] gap-4">
          <aside className="hidden lg:block bg-white dark:bg-[#1c1c2b] rounded-3xl p-3 shadow-sm h-[calc(100vh-110px)] sticky top-[90px] overflow-y-auto">
            <div className="flex items-center justify-between px-2 mb-2"><span className="section-label">CONVERSATIONS</span><button onClick={startNew} className="text-xs text-accent font-bold">New</button></div>
            <div className="space-y-1">
              {conversations.map((item) => (
                <div key={item.id} className={"group rounded-2xl " + (conversationId === item.id ? "bg-brand-gradient-soft" : "")}>
                  <button onClick={() => loadConversation(item.id)} className="w-full text-left px-3 py-2.5">
                    <p className="text-sm font-bold text-ink dark:text-gray-100 truncate">{item.title}</p>
                    <p className="text-[10px] text-gray-500 truncate">{item.course_id ? (courses.find(c => c.id === item.course_id)?.title || "Course") : "General"}</p>
                  </button>
                  <button onClick={() => deleteConversation(item.id)} className="hidden group-hover:block text-[10px] text-red-500 px-3 pb-2">Delete</button>
                </div>
              ))}
              {!conversations.length && <p className="px-2 text-xs text-gray-500">Your chats will appear here.</p>}
            </div>
          </aside>
          <section className="bg-white dark:bg-[#1c1c2b] rounded-3xl shadow-sm overflow-hidden min-h-[calc(100vh-110px)] flex flex-col">
            <div className="p-4 border-b dark:border-white/10">
              <select value={courseId} onChange={(e) => { setCourseId(e.target.value); if (conversationId) startNew(); }} className="search-box w-full">
                <option value="">General Study Hub</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
              <div className="flex gap-2 overflow-x-auto mt-3 no-scrollbar">
                {MODES.map(([label, prompt]) => (
                  <button key={label} onClick={() => setInput(prompt + (selectedCourse ? " for " + selectedCourse.title : ""))} className="filter-chip whitespace-nowrap">{label}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {!messages.length && (
                <div className="max-w-2xl mx-auto py-12 text-center">
                  <div className="mx-auto mb-4 w-16 h-16 rounded-3xl bg-brand-gradient flex items-center justify-center text-3xl">✦</div>
                  <h1 className="text-2xl font-black text-ink dark:text-white">How can I help you study?</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Ask for an explanation, summary, example, practice question, or step-by-step help.</p>
                  <div className="grid sm:grid-cols-2 gap-2 mt-6 text-left">
                    {["Explain this topic simply", "Give me a step-by-step example", "Summarize what I should revise", "Quiz me on this subject"].map((prompt) => (
                      <button key={prompt} onClick={() => setInput(prompt)} className="rounded-2xl border dark:border-white/10 px-4 py-3 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5">{prompt}</button>
                    ))}
                  </div>
                </div>
              )}
              {flashcards.length > 0 && (
                <div className="max-w-3xl mx-auto mb-6 rounded-3xl border dark:border-white/10 bg-gradient-to-br from-white to-gray-50 dark:from-[#222234] dark:to-[#181827] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div><p className="text-xs font-bold text-accent">FLASHCARD DECK</p><p className="font-black text-lg text-ink dark:text-white">{flashcardIndex + 1} / {flashcards.length}</p></div>
                    <button onClick={() => { setFlashcards([]); setFlashcardIndex(0); }} className="text-xs text-gray-500">Close</button>
                  </div>
                  <div className="min-h-40 rounded-2xl bg-white dark:bg-[#29293b] p-6 flex flex-col justify-center">
                    <p className="text-lg font-extrabold text-ink dark:text-white">{flashcards[flashcardIndex]?.question}</p>
                    <details className="mt-5"><summary className="cursor-pointer text-sm font-bold text-accent">Show answer</summary><p className="mt-3 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{flashcards[flashcardIndex]?.answer}</p></details>
                  </div>
                  <div className="flex justify-between mt-4">
                    <button disabled={flashcardIndex === 0} onClick={() => setFlashcardIndex((i) => Math.max(0, i - 1))} className="compact-action disabled:opacity-40">← Previous</button>
                    <button disabled={flashcardIndex === flashcards.length - 1} onClick={() => setFlashcardIndex((i) => Math.min(flashcards.length - 1, i + 1))} className="compact-action disabled:opacity-40">Next →</button>
                  </div>
                </div>
              )}
              <div className="max-w-3xl mx-auto space-y-5">
                {messages.map((message) => (
                  <div key={message.id} className={"flex " + (message.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={"max-w-[92%] sm:max-w-[82%] " + (message.role === "user" ? "rounded-3xl rounded-br-md bg-brand-gradient text-white" : "rounded-3xl rounded-bl-md bg-gray-100 dark:bg-[#29293b] text-ink dark:text-gray-100") + " px-4 py-3 text-sm leading-6"}>
                      <div className="break-words">{renderContent(message.content)}</div>
                      <div className={"mt-2 flex gap-2 text-[10px] " + (message.role === "user" ? "text-white/60 justify-end" : "text-gray-400")}>
                        {message.role === "assistant" && <button onClick={() => copyMessage(message)}>{copiedId === message.id ? "Copied" : "Copy"}</button>}
                        {message.role === "assistant" && <button onClick={() => { const lastUser = [...messages].reverse().find(m => m.role === "user"); if (lastUser) sendMessage(lastUser.content); }}>Regenerate</button>}
                      </div>
                    </div>
                  </div>
                ))}
                {sending && <div className="flex justify-start"><div className="rounded-3xl rounded-bl-md bg-gray-100 dark:bg-[#29293b] px-4 py-3 text-sm text-gray-500">Student AI is thinking <span className="animate-pulse">•••</span></div></div>}
                {error && <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div>}
                <div ref={bottomRef} />
              </div>
            </div>
            <div className="border-t dark:border-white/10 p-3 sm:p-4">
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="max-w-3xl mx-auto">
                <div className="rounded-3xl border dark:border-white/10 bg-gray-50 dark:bg-[#151522] p-2 flex items-end gap-2">
                  <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} rows={1} maxLength={8000} placeholder="Ask Student AI anything…" className="flex-1 resize-none bg-transparent outline-none px-3 py-2 text-sm text-ink dark:text-white" />
                  <button disabled={!input.trim() || sending} className="rounded-full bg-brand-gradient text-white px-5 py-2.5 text-sm font-bold disabled:opacity-40">Send</button>
                </div>
                <p className="text-[10px] text-gray-400 text-center mt-2">AI can make mistakes. Verify important answers with your course resources.</p>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
