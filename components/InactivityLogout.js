"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const IDLE_MS = 30 * 60 * 1000;
const CONFIRM_MS = 2 * 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"];

export default function InactivityLogout({ children }) {
  const idleTimer = useRef(null);
  const logoutTimer = useRef(null);
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);

  useEffect(() => {
    let mounted = true;

    const clearTimers = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
      idleTimer.current = null;
      logoutTimer.current = null;
    };

    const schedule = () => {
      clearTimers();
      idleTimer.current = setTimeout(() => {
        if (!mounted) return;
        setWarning(true);
        setSecondsLeft(120);

        logoutTimer.current = setTimeout(async () => {
          await supabase.auth.signOut();
          if (mounted) window.location.replace("/login?reason=timeout");
        }, CONFIRM_MS);
      }, IDLE_MS);
    };

    const onActivity = () => {
      if (warning) return;
      schedule();
    };

    // Only start the inactivity timer for an authenticated session.
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) schedule();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) schedule();
      else clearTimers();
      if (!session) setWarning(false);
    });

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    return () => {
      mounted = false;
      clearTimers();
      listener.subscription.unsubscribe();
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity);
    };
  }, [warning]);

  async function continueSession() {
    // Refresh the Supabase session before restarting the inactivity window.
    await supabase.auth.getSession();
    setWarning(false);
    setSecondsLeft(120);
  }

  if (!warning) return children;

  return (
    <>
      {children}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="idle-title">
        <section className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#1c1c2b]">
          <p className="section-label">SESSION TIMEOUT</p>
          <h2 id="idle-title" className="mt-1 text-2xl font-black text-gray-900 dark:text-white">
            Do you want to continue?
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            You have been inactive for 30 minutes. You will be logged out in 2 minutes.
          </p>
          <div className="mt-5 text-center text-3xl font-black text-accent" aria-live="polite">
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
          </div>
          <button
            type="button"
            onClick={continueSession}
            className="mt-5 w-full rounded-2xl bg-brand-gradient px-4 py-3 font-bold text-white"
          >
            Yes, continue
          </button>
          <button
            type="button"
            onClick={async () => {
              if (logoutTimer.current) clearTimeout(logoutTimer.current);
              await supabase.auth.signOut();
              window.location.replace("/login");
            }}
            className="mt-2 w-full rounded-2xl border px-4 py-3 font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200"
          >
            Log out now
          </button>
        </section>
      </div>
    </>
  );
}
