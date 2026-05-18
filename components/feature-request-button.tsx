"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Status = "idle" | "sending" | "sent" | "error";

export function FeatureRequestButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to send.");
      }
      setStatus("sent");
      setMessage("");
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 1600);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to send.");
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Request a feature"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group fixed bottom-5 right-5 z-50 flex items-center rounded-full bg-[var(--accent-primary)] p-3 text-sm font-medium text-white shadow-lg shadow-[var(--accent-primary)]/30 transition-all hover:shadow-xl hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-primary)]/40 active:scale-95",
          open && "opacity-0 pointer-events-none"
        )}
      >
        <MessageCircle className="size-5 shrink-0" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-current opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:mr-1 group-hover:max-w-[180px] group-hover:opacity-100">
          Request a feature
        </span>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Request a feature"
          className="fixed bottom-5 right-5 z-50 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-black/20 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Request a feature</div>
              <div className="text-xs text-muted-foreground">
                Send a message — I read every one.
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <X />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fr-name" className="text-xs font-medium text-muted-foreground">
                Your name <span className="opacity-60">(optional)</span>
              </label>
              <Input
                id="fr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                disabled={status === "sending" || status === "sent"}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="fr-email" className="text-xs font-medium text-muted-foreground">
                Your email <span className="opacity-60">(optional, for reply)</span>
              </label>
              <Input
                id="fr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={status === "sending" || status === "sent"}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="fr-message" className="text-xs font-medium text-muted-foreground">
                Message
              </label>
              <Textarea
                id="fr-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe the feature you'd like to see…"
                rows={4}
                required
                maxLength={5000}
                disabled={status === "sending" || status === "sent"}
              />
            </div>

            {status === "error" && errorMsg && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {errorMsg}
              </div>
            )}

            <Button
              type="submit"
              disabled={!message.trim() || status === "sending" || status === "sent"}
              className="self-end"
            >
              {status === "sending" && <Loader2 className="animate-spin" />}
              {status === "sent" && <Check />}
              {(status === "idle" || status === "error") && <Send />}
              {status === "sent" ? "Sent" : status === "sending" ? "Sending…" : "Send"}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
