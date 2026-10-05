export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-white dark:bg-[#0e0e17]">
      <div className="max-w-md text-center">
        <div className="text-5xl mb-4">📚</div>
        <h1 className="text-2xl font-black text-ink dark:text-white">You’re offline</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Study Hub will use files you have already opened when they are available in the device cache.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
