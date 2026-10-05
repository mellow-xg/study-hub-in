"use client";

import { useEffect, useState } from "react";

export default function OfflineCache() {
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" })
        .then(() => setReady(true))
        .catch((error) => console.warn("Study Hub offline cache unavailable:", error));
    }

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline && !ready) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-[80] rounded-full border border-black/10 dark:border-white/10 bg-white/90 dark:bg-[#1c1c2b]/90 backdrop-blur-md px-3 py-2 text-xs font-semibold text-ink dark:text-gray-100 shadow-lg"
      aria-live="polite"
    >
      {offline ? "Offline mode" : "Offline cache ready"}
    </div>
  );
}
