"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PasswordChecklist, { isStrongPassword } from "../../components/PasswordChecklist";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  async function submit(event) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    if (recovery) {
      if (!isStrongPassword(password) || password !== confirm) {
        setError("Complete the password checklist and make both passwords match."); setBusy(false); return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) setError(updateError.message);
      else setMessage("Password updated. You can return to your courses.");
    } else {
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (sendError) setError(sendError.message);
      else setMessage("If this email has an account, a reset link is on its way. Check your inbox.");
    }
    setBusy(false);
  }
  return <main className="login-shell min-h-screen flex items-center justify-center p-4">
    <div className="login-card bg-white dark:bg-[#1c1c2b] rounded-3xl w-full max-w-md p-8 sm:p-10">
      <Link href="/login" className="text-accent font-semibold text-sm">← Sign in</Link>
      <p className="section-label mt-8">ACCOUNT ACCESS</p>
      <h1 className="text-3xl font-black text-ink dark:text-white mt-2">{recovery ? "Choose a new password" : "Reset your password"}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-6">{recovery ? "Make it something you'll remember." : "We'll email you a link to get back in."}</p>
      <form onSubmit={submit} className="space-y-3">
        {recovery ? <>
          <input type="password" aria-label="New password" placeholder="New password (8+ characters)" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required className="w-full border rounded-xl px-4 py-3 dark:bg-[#182736] dark:text-white" />
          <PasswordChecklist password={password} />
          <input type="password" aria-label="Confirm password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} required className="w-full border rounded-xl px-4 py-3 dark:bg-[#182736] dark:text-white" />
        </> : <input type="email" aria-label="Email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required className="w-full border rounded-xl px-4 py-3 dark:bg-[#182736] dark:text-white" />}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {message && <p role="status" className="text-sm text-teal-700 dark:text-teal-300">{message}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-teal-700 text-white p-3 font-bold disabled:opacity-50">{busy ? "Please wait…" : recovery ? "Save new password" : "Send reset link"}</button>
      </form>
      {recovery && message && <Link href="/" className="inline-block mt-5 text-accent font-semibold">Go to Study Hub →</Link>}
    </div>
  </main>;
}
