import Link from "next/link";

const questions = [
  ["Where are my courses?", "Open the Courses section on the home page. Choose your semester and branch, then search by subject or resource."],
  ["How do I open a lecture or note?", "Open a course, select a resource, and use its viewer. Some YouTube streams require opening on YouTube. PDFs may use temporary links."],
  ["How is progress saved?", "Tap the circle beside a resource to mark it complete. Course progress updates as you finish materials."],
  ["Where are my saved resources?", "Tap Save beside a resource. Your bookmarks appear in Study Tools."],
  ["Can I use Study Hub offline?", "Some pages may remain cached by your browser, but lectures, quizzes, and protected notes need a connection."],
  ["I forgot my password. What now?", "Use the reset link below to request an email. The link needs to be opened on the same site you use to access Study Hub."],
];
export default function HelpPage() {
  return <main className="min-h-screen app-shell px-4 sm:px-6 py-10">
    <div className="max-w-3xl mx-auto">
      <Link href="/" className="text-accent font-semibold text-sm">← Home</Link>
      <p className="section-label mt-9">HELP CENTER</p>
      <h1 className="text-4xl font-black text-ink dark:text-white mt-1">Need a hand?</h1>
      <p className="text-gray-500 dark:text-gray-400 mt-2 mb-8">Quick answers to the questions students ask most.</p>
      <div className="space-y-3">{questions.map(([question, answer]) => <details key={question} className="tool-panel group">
        <summary className="cursor-pointer font-bold text-ink dark:text-white list-none flex justify-between gap-5">{question}<span aria-hidden="true" className="text-accent">＋</span></summary>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-4 leading-relaxed">{answer}</p>
      </details>)}</div>
      <div className="page-intro mt-8"><h2 className="font-bold text-ink dark:text-white">Account trouble?</h2><p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Request a password reset email to regain access.</p><Link href="/reset-password" className="inline-block text-accent font-bold mt-3">Reset password →</Link></div>
    </div>
  </main>;
}
