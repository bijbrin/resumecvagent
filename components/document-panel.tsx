"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Eye, FileType2, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type View = "md" | "docx" | "pdf";
type Status = "idle" | "loading" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Document panel shared by the Resume and Cover Letter tabs. Three views:
 *  - "Markdown": an editable .md editor with a Save button. Saving writes the
 *    file back to the job folder; the .docx / .pdf are regenerated from it.
 *  - "Formatted (.docx)": the generated .docx rendered in-browser via
 *    docx-preview.
 *  - "PDF": the generated .pdf embedded inline.
 * Plus Download buttons that stream the .docx / .pdf as attachments.
 *
 * `basePath` selects the API endpoints, e.g. "resume" → /api/applications/:id/
 * resume.docx and resume.pdf; "cover-letter" → cover-letter.docx / .pdf.
 */
export function DocumentPanel({
  appId,
  markdown,
  basePath,
  emptyLabel,
}: {
  appId: string;
  markdown: string | null;
  basePath: "resume" | "cover-letter";
  emptyLabel: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("md");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Editing state. `saved` is the last persisted content; `draft` is the editor.
  const [saved, setSaved] = useState(markdown ?? "");
  const [draft, setDraft] = useState(markdown ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  // Bumped after each save to cache-bust the .docx / .pdf previews + downloads.
  const [rev, setRev] = useState(0);

  const kind = basePath === "resume" ? "resume" : "coverLetter";
  const dirty = draft !== saved;
  const docxUrl = `/api/applications/${appId}/${basePath}.docx?v=${rev}`;
  const pdfUrl = `/api/applications/${appId}/${basePath}.pdf?v=${rev}`;

  useEffect(() => {
    if (view !== "docx") return;
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(docxUrl);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Could not render (${res.status})`);
        }
        const blob = await res.blob();
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        el.innerHTML = "";
        await renderAsync(blob, el, undefined, {
          className: "docx-rendered",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
        });
        if (!cancelled) setStatus("idle");
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Failed to render document");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [view, docxUrl]);

  if (!markdown) {
    return (
      <p className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        {emptyLabel}
      </p>
    );
  }

  function switchTo(next: View) {
    setError(null);
    if (next === "docx") setStatus("loading");
    setView(next);
  }

  async function save() {
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch(`/api/applications/${appId}/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, content: draft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `Save failed (${res.status})`);
      }
      setSaved(draft);
      setRev((r) => r + 1); // refresh .docx / .pdf previews + downloads
      setSaveState("saved");
      router.refresh();      // keep server-rendered content in sync
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  }

  const tabBtn = (v: View, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => switchTo(v)}
      className="inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors"
      style={view === v
        ? { background: "var(--accent-primary)", color: "var(--text-on-accent)" }
        : { color: "var(--text-secondary)" }}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div
          className="inline-flex rounded-md border p-0.5"
          style={{ borderColor: "var(--border-default)" }}
        >
          {tabBtn("md", <FileText className="size-3.5" />, "Markdown")}
          {tabBtn("docx", <Eye className="size-3.5" />, "Formatted (.docx)")}
          {tabBtn("pdf", <FileType2 className="size-3.5" />, "PDF")}
        </div>

        <div className="flex items-center gap-2">
          <a href={`${docxUrl}&download=1`} download>
            <Button
              variant="outline" size="sm" className="gap-1.5 text-xs"
              style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
            >
              <Download className="size-3.5" /> .docx
            </Button>
          </a>
          <a href={`${pdfUrl}&download=1`} download>
            <Button
              variant="outline" size="sm" className="gap-1.5 text-xs"
              style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
            >
              <Download className="size-3.5" /> .pdf
            </Button>
          </a>
        </div>
      </div>

      {/* Markdown editor */}
      {view === "md" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs" style={{
              color: saveState === "error"
                ? "var(--state-error)"
                : dirty ? "var(--state-warning)" : "var(--text-muted)",
            }}>
              {saveState === "saving"
                ? "Saving…"
                : saveState === "error"
                  ? (saveError ?? "Save failed")
                  : dirty
                    ? "Unsaved changes — Save to update the .docx and .pdf"
                    : saveState === "saved"
                      ? "Saved ✓ — .docx and .pdf updated"
                      : "Edit the markdown, then Save to regenerate the .docx and .pdf"}
            </span>
            <Button
              size="sm"
              onClick={save}
              disabled={!dirty || saveState === "saving"}
              className="gap-1.5 text-xs shadow-[0_8px_24px_-6px_rgba(104,67,236,0.55)] disabled:shadow-none"
              style={dirty
                ? { background: "var(--accent-gradient)", color: "var(--text-on-accent)" }
                : undefined}
            >
              {saveState === "saved" && !dirty
                ? <><Check className="size-3.5" /> Saved</>
                : <><Save className="size-3.5" /> Save changes</>}
            </Button>
          </div>
          <Textarea
            value={draft}
            onChange={(e) => { setDraft(e.target.value); if (saveState !== "idle") setSaveState("idle"); }}
            spellCheck={false}
            className="font-mono text-sm leading-relaxed"
            style={{ background: "var(--bg-base)", borderColor: "var(--border-default)", color: "var(--text-primary)", minHeight: "60vh", maxHeight: "70vh" }}
          />
        </div>
      )}

      {/* Formatted .docx view */}
      {view === "docx" && (
        <div
          className="rounded-lg border overflow-auto"
          style={{ borderColor: "var(--border-default)", background: "var(--paper)", maxHeight: "70vh" }}
        >
          {status === "loading" && (
            <p className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Rendering document…
            </p>
          )}
          {status === "error" && (
            <p className="py-10 text-center text-sm" style={{ color: "var(--state-error)" }}>
              {error}
            </p>
          )}
          <div ref={containerRef} className="flex justify-center py-4" />
        </div>
      )}

      {/* PDF view */}
      {view === "pdf" && (
        <iframe
          key={pdfUrl}
          src={pdfUrl}
          title={`${basePath} PDF`}
          className="w-full rounded-lg border"
          style={{ borderColor: "var(--border-default)", background: "var(--paper)", height: "70vh" }}
        />
      )}
    </div>
  );
}
