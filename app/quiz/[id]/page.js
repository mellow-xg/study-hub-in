"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import LoadingSkeleton from "../../../components/LoadingSkeleton";

function parseOptions(options) {
  if (Array.isArray(options)) return options;
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function QuizPage() {
  const router = useRouter();
  const params = useParams();
  const [quiz, setQuiz] = useState(null);
  const [course, setCourse] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: quizData } = await supabase
        .from("quizzes")
        .select("id,title,description,course_id,status,created_at")
        .eq("id", params.id)
        .eq("status", "published")
        .maybeSingle();

      if (!quizData) {
        setLoading(false);
        return;
      }
      setQuiz(quizData);

      if (quizData.course_id) {
        const { data: courseData } = await supabase
          .from("courses")
          .select("slug, title")
          .eq("id", quizData.course_id)
          .maybeSingle();
        setCourse(courseData);
      }

      // Security boundary: this view intentionally excludes correct_option.
      const { data: questionData } = await supabase
        .from("quiz_questions_public")
        .select("id,quiz_id,question,options,position,created_at")
        .eq("quiz_id", quizData.id)
        .order("position", { ascending: true });

      setQuestions((questionData || []).map((q) => ({
        ...q,
        options: parseOptions(q.options),
      })));
      setLoading(false);
    }
    load();
  }, [params.id, router]);

  const backHref = course ? `/courses/${course.slug}` : "/";

  function choose(optionIndex) {
    if (selected !== null || submitting) return;
    setSelected(optionIndex);
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = optionIndex;
      return next;
    });
  }

  async function goNext() {
    if (selected === null || submitting) return;

    if (index < questions.length - 1) {
      setIndex(index + 1);
      setSelected(null);
      return;
    }

    setSubmitting(true);
    setSubmitError(false);

    const { data, error } = await supabase.rpc("submit_quiz_attempt", {
      p_quiz_id: quiz.id,
      p_answers: answers,
    });

    if (error || !data) {
      setSubmitError(true);
      setSubmitting(false);
      return;
    }

    setResult(data);
    setFinished(true);
    setSubmitting(false);
  }

  function retry() {
    setIndex(0);
    setSelected(null);
    setAnswers([]);
    setFinished(false);
    setResult(null);
    setSubmitError(false);
  }

  if (loading) return <LoadingSkeleton variant="list" label="Loading quiz" />;

  if (!quiz) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-gray-400 dark:bg-[#0e0e17]">
        <p>Quiz not found.</p>
        <Link href="/" className="text-sm text-accent font-semibold">← Back to home</Link>
      </div>
    );
  }

  const total = questions.length;
  const current = questions[index];
  const score = Number(result?.score || 0);
  const resultTotal = Number(result?.total || total);
  const pct = resultTotal > 0 ? Math.round((score / resultTotal) * 100) : 0;
  const answered = finished ? total : index + (selected !== null ? 1 : 0);
  const barPct = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="min-h-screen dark:bg-[#0e0e17]">
      <nav className="bg-white/80 dark:bg-[#1c1c2b]/80 backdrop-blur-md shadow-sm px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-2">
          <Link href={backHref} className="text-sm text-accent font-semibold">← Back</Link>
          <h1 className="text-lg font-extrabold text-ink dark:text-gray-100 truncate">{quiz.title}</h1>
        </div>
        {total > 0 && (
          <div className="progress-track h-2 w-full">
            <div className="progress-fill" style={{ width: `${barPct}%` }} />
          </div>
        )}
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        {total === 0 && <p className="text-gray-400 text-sm">This quiz has no questions yet.</p>}

        {total > 0 && !finished && current && (
          <div className="bg-white dark:bg-[#1c1c2b] rounded-3xl shadow-sm p-5">
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-3">
              <span>Question {index + 1} of {total}</span>
              <span>{selected !== null ? "Answer selected" : "Choose an answer"}</span>
            </div>

            <h2 className="font-bold text-ink dark:text-gray-100 mb-4 leading-snug">{current.question}</h2>

            <div className="space-y-2">
              {current.options.map((option, k) => {
                const isChosen = k === selected;
                const style = isChosen
                  ? "border border-accent bg-purple-50 text-purple-800 dark:bg-purple-900/30 dark:border-purple-500 dark:text-purple-200"
                  : "border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#25253a]";

                return (
                  <button
                    key={k}
                    onClick={() => choose(k)}
                    disabled={submitting}
                    className={`w-full text-left rounded-2xl px-4 py-3 text-sm transition text-ink dark:text-gray-100 ${style}`}
                  >
                    <span className="font-semibold mr-2 text-accent">{String.fromCharCode(65 + k)}.</span>
                    {option}
                  </button>
                );
              })}
            </div>

            {selected !== null && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {index === total - 1
                    ? "Your answers will be securely graded when you submit."
                    : "Answer recorded for this question."}
                </p>
                <button
                  onClick={goNext}
                  disabled={submitting}
                  className="bg-brand-gradient text-white rounded-full px-5 py-2 text-sm font-semibold shrink-0 disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : index === total - 1 ? "See result" : "Next"}
                </button>
              </div>
            )}

            {submitError && (
              <p className="text-xs text-red-500 mt-3">Couldn't submit the quiz. Please try again.</p>
            )}
          </div>
        )}

        {total > 0 && finished && (
          <div className="bg-white dark:bg-[#1c1c2b] rounded-3xl shadow-sm p-6 text-center">
            <p className="text-xs uppercase tracking-wide text-accent font-bold mb-2">Your score</p>
            <p className="text-4xl font-extrabold text-ink dark:text-gray-100">{score} / {resultTotal}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{pct}%</p>
            <p className="text-sm text-ink dark:text-gray-100 mt-3">
              {pct >= 80 ? "Great work!" : pct >= 50 ? "Good effort. Review the notes and keep practising." : "Keep practising. Review the notes and try again."}
            </p>

            <div className="flex justify-center gap-3 mt-5">
              <button onClick={retry} className="bg-brand-gradient text-white rounded-full px-5 py-2 text-sm font-semibold">Try again</button>
              <Link href={backHref} className="border dark:border-gray-600 text-ink dark:text-gray-100 rounded-full px-5 py-2 text-sm font-semibold">Back to course</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
