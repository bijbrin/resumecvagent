"use client";

import { Shield, Flag, Landmark, Briefcase, Wifi, GraduationCap, MapPin, Trees } from "lucide-react";
import type { JobTags, WorkArrangement } from "@/lib/scraper/jobTags";

const ARRANGEMENT_STYLE: Record<WorkArrangement, { bg: string; fg: string }> = {
  Remote: {
    bg: "color-mix(in srgb, var(--state-success) 14%, transparent)",
    fg: "var(--state-success)",
  },
  Hybrid: {
    bg: "color-mix(in srgb, var(--accent-primary) 16%, transparent)",
    fg: "var(--accent-primary)",
  },
  "On-site": {
    bg: "color-mix(in srgb, var(--text-muted) 14%, transparent)",
    fg: "var(--text-secondary)",
  },
};

function Chip({
  children,
  bg,
  fg,
  border,
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
  border?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: bg, color: fg, borderColor: border ?? "transparent" }}
    >
      {children}
    </span>
  );
}

export function JobTagChips({ tags, maxTech = 4 }: { tags: JobTags; maxTech?: number }) {
  const arr = tags.arrangement ? ARRANGEMENT_STYLE[tags.arrangement] : null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.government && (
        <Chip
          bg="color-mix(in srgb, #d97706 14%, transparent)"
          fg="#b45309"
          border="color-mix(in srgb, #d97706 30%, transparent)"
        >
          <Landmark className="size-2.5" />
          Government
        </Chip>
      )}
      {tags.clearance && (
        <Chip
          bg="color-mix(in srgb, var(--state-error) 12%, transparent)"
          fg="var(--state-error)"
          border="color-mix(in srgb, var(--state-error) 30%, transparent)"
        >
          <Shield className="size-2.5" />
          Clearance
        </Chip>
      )}
      {tags.citizenship && (
        <Chip
          bg="color-mix(in srgb, var(--accent-primary) 12%, transparent)"
          fg="var(--accent-text)"
          border="color-mix(in srgb, var(--accent-primary) 28%, transparent)"
        >
          <Flag className="size-2.5" />
          AU citizen / PR
        </Chip>
      )}
      {arr && (
        <Chip bg={arr.bg} fg={arr.fg}>
          <Wifi className="size-2.5" />
          {tags.arrangement}
        </Chip>
      )}
      {tags.workType && (
        <Chip bg="var(--bg-surface-2)" fg="var(--text-secondary)" border="var(--border-default)">
          <Briefcase className="size-2.5" />
          {tags.workType}
        </Chip>
      )}
      {tags.locationType === "Regional" && (
        <Chip
          bg="color-mix(in srgb, var(--state-success) 14%, transparent)"
          fg="var(--state-success)"
          border="color-mix(in srgb, var(--state-success) 28%, transparent)"
        >
          <Trees className="size-2.5" />
          Regional
        </Chip>
      )}
      {tags.locationType === "City" && (
        <Chip bg="var(--bg-surface-2)" fg="var(--text-secondary)" border="var(--border-default)">
          <MapPin className="size-2.5" />
          City
        </Chip>
      )}
      {tags.seniority && (
        <Chip bg="var(--bg-surface-2)" fg="var(--text-secondary)" border="var(--border-default)">
          <GraduationCap className="size-2.5" />
          {tags.seniority}
        </Chip>
      )}
      {tags.tech.slice(0, maxTech).map((t) => (
        <Chip key={t} bg="var(--bg-surface-2)" fg="var(--text-muted)" border="var(--border-default)">
          {t}
        </Chip>
      ))}
    </div>
  );
}
