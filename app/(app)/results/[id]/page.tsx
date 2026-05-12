"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getSearchById,
  type SearchHistoryEntry,
} from "@/lib/search-history";
import { ResultsView } from "@/components/results-view";
import { Button } from "@/components/ui/button";

export default function ResultPage() {
  const params = useParams();
  const id =
    typeof params.id === "string" ? params.id : (params.id?.[0] ?? "");

  // localStorage read is synchronous — lazy initializer avoids an effect.
  const [entry] = useState<SearchHistoryEntry | null>(() => getSearchById(id));

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-sm text-muted-foreground">
          Result not found. It may have been cleared from this browser.
        </p>
        <Link href="/history">
          <Button
            variant="outline"
            size="sm"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            Back to history
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start py-10 px-4 max-w-5xl mx-auto gap-6">
      <div className="flex items-center gap-3">
        <Link href="/history">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8 px-3"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            <ArrowLeft className="size-3" />
            Back to history
          </Button>
        </Link>
        <p
          className="text-xs truncate"
          style={{ color: "var(--text-faint)", maxWidth: "40ch" }}
        >
          {entry.jobUrl}
        </p>
      </div>

      <ResultsView
        data={entry.results}
        onReset={() => {
          /* no-op — reset isn't meaningful on the history view */
        }}
      />
    </div>
  );
}
