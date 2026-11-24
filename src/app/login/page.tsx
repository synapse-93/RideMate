"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, KeyRound, LogIn } from "lucide-react";

const DEMO_ACCOUNTS = [
  { label: "Admin (Campus)", email: "admin@rvce.edu.in" },
  { label: "Driver — Aarav (Car)", email: "aarav.driver@rvce.edu.in" },
  { label: "Driver — Priya (Women-Only)", email: "priya.driver@rvce.edu.in" },
  { label: "Passenger — Ananya (Female)", email: "ananya.student@college.edu.in" },
  { label: "Passenger — Rohan (Pending ID)", email: "rohan.student@college.edu.in" },
] as const;

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/find";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Unverified OTP fallback flow
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
          setError(data.error ?? "Please verify your email OTP.");
        } else {
          setError(data.error ?? "Login failed");
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
        setError(data.error ?? "Invalid OTP");
        return;
      }
      router.push(nextUrl);
      router.refresh();
    } catch {
      setError("Failed to verify OTP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Sign in to RideMate</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Use your verified college email to offer or book campus rides.
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
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Mock Email OTP (Demo Banner)
                </p>
                <p className="mt-1">
                  Your 6-digit verification code:{" "}
                  <strong className="font-mono text-sm tracking-widest">
                    {demoOtpBanner}
                  </strong>
                </p>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Enter 6-Digit OTP
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="123456"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 text-center font-mono text-lg tracking-widest outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify Email & Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                College Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@rvce.edu.in"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 disabled:opacity-50 transition-colors"
            >
              <LogIn className="h-4 w-4" />
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-zinc-500">
          New to RideMate?{" "}
          <Link
            href="/register"
            className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Create student account
          </Link>
        </p>
      </div>

      {/* Quick Demo Account Autofill */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <KeyRound className="h-3.5 w-3.5 text-emerald-500" />
          Seeded Demo Accounts (Password: Password123!)
        </div>
        <div className="grid gap-1.5">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => {
                setEmail(acc.email);
                setPassword("Password123!");
                setPendingOtpEmail(null);
              }}
              className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-xs hover:border-emerald-500/60 transition-colors"
            >
              <span className="font-medium">{acc.label}</span>
              <span className="font-mono text-[11px] text-zinc-500">
                {acc.email}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md py-12 text-center text-sm text-zinc-500">
          Loading sign-in...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
