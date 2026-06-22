"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

// Workspace navigation. Routes are unchanged — this is presentation only.
const NAV: Array<{ href: string; label: string }> = [
  { href: "/optimizer", label: "Optimizer" },
  { href: "/applications", label: "Applications" },
  { href: "/history", label: "History" },
  { href: "/job-scraper", label: "Job Scanner" },
];

function isActive(pathname: string, href: string) {
  if (href === "/optimizer") return pathname === "/optimizer";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Workspace"
      className="hidden lg:flex w-[236px] flex-none flex-col gap-6 px-4 py-[22px] relative z-[2]"
      style={{
        borderRight: "1px solid var(--border-default)",
        background: "var(--sidebar-bg)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {/* Logo lockup */}
      <Link href="/" className="flex items-center gap-[11px] px-1.5 hover:opacity-90 transition-opacity">
        <span
          className="flex items-center justify-center font-mono font-bold text-[15px]"
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "0 6px 22px var(--accent-glow)",
          }}
        >
          R
        </span>
        <span className="flex flex-col leading-[1.05]">
          <span className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-primary)" }}>
            ResumeCV
          </span>
          <span
            className="font-mono text-[9px] mt-[3px]"
            style={{ letterSpacing: "0.24em", color: "var(--text-muted)" }}
          >
            A&nbsp;G&nbsp;E&nbsp;N&nbsp;T
          </span>
        </span>
      </Link>

      {/* New optimization */}
      <Link
        href="/optimizer"
        className="flex items-center gap-[9px] font-mono text-[11.5px] px-3 py-[11px] rounded-[11px] transition-transform duration-150 hover:-translate-y-px"
        style={{
          border: "1px solid var(--accent-line)",
          background: "var(--accent-soft)",
          color: "var(--accent)",
          letterSpacing: "0.02em",
        }}
      >
        <span className="text-[15px] leading-none -mt-px">+</span> New optimization
      </Link>

      {/* Nav */}
      <div className="flex flex-col gap-0.5">
        <span
          className="font-mono text-[9.5px] px-2 pb-2"
          style={{ letterSpacing: "0.16em", color: "var(--text-faint)" }}
        >
          WORKSPACE
        </span>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="group flex items-center gap-[11px] px-2.5 py-[9px] rounded-[9px] text-[13.5px] transition-colors"
              style={{
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "rgba(255,255,255,.04)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full flex-none"
                style={{
                  background: active ? "var(--accent)" : "#3a3d46",
                  boxShadow: active ? "0 0 8px var(--accent)" : "none",
                }}
              />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* User chip */}
      <div
        className="mt-auto flex items-center gap-[11px] p-2.5 rounded-[12px]"
        style={{ border: "1px solid var(--border-default)", background: "rgba(255,255,255,.02)" }}
      >
        <UserButton
          appearance={{ elements: { userButtonAvatarBox: { width: 32, height: 32 } } }}
        />
        <div className="flex flex-col leading-[1.2] min-w-0">
          <span className="text-[12.5px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            Your account
          </span>
          <span className="font-mono text-[9.5px]" style={{ color: "var(--text-muted)" }}>
            PRO
          </span>
        </div>
      </div>
    </nav>
  );
}
