import { ThemeToggle } from "@/components/theme-toggle";
import { Sidebar } from "@/components/app-shell/sidebar";
import { AppHeader } from "@/components/app-shell/app-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen overflow-hidden"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Ambient accent glows — behind everything, non-interactive */}
      <div
        aria-hidden
        className="pointer-events-none absolute z-0"
        style={{
          top: -200,
          right: -130,
          width: 640,
          height: 640,
          borderRadius: "50%",
          background: "radial-gradient(circle, var(--accent-glow), transparent 68%)",
          opacity: 0.5,
          filter: "blur(18px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute z-0"
        style={{
          bottom: -240,
          left: 160,
          width: 540,
          height: 540,
          borderRadius: "50%",
          background: "radial-gradient(circle, var(--accent-glow), transparent 70%)",
          opacity: 0.2,
          filter: "blur(30px)",
        }}
      />

      <Sidebar />

      <main className="flex flex-1 flex-col min-w-0 relative z-[2]">
        <AppHeader themeToggle={<ThemeToggle />} />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
