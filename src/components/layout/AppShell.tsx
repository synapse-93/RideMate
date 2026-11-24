"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Bell,
  Car,
  Compass,
  Home,
  LogIn,
  LogOut,
  Moon,
  PlusCircle,
  ShieldCheck,
  Sun,
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

const NAV_ITEMS = [
  { href: "/", label: "Home", mobileLabel: "Home", icon: Home },
  { href: "/find", label: "Find Ride", mobileLabel: "Find", icon: Compass },
  { href: "/offer", label: "Offer Ride", mobileLabel: "Offer", icon: PlusCircle },
  { href: "/trips", label: "Trips", mobileLabel: "Trips", icon: Car },
  { href: "/profile", label: "Profile", mobileLabel: "Profile", icon: User },
] as const;

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

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { notifications: NotificationItem[] };
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // Ignore transient network errors during polling
    }
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
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 flex flex-col">
      {/* Desktop & Mobile Top Bar */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold tracking-tight text-lg"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-emerald-400 dark:bg-emerald-500 dark:text-zinc-950">
                <Car className="h-4 w-4" />
              </span>
              <span>RideMate</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}

              {user?.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive("/admin")
                      ? "bg-emerald-600 text-white"
                      : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Admin
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                className="md:hidden inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </Link>
            )}

            {/* Notification Bell */}
            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBellOpen((o) => !o)}
                  aria-label="Notifications"
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-3.5 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Notifications ({unreadCount} unread)
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleMarkAllRead()}
                          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                      {activeNotifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-zinc-500">
                          No notifications yet.
                        </div>
                      ) : (
                        activeNotifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => void handleNotificationClick(item)}
                            className={`w-full text-left px-3.5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition-colors ${
                              !item.read
                                ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                                : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                {item.title}
                              </p>
                              {!item.read && (
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-zinc-700" />
              )}
            </button>

            {/* Auth Button */}
            {user ? (
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 pb-24 md:pb-10">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md md:hidden"
      >
        <div className="grid grid-cols-5 h-16">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.mobileLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
