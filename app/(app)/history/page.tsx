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

export default function HistoryPage() {
  const [entries, setEntries] = useState<SearchHistoryEntry[]>(getHistory);

  function handleDelete(id: string) {
    deleteSearch(id);
    setEntries(getHistory());
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
            <div
              key={entry.id}
              className="flex items-center justify-between gap-4 rounded-lg border px-5 py-4"
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
                <div className="flex items-center gap-3 mt-1">
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {new Date(entry.timestamp).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {entry.results.fitScore !== null && (
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Fit score: {entry.results.fitScore}/100
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/results/${entry.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8 px-3"
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
                  className="p-1.5 rounded hover:opacity-70 transition-opacity"
                  style={{ color: "var(--text-faint)" }}
                  aria-label="Delete this search"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}