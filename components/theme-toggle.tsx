import { cookies } from "next/headers";
import { ThemeToggleButton } from "./theme-toggle-button";

export async function ThemeToggle() {
  // Dark is the default; only an explicit light cookie switches to light.
  const initial = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  return <ThemeToggleButton initial={initial} />;
}
