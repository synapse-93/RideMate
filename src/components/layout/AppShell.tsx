"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Bell,
  Car,
  Compass,
  LogIn,
  LogOut,
  Moon,
  PlusCircle,
  ShieldCheck,
  Sun,
  Ticket,
  User,
} from "lucide-react";

export interface NavUser {
  id: string;
  fullName: string;
  email: string;
  role: "STUDENT" | "ADMIN";
  gender: "MALE" | "FEMALE" | "OTHER";
  idVerificationStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  emailVerified: boolean;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  linkUrl: string | null;
  createdAt: string;
}

const DESKTOP_NAV_ITEMS = [
  { href: "/find", label: "Find", icon: Compass },
  { href: "/offer", label: "Offer", icon: PlusCircle },
  { href: "/trips", label: "Trips", icon: Ticket },
] as const;

const MOBILE_NAV_ITEMS = [
  { href: "/find", label: "Find", icon: Compass },
  { href: "/offer", label: "Offer", icon: PlusCircle },
  { href: "/trips", label: "Trips", icon: Ticket },
  { href: "/profile", label: "Profile", icon: User },
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "RM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [user, setUser] = useState<NavUser | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { notifications: NotificationItem[] };
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  useEffect(() => {
    function handleOutside(event: MouseEvent): void {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function syncSession(): Promise<void> {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { user: NavUser | null };
          setUser(data.user ?? null);
        } else {
          setUser(null);
        }
      } catch {
        if (!cancelled) setUser(null);
      }
    }
    void syncSession();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function initialLoad(): Promise<void> {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { notifications: NotificationItem[] };
          setNotifications(data.notifications ?? []);
        }
      } catch {
        // Ignore
      }
    }
    void initialLoad();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, fetchNotifications]);

  const activeNotifications = user ? notifications : [];
  const unreadCount = activeNotifications.filter((n) => !n.read).length;

  async function handleMarkAllRead(): Promise<void> {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // Ignore
    }
  }

  async function handleNotificationClick(item: NotificationItem): Promise<void> {
    if (!item.read) {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
      } catch {
        // Ignore
      }
    }
    setBellOpen(false);
    if (item.linkUrl) {
      router.push(item.linkUrl);
    }
  }

  async function handleLogout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setNotifications([]);
    router.push("/");
    router.refresh();
  }

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-ink)] flex flex-col">
      {/* Frosted Transit Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-15 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            {/* Brand Mark -> Home */}
            <Link
              href="/"
              className="group flex items-center gap-2.5 font-extrabold tracking-tight text-lg"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-signal)] text-white shadow-xs transition-transform duration-200 group-hover:scale-105">
                <Car className="h-4 w-4 stroke-[2.4]" />
              </span>
              <span className="tracking-[-0.03em]">RideMate</span>
            </Link>

            {/* Streamlined Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
              {DESKTOP_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`btn-press flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                      active
                        ? "bg-[var(--text-ink)] text-[var(--bg-surface)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}

              {user?.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className={`btn-press flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                    isActive("/admin")
                      ? "bg-[var(--accent-signal)] text-white"
                      : "text-[var(--accent-signal)] hover:bg-[var(--accent-signal)]/10"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                className="md:hidden btn-press inline-flex items-center gap-1 rounded-full border border-[var(--accent-signal)]/30 bg-[var(--accent-signal)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--accent-signal)]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </Link>
            )}

            {/* Notification Bell */}
            {user && (
              <div ref={bellRef} className="relative">
                <button
                  type="button"
                  onClick={() => setBellOpen((o) => !o)}
                  aria-label="Notifications"
                  className="btn-press relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]"
                >
                  <Bell className="h-4 w-4 text-[var(--text-ink)]" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-signal)] opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent-signal)]" />
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="animate-fade-up absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Updates {unreadCount > 0 ? `· ${unreadCount} new` : ""}
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleMarkAllRead()}
                          className="text-xs font-semibold text-[var(--accent-signal)] hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                      {activeNotifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                          All caught up. Ride alerts show up here.
                        </div>
                      ) : (
                        activeNotifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => void handleNotificationClick(item)}
                            className={`w-full text-left px-4 py-3 hover:bg-[var(--bg-subtle)] transition-colors ${
                              !item.read ? "bg-[var(--accent-signal)]/[0.06]" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-bold text-[var(--text-ink)]">
                                {item.title}
                              </p>
                              {!item.read && (
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent-signal)]" />
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-[var(--text-muted)] line-clamp-2">
                              {item.body}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              aria-label="Toggle color theme"
              className="btn-press flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]"
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-[var(--text-ink)]" />
              )}
            </button>

            {/* User Avatar Pill + Sign Out / Sign In */}
            {user ? (
              <div className="flex items-center gap-1.5">
                <Link
                  href="/profile"
                  className={`btn-press flex items-center gap-2 rounded-full border pl-1 pr-3 py-1 text-xs font-semibold ${
                    isActive("/profile")
                      ? "border-[var(--accent-signal)] bg-[var(--accent-signal)]/10 text-[var(--text-ink)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--text-ink)] text-[11px] font-bold text-[var(--bg-surface)]">
                    {getInitials(user.fullName)}
                  </span>
                  <span className="hidden sm:inline max-w-[110px] truncate">
                    {user.fullName.split(" ")[0]}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  aria-label="Sign out"
                  title="Sign out"
                  className="btn-press flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-rose-600 hover:bg-[var(--bg-subtle)]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="btn-press inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-signal)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--accent-signal-hover)] shadow-xs"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12">
        {children}
      </main>

      {/* Compact Thumb-Friendly Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md md:hidden"
      >
        <div className="grid grid-cols-4 h-16 max-w-md mx-auto">
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`btn-press flex flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                  active
                    ? "text-[var(--accent-signal)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                <span
                  className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-[var(--accent-signal)]/12" : ""
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
