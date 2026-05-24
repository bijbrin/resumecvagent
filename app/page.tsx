import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/mobile-nav";
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
    <>
      <style>{`
        @keyframes heroFloat {
          0%, 100% { transform: translateY(0px) rotate(-0.5deg); }
          50% { transform: translateY(-18px) rotate(0.5deg); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        @keyframes shimmer {
          from { background-position: -200% 0; }
          to { background-position: 200% 0; }
        }
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        .hero-float { animation: heroFloat 7s ease-in-out infinite; }
        .fade-up-1 { animation: fadeUp 0.75s cubic-bezier(.22,.68,0,1.2) both; animation-delay: 0.05s; }
        .fade-up-2 { animation: fadeUp 0.75s cubic-bezier(.22,.68,0,1.2) both; animation-delay: 0.18s; }
        .fade-up-3 { animation: fadeUp 0.75s cubic-bezier(.22,.68,0,1.2) both; animation-delay: 0.3s; }
        .fade-up-4 { animation: fadeUp 0.75s cubic-bezier(.22,.68,0,1.2) both; animation-delay: 0.44s; }
        .fade-up-5 { animation: fadeUp 0.75s cubic-bezier(.22,.68,0,1.2) both; animation-delay: 0.56s; }

        .display-heading { font-family: var(--font-display), Georgia, "Times New Roman", serif; }

        .hero-section {
          background: #05091a;
          position: relative;
          overflow: hidden;
        }
        .hero-section::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 15% 60%, rgba(37,99,235,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 85% 15%, rgba(37,99,235,0.12) 0%, transparent 55%),
            radial-gradient(ellipse 35% 35% at 70% 85%, rgba(99,58,200,0.1) 0%, transparent 50%);
          pointer-events: none;
        }
        .hero-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 64px 64px;
          pointer-events: none;
        }
        .hero-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(5,9,26,0.6) 100%);
          pointer-events: none;
        }

        .btn-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--accent-primary);
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
          padding: 0.75rem 1.875rem;
          border-radius: 9px;
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(37,99,235,0.3), 0 4px 16px rgba(37,99,235,0.25);
        }
        .btn-cta:hover {
          background: #1d4ed8;
          transform: translateY(-2px);
          box-shadow: 0 1px 2px rgba(37,99,235,0.4), 0 8px 28px rgba(37,99,235,0.4);
        }

        .btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.8);
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.01em;
          padding: 0.75rem 1.75rem;
          border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.12);
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s ease;
        }
        .btn-ghost:hover {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.22);
          color: #fff;
        }

        .agent-card {
          background: rgba(10,18,42,0.88);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 16px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.04);
          overflow: hidden;
          width: 100%;
          max-width: 340px;
        }

        @media (max-width: 1023px) {
          .agent-card { max-width: 300px; }
        }
        @media (max-width: 639px) {
          .agent-card { max-width: 100%; }
        }

        .step-done { background: rgba(22,163,74,0.12); }
        .step-active { background: rgba(37,99,235,0.18); }
        .step-pending { opacity: 0.38; }

        .dot-bounce { animation: dotPulse 1.2s ease-in-out infinite; }
        .dot-bounce-2 { animation: dotPulse 1.2s ease-in-out infinite 0.24s; }
        .dot-bounce-3 { animation: dotPulse 1.2s ease-in-out infinite 0.48s; }

        .progress-bar {
          background: linear-gradient(90deg, #2563eb, #60a5fa, #2563eb);
          background-size: 200% 100%;
          animation: shimmer 2.5s linear infinite;
          height: 100%;
          border-radius: 99px;
        }

        .step-num {
          font-family: var(--font-display), Georgia, serif;
          font-size: 4.5rem;
          font-weight: 900;
          line-height: 1;
          background: linear-gradient(140deg, var(--accent-primary) 0%, rgba(37,99,235,0.18) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .feature-card {
          border-radius: 12px;
          padding: 24px;
          border: 1px solid var(--border-default);
          background: var(--bg-surface);
          transition: transform 0.25s cubic-bezier(.22,.68,0,1), border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .feature-card:hover {
          transform: translateY(-6px);
          border-color: rgba(37,99,235,0.4);
          box-shadow: 0 20px 50px rgba(37,99,235,0.1);
        }

        .testimonial-card {
          border-radius: 14px;
          padding: 28px;
          border: 1px solid var(--border-default);
          background: var(--bg-base);
          box-shadow: var(--shadow-2);
          transition: transform 0.25s cubic-bezier(.22,.68,0,1);
        }
        .testimonial-card:hover { transform: translateY(-4px); }

        .company-name {
          font-family: var(--font-display), Georgia, serif;
          font-weight: 700;
          font-size: 1.05rem;
          letter-spacing: -0.03em;
          color: var(--text-muted);
          opacity: 0.4;
          transition: opacity 0.2s;
          cursor: default;
        }
        .company-name:hover { opacity: 0.65; }

        .pill-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: var(--accent-soft);
          color: var(--accent-primary);
          margin-bottom: 16px;
        }

        .cta-dark {
          background: #05091a;
          position: relative;
          overflow: hidden;
          border-radius: 20px;
          padding: 72px 48px;
          text-align: center;
        }
        @media (max-width: 639px) {
          .cta-dark { padding: 48px 24px; }
        }
        .cta-dark::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 65% 65% at 50% 50%, rgba(37,99,235,0.22) 0%, transparent 70%);
          pointer-events: none;
        }

        .footer-link {
          font-size: 13.5px;
          color: var(--text-muted);
          text-decoration: none;
          transition: color 0.15s;
          display: block;
          margin-bottom: 8px;
        }
        .footer-link:hover { color: var(--text-primary); }

        .nav-link {
          font-size: 13.5px;
          color: rgba(255,255,255,0.55);
          text-decoration: none;
          transition: color 0.15s;
        }
        .nav-link:hover { color: rgba(255,255,255,0.9); }

        .star-icon { fill: #f59e0b; }

        /* Mobile nav link active states */
        .mobile-nav-link { color: rgba(255,255,255,0.7); transition: color 0.15s; }
        .mobile-nav-link:hover, .mobile-nav-link:active { color: rgba(255,255,255,0.95); }
      `}</style>

      <div className={`${playfair.variable} min-h-screen flex flex-col`} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>

        {/* ── HEADER ── */}
        <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 }}>
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#2563eb] flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="3" width="13" height="18" rx="2"/>
                  <path d="M8 8h6M8 12h6M8 16h4"/>
                </svg>
              </div>
              <span className="font-semibold text-[15px] text-white tracking-tight">Resume Optimizer</span>
            </div>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-7">
              <a href="#how-it-works" className="nav-link">How It Works</a>
              <a href="#features" className="nav-link">Features</a>
              <a href="#testimonials" className="nav-link">Reviews</a>
              {userId ? (
                <Link href="/optimizer" className="btn-cta" style={{ padding: "8px 18px", fontSize: 13 }}>
                  Open App →
                </Link>
              ) : (
                <>
                  <Link href="/sign-in" className="nav-link">Sign in</Link>
                  <Link href="/sign-up" className="btn-cta" style={{ padding: "8px 18px", fontSize: 13 }}>
                    Get Started
                  </Link>
                </>
              )}
            </nav>

            {/* Mobile nav */}
            <MobileNav userId={userId} />
          </div>
        </header>

        {/* ── HERO ── */}
        <section className="hero-section min-h-[100dvh] flex items-center">
          <div className="hero-grid" />
          <div className="hero-vignette" />

          <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 lg:pt-32 pb-16 sm:pb-20 w-full">
            <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-center">
              {/* LEFT — Copy */}
              <div className="max-w-[580px] w-full text-center lg:text-left">
                <div className="fade-up-1 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[rgba(37,99,235,0.4)] bg-[rgba(37,99,235,0.12)] text-[#93c5fd] text-xs font-semibold tracking-wider uppercase mb-5 sm:mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] animate-pulse-soft" />
                  8 AI Agents · ATS Optimized · Free to Start
                </div>

                <h1 className="display-heading fade-up-2 text-[clamp(2.2rem,5.5vw,4.25rem)] font-black leading-[1.05] tracking-tight text-white mb-5 sm:mb-6">
                  Land Your<br />
                  <span className="text-[#60a5fa]">Dream Job</span><br />
                  Faster.
                </h1>

                <p className="fade-up-3 text-base sm:text-lg leading-relaxed text-white/55 mb-7 sm:mb-9 max-w-[460px] mx-auto lg:mx-0">
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
                    <span key={t} className="flex items-center gap-1.5 text-xs text-white/35">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(96,165,250,0.7)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
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
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[rgba(239,68,68,0.6)]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[rgba(234,179,8,0.6)]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[rgba(34,197,94,0.6)]" />
                      </div>
                      <span className="text-[11px] text-white/25 font-mono">agent-pipeline · running</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse-soft" />
                    </div>

                    {/* Steps */}
                    <div className="px-3.5 pt-4 pb-2">
                      <div className="text-[10px] text-white/28 font-mono tracking-widest mb-2.5 pl-2">AGENT PIPELINE</div>
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
                          <span className="text-xs text-white/[0.72] flex-1">{s.label}</span>
                          {s.state === "done" && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" className="flex-shrink-0"><path d="M20 6L9 17l-5-5"/></svg>
                          )}
                          {s.state === "active" && (
                            <div className="flex gap-[3px] flex-shrink-0">
                              <div className="dot-bounce w-[5px] h-[5px] rounded-full bg-[#60a5fa]" />
                              <div className="dot-bounce-2 w-[5px] h-[5px] rounded-full bg-[#60a5fa]" />
                              <div className="dot-bounce-3 w-[5px] h-[5px] rounded-full bg-[#60a5fa]" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Progress */}
                    <div className="px-4 pb-4 pt-1">
                      <div className="flex justify-between text-[11px] text-white/28 mb-1.5">
                        <span>Progress</span><span>40%</span>
                      </div>
                      <div className="h-[5px] rounded-full bg-white/[0.08]">
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
                  color: "#2563eb",
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
                  <div className="w-[30px] h-[30px] rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="3" width="13" height="18" rx="2"/>
                      <path d="M8 8h6M8 12h6M8 16h4"/>
                    </svg>
                  </div>
                  <span className="font-semibold text-[14.5px] text-[var(--text-primary)] tracking-tight">Resume Optimizer</span>
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
              <p className="text-xs sm:text-[12.5px] text-[var(--text-faint)] text-center sm:text-left">© 2025 Resume Optimizer. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <ThemeToggle />
                <span className="mono text-[11.5px] text-[var(--text-faint)]">v1.0</span>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
