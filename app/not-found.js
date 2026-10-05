import Link from "next/link";

export default function NotFound() {
  return <main className="min-h-screen app-shell flex items-center justify-center p-6">
    <section className="tool-panel max-w-md text-center">
      <h1 className="text-2xl font-bold text-ink dark:text-white">Page not found</h1>
      <p className="text-gray-500 dark:text-gray-400 mt-2">The page you requested does not exist.</p>
      <Link href="/" className="inline-block mt-5 text-accent font-semibold">Back to Study Hub</Link>
    </section>
  </main>;
}
