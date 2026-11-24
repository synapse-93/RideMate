"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Check,
  Flag,
  ShieldCheck,
  X,
} from "lucide-react";

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
  reportedUser: { id: string; fullName: string; email: string; avgRating: number };
  ride: { id: string; originLabel: string; destLabel: string; status: string } | null;
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
        setError("Admin privileges required to access this page.");
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
          setError("Admin privileges required to access this page.");
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
      <div className="py-12 text-center text-sm text-zinc-500">
        Loading Admin dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-sm text-rose-500">{error}</div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
            Campus Admin Moderation
          </h1>
          <p className="text-sm text-zinc-500">
            Verify student ID cards and resolve community safety reports.
          </p>
        </div>
      </div>

      {/* Pending ID Queue */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-emerald-500" />
          Pending College ID Queue ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-sm text-zinc-500">
            No pending ID verifications right now.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((student) => (
              <div
                key={student.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4"
              >
                <div>
                  <p className="font-semibold">{student.fullName}</p>
                  <p className="text-xs text-zinc-500">
                    {student.email} · ID: {student.collegeIdNumber ?? "Not provided"}
                  </p>
                </div>

                {student.idCardUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={student.idCardUrl}
                    alt={`ID card for ${student.fullName}`}
                    className="w-full max-h-52 rounded-xl border border-zinc-200 dark:border-zinc-800 object-contain bg-zinc-50 dark:bg-zinc-950"
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
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <Check className="h-4 w-4" />
                    Approve & Grant Badge
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleVerificationDecision(student.id, "REJECTED")
                    }
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
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

      {/* Safety Reports Queue */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Flag className="h-5 w-5 text-rose-500" />
          Safety Reports ({reports.length})
        </h2>

        {reports.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-sm text-zinc-500">
            No user or ride reports submitted yet.
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                        rep.status === "OPEN"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          : rep.status === "REVIEWED"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {rep.status}
                    </span>
                    <span className="font-semibold text-sm">{rep.reason}</span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Reported user: <strong>{rep.reportedUser.fullName}</strong> (
                    {rep.reportedUser.email}) · By: {rep.reporter.fullName}
                  </p>
                  {rep.details && (
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 pt-1">
                      {rep.details}
                    </p>
                  )}
                  {rep.ride && (
                    <Link
                      href={`/rides/${rep.ride.id}`}
                      className="inline-block text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline pt-1"
                    >
                      View Ride: {rep.ride.originLabel.split(",")[0]} →{" "}
                      {rep.ride.destLabel.split(",")[0]}
                    </Link>
                  )}
                </div>

                {rep.status === "OPEN" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleReportDecision(rep.id, "REVIEWED")}
                      className="rounded-xl bg-zinc-900 dark:bg-zinc-100 px-3.5 py-2 text-xs font-semibold text-white dark:text-zinc-950"
                    >
                      Mark Reviewed
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReportDecision(rep.id, "DISMISSED")}
                      className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 text-xs font-semibold"
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

      {/* Recently Reviewed IDs */}
      {reviewed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Recently Reviewed Students
          </h2>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
            {reviewed.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between px-4 py-3 text-xs"
              >
                <div>
                  <span className="font-semibold">{u.fullName}</span>{" "}
                  <span className="text-zinc-500">({u.email})</span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${
                    u.idVerificationStatus === "APPROVED"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
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
