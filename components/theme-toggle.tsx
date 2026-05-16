import { cookies } from "next/headers";
import { ThemeToggleButton } from "./theme-toggle-button";

export async function ThemeToggle() {
  const initial = (await cookies()).get("theme")?.value === "dark" ? "dark" : "light";
  return <ThemeToggleButton initial={initial} />;
}
