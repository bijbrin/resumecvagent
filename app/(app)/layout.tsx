import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <header
        className="glass sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 lg:px-7 py-3.5 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <span
            className="flex items-center justify-center rounded-[9px] shadow-[0_4px_14px_-4px_rgba(104,67,236,0.6)]"
            style={{ width: 30, height: 30, background: "var(--accent-gradient)" }}
          >
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="var(--text-on-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="13" height="18" rx="2" />
              <path d="M8 8h6M8 12h6M8 16h4" />
            </svg>
          </span>
          <span className="font-display font-semibold text-[16px] tracking-tight" style={{ color: "var(--text-primary)" }}>
            Resume Optimizer
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <nav className="hidden md:flex items-center gap-4 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
            <Link href="/applications" className="hover:text-[var(--text-primary)] transition-colors">
              Applications
            </Link>
            <Link href="/optimizer" className="hover:text-[var(--text-primary)] transition-colors">
              Optimizer
            </Link>
            <Link href="/history" className="hover:text-[var(--text-primary)] transition-colors">
              History
            </Link>
            <Link href="/job-scraper" className="hover:text-[var(--text-primary)] transition-colors">
              Job Scraper
            </Link>
          </nav>
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <div className="hidden md:block">
            <UserButton />
          </div>
          <div className="md:hidden">
            <MobileNav userId="app" />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
