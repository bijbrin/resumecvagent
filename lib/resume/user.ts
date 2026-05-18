import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

// Upsert a Clerk user into the local DB so foreign keys on `userId` succeed.
// Mirrors the inline upsert in /api/optimize so resume endpoints behave the
// same way when a user hits resume APIs before ever running an optimization.
export async function ensureUser(userId: string): Promise<void> {
  let email = `${userId}@unknown.invalid`;
  try {
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    email = clerkUser.emailAddresses[0]?.emailAddress ?? email;
  } catch {
    // Clerk lookup failed — fall through with placeholder email
  }
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email },
  });
}
