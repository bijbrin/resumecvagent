"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

// Workspace navigation. Routes are unchanged — this is presentation only.
const NAV: Array<{ href: string; label: string }> = [
  { href: "/optimizer", label: "Optimizer" },
  { href: "/applications", label: "Applications" },
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
      className="hidden lg:flex h-full w-[236px] flex-none flex-col gap-6 px-4 py-[22px] relative z-[2]"
      style={{
        borderRight: "1px solid var(--border-default)",
        background: "var(--sidebar-bg)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {/* Nav — uniform links; selected gets a filled accent tint, hover a slighter one */}
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
              scroll={false}
              aria-current={active ? "page" : undefined}
              className="sidebar-nav-item group flex items-center gap-[11px] px-2.5 py-[9px] rounded-[9px] text-[13.5px]"
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
