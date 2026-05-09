import { OptimizerForm } from "@/components/optimizer-form";

export default function OptimizerPage() {
  return (
    <div className="flex flex-col items-center py-12 px-4 gap-8">
      <div className="text-center max-w-xl">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Resume Optimizer
        </h1>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          Paste your resume and a job posting URL. Eight AI agents will run in
          parallel to analyse, strategise, and rewrite your resume — then write
          a matching cover letter.
        </p>
      </div>

      <OptimizerForm />
    </div>
  );
}
