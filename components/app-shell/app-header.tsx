"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AccentSwitcher } from "./accent-switcher";
import { MobileNav } from "@/components/mobile-nav";

// Derives the contextual eyebrow + title from the current route. Presentation
// only — no data fetching, no route changes.
function sectionFor(pathname: string): { eyebrow: string; title: string } {
  const p = pathname.replace(/\/+$/, "");
  if (p === "/optimizer") return { eyebrow: "WORKSPACE · OPTIMIZER", title: "New optimization" };
  if (p === "/applications") return { eyebrow: "WORKSPACE · APPLICATIONS", title: "Applications" };
  if (p.startsWith("/applications/")) return { eyebrow: "WORKSPACE · APPLICATION", title: "Application detail" };
  if (p === "/history") return { eyebrow: "WORKSPACE · HISTORY", title: "Optimization history" };
  if (p === "/job-scraper") return { eyebrow: "WORKSPACE · JOB SCANNER", title: "Job scanner" };
  if (p.startsWith("/results/")) return { eyebrow: "WORKSPACE · RESULT", title: "Optimization result" };
  return { eyebrow: "WORKSPACE", title: "ResumeCV Agent" };
}

export function AppHeader({ themeToggle }: { themeToggle: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { eyebrow, title } = sectionFor(pathname);

  return (
    <header
      className="flex items-center justify-between gap-4 px-5 sm:px-7 py-[17px] relative z-[2]"
      style={{
        borderBottom: "1px solid var(--border-default)",
        background: "color-mix(in srgb, var(--bg-base) 55%, transparent)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="lg:hidden">
          <MobileNav userId="app" />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span
            className="font-mono text-[10.5px] whitespace-nowrap truncate"
            style={{ letterSpacing: "0.1em", color: "var(--text-muted)" }}
          >
            {eyebrow}
          </span>
          <span className="text-[18px] font-semibold tracking-[-0.01em] truncate" style={{ color: "var(--text-primary)" }}>
            {title}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        <AccentSwitcher />
        {themeToggle}
      </div>
    </header>
  );
}
