"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2,
  GraduationCap,
  Loader2,
  MapPin,
  TrainFront,
  X,
} from "lucide-react";
import { CAMPUS_PRESETS, type CampusPreset } from "@/lib/presets";

export interface SelectedLocation {
  label: string;
  lat: number;
  lng: number;
}

const geocodeCache = new Map<string, SelectedLocation[]>();

function presetSublabel(preset: CampusPreset): string {
  const parts = preset.label.split(",").map((s) => s.trim());
  return parts.length >= 2 ? parts[1] : "Bengaluru";
}

function PresetIcon({ category }: { category: CampusPreset["category"] }) {
  if (category === "CAMPUS") {
    return <GraduationCap className="h-3.5 w-3.5 text-[var(--accent-signal)] shrink-0" />;
  }
  if (category === "TRANSIT") {
    return <TrainFront className="h-3.5 w-3.5 text-[var(--verified-green)] shrink-0" />;
  }
  return <Building2 className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />;
}

interface LocationAutocompleteProps {
  label?: string;
  placeholder?: string;
  value: SelectedLocation | null;
  onChange: (loc: SelectedLocation | null) => void;
  showQuickPicks?: boolean;
  compact?: boolean;
  dotColor?: "orange" | "ink" | "green";
}

export function LocationAutocomplete({
  label,
  placeholder = "Search Bengaluru stop or campus…",
  value,
  onChange,
  compact = false,
  dotColor,
}: LocationAutocompleteProps) {
  const [draftQuery, setDraftQuery] = useState<string | null>(null);
  const [results, setResults] = useState<SelectedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const query = draftQuery ?? value?.label ?? "";

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const trimmed = query.trim();
  const canSearch = open && trimmed.length >= 3 && trimmed !== value?.label;

  useEffect(() => {
    if (!canSearch) {
      return;
    }

    const cacheKey = trimmed.toLowerCase();
    const localMatches: SelectedLocation[] = CAMPUS_PRESETS.filter(
      (p) =>
        p.label.toLowerCase().includes(cacheKey) ||
        p.shortLabel.toLowerCase().includes(cacheKey)
    ).map((p) => ({ label: p.label, lat: p.lat, lng: p.lng }));

    let cancelled = false;
    const timer = setTimeout(async () => {
      const cached = geocodeCache.get(cacheKey);
      if (cached) {
        if (!cancelled) setResults(cached);
        return;
      }

      if (!cancelled) setLoading(true);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(trimmed)}`,
          {
            headers: { Accept: "application/json" },
            cache: "no-store",
          }
        );
        if (!cancelled && res.ok) {
          const data = (await res.json()) as {
            results?: SelectedLocation[];
          };
          const combined =
            Array.isArray(data.results) && data.results.length > 0
              ? data.results
              : localMatches;
          geocodeCache.set(cacheKey, combined);
          setResults(combined);
        } else if (!cancelled) {
          setResults(localMatches);
        }
      } catch {
        if (!cancelled) setResults(localMatches);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, canSearch]);

  const visibleResults = canSearch ? results : [];

  function selectLocation(loc: SelectedLocation): void {
    onChange(loc);
    setDraftQuery(null);
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </label>
      )}

      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
          {dotColor === "orange" ? (
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-signal)] ring-4 ring-[var(--accent-signal)]/15" />
          ) : dotColor === "ink" ? (
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-ink)] ring-4 ring-[var(--text-ink)]/10" />
          ) : dotColor === "green" ? (
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--verified-green)] ring-4 ring-[var(--verified-green)]/15" />
          ) : (
            <MapPin className="h-4 w-4 text-[var(--text-muted)]" />
          )}
        </span>

        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const nextVal = e.target.value;
            setDraftQuery(nextVal);
            setOpen(true);
            if (nextVal.trim() === "") {
              onChange(null);
              setResults([]);
            }
          }}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-10 pr-9 text-sm font-medium text-[var(--text-ink)] placeholder:text-[var(--text-muted)]/75 outline-none transition-colors focus:border-[var(--accent-signal)] focus:ring-2 focus:ring-[var(--accent-signal)]/15 ${
            compact ? "py-2.5" : "py-3"
          }`}
        />

        {loading && canSearch && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[var(--accent-signal)]" />
        )}
        {!(loading && canSearch) && query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setDraftQuery("");
              onChange(null);
              setResults([]);
            }}
            aria-label="Clear location"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-ink)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Floating Dropdown — Campus Quick-Picks on Focus or Live Search Results */}
      {open && (visibleResults.length > 0 || trimmed.length < 3) && (
        <div className="animate-fade-up absolute left-0 right-0 z-40 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl">
          {visibleResults.length > 0 ? (
            <div className="divide-y divide-[var(--border-subtle)] py-1">
              {visibleResults.map((item, idx) => (
                <button
                  key={`${item.lat}-${item.lng}-${idx}`}
                  type="button"
                  onClick={() => selectLocation(item)}
                  className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left text-xs hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-signal)]" />
                  <span className="line-clamp-2 font-medium text-[var(--text-ink)]">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-2">
              <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Popular Campus &amp; Metro Stops
              </p>
              <div className="space-y-0.5">
                {CAMPUS_PRESETS.slice(0, 7).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      selectLocation({
                        label: preset.label,
                        lat: preset.lat,
                        lng: preset.lng,
                      })
                    }
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-subtle)]">
                        <PresetIcon category={preset.category} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-ink)] truncate">
                          {preset.shortLabel}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          {presetSublabel(preset)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
