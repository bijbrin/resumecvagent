"use client";

import { useEffect, useState } from "react";
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

function HistoryCard({ entry, onDelete }: { entry: SearchHistoryEntry; onDelete: () => void }) {
  const jd = entry.results.jobDetails;
  const title   = jd?.title   || null;
  const company = jd?.company || null;
  const workMode = remoteLabel(jd?.remote);
  const location = jd?.location || null;
  const clearance = jd?.securityClearance || null;
  const citizenship = jd?.citizenshipRequired || null;

  const displayTitle = [title, company].filter(Boolean).join(" — ") || "Untitled search";

  return (
    <div
      className="rounded-lg border px-5 py-4 flex flex-col gap-3"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold leading-snug"
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
              className="gap-1.5 text-xs h-8 px-3"
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
              className="gap-1.5 text-xs h-8 px-3"
              style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
            >
              <Link2 className="size-3" />
              Job
            </Button>
          </a>
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-faint)" }}
            aria-label="Delete this search"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Meta badges */}
      <div className="flex flex-wrap items-center gap-2">
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
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
              background: "var(--bg-base)",
            }}
          >
            {workMode}
          </Badge>
        )}

        {/* Location */}
        {location && (
          <span
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
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
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<SearchHistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setEntries(getHistory());
    setLoaded(true);
  }, []);

  function handleDelete(id: string) {
    deleteSearch(id);
    setEntries(getHistory());
  }

  if (!loaded) {
    return <div className="max-w-3xl mx-auto py-12 px-4" aria-hidden />;
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Search History
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your past resume optimizations, saved in this browser.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">No searches yet.</p>
          <Link
            href="/optimizer"
            className="mt-3 inline-block text-sm hover:underline"
            style={{ color: "var(--accent-primary)" }}
          >
            Go to optimizer
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              onDelete={() => handleDelete(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
