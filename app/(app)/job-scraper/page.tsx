import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { JobScraperView } from "@/components/job-scraper-view";

export const metadata: Metadata = {
  title: "Job Scanner | ResumeCV Agent",
  description: "Scan SEEK, Jora, Indeed, Adzuna, LinkedIn and more for recent Australian software roles.",
  openGraph: {
    title: "Job Scanner | ResumeCV Agent",
    description: "Scan SEEK, Jora, Indeed, Adzuna, LinkedIn and more for recent Australian software roles.",
  },
};

export default async function JobScraperPage() {
  await requireAuth();
  return <JobScraperView />;
}
