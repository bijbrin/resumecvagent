import { Suspense } from "react";
import type { Metadata } from "next";
import { OptimizerForm } from "@/components/optimizer-form";
import { RecentApplications } from "@/components/recent-applications";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Optimize | ResumeCV Agent",
  description: "Tailor your resume and cover letter to a job posting with an 8-agent AI pipeline.",
  openGraph: {
    title: "Optimize | ResumeCV Agent",
    description: "Tailor your resume and cover letter to a job posting with an 8-agent AI pipeline.",
  },
};

export default async function OptimizerPage() {
  await requireAuth();
  return (
    <div className="flex flex-col gap-10 px-5 py-8 sm:px-7 sm:py-[30px]">
      <Suspense fallback={null}>
        <OptimizerForm />
      </Suspense>
      <div className="mx-auto w-full max-w-[1080px]">
        <RecentApplications />
      </div>
    </div>
  );
}
