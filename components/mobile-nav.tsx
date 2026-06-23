"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, X, Sparkles, Search, Home, Briefcase, LogIn, UserPlus } from "lucide-react";
import { AccentSwitcher } from "@/components/app-shell/accent-switcher";

interface MobileNavProps {
  userId: string | null;
  themeToggle?: ReactNode;
}

export function MobileNav({ userId, themeToggle }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const isAppContext = userId === "app";

  // The landing page has no in-page section nav anymore — the dropdown only
  // carries the theme/accent switchers and the auth actions. The in-app context
  // keeps its workspace links.
  const appLinks = [
    { href: "/optimizer", label: "Optimizer", icon: Sparkles },
    { href: "/applications", label: "Applications", icon: Briefcase },
    { href: "/job-scraper", label: "Job Scraper", icon: Search },
    { href: "/", label: "Home", icon: Home },
  ];

  const links = isAppContext ? appLinks : [];

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg transition-colors"
        style={{ color: "var(--text-muted)" }}
        aria-label="Toggle menu"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open && (
        <div
          className="fixed inset-x-0 top-[60px] z-50 border-b px-6 py-5 flex flex-col gap-1"
          style={{
            background: "color-mix(in srgb, var(--bg-base) 92%, transparent)",
            borderColor: "var(--border-default)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="sidebar-nav-item flex items-center gap-3 text-sm font-medium py-2.5 px-2 rounded-lg"
            >
              {l.icon && <l.icon className="size-4 flex-shrink-0" />}
              {l.label}
            </Link>
          ))}

          {/* Theme + accent switchers (landing has no header switchers on mobile) */}
          {!isAppContext && (
            <div
              className="flex items-center justify-between gap-3 py-2 px-1 mb-1 border-b"
              style={{ borderColor: "var(--border-default)" }}
            >
              <AccentSwitcher className="flex" />
              {themeToggle}
            </div>
          )}

          <div className={links.length ? "pt-3 mt-2 border-t" : ""} style={{ borderColor: "var(--border-default)" }}>
            {userId && userId !== "app" ? (
              <Link
                href="/optimizer"
                onClick={() => setOpen(false)}
                className="btn-cta w-full justify-center"
              >
                <Sparkles className="size-4" />
                Open Optimizer
              </Link>
            ) : isAppContext ? null : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 text-sm py-2 px-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <LogIn className="size-4" />
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setOpen(false)}
                  className="btn-cta justify-center"
                >
                  <UserPlus className="size-4" />
                  Get Started — Free
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
