"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  BadgeCheck,
  Car,
  CheckCircle2,
  Clock,
  GraduationCap,
  ImagePlus,
  Lock,
  Phone,
  Save,
  ShieldAlert,
  Star,
  Upload,
} from "lucide-react";

interface ProfileUser {
  id: string;
  email: string;
  fullName: string;
  collegeIdNumber: string | null;
  gender: "MALE" | "FEMALE" | "OTHER";
  role: "STUDENT" | "ADMIN";
  emailVerified: boolean;
  idCardUrl: string | null;
  idVerificationStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  vehicleType: "TWO_WHEELER" | "CAR" | "NONE";
  vehicleModel: string | null;
  vehiclePlate: string | null;
  showPhonePrivacy: boolean;
  phone: string | null;
  avgRating: number;
  totalRatings: number;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ST";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function ProfilePage() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [collegeIdNumber, setCollegeIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [showPhonePrivacy, setShowPhonePrivacy] = useState(false);
  const [vehicleType, setVehicleType] = useState<
    "TWO_WHEELER" | "CAR" | "NONE"
  >("NONE");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [pendingIdUpload, setPendingIdUpload] = useState<string | null>(null);
  const [selectedFileMeta, setSelectedFileMeta] = useState<{
    name: string;
    sizeKb: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          setError("Please sign in to view your profile.");
          return;
        }
        const data = (await res.json()) as { user: ProfileUser };
        const u = data.user;
        setUser(u);
        setFullName(u.fullName);
        setCollegeIdNumber(u.collegeIdNumber ?? "");
        setPhone(u.phone ?? "");
        setShowPhonePrivacy(u.showPhonePrivacy);
        setVehicleType(u.vehicleType);
        setVehicleModel(u.vehicleModel ?? "");
        setVehiclePlate(u.vehiclePlate ?? "");
        setEmergencyContactName(u.emergencyContactName ?? "");
        setEmergencyContactPhone(u.emergencyContactPhone ?? "");
      } catch {
        if (!cancelled) setError("Unable to load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleIdFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please select a PNG, JPEG, or WebP image of your College ID.");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("ID image must be 500 KB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPendingIdUpload(reader.result);
        setSelectedFileMeta({
          name: file.name,
          sizeKb: Math.max(1, Math.round(file.size / 1024)),
        });
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          collegeIdNumber: collegeIdNumber || null,
          phone: phone || null,
          showPhonePrivacy,
          vehicleType,
          vehicleModel: vehicleModel || null,
          vehiclePlate: vehiclePlate || null,
          emergencyContactName: emergencyContactName || null,
          emergencyContactPhone: emergencyContactPhone || null,
          ...(pendingIdUpload ? { idCardUrl: pendingIdUpload } : {}),
        }),
      });
      const data = (await res.json()) as { user?: ProfileUser; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error ?? "Failed to update profile");
        return;
      }
      setUser(data.user);
      setPendingIdUpload(null);
      setSelectedFileMeta(null);
      setMessage(
        pendingIdUpload
          ? "Profile saved and College ID submitted for review!"
          : "Profile updated."
      );
    } catch {
      setError("Network error while saving profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-[var(--text-muted)]">
        Loading your Digital Campus Pass…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-12 text-center text-sm text-rose-500">
        {error ?? "Not signed in."}
      </div>
    );
  }

  const previewImage = pendingIdUpload ?? user.idCardUrl;

  return (
    <div className="mx-auto max-w-3xl space-y-6 card-enter">
      {/* Sleek Digital Campus Pass Header */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-surface)] via-[var(--bg-surface)] to-[#FF5A26]/[0.08] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--text-ink)] text-lg font-extrabold text-[var(--bg-surface)] shadow-sm">
              {getInitials(user.fullName)}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent-signal)]">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Digital Campus Pass
                </span>
                {user.collegeIdNumber && (
                  <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--text-ink)]">
                    {user.collegeIdNumber}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-[-0.03em]">
                  {user.fullName}
                </h1>
                {user.idVerificationStatus === "APPROVED" && (
                  <span className="shimmer-badge inline-flex items-center gap-1 rounded-full bg-[var(--verified-green)]/14 px-3 py-0.5 text-xs font-bold text-[var(--verified-green)] border border-[var(--verified-green)]/25">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified Student
                  </span>
                )}
                {user.idVerificationStatus === "PENDING" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <Clock className="h-3.5 w-3.5" />
                    ID Pending Review
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-[var(--text-muted)]">
                {user.email} · {user.gender}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur-xs px-4 py-2.5">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <div className="text-sm font-mono">
              <span className="font-bold">
                {user.totalRatings > 0 ? user.avgRating.toFixed(1) : "New"}
              </span>{" "}
              <span className="font-sans text-xs text-[var(--text-muted)]">
                ({user.totalRatings})
              </span>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--verified-green)]/30 bg-[var(--verified-green)]/10 px-4 py-3 text-sm font-medium text-[var(--verified-green)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Personal & Privacy */}
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
          <h2 className="font-bold text-base flex items-center gap-2">
            <Phone className="h-4 w-4 text-[var(--accent-signal)]" />
            Student Info &amp; Phone Privacy
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                College ID / USN
              </label>
              <input
                type="text"
                value={collegeIdNumber}
                onChange={(e) => setCollegeIdNumber(e.target.value)}
                placeholder="1RV22CS014"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 font-mono text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98450 00000"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 font-mono text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
              />
            </div>

            <label className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 px-4 py-3 cursor-pointer">
              <div className="space-y-0.5 pr-3">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  Share phone with co-riders
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Keep off to stay chat-only
                </p>
              </div>
              <input
                type="checkbox"
                checked={showPhonePrivacy}
                onChange={(e) => setShowPhonePrivacy(e.target.checked)}
                className="h-5 w-5 accent-[#FF5A26] cursor-pointer"
              />
            </label>
          </div>
        </section>

        {/* Vehicle Details */}
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
          <h2 className="font-bold text-base flex items-center gap-2">
            <Car className="h-4 w-4 text-[var(--accent-signal)]" />
            Vehicle Details
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Vehicle Type
              </label>
              <select
                value={vehicleType}
                onChange={(e) =>
                  setVehicleType(
                    e.target.value as "TWO_WHEELER" | "CAR" | "NONE"
                  )
                }
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
              >
                <option value="NONE">None (Rider only)</option>
                <option value="CAR">Car</option>
                <option value="TWO_WHEELER">Two-wheeler</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Model &amp; Color
              </label>
              <input
                type="text"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="Maruti Swift (White)"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                License Plate
              </label>
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                placeholder="KA-05-MN-4821"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 font-mono text-sm uppercase outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
              />
            </div>
          </div>
        </section>

        {/* Emergency Contact */}
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
          <h2 className="font-bold text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-500" />
            Emergency Contact
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Contact Name
              </label>
              <input
                type="text"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="Parent / Guardian Name"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Emergency Phone
              </label>
              <input
                type="tel"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder="+91 98450 99999"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5 font-mono text-sm outline-none focus:border-[var(--accent-signal)] focus:bg-[var(--bg-surface)]"
              />
            </div>
          </div>
        </section>

        {/* Styled College ID Dropzone */}
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-[var(--accent-signal)]" />
              College ID Card
            </h2>
            <span className="font-mono text-xs font-bold uppercase text-[var(--text-muted)]">
              Status: {user.idVerificationStatus}
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleIdFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-press group w-full rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)]/45 hover:border-[var(--accent-signal)] hover:bg-[var(--accent-signal)]/[0.04] p-5 text-left transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {previewImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewImage}
                  alt="College ID card thumbnail"
                  className="h-20 w-32 shrink-0 rounded-xl border border-[var(--border-subtle)] object-cover bg-[var(--bg-surface)]"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--accent-signal)]">
                  <ImagePlus className="h-5 w-5" />
                </span>
              )}

              <div className="min-w-0 space-y-1">
                <p className="text-sm font-bold text-[var(--text-ink)]">
                  {selectedFileMeta
                    ? `${selectedFileMeta.name} (${selectedFileMeta.sizeKb} KB)`
                    : previewImage
                    ? "Replace College ID photo"
                    : "Upload College ID photo"}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  PNG, JPEG, or WebP · max 500 KB · Earn your Verified Student
                  badge after admin review.
                </p>
              </div>
            </div>
          </button>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="btn-press inline-flex items-center gap-2 rounded-xl bg-[var(--accent-signal)] px-6 py-3 text-sm font-bold text-white hover:bg-[var(--accent-signal-hover)] disabled:opacity-50 shadow-xs"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
