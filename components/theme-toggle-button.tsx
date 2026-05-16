"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggleButton({ initial }: { initial: "light" | "dark" }) {
  const [theme, setTheme] = useState<"light" | "dark">(initial);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={toggle}
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
