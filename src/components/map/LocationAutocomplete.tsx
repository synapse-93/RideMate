"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import { CAMPUS_PRESETS } from "@/lib/presets";

export interface SelectedLocation {
  label: string;
  lat: number;
  lng: number;
}

const geocodeCache = new Map<string, SelectedLocation[]>();

interface LocationAutocompleteProps {
  label: string;
  placeholder?: string;
  value: SelectedLocation | null;
  onChange: (loc: SelectedLocation | null) => void;
  showQuickPicks?: boolean;
}

export function LocationAutocomplete({
  label,
  placeholder = "Search Bengaluru location or pick a campus...",
  value,
  onChange,
  showQuickPicks = true,
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
    <div ref={containerRef} className="space-y-1.5 relative">
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </label>

      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
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
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pl-9 pr-9 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        {loading && canSearch && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-emerald-500" />
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
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {open && (visibleResults.length > 0 || trimmed.length < 3) && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg divide-y divide-zinc-100 dark:divide-zinc-800">
          {visibleResults.length > 0 ? (
            visibleResults.map((item, idx) => (
              <button
                key={`${item.lat}-${item.lng}-${idx}`}
                type="button"
                onClick={() => selectLocation(item)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span className="line-clamp-2">{item.label}</span>
              </button>
            ))
          ) : (
            <div className="p-2">
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Bengaluru Campus & Transit Quick-Picks
              </p>
              {CAMPUS_PRESETS.slice(0, 6).map((preset) => (
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
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span className="font-medium">{preset.shortLabel}</span>
                  <span className="text-[10px] uppercase text-zinc-400">
                    {preset.category}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick-pick pills */}
      {showQuickPicks && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {CAMPUS_PRESETS.slice(0, 5).map((preset) => (
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
              className="rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              {preset.shortLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
