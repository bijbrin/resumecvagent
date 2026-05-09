import { ThemeToggle } from "@/components/theme-toggle";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// In Clerk v7 / Next.js App Router, auth() replaces SignedIn/SignedOut
// for Server Components — we read the session once and branch in JSX.
export default async function Home() {
  const { userId } = await auth();
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-7 py-3.5 border-b"
        style={{ background: "var(--bg-base)", borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="13" height="18" rx="2" />
            <path d="M8 8h6M8 12h6M8 16h4" />
            <path d="M17 7l3 1.5v8L17 18" stroke="var(--accent-primary)" />
          </svg>
          <span className="font-semibold text-[15px] tracking-tight">Resume Optimizer</span>
          <span
            className="mono text-[11px] px-1.5 py-0.5 rounded-full border"
            style={{ color: "var(--text-faint)", borderColor: "var(--border-default)", background: "var(--bg-surface)" }}
          >
            v1.0 · Next.js 16
          </span>
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-4 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Runs</a>
            <a href="#" className="hover:text-[var(--text-primary)] transition-colors">API docs</a>
          </nav>
          <ThemeToggle />
          <div
            className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-semibold mono"
            style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
          >
            RO
          </div>
        </div>
      </header>

      {/* Placeholder body */}
      <main className="flex-1 flex flex-col items-center justify-center gap-6 p-10">
        <div
          className="rounded-xl border p-8 max-w-md w-full text-center"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)", boxShadow: "var(--shadow-2)" }}
        >
          <div className="text-4xl mb-4">✍️</div>
          <h1 className="text-xl font-semibold tracking-tight mb-2" style={{ color: "var(--text-primary)" }}>
            Resume Optimizer
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Paste a job URL and your resume. The agent researches the company,
            analyzes your gaps, and rewrites your materials — ATS-ready.
          </p>
          <div className="mt-6">
            {userId ? (
              <Link href="/optimizer" className="w-full block">
                <Button style={{ background: "var(--accent-primary)" }} className="text-white w-full">
                  Go to Optimizer →
                </Button>
              </Link>
            ) : (
              <Link href="/sign-in" className="w-full block">
                <Button style={{ background: "var(--accent-primary)" }} className="text-white w-full">
                  Get started — sign in
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Token preview — shows the design tokens switching live */}
        <div className="grid grid-cols-2 gap-3 max-w-md w-full text-xs">
          {[
            { label: "--bg-base",        value: "var(--bg-base)"        },
            { label: "--bg-surface",     value: "var(--bg-surface)"     },
            { label: "--accent-primary", value: "var(--accent-primary)" },
            { label: "--text-muted",     value: "var(--text-muted)"     },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-lg border px-3 py-2"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
            >
              <div
                className="w-4 h-4 rounded flex-shrink-0 border"
                style={{ background: value, borderColor: "var(--border-strong)" }}
              />
              <span className="mono truncate" style={{ color: "var(--text-muted)" }}>{label}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
