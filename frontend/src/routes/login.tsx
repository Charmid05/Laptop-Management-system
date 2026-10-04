import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { login } from "@/lib/auth";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/login")({
  head: () => meta("Sign in", "Sign in to the laptop store management system."),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [userFocused, setUserFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    interface Particle {
      x: number; y: number; r: number;
      dx: number; dy: number; alpha: number;
      pulse: number; pulseSpeed: number;
    }

    const particles: Particle[] = Array.from({ length: 55 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.8 + 0.4,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.45 + 0.12,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.018 + 0.006,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(62,207,142,${0.1 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      for (const p of particles) {
        p.pulse += p.pulseSpeed;
        const a = p.alpha + Math.sin(p.pulse) * 0.1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(62,207,142,${a})`;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await login(username, password);
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0b0f1a 0%, #111827 50%, #0d1f15 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
      fontFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    }}>
      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }} />

      {/* Ambient glow orbs */}
      <div style={{ position: "absolute", top: "8%", left: "3%", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(62,207,142,0.07) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "absolute", bottom: "6%", right: "6%", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(100,120,255,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 330,
        margin: "0 16px",
        background: "rgba(12, 17, 28, 0.88)",
        backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
        border: "1px solid rgba(62,207,142,0.15)",
        borderRadius: 20,
        padding: "30px 28px 24px",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 20px 70px rgba(0,0,0,0.6), 0 0 50px rgba(62,207,142,0.05)",
        animation: shake ? "shake 0.5s ease" : undefined,
      }}>

        {/* ── Logo area ── */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>

          {/* Geometric TA shield logo */}
          <div style={{ display: "inline-block", marginBottom: 14, filter: "drop-shadow(0 0 18px rgba(62,207,142,0.45))" }}>
            <svg width="60" height="66" viewBox="0 0 60 66" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Shield outer */}
              <path
                d="M30 2L4 13V34C4 47.8 15.6 60.2 30 64C44.4 60.2 56 47.8 56 34V13L30 2Z"
                fill="url(#shieldGrad)"
                stroke="rgba(62,207,142,0.4)"
                strokeWidth="1"
              />
              {/* Shield inner highlight */}
              <path
                d="M30 7L9 16.5V34C9 45.2 18.5 56 30 59.5C41.5 56 51 45.2 51 34V16.5L30 7Z"
                fill="url(#shieldInner)"
              />
              {/* T letter */}
              <rect x="16" y="22" width="19" height="3" rx="1.5" fill="white" opacity="0.95"/>
              <rect x="23.5" y="22" width="3" height="13" rx="1.5" fill="white" opacity="0.95"/>
              {/* A letter — using lines for a minimal geometric look */}
              <path
                d="M37 37L40.5 24H41.5L45 37"
                stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" fill="none"
              />
              <line x1="38.3" y1="32.5" x2="43.7" y2="32.5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
              <defs>
                <linearGradient id="shieldGrad" x1="30" y1="2" x2="30" y2="64" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#3ecf8e"/>
                  <stop offset="100%" stopColor="#1a7a50"/>
                </linearGradient>
                <linearGradient id="shieldInner" x1="30" y1="7" x2="30" y2="59" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.08)"/>
                  <stop offset="100%" stopColor="rgba(0,0,0,0.25)"/>
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Store name */}
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 4 }}>
            <span style={{ color: "#ffffff" }}>TENSEI </span>
            <span style={{ color: "#3ecf8e", textShadow: "0 0 20px rgba(62,207,142,0.5)" }}>ARK</span>
          </div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 500, margin: 0 }}>
            Management Portal
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(62,207,142,0.22), transparent)", marginBottom: 24 }} />

        <form onSubmit={(e) => void submit(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Username */}
          <div>
            <label style={{
              display: "block", fontSize: 11, fontWeight: 600,
              color: userFocused ? "#3ecf8e" : "rgba(255,255,255,0.4)",
              marginBottom: 6, letterSpacing: "0.07em", textTransform: "uppercase",
              transition: "color 0.2s",
            }}>Username or Email</label>
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
                pointerEvents: "none", color: userFocused ? "#3ecf8e" : "rgba(255,255,255,0.28)",
                transition: "color 0.2s",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <input
                type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setUserFocused(true)} onBlur={() => setUserFocused(false)}
                autoFocus placeholder="Enter your username"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "11px 14px 11px 40px",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${userFocused ? "rgba(62,207,142,0.55)" : "rgba(255,255,255,0.09)"}`,
                  borderRadius: 10, color: "#fff", fontSize: 13.5, outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  boxShadow: userFocused ? "0 0 0 3px rgba(62,207,142,0.1)" : "none",
                  caretColor: "#3ecf8e",
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{
              display: "block", fontSize: 11, fontWeight: 600,
              color: passFocused ? "#3ecf8e" : "rgba(255,255,255,0.4)",
              marginBottom: 6, letterSpacing: "0.07em", textTransform: "uppercase",
              transition: "color 0.2s",
            }}>Password</label>
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
                pointerEvents: "none", color: passFocused ? "#3ecf8e" : "rgba(255,255,255,0.28)",
                transition: "color 0.2s",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <input
                type={showPassword ? "text" : "password"} value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPassFocused(true)} onBlur={() => setPassFocused(false)}
                placeholder="Enter your password"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "11px 44px 11px 40px",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${passFocused ? "rgba(62,207,142,0.55)" : "rgba(255,255,255,0.09)"}`,
                  borderRadius: 10, color: "#fff", fontSize: 13.5, outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  boxShadow: passFocused ? "0 0 0 3px rgba(62,207,142,0.1)" : "none",
                  caretColor: "#3ecf8e",
                }}
              />
              <button
                type="button" onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.3)", padding: 3,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#3ecf8e")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)")}
              >
                {showPassword ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 12px",
              background: "rgba(239,68,68,0.09)",
              border: "1px solid rgba(239,68,68,0.22)",
              borderRadius: 9, color: "#f87171", fontSize: 12.5,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit" disabled={busy}
            style={{
              marginTop: 4,
              padding: "12px 20px",
              background: busy ? "rgba(62,207,142,0.35)" : "linear-gradient(135deg, #3ecf8e 0%, #1fa366 100%)",
              border: "none", borderRadius: 10,
              color: "#071a0e", fontSize: 14, fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
              letterSpacing: "0.01em",
              transition: "all 0.2s",
              boxShadow: busy ? "none" : "0 4px 20px rgba(62,207,142,0.32)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => { if (!busy) { const b = e.currentTarget as HTMLButtonElement; b.style.boxShadow = "0 6px 28px rgba(62,207,142,0.48)"; b.style.transform = "translateY(-1px)"; }}}
            onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.boxShadow = "0 4px 20px rgba(62,207,142,0.32)"; b.style.transform = "translateY(0)"; }}
          >
            {busy ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.18)", marginTop: 24, letterSpacing: "0.04em" }}>
          TENSEI ARK · Laptop Management System
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)} 15%{transform:translateX(-7px)} 30%{transform:translateX(7px)}
          45%{transform:translateX(-5px)} 60%{transform:translateX(5px)} 75%{transform:translateX(-2px)} 90%{transform:translateX(2px)}
        }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        input::placeholder { color: rgba(255,255,255,0.18); }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px rgba(12,17,28,0.95) inset !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #3ecf8e;
        }
      `}</style>
    </div>
  );
}
