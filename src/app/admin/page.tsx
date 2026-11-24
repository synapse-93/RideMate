"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Check, Flag, ShieldCheck, X } from "lucide-react";

interface VerificationUser {
  id: string;
  fullName: string;
  email: string;
  collegeIdNumber: string | null;
  idCardUrl: string | null;
  idVerificationStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
}

interface ReportRecord {
  id: string;
  reason: string;
  details: string | null;
  status: "OPEN" | "REVIEWED" | "DISMISSED";
  createdAt: string;
  reporter: { id: string; fullName: string; email: string };
  reportedUser: {
    id: string;
    fullName: string;
    email: string;
    avgRating: number;
  };
  ride: {
    id: string;
    originLabel: string;
    destLabel: string;
    status: string;
  } | null;
}

export default function AdminPage() {
  const [pending, setPending] = useState<VerificationUser[]>([]);
  const [reviewed, setReviewed] = useState<VerificationUser[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshQueues = useCallback(async () => {
    try {
      const [verRes, repRes] = await Promise.all([
        fetch("/api/admin/verifications", { cache: "no-store" }),
        fetch("/api/admin/reports", { cache: "no-store" }),
      ]);
      if (verRes.status === 403 || repRes.status === 403) {
        setError("Admin access required.");
        return;
      }
      if (verRes.ok) {
        const verData = (await verRes.json()) as {
          pending: VerificationUser[];
          reviewed: VerificationUser[];
        };
        setPending(verData.pending);
        setReviewed(verData.reviewed);
      }
      if (repRes.ok) {
        const repData = (await repRes.json()) as { reports: ReportRecord[] };
        setReports(repData.reports);
      }
    } catch {
      setError("Failed to load admin queues.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init(): Promise<void> {
      try {
        const [verRes, repRes] = await Promise.all([
          fetch("/api/admin/verifications", { cache: "no-store" }),
          fetch("/api/admin/reports", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (verRes.status === 403 || repRes.status === 403) {
          setError("Admin access required.");
          return;
        }
        if (verRes.ok) {
          const verData = (await verRes.json()) as {
            pending: VerificationUser[];
            reviewed: VerificationUser[];
          };
          setPending(verData.pending);
          setReviewed(verData.reviewed);
        }
        if (repRes.ok) {
          const repData = (await repRes.json()) as { reports: ReportRecord[] };
          setReports(repData.reports);
        }
      } catch {
        if (!cancelled) setError("Failed to load admin queues.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleVerificationDecision(
    userId: string,
    decision: "APPROVED" | "REJECTED"
  ): Promise<void> {
    const res = await fetch("/api/admin/verifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, decision }),
    });
    if (res.ok) {
      void refreshQueues();
    }
  }

  async function handleReportDecision(
    reportId: string,
    status: "REVIEWED" | "DISMISSED"
  ): Promise<void> {
    const res = await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, status }),
    });
    if (res.ok) {
      void refreshQueues();
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-[var(--text-muted)]">
        Loading Admin dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-sm text-rose-500">{error}</div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-[var(--accent-signal)]" />
          Campus Admin
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Approve student ID badges and review community safety reports.
        </p>
      </div>

      {/* Pending ID Queue */}
      <section className="space-y-4">
        <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-[var(--verified-green)]" />
          Pending Student IDs
          <span className="font-mono text-xs rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[var(--text-muted)]">
            {pending.length}
          </span>
        </h2>

        {pending.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-muted)]">
            All caught up — no pending ID reviews.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((student) => (
              <div
                key={student.id}
                className="card-lift rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4"
              >
                <div>
                  <p className="font-bold text-base">{student.fullName}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {student.email} · ID:{" "}
                    <span className="font-mono">
                      {student.collegeIdNumber ?? "—"}
                    </span>
                  </p>
                </div>

                {student.idCardUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={student.idCardUrl}
                    alt={`ID card for ${student.fullName}`}
                    className="w-full max-h-52 rounded-xl border border-[var(--border-subtle)] object-contain bg-[var(--bg-subtle)]"
                  />
                ) : (
                  <p className="text-xs text-amber-600">No ID image attached.</p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void handleVerificationDecision(student.id, "APPROVED")
                    }
                    className="btn-press flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--verified-green)] px-3 py-2.5 text-xs font-bold text-white"
                  >
                    <Check className="h-4 w-4" />
                    Approve Badge
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleVerificationDecision(student.id, "REJECTED")
                    }
                    className="btn-press flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-300"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Safety Reports */}
      <section className="space-y-4">
        <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
          <Flag className="h-5 w-5 text-rose-500" />
          Safety Reports
          <span className="font-mono text-xs rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[var(--text-muted)]">
            {reports.length}
          </span>
        </h2>

        {reports.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-muted)]">
            No safety reports filed.
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                        rep.status === "OPEN"
                          ? "bg-rose-500/12 text-rose-600 dark:text-rose-300"
                          : rep.status === "REVIEWED"
                          ? "bg-[var(--verified-green)]/12 text-[var(--verified-green)]"
                          : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                      }`}
                    >
                      {rep.status}
                    </span>
                    <span className="font-bold text-sm">{rep.reason}</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Reported:{" "}
                    <strong className="text-[var(--text-ink)]">
                      {rep.reportedUser.fullName}
                    </strong>{" "}
                    ({rep.reportedUser.email}) · By: {rep.reporter.fullName}
                  </p>
                  {rep.details && (
                    <p className="text-xs text-[var(--text-ink)] pt-1">
                      {rep.details}
                    </p>
                  )}
                  {rep.ride && (
                    <Link
                      href={`/rides/${rep.ride.id}`}
                      className="inline-block text-xs font-bold text-[var(--accent-signal)] hover:underline pt-1"
                    >
                      Open ride: {rep.ride.originLabel.split(",")[0]} →{" "}
                      {rep.ride.destLabel.split(",")[0]}
                    </Link>
                  )}
                </div>

                {rep.status === "OPEN" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        void handleReportDecision(rep.id, "REVIEWED")
                      }
                      className="btn-press rounded-xl bg-[var(--text-ink)] px-3.5 py-2 text-xs font-bold text-[var(--bg-surface)]"
                    >
                      Mark Reviewed
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleReportDecision(rep.id, "DISMISSED")
                      }
                      className="btn-press rounded-xl border border-[var(--border-subtle)] px-3.5 py-2 text-xs font-bold"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recently Reviewed Students */}
      {reviewed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Recently Reviewed Students
          </h2>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]">
            {reviewed.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between px-4 py-3 text-xs"
              >
                <div>
                  <span className="font-bold">{u.fullName}</span>{" "}
                  <span className="text-[var(--text-muted)]">({u.email})</span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-bold ${
                    u.idVerificationStatus === "APPROVED"
                      ? "bg-[var(--verified-green)]/12 text-[var(--verified-green)]"
                      : "bg-rose-500/12 text-rose-600 dark:text-rose-300"
                  }`}
                >
                  {u.idVerificationStatus}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
