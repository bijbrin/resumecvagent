import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep PDF/DOCX parsers out of the Next.js server bundle so pdfjs-dist can
  // find its own worker file relative to node_modules at runtime. Bundling
  // them produced: "Setting up fake worker failed: Cannot find module
  // .../.next/dev/server/chunks/pdf.worker.mjs".
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth"],
};

export default nextConfig;
