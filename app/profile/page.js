"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import PasswordChecklist, { isStrongPassword } from "../../components/PasswordChecklist";
import LoadingSkeleton from "../../components/LoadingSkeleton";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: { user: signedInUser }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !signedInUser) { router.replace("/login"); return; }
      setUser(signedInUser);
      const { data } = await supabase.from("profiles").select("full_name, role").eq("id", signedInUser.id).maybeSingle();
      if (active) { setProfile(data); setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [router]);

  async function changePassword(event) {
    event.preventDefault(); setError(""); setMessage("");
    if (!isStrongPassword(newPassword)) { setError("Complete all password requirements."); return; }
    if (newPassword !== confirmPassword) { setError("The new passwords do not match."); return; }
    if (newPassword === currentPassword) { setError("Choose a password different from your current one."); return; }
    if (!user?.email) { setError("This account has no email address. Use the reset option for help."); return; }
    setBusy(true);
    try {
      const { data, error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (verifyError || data.user?.id !== user.id) { setError("Current password is incorrect."); return; }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) { setError(updateError.message); return; }
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setMessage("Password changed successfully.");
    } catch {
      setError("Could not change your password. Please try again.");
    } finally { setBusy(false); }
  }

  if (loading) return <LoadingSkeleton variant="profile" label="Loading profile" />;

  return <main className="min-h-screen app-shell px-4 sm:px-6 py-8 sm:py-12">
    <div className="max-w-3xl mx-auto">
      <Link href="/" className="text-accent text-sm font-semibold">← Home</Link>
      <p className="section-label mt-9">YOUR ACCOUNT</p>
      <h1 className="text-3xl sm:text-4xl font-black text-ink dark:text-white mt-1">Profile</h1>
      <p className="text-gray-500 dark:text-gray-400 mt-2 mb-8">Your details and account security in one place.</p>

      <section className="tool-panel mb-5">
        <div className="flex gap-4 items-center mb-5"><span className="profile-avatar" aria-hidden="true">{(profile?.full_name || user.email || "S").slice(0, 1).toUpperCase()}</span>
          <div><h2 className="text-xl font-bold text-ink dark:text-white">{profile?.full_name || "Study Hub learner"}</h2><p className="text-sm text-gray-500 dark:text-gray-400">{profile?.role === "admin" ? "Admin" : "Learner"}</p></div>
        </div>
        <div className="profile-detail"><span>Email</span><strong className="break-all">{user.email || "No email linked"}</strong></div>
      </section>

      <section className="tool-panel">
        <p className="section-label">SECURITY</p>
        <h2 className="text-xl font-bold text-ink dark:text-white mt-1">Change password</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">Enter your current password to confirm it is you.</p>
        <form onSubmit={changePassword} className="space-y-4">
          <label className="profile-field">Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required /></label>
          <label className="profile-field">New password<input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required /></label>
          <PasswordChecklist password={newPassword} />
          <label className="profile-field">Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></label>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
          {message && <p role="status" className="text-sm text-teal-700 dark:text-teal-300">{message}</p>}
          <button type="submit" disabled={busy} className="profile-submit">{busy ? "Updating…" : "Update password"}</button>
        </form>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-5">Forgot your current password? <Link href="/reset-password" className="text-accent font-semibold">Reset by email</Link></p>
      </section>
      <Link href="/help" className="inline-block text-sm text-accent font-semibold mt-6">Help and FAQs →</Link>
    </div>
  </main>;
}
