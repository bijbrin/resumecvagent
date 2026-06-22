"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CompanyResearch } from "@/lib/state/resumeState";

/**
 * Company research summary card. Shared by the optimizer results view and the
 * application detail page. Renders nothing when there is no meaningful content.
 */
export function CompanyCard({ research }: { research: CompanyResearch }) {
  const hasContent =
    research.mission ||
    research.values.length > 0 ||
    research.recentNews.length > 0 ||
    research.techStack.length > 0 ||
    research.cultureNotes;

  if (!hasContent && !research.name) return null;

  return (
    <div
      className="rounded-lg border p-5 flex flex-col gap-4"
      style={{
        background:  "var(--bg-surface)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: "var(--accent-primary)" }}
          />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Company Research
            {research.name ? ` — ${research.name}` : ""}
          </h3>
        </div>
        {research.website && (
          <a
            href={research.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--accent-primary)" }}
          >
            {research.website.replace(/^https?:\/\/(www\.)?/, "")}
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      {/* Mission */}
      {research.mission && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            Mission
          </p>
          <p className="text-sm italic" style={{ color: "var(--text-secondary)" }}>
            {research.mission}
          </p>
        </div>
      )}

      {/* Values */}
      {research.values.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            Values
          </p>
          <ul className="flex flex-col gap-1">
            {research.values.map((v, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: "var(--accent-primary)" }} />
                {v}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Culture notes */}
      {research.cultureNotes && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            Culture
          </p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {research.cultureNotes}
          </p>
        </div>
      )}

      {/* Recent news */}
      {research.recentNews.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            Recent News
          </p>
          <ul className="flex flex-col gap-1">
            {research.recentNews.map((n, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: "var(--text-faint)" }} />
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tech stack */}
      {research.techStack.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            Tech Stack
          </p>
          <div className="flex flex-wrap gap-1.5">
            {research.techStack.map((t, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-xs font-normal px-2 py-0.5"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-secondary)",
                  background: "var(--bg-base)",
                }}
              >
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
