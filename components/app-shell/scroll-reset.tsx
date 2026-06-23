"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll container that resets its scrollTop to 0 on route change.
 * Next.js only auto-resets window scroll; nested overflow containers keep
 * their scrollTop across navigations, which makes short pages render blank
 * (scrolled past their content) after visiting a long page.
 */
export function ScrollReset({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Disable browser scroll-restoration — it fights our reset and re-scrolls
    // the document after navigation, pushing the app shell off-screen.
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    if (ref.current) ref.current.scrollTop = 0;
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
