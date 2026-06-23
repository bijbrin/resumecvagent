"use client";

import { useEffect, useSyncExternalStore } from "react";

// Presentation-only accent theming. The selected accent is stored in
// localStorage; the accent variants in globals.css remap the --accent family
// when `data-accent` is set on <html>.
const ACCENTS = [
  { key: "crimson", color: "#FF5161" },
  { key: "violet", color: "#7B61FF" },
  { key: "teal", color: "#27D3BE" },
  { key: "amber", color: "#F5A524" },
  { key: "retro", color: "#576A8F" },
] as const;

type AccentKey = (typeof ACCENTS)[number]["key"];

const STORAGE_KEY = "rcv-accent";
const EVENT = "rcv-accent-change";

// ── External store (localStorage) read via useSyncExternalStore ───────────────
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
function getSnapshot(): AccentKey {
  const v = localStorage.getItem(STORAGE_KEY) as AccentKey | null;
  return v ?? "crimson";
}
function getServerSnapshot(): AccentKey {
  return "crimson";
}

function applyAccent(key: AccentKey) {
  document.documentElement.dataset.accent = key;
}

export function AccentSwitcher({ className = "hidden sm:flex" }: { className?: string }) {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Mirror the stored accent onto <html> (external-system sync).
  useEffect(() => {
    applyAccent(active);
  }, [active]);

  function pick(key: AccentKey) {
    localStorage.setItem(STORAGE_KEY, key);
    applyAccent(key);
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div className={`${className} items-center gap-2.5`}>
      <span className="font-mono text-[10px] tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
        ACCENT
      </span>
      <div className="flex gap-[7px]">
        {ACCENTS.map((a) => (
          <button
            key={a.key}
            type="button"
            title={a.key}
            aria-label={`${a.key} accent`}
            aria-pressed={active === a.key}
            onClick={() => pick(a.key)}
            className="h-5 w-5 rounded-[6px] cursor-pointer p-0 transition-[box-shadow] duration-150"
            style={{
              background: a.color,
              boxShadow:
                active === a.key
                  ? `0 0 0 2px var(--bg-base), 0 0 0 4px ${a.color}`
                  : "0 0 0 1px rgba(255,255,255,.12)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
