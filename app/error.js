"use client";

export default function Error({ reset }) {
  return <main className="min-h-screen app-shell flex items-center justify-center p-6">
    <section className="tool-panel max-w-md text-center">
      <h1 className="text-2xl font-bold text-ink dark:text-white">Something went wrong</h1>
      <p className="text-gray-500 dark:text-gray-400 mt-2">Please try again.</p>
      <button onClick={() => reset()} className="mt-5 profile-submit">Try again</button>
    </section>
  </main>;
}
