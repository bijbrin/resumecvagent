import { ThemeToggle } from "@/components/theme-toggle";

// Shared layout for all auth pages (sign-in, sign-up).
// No main nav — just a centered card with a theme toggle.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        {children}
      </div>
    </div>
  );
}
