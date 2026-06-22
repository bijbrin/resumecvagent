"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage } from "@/lib/sync/chat";

const SUGGESTIONS = [
  "What are my biggest gaps for this role?",
  "Rewrite my resume summary for this JD.",
  "Give me 3 likely interview questions and strong answers.",
];

/**
 * AI chat grounded in the application's documents. Persists to Chat.md via the
 * /api/applications/:id/chat route; loads prior turns from the `initial` prop.
 */
export function ApplicationChat({
  appId,
  initial,
}: {
  appId: string;
  initial: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setSending(true);
    try {
      const res = await fetch(`/api/applications/${appId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || `Failed (${res.status})`);
      setMessages((m) => [...m, data.reply as ChatMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
      // Roll the unanswered user message back out so they can retry.
      setMessages((m) => m.slice(0, -1));
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="flex flex-col rounded-lg border"
      style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)", height: "64vh" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{ borderColor: "var(--border-default)" }}
      >
        <Sparkles className="size-4" style={{ color: "var(--accent-primary)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Ask about this application
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="m-auto flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Grounded in this role&apos;s JD, your resume, cover letter, and review.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-md border px-3 py-2 text-left text-xs transition-colors hover:border-[var(--accent-primary)]"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "user" ? "self-end" : "self-start"
            }`}
            style={
              m.role === "user"
                ? { background: "var(--accent-primary)", color: "var(--text-on-accent)" }
                : { background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }
            }
          >
            {m.content}
          </div>
        ))}

        {sending && (
          <div
            className="self-start rounded-lg border px-3.5 py-2.5 text-sm"
            style={{ background: "var(--bg-base)", borderColor: "var(--border-default)", color: "var(--text-muted)" }}
          >
            <span className="animate-pulse">Thinking…</span>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-3" style={{ borderColor: "var(--border-default)" }}>
        {error && (
          <p className="mb-2 text-xs" style={{ color: "var(--state-error)" }}>{error}</p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask a question, or request a rewrite…  (Enter to send, Shift+Enter for newline)"
            spellCheck={false}
            className="min-h-[44px] max-h-40 resize-none text-sm"
            style={{ background: "var(--bg-base)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
          />
          <Button
            size="sm"
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            className="gap-1.5 text-xs h-11 shrink-0"
            style={{ background: "var(--accent-gradient)", color: "var(--text-on-accent)" }}
          >
            <Send className="size-3.5" /> Send
          </Button>
        </div>
      </div>
    </div>
  );
}
