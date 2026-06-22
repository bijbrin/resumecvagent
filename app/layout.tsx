import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Work_Sans, Darker_Grotesque, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { FeatureRequestButton } from "@/components/feature-request-button";
import "./globals.css";

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  display: "swap",
});

const darkerGrotesque = Darker_Grotesque({
  variable: "--font-darker-grotesque",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Resume Optimizer",
  description: "AI-powered resume & cover letter optimization agent",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Dark is the default surface for the modern theme; opt out only with an explicit light cookie.
  const isLight = (await cookies()).get("theme")?.value === "light";

  // Clerk can't read our CSS custom properties (it derives shades from raw colors),
  // so we mirror the globals.css palette here as the integration boundary.
  const clerkAppearance = {
    variables: {
      colorPrimary: "#6843EC",
      fontFamily: "var(--font-work-sans)",
      borderRadius: "0.6rem",
      ...(isLight
        ? {
            colorBackground: "#ffffff",
            colorText: "#0e0e0e",
            colorTextSecondary: "#6b6b73",
            colorInputBackground: "#ffffff",
            colorInputText: "#0e0e0e",
          }
        : {
            colorBackground: "#181818",
            colorText: "#ffffff",
            colorTextSecondary: "#8f8f96",
            colorInputBackground: "#0E0E0E",
            colorInputText: "#ffffff",
            colorNeutral: "#ffffff",
          }),
    },
  };

  return (
    <html
      lang="en"
      className={`${workSans.variable} ${darkerGrotesque.variable} ${geistMono.variable} h-full antialiased${isLight ? "" : " dark"}`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <ClerkProvider afterSignOutUrl="/" appearance={clerkAppearance}>
          {children}
          <FeatureRequestButton />
        </ClerkProvider>
      </body>
    </html>
  );
}
