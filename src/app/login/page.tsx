"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  LogIn,
} from "lucide-react";

const DEMO_ACCOUNTS = [
  { role: "Admin", name: "Campus Admin", email: "admin@rvce.edu.in" },
  { role: "Driver · Car", name: "Aarav Sharma", email: "aarav.driver@rvce.edu.in" },
  { role: "Driver · Women-Only", name: "Priya Nair", email: "priya.driver@rvce.edu.in" },
  { role: "Rider · Female", name: "Ananya Rao", email: "ananya.student@college.edu.in" },
  { role: "Rider · Pending ID", name: "Rohan Kulkarni", email: "rohan.student@college.edu.in" },
] as const;

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/find";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [pendingOtpEmail, setPendingOtpEmail] = useState<string | null>(null);
  const [demoOtpBanner, setDemoOtpBanner] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        error?: string;
        requiresVerification?: boolean;
        demoOtp?: string;
        email?: string;
      };

      if (!res.ok) {
        if (data.requiresVerification && data.email) {
          setPendingOtpEmail(data.email);
          setDemoOtpBanner(data.demoOtp ?? null);
          setError(data.error ?? "Please verify your campus code.");
        } else {
          setError(data.error ?? "Sign in failed");
        }
        return;
      }

      router.push(nextUrl);
      router.refresh();
    } catch {
      setError("Network error while signing in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!pendingOtpEmail) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingOtpEmail, otp: otpInput }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Invalid verification code");
        return;
      }
      router.push(nextUrl);
      router.refresh();
    } catch {
      setError("Failed to verify code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5 animate-fade-up">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-extrabold tracking-[-0.03em]">
            Welcome back
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Sign in with your college email to book or offer campus rides.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {pendingOtpEmail ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {demoOtpBanner && (
              <div className="rounded-xl border border-[var(--verified-green)]/30 bg-[var(--verified-green)]/10 p-3.5 text-xs text-[var(--verified-green)]">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Instant campus code
                </p>
                <p className="mt-1 text-[var(--text-ink)]">
                  Your 6-digit code:{" "}
                  <strong className="font-mono text-sm tracking-widest">
                    {demoOtpBanner}
                  </strong>
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Enter 6-Digit Code
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="123456"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-center font-mono text-lg tracking-widest outline-none focus:border-[var(--accent-signal)]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-press w-full rounded-xl bg-[var(--accent-signal)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--accent-signal-hover)] disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify & Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                College Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@rvce.edu.in"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-signal)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--accent-signal-hover)] disabled:opacity-50 shadow-xs"
            >
              <LogIn className="h-4 w-4" />
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-[var(--text-muted)]">
          New to RideMate?{" "}
          <Link
            href="/register"
            className="font-bold text-[var(--accent-signal)] hover:underline"
          >
            Create student account
          </Link>
        </p>
      </div>

      {/* Scannable One-Click Demo Account Pills */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-[var(--accent-signal)]" />
            Quick Demo Login
          </span>
          <span className="font-mono normal-case text-[var(--text-ink)]">
            Password123!
          </span>
        </div>
        <div className="grid gap-1.5">
          {DEMO_ACCOUNTS.map((acc) => {
            const selected = email === acc.email;
            return (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword("Password123!");
                  setPendingOtpEmail(null);
                }}
                className={`btn-press flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs ${
                  selected
                    ? "border-[var(--accent-signal)] bg-[var(--accent-signal)]/[0.08]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 hover:border-[var(--accent-signal)]/50"
                }`}
              >
                <div className="min-w-0">
                  <span className="font-bold text-[var(--text-ink)]">
                    {acc.name}
                  </span>
                  <span className="ml-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                    {acc.role}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[var(--text-muted)] truncate">
                  {acc.email}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md py-12 text-center text-sm text-[var(--text-muted)]">
          Loading sign-in…
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
