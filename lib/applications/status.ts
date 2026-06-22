/**
 * lib/applications/status.ts
 *
 * Display metadata for ApplicationStatus. Pure (no server-only / DB) so both
 * server and client components can import it.
 */

export const APPLICATION_STATUSES = [
  "DRAFT", "TAILORING", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "ARCHIVED",
] as const;

export type ApplicationStatusValue = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatusValue, string> = {
  DRAFT:     "Draft",
  TAILORING: "Tailoring",
  APPLIED:   "Applied",
  INTERVIEW: "Interview",
  OFFER:     "Offer",
  REJECTED:  "Rejected",
  ARCHIVED:  "Archived",
};

/** Pipeline columns shown on the board, in order. */
export const BOARD_COLUMNS: ApplicationStatusValue[] = [
  "DRAFT", "TAILORING", "APPLIED", "INTERVIEW", "OFFER", "REJECTED",
];

/** Badge styling for a 0–100 fit score (null → neutral). */
export function fitScoreStyle(score: number | null): React.CSSProperties {
  if (score === null) return { background: "var(--bg-surface)", color: "var(--text-muted)", borderColor: "var(--border-default)" };
  if (score >= 70)    return { background: "var(--state-success)", color: "var(--text-on-accent)", borderColor: "var(--state-success)" };
  if (score >= 50)    return { background: "var(--state-warning)", color: "var(--text-on-accent)", borderColor: "var(--state-warning)" };
  return                     { background: "var(--state-error)", color: "var(--text-on-accent)", borderColor: "var(--state-error)" };
}

/** Badge styling per status, using the app's CSS design tokens. */
export function statusStyle(status: string): React.CSSProperties {
  switch (status) {
    case "OFFER":
      return { background: "var(--state-success)", color: "#fff", borderColor: "var(--state-success)" };
    case "INTERVIEW":
      return { background: "var(--accent-primary)", color: "#fff", borderColor: "var(--accent-primary)" };
    case "APPLIED":
      return {
        background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)",
        color: "var(--accent-primary)",
        borderColor: "color-mix(in srgb, var(--accent-primary) 40%, transparent)",
      };
    case "TAILORING":
      return {
        background: "color-mix(in srgb, var(--state-warning, #d97706) 12%, transparent)",
        color: "var(--state-warning, #d97706)",
        borderColor: "color-mix(in srgb, var(--state-warning, #d97706) 40%, transparent)",
      };
    case "REJECTED":
      return { background: "var(--bg-base)", color: "var(--text-faint)", borderColor: "var(--border-default)" };
    case "ARCHIVED":
      return { background: "var(--bg-base)", color: "var(--text-faint)", borderColor: "var(--border-default)" };
    default: // DRAFT
      return { background: "var(--bg-base)", color: "var(--text-secondary)", borderColor: "var(--border-default)" };
  }
}
