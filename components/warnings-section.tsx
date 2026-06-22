"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/** Collapsible list of agent warnings. Renders nothing when empty. */
export function WarningsSection({ warnings }: { warnings: string[] }) {
  const [open, setOpen] = useState(false);

  if (warnings.length === 0) return null;

  return (
    <div
      className="rounded-lg border"
      style={{
        background:  "color-mix(in srgb, var(--state-warning) 8%, transparent)",
        borderColor: "color-mix(in srgb, var(--state-warning) 40%, transparent)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        style={{ color: "var(--state-warning)" }}
      >
        <span>{warnings.length} warning{warnings.length > 1 ? "s" : ""}</span>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
      {open && (
        <ul className="px-4 pb-3 flex flex-col gap-1">
          {warnings.map((w, i) => (
            <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
