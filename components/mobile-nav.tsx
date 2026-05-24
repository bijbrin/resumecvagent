"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Sparkles, History, Search, Home, LogIn, UserPlus } from "lucide-react";

interface MobileNavProps {
  userId: string | null;
}

export function MobileNav({ userId }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const isAppContext = userId === "app";

  const appLinks = [
    { href: "/optimizer", label: "Optimizer", icon: Sparkles },
    { href: "/history", label: "History", icon: History },
    { href: "/job-scraper", label: "Job Scraper", icon: Search },
    { href: "/", label: "Home", icon: Home },
  ];

  const landingLinks = userId
    ? [
        { href: "/optimizer", label: "Optimizer", icon: Sparkles },
        { href: "/history", label: "History", icon: History },
        { href: "/job-scraper", label: "Job Scraper", icon: Search },
      ]
    : [
        { href: "/#how-it-works", label: "How It Works", icon: null },
        { href: "/#features", label: "Features", icon: null },
        { href: "/#testimonials", label: "Reviews", icon: null },
      ];

  const links = isAppContext ? appLinks : landingLinks;

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg transition-colors hover:bg-white/10"
        aria-label="Toggle menu"
      >
        {open ? (
          <X className="size-5" style={{ color: isAppContext ? "var(--text-primary)" : "#fff" }} />
        ) : (
          <Menu className="size-5" style={{ color: isAppContext ? "var(--text-muted)" : "rgba(255,255,255,0.7)" }} />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-x-0 top-[60px] z-50 border-b px-6 py-5 flex flex-col gap-1"
          style={{
            background: isAppContext ? "var(--bg-base)" : "rgba(5,9,26,0.97)",
            borderColor: isAppContext ? "var(--border-default)" : "rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 text-sm font-medium py-2.5 px-2 rounded-lg transition-colors"
              style={{ color: isAppContext ? "var(--text-secondary)" : "rgba(255,255,255,0.7)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = isAppContext ? "var(--bg-surface)" : "rgba(255,255,255,0.05)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              {l.icon && <l.icon className="size-4 flex-shrink-0" />}
              {l.label}
            </Link>
          ))}
          <div className="pt-3 mt-2 border-t" style={{ borderColor: isAppContext ? "var(--border-default)" : "rgba(255,255,255,0.08)" }}>
            {userId && userId !== "app" ? (
              <Link
                href="/optimizer"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg w-full justify-center"
                style={{ background: "var(--accent-primary)", color: "#fff" }}
              >
                <Sparkles className="size-4" />
                Open Optimizer →
              </Link>
            ) : isAppContext ? null : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 text-sm py-2 px-2"
                  style={{ color: isAppContext ? "var(--text-secondary)" : "rgba(255,255,255,0.7)" }}
                >
                  <LogIn className="size-4" />
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg"
                  style={{ background: "var(--accent-primary)", color: "#fff" }}
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
