"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, ExternalLink, MapPin, Shield, Link2 } from "lucide-react";
import {
  getHistory,
  deleteSearch,
  type SearchHistoryEntry,
} from "@/lib/search-history";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function fitScoreStyle(score: number): React.CSSProperties {
  if (score >= 70) return { background: "var(--state-success)", color: "#fff", borderColor: "var(--state-success)" };
  if (score >= 50) return { background: "var(--state-warning, #d97706)", color: "#fff", borderColor: "var(--state-warning, #d97706)" };
  return { background: "var(--state-error)", color: "#fff", borderColor: "var(--state-error)" };
}

function remoteLabel(remote: boolean | null | undefined): string | null {
  if (remote === true)  return "Remote";
  if (remote === false) return "On-site";
  return null;
}

export function SearchHistory() {
  const [entries, setEntries] = useState<SearchHistoryEntry[]>(() =>
    getHistory().slice(0, 5)
  );

  if (entries.length === 0) return null;

  function handleDelete(id: string) {
    deleteSearch(id);
    setEntries(getHistory().slice(0, 5));
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          Recent searches
        </h2>
        <Link
          href="/history"
          className="text-xs hover:underline"
          style={{ color: "var(--accent-primary)" }}
        >
          View all
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {entries.map((entry) => {
          const jd = entry.results.jobDetails;
          const title    = jd?.title    || null;
          const company  = jd?.company  || null;
          const workMode = remoteLabel(jd?.remote);
          const location = jd?.location || null;
          const clearance    = jd?.securityClearance   || null;
          const citizenship  = jd?.citizenshipRequired || null;
          const displayTitle = [title, company].filter(Boolean).join(" — ") || "Untitled search";

          return (
            <div
              key={entry.id}
              className="rounded-lg border px-4 py-3 flex flex-col gap-2"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
            >
              {/* Title + actions row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold truncate leading-snug"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {displayTitle}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                    {new Date(entry.timestamp).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/results/${entry.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-7 px-2.5"
                      style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                    >
                      <ExternalLink className="size-3" />
                      View
                    </Button>
                  </Link>
                  <a href={entry.jobUrl} target="_blank" rel="noopener noreferrer">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-7 px-2.5"
                      style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                    >
                      <Link2 className="size-3" />
                      Job
                    </Button>
                  </a>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-1 rounded hover:opacity-70 transition-opacity"
                    style={{ color: "var(--text-faint)" }}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Meta badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Fit score */}
                {entry.results.fitScore !== null && (
                  <Badge
                    variant="outline"
                    style={fitScoreStyle(entry.results.fitScore)}
                    className="text-xs font-semibold px-2"
                  >
                    Fit {entry.results.fitScore}/100
                  </Badge>
                )}

                {/* Remote / on-site */}
                {workMode && (
                  <Badge
                    variant="outline"
                    className="text-xs font-medium px-2"
                    style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)", background: "var(--bg-base)" }}
                  >
                    {workMode}
                  </Badge>
                )}

                {/* Location */}
                {location && (
                  <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <MapPin className="size-3 shrink-0" />
                    {location}
                  </span>
                )}

                {/* Security clearance */}
                {clearance && (
                  <Badge
                    variant="outline"
                    className="text-xs font-medium px-2 gap-1"
                    style={{
                      borderColor: "color-mix(in srgb, var(--state-warning, #d97706) 60%, transparent)",
                      color: "var(--state-warning, #d97706)",
                      background: "color-mix(in srgb, var(--state-warning, #d97706) 8%, transparent)",
                    }}
                  >
                    <Shield className="size-3" />
                    {clearance}
                  </Badge>
                )}

                {/* Citizenship */}
                {citizenship && (
                  <Badge
                    variant="outline"
                    className="text-xs font-medium px-2"
                    style={{
                      borderColor: "color-mix(in srgb, var(--state-warning, #d97706) 60%, transparent)",
                      color: "var(--state-warning, #d97706)",
                      background: "color-mix(in srgb, var(--state-warning, #d97706) 8%, transparent)",
                    }}
                  >
                    {citizenship}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
