"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  BadgeCheck,
  Car,
  CheckCircle2,
  Clock,
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
  const [vehicleType, setVehicleType] = useState<"TWO_WHEELER" | "CAR" | "NONE">("NONE");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [pendingIdUpload, setPendingIdUpload] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
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
        setError("Unable to load profile.");
      } finally {
        setLoading(false);
      }
    }
    void load();
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
      setMessage(
        pendingIdUpload
          ? "Profile saved and College ID submitted for Admin review!"
          : "Profile updated successfully."
      );
    } catch {
      setError("Network error while saving profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500">
        Loading your profile...
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
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header Summary Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{user.fullName}</h1>
            {user.idVerificationStatus === "APPROVED" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified Student
              </span>
            )}
            {user.idVerificationStatus === "PENDING" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                ID Pending Review
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">
            {user.email} · {user.gender} · {user.role}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2.5">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <div className="text-sm">
            <span className="font-bold">
              {user.totalRatings > 0 ? user.avgRating.toFixed(1) : "New"}
            </span>{" "}
            <span className="text-xs text-zinc-500">
              ({user.totalRatings} reviews)
            </span>
          </div>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Personal & Privacy */}
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Phone className="h-4 w-4 text-emerald-500" />
            Student Info & Phone Privacy
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-zinc-500">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-zinc-500">
                College ID / USN
              </label>
              <input
                type="text"
                value={collegeIdNumber}
                onChange={(e) => setCollegeIdNumber(e.target.value)}
                placeholder="1RV22CS014"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-zinc-500">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98450 00000"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3">
              <div className="space-y-0.5 pr-3">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-zinc-400" />
                  Share Phone With Co-Riders
                </p>
                <p className="text-xs text-zinc-500">
                  Off = hidden from ride listings & riders
                </p>
              </div>
              <input
                type="checkbox"
                checked={showPhonePrivacy}
                onChange={(e) => setShowPhonePrivacy(e.target.checked)}
                className="h-5 w-5 accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* Vehicle Details */}
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Car className="h-4 w-4 text-emerald-500" />
            Vehicle Details (for Drivers)
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-zinc-500">
                Vehicle Type
              </label>
              <select
                value={vehicleType}
                onChange={(e) =>
                  setVehicleType(
                    e.target.value as "TWO_WHEELER" | "CAR" | "NONE"
                  )
                }
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                <option value="NONE">None (Passenger only)</option>
                <option value="CAR">Car (4-Wheeler)</option>
                <option value="TWO_WHEELER">Two-Wheeler (Scooter / Bike)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-zinc-500">
                Model & Color
              </label>
              <input
                type="text"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="Maruti Swift (White)"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-zinc-500">
                License Plate
              </label>
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                placeholder="KA-05-MN-4821"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 text-sm uppercase outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </section>

        {/* Emergency Contact */}
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-500" />
            Emergency Contact (Displayed on SOS)
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-zinc-500">
                Contact Name
              </label>
              <input
                type="text"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="Parent / Guardian Name"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-zinc-500">
                Emergency Phone
              </label>
              <input
                type="tel"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder="+91 98450 99999"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </section>

        {/* College ID Verification Upload */}
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-500" />
              College ID Card Upload (Optional Verification)
            </h2>
            <span className="text-xs font-semibold uppercase text-zinc-500">
              Status: {user.idVerificationStatus}
            </span>
          </div>

          <p className="text-xs text-zinc-500">
            Upload a clear photo of your college ID card (PNG, JPEG, or WebP, max
            500 KB) to receive a <strong>Verified Student</strong> badge after
            Admin review. Stored directly in PostgreSQL as a validated base64
            data URL (zero disk writes).
          </p>

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleIdFileChange}
            className="block w-full text-xs text-zinc-500 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-white dark:file:bg-zinc-100 dark:file:text-zinc-950 cursor-pointer"
          />

          {previewImage && (
            <div className="pt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt="Uploaded College ID Card preview"
                className="max-h-52 rounded-xl border border-zinc-200 dark:border-zinc-800 object-contain"
              />
            </div>
          )}
        </section>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving changes..." : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
