import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-7 py-3.5 border-b"
        style={{ background: "var(--bg-base)", borderColor: "var(--border-default)" }}
      >
        <Link href="/optimizer" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="13" height="18" rx="2" />
            <path d="M8 8h6M8 12h6M8 16h4" />
            <path d="M17 7l3 1.5v8L17 18" stroke="var(--accent-primary)" />
          </svg>
          <span className="font-semibold text-[15px] tracking-tight" style={{ color: "var(--text-primary)" }}>
            Resume Optimizer
          </span>
          <span
            className="mono text-[11px] px-1.5 py-0.5 rounded-full border"
            style={{ color: "var(--text-faint)", borderColor: "var(--border-default)", background: "var(--bg-surface)" }}
          >
            v1.0
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-4 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            <Link href="/optimizer" className="hover:text-[var(--text-primary)] transition-colors">
              Optimizer
            </Link>
            <a href="#" className="hover:text-[var(--text-primary)] transition-colors">API docs</a>
          </nav>
          <ThemeToggle />
          <UserButton />
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
