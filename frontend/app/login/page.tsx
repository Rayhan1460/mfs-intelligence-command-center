"use client";

import { useEffect, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

function loginMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "The secure service is unavailable. Try again in a moment.";
  if (error.status === 429) return "Too many attempts. Wait a little before trying again.";
  if (error.status === 401) return "Those sign-in details could not be verified. Check your password and confirm the account is active.";
  if (error.status === 403) return "This sign-in request could not be accepted.";
  if (error.status >= 500) return "The secure service is having trouble. Try again shortly.";
  return "Check your sign-in details and try again.";
}

export default function LoginPage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) router.replace("/command-center");
  }, [user, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/api/v1/auth/login", { method: "POST", body: { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") } });
      await refresh();
      router.replace("/command-center");
    } catch (cause) {
      setError(loginMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-screen">
    <section className="login-story">
      <Link className="brand-lockup" href="/"><span className="brand-mark">M<span>F</span></span><span className="brand-name">MFS<span>INTELLIGENCE</span></span></Link>
      <motion.div className="login-story-copy" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .55 }}>
        <p className="eyebrow">SECURE ACCESS · TRACK 05</p>
        <h1>Decisions begin with a clearer signal.</h1>
        <p>Enter the synthetic merchant and agent intelligence workspace. Account access and actions are controlled by your assigned role.</p>
        <div className="hero-proof"><span className="badge badge-synthetic">Synthetic demo</span><span className="badge badge-review"><ShieldCheck size={13} /> Human review required</span></div>
      </motion.div>
      <div className="login-bottom"><Link href="/" className="text-button"><ArrowLeft size={13} /> Back to overview</Link><div>Session cookies are HttpOnly. Never share your account credentials.</div></div>
    </section>
    <section className="login-form-side"><motion.div className="login-card" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .48, delay: .08 }}>
      <span className="eyebrow">COMMAND CENTER</span><h2>Welcome back</h2><p>Sign in with your assigned account.</p>
      {error && <div className="login-error" role="alert">{error}</div>}
      <form className="form-stack" onSubmit={submit}>
        <label>Email<input type="email" name="email" required autoComplete="username" placeholder="name@organization" /></label>
        <label>Password<input type="password" name="password" required autoComplete="current-password" /></label>
        <button className="button button-gold" type="submit" disabled={busy}>{busy ? "Verifying access…" : "Sign in"}{!busy && <ArrowRight size={15} />}</button>
      </form>
      <div className="login-bottom"><LockKeyhole size={14} /> Secure session · Role-based access · No browser token storage</div>
    </motion.div></section>
  </main>;
}
