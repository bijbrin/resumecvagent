"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: don't render until client-side theme is known
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative"
    >
      <Sun
        size={16}
        className="rotate-0 scale-100 transition-all duration-200 dark:-rotate-90 dark:scale-0"
      />
      <Moon
        size={16}
        className="absolute rotate-90 scale-0 transition-all duration-200 dark:rotate-0 dark:scale-100"
      />
    </Button>
  );
}
