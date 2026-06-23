import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { LandingHeader } from "@/components/landing-header";
import { AnimatedSection, StaggerContainer } from "@/hooks/use-in-view";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "700", "900"],
});

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className={`${playfair.variable} min-h-screen flex flex-col`} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>

      {/* ── HEADER (sticky, matches in-app shell) ── */}
      <LandingHeader userId={userId} themeToggle={<ThemeToggle />} />

      {/* ── HERO ── */}
      <section className="hero-section min-h-[calc(100dvh-61px)] flex items-center">
        <div className="hero-grid" />
        <div className="hero-vignette" />

        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-16 sm:pb-20 w-full">
          <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-center">
            {/* LEFT — Copy */}
            <div className="max-w-[580px] w-full text-center lg:text-left">
              <div className="fade-up-1 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-semibold tracking-wider uppercase mb-5 sm:mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse-soft" />
                8 AI Agents · ATS Optimized · Free to Start
              </div>

              <h1 className="display-heading fade-up-2 text-[clamp(2.2rem,5.5vw,4.25rem)] font-black leading-[1.05] tracking-tight text-[var(--text-primary)] mb-5 sm:mb-6">
                Land Your<br />
                <span className="text-[var(--accent-text)]">Dream Job</span><br />
                Faster.
              </h1>

              <p className="fade-up-3 text-base sm:text-lg leading-relaxed text-[var(--text-secondary)] mb-7 sm:mb-9 max-w-[460px] mx-auto lg:mx-0">
                Paste a job URL and your resume. Eight specialized AI agents research the company, find every gap, and rewrite your materials — ATS-ready in under two minutes.
              </p>

              <div className="fade-up-4 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-3.5">
                {userId ? (
                  <Link href="/optimizer" className="btn-cta w-full sm:w-auto justify-center">
                    Open Optimizer
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                ) : (
                  <>
                    <Link href="/sign-up" className="btn-cta w-full sm:w-auto justify-center">
                      Get Started — Free
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </Link>
                    <Link href="/sign-in" className="btn-ghost w-full sm:w-auto justify-center">
                      Sign in
                    </Link>
                  </>
                )}
              </div>

              <div className="fade-up-5 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 sm:gap-x-6 gap-y-2 mt-6 sm:mt-7">
                {["No credit card", "Results in < 2 min", "ATS guaranteed"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                    <span dangerouslySetInnerHTML={{ __html: t }} />
                  </span>
                ))}
              </div>
            </div>

            {/* RIGHT — Floating agent card */}
            <div className="flex justify-center lg:justify-end w-full lg:w-auto mt-2 lg:mt-0">
              <div className="hero-float">
                <div className="agent-card mx-auto lg:mx-0">
                  {/* Window chrome */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[rgba(239,68,68,0.6)]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[rgba(234,179,8,0.6)]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[rgba(34,197,94,0.6)]" />
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">agent-pipeline · running</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--ok)] animate-pulse-soft" />
                  </div>

                  {/* Steps */}
                  <div className="px-3.5 pt-4 pb-2">
                    <div className="text-[10px] text-[var(--text-faint)] font-mono tracking-widest mb-2.5 pl-2">AGENT PIPELINE</div>
                    {[
                      { emoji: "🔍", label: "Scraping Job Description", state: "done" },
                      { emoji: "🏢", label: "Researching Company Culture", state: "done" },
                      { emoji: "🧐", label: "Analyzing Resume Gaps", state: "active" },
                      { emoji: "🧠", label: "Synthesizing Strategy", state: "pending" },
                      { emoji: "✍️", label: "Drafting Optimized Content", state: "pending" },
                      { emoji: "✅", label: "Done!", state: "pending" },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className={`flex items-center gap-2 px-2.5 py-[7px] rounded-lg mb-1 ${s.state === "done" ? "step-done" : s.state === "active" ? "step-active" : "step-pending"}`}
                      >
                        <span className="text-sm leading-none flex-shrink-0">{s.emoji}</span>
                        <span className="text-xs text-[var(--text-secondary)] flex-1">{s.label}</span>
                        {s.state === "done" && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" className="flex-shrink-0"><path d="M20 6L9 17l-5-5"/></svg>
                        )}
                        {s.state === "active" && (
                          <div className="flex gap-[3px] flex-shrink-0">
                            <div className="dot-bounce w-[5px] h-[5px] rounded-full bg-[var(--accent)]" />
                            <div className="dot-bounce-2 w-[5px] h-[5px] rounded-full bg-[var(--accent)]" />
                            <div className="dot-bounce-3 w-[5px] h-[5px] rounded-full bg-[var(--accent)]" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Progress */}
                  <div className="px-4 pb-4 pt-1">
                    <div className="flex justify-between text-[11px] text-[var(--text-muted)] mb-1.5">
                      <span>Progress</span><span>40%</span>
                    </div>
                    <div className="h-[5px] rounded-full bg-[var(--bg-surface-2)]">
                      <div className="progress-bar w-[40%]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom gradient bleed */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-[var(--bg-base)] pointer-events-none" />
      </section>

      {/* ── TRUSTED BY ── */}
      <AnimatedSection className="py-10 sm:py-12 px-4 sm:px-6 lg:px-8 border-b border-[var(--border-default)]">
        <div className="max-w-[900px] mx-auto">
          <p className="text-center text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--text-faint)] mb-6 sm:mb-7">
            Trusted by professionals at leading companies
          </p>
          <div className="flex items-center justify-center gap-6 sm:gap-10 lg:gap-12 flex-wrap">
            {["Stripe", "Figma", "Notion", "Linear", "Vercel", "Supabase"].map((c) => (
              <span key={c} className="company-name">{c}</span>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8" style={{ background: "var(--bg-surface)" }}>
        <div className="max-w-[1100px] mx-auto">
          <AnimatedSection className="text-center mb-12 sm:mb-16">
            <div className="pill-label">How It Works</div>
            <h2 className="display-heading text-[clamp(1.7rem,3.5vw,2.875rem)] font-bold tracking-tight text-[var(--text-primary)] leading-tight">
              From job post to offer-ready<br className="hidden sm:block" /> in three steps.
            </h2>
          </AnimatedSection>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6" staggerDelay={0.1}>
            {[
              { num: "01", icon: "📋", title: "Paste Your Resume", desc: "Upload or paste your current resume and the job posting URL you're targeting. That's all you need to start." },
              { num: "02", icon: "⚡", title: "AI Does the Work", desc: "Eight specialized agents run in parallel — researching the company, analyzing gaps, and building a tailored strategy." },
              { num: "03", icon: "🎯", title: "Download & Apply", desc: "Receive an ATS-optimized resume, personalized cover letter, and an interview prep cheat sheet. Apply with confidence." },
            ].map((s) => (
              <div key={s.num} className="bg-[var(--bg-base)] border border-[var(--border-default)] rounded-[14px] p-6 sm:p-8 shadow-[var(--shadow-1)] hover-lift">
                <div className="step-num">{s.num}</div>
                <div className="text-2xl mt-2 mb-3">{s.icon}</div>
                <h3 className="text-base sm:text-[17px] font-semibold tracking-tight text-[var(--text-primary)] mb-2.5">{s.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--text-muted)]">{s.desc}</p>
              </div>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto">
          <AnimatedSection className="text-center mb-12 sm:mb-16">
            <div className="pill-label">8 AI Agents</div>
            <h2 className="display-heading text-[clamp(1.7rem,3.5vw,2.875rem)] font-bold tracking-tight text-[var(--text-primary)] leading-tight">
              Every agent has one job.<br className="hidden sm:block" /> Together, they&apos;re unstoppable.
            </h2>
          </AnimatedSection>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-[18px]" staggerDelay={0.08}>
            {[
              { icon: "🔍", title: "Job Intelligence", desc: "Parses any job posting URL to extract requirements, culture signals, and the hidden ATS keywords that most applicants miss." },
              { icon: "🏢", title: "Company Research", desc: "Deep-dives into company culture, values, and hiring patterns to make every line of your application feel specifically written for them." },
              { icon: "🧐", title: "Gap Analysis", desc: "Identifies exactly where your experience diverges from what the role requires — and maps the clearest path to bridge each gap." },
              { icon: "🧠", title: "Strategy Engine", desc: "Builds a tailoring playbook: which wins to lead with, which experiences to reframe, and what to quietly cut from your resume." },
              { icon: "✍️", title: "Content Generation", desc: "Rewrites your resume and drafts a cover letter that sounds authentically like you — but sharper, cleaner, and perfectly targeted." },
              { icon: "🎯", title: "Interview Prep", desc: "Generates a personalized cheat sheet of likely questions, ideal talking points, and stories to prep — based on the exact role." },
            ].map((f) => (
              <div key={f.title} className="feature-card">
                <div className="text-2xl mb-3.5">{f.icon}</div>
                <h3 className="text-[15.5px] font-semibold tracking-tight text-[var(--text-primary)] mb-2">{f.title}</h3>
                <p className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">{f.desc}</p>
              </div>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8" style={{ background: "var(--bg-surface)" }}>
        <div className="max-w-[1100px] mx-auto">
          <AnimatedSection className="text-center mb-12 sm:mb-16">
            <div className="pill-label">Reviews</div>
            <h2 className="display-heading text-[clamp(1.7rem,3.5vw,2.875rem)] font-bold tracking-tight text-[var(--text-primary)] leading-tight">
              Real results from<br className="hidden sm:block" /> real job seekers.
            </h2>
          </AnimatedSection>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-[22px]" staggerDelay={0.1}>
            {[
              {
                quote: "I got 3× more callbacks after using this. The AI found ATS keywords I had no idea even existed. Landed an offer within two weeks of optimizing.",
                name: "Sarah Chen",
                role: "Senior Product Manager",
                company: "Stripe",
                avatar: "SC",
                color: "var(--accent)",
              },
              {
                quote: "The cover letter it generated felt more like me than anything I'd written myself. My hiring manager literally commented on how personalized it felt.",
                name: "Marcus Johnson",
                role: "Software Engineer",
                company: "Google",
                avatar: "MJ",
                color: "#059669",
              },
              {
                quote: "The gap analysis alone is worth it. It told me exactly what to highlight and how to reframe seven years of experience for a complete role pivot.",
                name: "Priya Patel",
                role: "Data Scientist",
                company: "Airbnb",
                avatar: "PP",
                color: "#7c3aed",
              },
            ].map((t) => (
              <div key={t.name} className="testimonial-card">
                <div className="flex gap-[3px] mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24"><path className="star-icon" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ))}
                </div>
                <p className="text-sm sm:text-[14.5px] leading-relaxed text-[var(--text-secondary)] mb-5 sm:mb-6">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: t.color }}>
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{t.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{t.role} · {t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[860px] mx-auto">
          <AnimatedSection>
            <div className="cta-dark">
              <div className="relative z-[1]">
                <h2 className="display-heading text-[clamp(1.7rem,3.5vw,3rem)] font-black tracking-tight text-white leading-tight mb-4 sm:mb-5">
                  Your next job is one<br className="hidden sm:block" /> optimized resume away.
                </h2>
                <p className="text-sm sm:text-base leading-relaxed text-white/45 mb-7 sm:mb-9 max-w-[480px] mx-auto">
                  Join thousands of professionals who&apos;ve transformed their interview rate with AI-powered resume optimization.
                </p>
                <div className="flex items-center justify-center">
                  {userId ? (
                    <Link href="/optimizer" className="btn-cta text-base px-8 sm:px-10 py-3.5 sm:py-3">
                      Open Optimizer →
                    </Link>
                  ) : (
                    <Link href="/sign-up" className="btn-cta text-base px-8 sm:px-10 py-3.5 sm:py-3">
                      Get Started — It&apos;s Free →
                    </Link>
                  )}
                </div>
                <p className="text-xs text-white/22 mt-4">
                  No credit card · Results in under 2 minutes
                </p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--border-default)] pt-12 sm:pt-14 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-12">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2.5 mb-3.5">
                <span className="landing-logo-mark">R</span>
                <span className="font-semibold text-[14.5px] text-[var(--text-primary)] tracking-tight">ResumeCV Agent</span>
              </div>
              <p className="text-[13.5px] leading-relaxed text-[var(--text-muted)] max-w-[210px]">
                AI-powered resume optimization for modern job seekers. ATS-ready in minutes.
              </p>
            </div>

            {/* Product */}
            <div>
              <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--text-faint)] mb-3.5">Product</div>
              {["Optimizer", "Job Scraper", "History", "API Docs"].map((item) => (
                <a key={item} href="#" className="footer-link">{item}</a>
              ))}
            </div>

            {/* Company */}
            <div>
              <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--text-faint)] mb-3.5">Company</div>
              {["About", "Blog", "Careers", "Contact"].map((item) => (
                <a key={item} href="#" className="footer-link">{item}</a>
              ))}
            </div>

            {/* Legal */}
            <div>
              <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--text-faint)] mb-3.5">Legal</div>
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
                <a key={item} href="#" className="footer-link">{item}</a>
              ))}
            </div>
          </div>

          <div className="pt-5 sm:pt-6 border-t border-[var(--border-default)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs sm:text-[12.5px] text-[var(--text-faint)] text-center sm:text-left">© 2025 ResumeCV Agent. All rights reserved.</p>
            <span className="mono text-[11.5px] text-[var(--text-faint)]">v1.0</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
