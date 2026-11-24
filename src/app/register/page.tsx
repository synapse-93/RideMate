"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, ShieldCheck, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"FORM" | "OTP">("FORM");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("FEMALE");
  const [collegeIdNumber, setCollegeIdNumber] = useState("");
  const [phone, setPhone] = useState("");

  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          gender,
          collegeIdNumber: collegeIdNumber || undefined,
          phone: phone || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        demoOtp?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }
      setDemoOtp(data.demoOtp ?? null);
      setStep("OTP");
    } catch {
      setError("Network error during registration.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpInput }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Invalid verification code");
        return;
      }
      router.push("/profile");
      router.refresh();
    } catch {
      setError("Network error while verifying code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md animate-fade-up">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--verified-green)]/12 px-2.5 py-0.5 text-xs font-bold text-[var(--verified-green)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified campus rides
          </div>
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] pt-1">
            {step === "FORM"
              ? "Join your campus network"
              : "Confirm your campus email"}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            {step === "FORM"
              ? "Approved domains: rvce.edu.in, college.edu.in"
              : `Enter the 6-digit code for ${email}`}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === "FORM" ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Kavya Menon"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                College Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kavya@rvce.edu.in"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) =>
                    setGender(e.target.value as "MALE" | "FEMALE" | "OTHER")
                  }
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
                >
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  USN / College ID
                </label>
                <input
                  type="text"
                  value={collegeIdNumber}
                  onChange={(e) => setCollegeIdNumber(e.target.value)}
                  placeholder="1RV23CS045"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 font-mono text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Phone (Optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98450 12345"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 font-mono text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Password (8+ characters)
              </label>
              <input
                type="password"
                required
                minLength={8}
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
              <UserPlus className="h-4 w-4" />
              {loading ? "Creating account…" : "Get Instant Campus Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {demoOtp && (
              <div className="rounded-xl border border-[var(--verified-green)]/30 bg-[var(--verified-green)]/10 p-4 space-y-1.5 text-xs">
                <p className="font-bold text-[var(--verified-green)] flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Instant campus code ready
                </p>
                <p className="text-[var(--text-ink)]">
                  Enter this 6-digit code to verify your email:{" "}
                  <strong className="font-mono text-base tracking-widest">
                    {demoOtp}
                  </strong>
                </p>
                <button
                  type="button"
                  onClick={() => setOtpInput(demoOtp)}
                  className="inline-block font-bold text-[var(--accent-signal)] hover:underline"
                >
                  Auto-fill code
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                6-Digit Campus Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="000000"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-3 text-center font-mono text-xl tracking-[0.35em] outline-none focus:border-[var(--accent-signal)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-press w-full rounded-xl bg-[var(--accent-signal)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--accent-signal-hover)] disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify & Continue"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-[var(--text-muted)]">
          Already registered?{" "}
          <Link
            href="/login"
            className="font-bold text-[var(--accent-signal)] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
