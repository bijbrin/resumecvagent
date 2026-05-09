import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that are publicly accessible without signing in
const isPublicRoute = createRouteMatcher([
  "/",                    // landing / marketing page
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/v1/health",       // health check — no auth needed
  "/api/v1/supported-job-sites",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect(); // redirects to /sign-in if unauthenticated
  }
});

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
