"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";

export function useInView<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.15,
  once = true,
}: { threshold?: number; once?: boolean } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  return { ref, inView };
}

/* ── AnimatedSection ─────────────────────────────────────────────────────── */

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  duration?: number;
  style?: React.CSSProperties;
}

export function AnimatedSection({
  children,
  className = "",
  delay = 0,
  direction = "up",
  duration = 0.7,
  style,
}: AnimatedSectionProps) {
  const { ref, inView } = useInView({ threshold: 0.12 });

  const translateMap = {
    up: "translateY(32px)",
    down: "translateY(-32px)",
    left: "translateX(32px)",
    right: "translateX(-32px)",
  };

  const transformStart = translateMap[direction];
  const transformEnd = "translate(0, 0)";

  const divRef = ref as React.RefObject<HTMLDivElement | null>;

  return (
    <div
      ref={divRef}
      className={className}
      style={{
        ...style,
        opacity: inView ? 1 : 0,
        transform: inView ? transformEnd : transformStart,
        transition: `opacity ${duration}s cubic-bezier(.22,.68,0,1), transform ${duration}s cubic-bezier(.22,.68,0,1)`,
        transitionDelay: `${delay}s`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

/* ── StaggerChildren ─────────────────────────────────────────────────────── */

interface StaggerChildrenProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  childClassName?: string;
}

export function StaggerContainer({
  children,
  className = "",
  staggerDelay = 0.08,
}: StaggerChildrenProps) {
  const { ref, inView } = useInView({ threshold: 0.1 });

  return (
    <div ref={ref} className={className}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <div
              key={i}
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(24px)",
                transition: `opacity 0.55s cubic-bezier(.22,.68,0,1) ${i * staggerDelay}s, transform 0.55s cubic-bezier(.22,.68,0,1) ${i * staggerDelay}s`,
                willChange: "opacity, transform",
              }}
            >
              {child}
            </div>
          ))
        : children}
    </div>
  );
}
