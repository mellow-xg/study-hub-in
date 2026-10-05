"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const IDLE_MS = 15 * 60 * 1000;
const WARNING_MS = 2 * 60 * 1000;

export default function SessionGuard({ children }) {
  const router = useRouter();
  const timerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    let active = true;

    const clearTimers = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };

    const logout = async () => {
      clearTimers();
      setShowWarning(false);
      await supabase.auth.signOut();
      if (active) router.replace("/login?reason=inactive");
    };

    const startIdleTimer = () => {
      clearTimers();
      setShowWarning(false);

      timerRef.current = setTimeout(() => {
        setShowWarning(true);
        warningTimerRef.current = setTimeout(logout, WARNING_MS);
      }, IDLE_MS);
    };

    const activity = () => {
      if (!showWarning) startIdleTimer();
    };

    const events = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll", "click"];
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }));

    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || event === "SIGNED_OUT") {
        clearTimers();
        setShowWarning(false);
        return;
      }
      startIdleTimer();
    });

    startIdleTimer();

    return () => {
      active = false;
      clearTimers();
      auth.subscription.unsubscribe();
      events.forEach((event) => window.removeEventListener(event, activity));
    };
  }, [router, showWarning]);

  const continueSession = () => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setShowWarning(false);
    window.dispatchEvent(new Event("studyhub-session-activity"));
  };

  return (
    <>
      {children}

      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="session-warning-title"
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#1c1c2b]"
          >
            <p className="text-xs font-black uppercase tracking-widest text-accent">Session security</p>
            <h2 id="session-warning-title" className="mt-2 text-xl font-black text-ink dark:text-white">
              Are you still studying?
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              You have been inactive for 15 minutes. Continue within 2 minutes or you will be logged out for security.
            </p>
            <button
              type="button"
              onClick={continueSession}
              className="mt-5 w-full rounded-full bg-brand-gradient px-5 py-3 text-sm font-bold text-white"
            >
              Yes, continue
            </button>
          </div>
        </div>
      )}
    </>
  );
}
