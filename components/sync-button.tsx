"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Triggers a folder ↔ DB sync via POST /api/sync, then refreshes the page.
 * The API route refuses to run unless the app is served locally.
 */
export function SyncButton({ mode = "all" }: { mode?: "all" | "import" | "export" }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "syncing" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setState("syncing");
    setMessage(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Sync failed (${res.status})`);
      }
      setState("idle");
      router.refresh();
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Sync failed");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={state === "syncing"}
        className="gap-1.5 text-xs h-8 px-3"
        style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
      >
        <RefreshCw className={`size-3.5 ${state === "syncing" ? "animate-spin" : ""}`} />
        {state === "syncing" ? "Syncing…" : "Sync folders"}
      </Button>
      {message && (
        <span className="text-xs" style={{ color: "var(--state-error)" }}>
          {message}
        </span>
      )}
    </div>
  );
}
