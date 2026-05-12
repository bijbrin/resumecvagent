import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
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
          width: 340px;
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
          transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
        }
        .feature-card:hover {
          transform: translateY(-5px);
          border-color: rgba(37,99,235,0.4);
          box-shadow: 0 16px 40px rgba(37,99,235,0.08);
        }

        .testimonial-card {
          border-radius: 14px;
          padding: 28px;
          border: 1px solid var(--border-default);
          background: var(--bg-base);
          box-shadow: var(--shadow-2);
          transition: transform 0.22s ease;
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
      `}</style>

      <div className={`${playfair.variable} min-h-screen flex flex-col`} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>

        {/* ── HEADER ── */}
        <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="3" width="13" height="18" rx="2"/>
                  <path d="M8 8h6M8 12h6M8 16h4"/>
                </svg>
              </div>
              <span style={{ fontWeight: 650, fontSize: 15, color: "#fff", letterSpacing: "-0.02em" }}>Resume Optimizer</span>
            </div>

            <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
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
          </div>
        </header>

        {/* ── HERO ── */}
        <section className="hero-section" style={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
          <div className="hero-grid" />
          <div className="hero-vignette" />

          <div style={{ position: "relative", zIndex: 10, maxWidth: 1200, margin: "0 auto", padding: "128px 32px 80px", width: "100%" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 64, alignItems: "center" }}>
              {/* LEFT — Copy */}
              <div style={{ maxWidth: 580 }}>
                <div className="fade-up-1" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px", borderRadius: 99, border: "1px solid rgba(37,99,235,0.4)", background: "rgba(37,99,235,0.12)", color: "#93c5fd", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 24 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa", animation: "pulseGlow 2s ease-in-out infinite" }} />
                  8 AI Agents · ATS Optimized · Free to Start
                </div>

                <h1 className="display-heading fade-up-2" style={{ fontSize: "clamp(2.6rem, 5vw, 4.25rem)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.035em", color: "#fff", marginBottom: 24 }}>
                  Land Your<br />
                  <span style={{ color: "#60a5fa" }}>Dream Job</span><br />
                  Faster.
                </h1>

                <p className="fade-up-3" style={{ fontSize: "1.1rem", lineHeight: 1.7, color: "rgba(255,255,255,0.55)", marginBottom: 36, maxWidth: 460 }}>
                  Paste a job URL and your resume. Eight specialized AI agents research the company, find every gap, and rewrite your materials — ATS-ready in under two minutes.
                </p>

                <div className="fade-up-4" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  {userId ? (
                    <Link href="/optimizer" className="btn-cta">
                      Open Optimizer
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </Link>
                  ) : (
                    <>
                      <Link href="/sign-up" className="btn-cta">
                        Get Started — Free
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </Link>
                      <Link href="/sign-in" className="btn-ghost">
                        Sign in
                      </Link>
                    </>
                  )}
                </div>

                <div className="fade-up-5" style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 28 }}>
                  {["No credit card", "Results in &lt; 2 min", "ATS guaranteed"].map((t) => (
                    <span key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "rgba(255,255,255,0.35)" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(96,165,250,0.7)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      <span dangerouslySetInnerHTML={{ __html: t }} />
                    </span>
                  ))}
                </div>
              </div>

              {/* RIGHT — Floating agent card */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div className="hero-float">
                  <div className="agent-card">
                    {/* Window chrome */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(239,68,68,0.6)" }} />
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(234,179,8,0.6)" }} />
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(34,197,94,0.6)" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>agent-pipeline · running</span>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "pulseGlow 2s ease-in-out infinite" }} />
                    </div>

                    {/* Steps */}
                    <div style={{ padding: "16px 14px 8px" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", fontFamily: "monospace", letterSpacing: "0.06em", marginBottom: 10, paddingLeft: 8 }}>AGENT PIPELINE</div>
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
                          className={s.state === "done" ? "step-done" : s.state === "active" ? "step-active" : "step-pending"}
                          style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, marginBottom: 4 }}
                        >
                          <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{s.emoji}</span>
                          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.72)", flex: 1 }}>{s.label}</span>
                          {s.state === "done" && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M20 6L9 17l-5-5"/></svg>
                          )}
                          {s.state === "active" && (
                            <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                              <div className="dot-bounce" style={{ width: 5, height: 5, borderRadius: "50%", background: "#60a5fa" }} />
                              <div className="dot-bounce-2" style={{ width: 5, height: 5, borderRadius: "50%", background: "#60a5fa" }} />
                              <div className="dot-bounce-3" style={{ width: 5, height: 5, borderRadius: "50%", background: "#60a5fa" }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Progress */}
                    <div style={{ padding: "10px 16px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.28)", marginBottom: 6 }}>
                        <span>Progress</span><span>40%</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.08)" }}>
                        <div className="progress-bar" style={{ width: "40%" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom gradient bleed */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom, transparent, var(--bg-base))", pointerEvents: "none" }} />
        </section>

        {/* ── TRUSTED BY ── */}
        <section style={{ padding: "48px 32px", borderBottom: "1px solid var(--border-default)" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 28 }}>
              Trusted by professionals at leading companies
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 48, flexWrap: "wrap" }}>
              {["Stripe", "Figma", "Notion", "Linear", "Vercel", "Supabase"].map((c) => (
                <span key={c} className="company-name">{c}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" style={{ padding: "96px 32px", background: "var(--bg-surface)" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <div className="pill-label">How It Works</div>
              <h2 className="display-heading" style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.875rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1.15 }}>
                From job post to offer-ready<br />in three steps.
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
              {[
                { num: "01", icon: "📋", title: "Paste Your Resume", desc: "Upload or paste your current resume and the job posting URL you're targeting. That's all you need to start." },
                { num: "02", icon: "⚡", title: "AI Does the Work", desc: "Eight specialized agents run in parallel — researching the company, analyzing gaps, and building a tailored strategy." },
                { num: "03", icon: "🎯", title: "Download & Apply", desc: "Receive an ATS-optimized resume, personalized cover letter, and an interview prep cheat sheet. Apply with confidence." },
              ].map((s) => (
                <div key={s.num} style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: 14, padding: 32, boxShadow: "var(--shadow-1)" }}>
                  <div className="step-num">{s.num}</div>
                  <div style={{ fontSize: 26, margin: "8px 0 12px" }}>{s.icon}</div>
                  <h3 style={{ fontSize: 17, fontWeight: 650, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 10 }}>{s.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-muted)" }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" style={{ padding: "96px 32px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <div className="pill-label">8 AI Agents</div>
              <h2 className="display-heading" style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.875rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1.15 }}>
                Every agent has one job.<br />Together, they&apos;re unstoppable.
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
              {[
                { icon: "🔍", title: "Job Intelligence", desc: "Parses any job posting URL to extract requirements, culture signals, and the hidden ATS keywords that most applicants miss." },
                { icon: "🏢", title: "Company Research", desc: "Deep-dives into company culture, values, and hiring patterns to make every line of your application feel specifically written for them." },
                { icon: "🧐", title: "Gap Analysis", desc: "Identifies exactly where your experience diverges from what the role requires — and maps the clearest path to bridge each gap." },
                { icon: "🧠", title: "Strategy Engine", desc: "Builds a tailoring playbook: which wins to lead with, which experiences to reframe, and what to quietly cut from your resume." },
                { icon: "✍️", title: "Content Generation", desc: "Rewrites your resume and drafts a cover letter that sounds authentically like you — but sharper, cleaner, and perfectly targeted." },
                { icon: "🎯", title: "Interview Prep", desc: "Generates a personalized cheat sheet of likely questions, ideal talking points, and stories to prep — based on the exact role." },
              ].map((f) => (
                <div key={f.title} className="feature-card">
                  <div style={{ fontSize: 24, marginBottom: 14 }}>{f.icon}</div>
                  <h3 style={{ fontSize: 15.5, fontWeight: 650, letterSpacing: "-0.015em", color: "var(--text-primary)", marginBottom: 8 }}>{f.title}</h3>
                  <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text-muted)" }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section id="testimonials" style={{ padding: "96px 32px", background: "var(--bg-surface)" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <div className="pill-label">Reviews</div>
              <h2 className="display-heading" style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.875rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1.15 }}>
                Real results from<br />real job seekers.
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 22 }}>
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
                  <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} width="14" height="14" viewBox="0 0 24 24"><path className="star-icon" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    ))}
                  </div>
                  <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 22 }}>&ldquo;{t.quote}&rdquo;</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {t.avatar}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 650, color: "var(--text-primary)" }}>{t.name}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t.role} · {t.company}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section style={{ padding: "80px 32px" }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div className="cta-dark">
              <div style={{ position: "relative", zIndex: 1 }}>
                <h2 className="display-heading" style={{ fontSize: "clamp(1.9rem, 3.5vw, 3rem)", fontWeight: 900, letterSpacing: "-0.035em", color: "#fff", lineHeight: 1.1, marginBottom: 18 }}>
                  Your next job is one<br />optimized resume away.
                </h2>
                <p style={{ fontSize: "1.05rem", lineHeight: 1.7, color: "rgba(255,255,255,0.45)", marginBottom: 36, maxWidth: 480, margin: "0 auto 36px" }}>
                  Join thousands of professionals who&apos;ve transformed their interview rate with AI-powered resume optimization.
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {userId ? (
                    <Link href="/optimizer" className="btn-cta" style={{ fontSize: 16, padding: "14px 40px" }}>
                      Open Optimizer →
                    </Link>
                  ) : (
                    <Link href="/sign-up" className="btn-cta" style={{ fontSize: 16, padding: "14px 40px" }}>
                      Get Started — It&apos;s Free →
                    </Link>
                  )}
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", marginTop: 16 }}>
                  No credit card · Results in under 2 minutes
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: "1px solid var(--border-default)", padding: "56px 32px 32px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 40, marginBottom: 48 }}>
              {/* Brand */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="3" width="13" height="18" rx="2"/>
                      <path d="M8 8h6M8 12h6M8 16h4"/>
                    </svg>
                  </div>
                  <span style={{ fontWeight: 650, fontSize: 14.5, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Resume Optimizer</span>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text-muted)", maxWidth: 210 }}>
                  AI-powered resume optimization for modern job seekers. ATS-ready in minutes.
                </p>
              </div>

              {/* Product */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 14 }}>Product</div>
                {["Optimizer", "Job Scraper", "History", "API Docs"].map((item) => (
                  <a key={item} href="#" className="footer-link">{item}</a>
                ))}
              </div>

              {/* Company */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 14 }}>Company</div>
                {["About", "Blog", "Careers", "Contact"].map((item) => (
                  <a key={item} href="#" className="footer-link">{item}</a>
                ))}
              </div>

              {/* Legal */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 14 }}>Legal</div>
                {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
                  <a key={item} href="#" className="footer-link">{item}</a>
                ))}
              </div>
            </div>

            <div style={{ paddingTop: 24, borderTop: "1px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>© 2025 Resume Optimizer. All rights reserved.</p>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <ThemeToggle />
                <span className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)" }}>v1.0</span>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
