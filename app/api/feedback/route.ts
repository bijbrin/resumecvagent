import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { csrfCheck } from "@/lib/csrf";

export const runtime = "nodejs";

const RECIPIENT = "bijbrin@gmail.com";

const bodySchema = z.object({
  message: z.string().min(1).max(5000),
  email: z.string().email().optional().or(z.literal("")),
  name: z.string().max(200).optional().or(z.literal("")),
});

// Simple in-memory token bucket: 3 requests per user per hour. Resets on
// server restart — acceptable for this low-volume contact form.
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) {
    requestLog.set(userId, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLog.set(userId, timestamps);
  return false;
}

export async function POST(request: Request) {
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (isRateLimited(userId)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return NextResponse.json(
      { error: "Email service is not configured." },
      { status: 503 }
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { message, email, name } = parsed;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const fromName = name?.trim() || "Anonymous";
  const fromEmail = email?.trim() || "no-reply@resumecvagent";

  const subject = `Feature request from ${fromName}`;
  const text = [
    `From: ${fromName} <${fromEmail}>`,
    "",
    message,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5">
      <h2 style="margin:0 0 12px">New feature request</h2>
      <p style="margin:0 0 4px"><strong>From:</strong> ${escapeHtml(fromName)}</p>
      <p style="margin:0 0 16px"><strong>Email:</strong> ${escapeHtml(fromEmail)}</p>
      <div style="white-space:pre-wrap;border-left:3px solid #ddd;padding-left:12px">
        ${escapeHtml(message)}
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"ResumeCVAgent Feedback" <${user}>`,
      to: RECIPIENT,
      replyTo: email?.trim() || undefined,
      subject,
      text,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feedback] sendMail failed:", err);
    return NextResponse.json(
      { error: "Failed to send message." },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
