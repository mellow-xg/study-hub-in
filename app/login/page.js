"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PasswordChecklist, { isStrongPassword } from "../../components/PasswordChecklist";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState("signin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signup") {
      if (!isStrongPassword(password)) { setError("Complete all password requirements before signing up."); setLoading(false); return; }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      });
      if (error) setError(error.message);
      else router.push("/");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push("/");
    }
    setLoading(false);
  }

  return (
    <div className="login-shell min-h-screen flex items-center justify-center px-4 py-12">
      <div className="login-card w-full max-w-md bg-white dark:bg-[#1c1c2b] rounded-3xl shadow-xl p-8 sm:p-10">
        <Link href="/" className="brand-orb mb-8" aria-label="Study Hub home">S</Link>
        <p className="section-label">YOUR LEARNING SPACE</p>
        <h1 className="text-3xl font-extrabold bg-brand-gradient bg-clip-text text-transparent mb-1">
          {mode === "signin" ? "Welcome back." : "Start learning."}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {mode === "signin" ? "Sign in to continue your progress." : "Create an account to save your learning."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              aria-label="Full name" placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          )}
          <input
            type="email"
            aria-label="Email" placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            required
          />
          <input
            type="password"
            aria-label="Password" placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border dark:border-gray-600 dark:bg-[#14141f] dark:text-gray-100 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            required
            minLength={mode === "signup" ? 8 : 6}
          />
          {mode === "signup" && <PasswordChecklist password={password} />}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-gradient text-white rounded-2xl py-2.5 text-sm font-bold disabled:opacity-50 shadow-lg shadow-accent/30"
          >
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <div className="flex items-center justify-between gap-3 mt-5"><Link href="/reset-password" className="text-sm text-accent font-semibold">Forgot password?</Link><Link href="/help" className="text-sm text-gray-500">Help</Link></div>
        <button
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
          className="text-sm text-accent font-semibold mt-4 underline"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}