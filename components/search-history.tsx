"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, ExternalLink } from "lucide-react";
import {
  getHistory,
  deleteSearch,
  type SearchHistoryEntry,
} from "@/lib/search-history";
import { Button } from "@/components/ui/button";

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
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {entry.jobUrl}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                {new Date(entry.timestamp).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {entry.results.fitScore !== null &&
                  ` · Fit ${entry.results.fitScore}/100`}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/results/${entry.id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7 px-2.5"
                  style={{
                    borderColor: "var(--border-default)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <ExternalLink className="size-3" />
                  View
                </Button>
              </Link>
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
        ))}
      </div>
    </div>
  );
}