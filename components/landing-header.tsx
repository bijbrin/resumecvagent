"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { AccentSwitcher } from "@/components/app-shell/accent-switcher";
import { MobileNav } from "@/components/mobile-nav";

// Sticky marketing header. Mirrors the in-app AppHeader treatment (themed
// translucent bar + accent switcher + theme toggle) so the landing page reads
// as the same product. The landing page has no sidebar, so account / Get
// Started lives here.
export function LandingHeader({
  userId,
  themeToggle,
}: {
  userId: string | null;
  themeToggle: ReactNode;
}) {
  return (
    <header className="landing-header">
      <div className="landing-header-inner">
        {/* Brand lockup — same mark as the app sidebar */}
        <Link href="/" className="flex items-center gap-[11px] hover:opacity-90 transition-opacity">
          <span className="landing-logo-mark">R</span>
          <span className="flex flex-col leading-[1.05]">
            <span className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-primary)" }}>
              ResumeCV
            </span>
            <span className="font-mono text-[9px] mt-[3px]" style={{ letterSpacing: "0.24em", color: "var(--text-muted)" }}>
              A&nbsp;G&nbsp;E&nbsp;N&nbsp;T
            </span>
          </span>
        </Link>

        {/* Right cluster — switchers + auth (no in-page section nav) */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Desktop: switchers live in the bar; on mobile they move into the menu */}
          <div className="hidden lg:flex items-center gap-5">
            <AccentSwitcher />
            {themeToggle}
            {userId ? (
              <>
                <Link href="/optimizer" className="btn-cta" style={{ padding: "8px 18px", fontSize: 13 }}>
                  Open Optimizer
                </Link>
                <UserButton appearance={{ elements: { userButtonAvatarBox: { width: 32, height: 32 } } }} />
              </>
            ) : (
              <>
                <Link href="/sign-in" className="landing-nav-link">Sign in</Link>
                <Link href="/sign-up" className="btn-cta" style={{ padding: "8px 18px", fontSize: 13 }}>
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile: account stays in the bar, the rest lives in the menu */}
          {userId && (
            <div className="lg:hidden">
              <UserButton appearance={{ elements: { userButtonAvatarBox: { width: 32, height: 32 } } }} />
            </div>
          )}
          <MobileNav userId={userId} themeToggle={themeToggle} />
        </div>
      </div>
    </header>
  );
}
