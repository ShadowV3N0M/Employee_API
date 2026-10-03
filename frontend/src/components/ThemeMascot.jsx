import { useEffect, useState } from "react";

export default function ThemeMascot({ active, onComplete }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    // Check reduced motion preference
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      if (onComplete) onComplete();
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      if (onComplete) onComplete();
    }, 2800);

    return () => clearTimeout(timer);
  }, [active, onComplete]);

  if (!visible || !active) return null;

  return (
    <aside
      className={`theme-mascot-stage mascot-${active}`}
      aria-live="polite"
      aria-label={
        active === "rooster"
          ? "Rooster waking up for light mode"
          : "Owl waking up for dark mode"
      }
    >
      <div className="theme-mascot-card">
        {/* ================= ROOSTER (Light Theme Dawn) ================= */}
        {active === "rooster" && (
          <div className="mascot-actor actor-rooster">
            <div className="mascot-speech-bubble">
              <span className="bubble-text">Rise &amp; Shine!</span>
              <span className="bubble-emoji">☀️</span>
            </div>

            <svg
              viewBox="0 0 160 140"
              className="mascot-svg mascot-rooster-svg"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="roosterSun" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fff3bf" stopOpacity="0.9" />
                  <stop offset="60%" stopColor="#ffd43b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#fab005" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Sunrise ambient aura */}
              <circle cx="80" cy="80" r="48" fill="url(#roosterSun)" className="rooster-sunrise-glow" />

              {/* Perch post & fence rail */}
              <rect x="70" y="96" width="20" height="44" rx="4" fill="#8d5b4c" stroke="#5c3a21" strokeWidth="2" />
              <rect x="45" y="94" width="70" height="9" rx="3" fill="#a06855" stroke="#5c3a21" strokeWidth="2" />

              {/* Rooster claws */}
              <path d="M72 94 L72 90 M76 94 L76 90 M84 94 L84 90 M88 94 L88 90" stroke="#f59f00" strokeWidth="3" strokeLinecap="round" />

              {/* Tail plumes */}
              <g className="rooster-tail">
                <path d="M62 76 C38 68 28 42 42 28 C48 44 54 60 66 68 Z" fill="#099268" />
                <path d="M58 78 C32 76 22 52 34 38 C44 52 50 66 64 74 Z" fill="#1098ad" />
                <path d="M56 82 C36 88 26 70 38 56 C46 66 52 76 62 80 Z" fill="#0ca678" />
              </g>

              {/* Rooster plump body */}
              <path d="M60 84 C60 66 74 60 88 64 C96 66 102 74 102 84 C102 96 90 100 78 98 C66 96 60 92 60 84 Z" fill="#d9480f" />

              {/* Flapping wing */}
              <path d="M68 80 C74 72 88 72 92 82 C92 90 82 94 72 90 Z" fill="#e8590c" className="rooster-wing" />

              {/* Stretching neck and head */}
              <g className="rooster-head-group">
                <path d="M84 70 C86 54 88 42 94 36 C98 42 100 56 96 70 Z" fill="#f59f00" />
                {/* Wobbly crown / comb */}
                <path d="M92 32 C88 22 94 16 97 20 C100 14 107 16 107 22 C113 16 118 20 114 28 Z" fill="#e03131" className="rooster-comb" />
                {/* Head circle */}
                <circle cx="98" cy="36" r="10" fill="#f59f00" />
                {/* Red wattle */}
                <path d="M102 44 C105 50 101 56 97 52 C95 48 97 44 102 44 Z" fill="#e03131" className="rooster-wattle" />
                {/* Upper beak */}
                <path d="M106 34 L122 38 L106 41 Z" fill="#fcc419" stroke="#e67700" strokeWidth="1" className="rooster-beak-upper" />
                {/* Lower crowing beak */}
                <path d="M106 39 L118 43 L106 44 Z" fill="#f59f00" className="rooster-beak-lower" />
                {/* Eye */}
                <circle cx="100" cy="34" r="3.2" fill="#ffffff" />
                <circle cx="101" cy="34" r="1.6" fill="#1c2333" className="rooster-eye-pupil" />
                <path d="M96 32 L103 34" stroke="#c92a2a" strokeWidth="1.5" strokeLinecap="round" />
              </g>

              {/* Crowing Musical & Sunburst Notes */}
              <g className="rooster-notes">
                <text x="124" y="28" className="crow-note crow-note-1">♪</text>
                <text x="136" y="18" className="crow-note crow-note-2">♫</text>
                <text x="128" y="8" className="crow-note crow-note-3">☼</text>
              </g>
            </svg>
          </div>
        )}

        {/* ================= OWL (Dark Theme Twilight) ================= */}
        {active === "owl" && (
          <div className="mascot-actor actor-owl">
            <div className="mascot-speech-bubble">
              <span className="bubble-text">Night Owl Mode!</span>
              <span className="bubble-emoji">🌙</span>
            </div>

            <svg
              viewBox="0 0 160 140"
              className="mascot-svg mascot-owl-svg"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="owlMoonAura" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#91a7ff" stopOpacity="0.4" />
                  <stop offset="70%" stopColor="#4c6ef5" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#3b5bdb" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Night moonlit aura */}
              <circle cx="80" cy="72" r="48" fill="url(#owlMoonAura)" className="owl-moon-glow" />

              {/* Tree Branch */}
              <path d="M20 98 Q80 92 140 102 L140 108 Q80 98 20 104 Z" fill="#3e2e23" stroke="#261b14" strokeWidth="1.5" />
              <path d="M110 98 Q125 82 135 80" stroke="#3e2e23" strokeWidth="3" strokeLinecap="round" />

              {/* Owl Claws / Talons */}
              <path d="M68 95 L68 101 M72 95 L72 101 M76 95 L76 100 M84 95 L84 101 M88 95 L88 101 M92 95 L92 100" stroke="#f59f00" strokeWidth="2.5" strokeLinecap="round" />

              {/* Owl Body */}
              <ellipse cx="80" cy="72" rx="26" ry="28" fill="#334155" stroke="#1e293b" strokeWidth="2" />

              {/* Feathery Chest */}
              <ellipse cx="80" cy="78" rx="17" ry="18" fill="#475569" />
              <path d="M72 72 Q76 76 80 72 M80 72 Q84 76 88 72 M74 80 Q78 84 82 80 M80 86 Q84 90 88 86" stroke="#64748b" strokeWidth="1.8" fill="none" strokeLinecap="round" />

              {/* Wings */}
              <path d="M54 60 C50 73 52 88 60 94 C56 84 56 70 58 62 Z" fill="#1e293b" className="owl-wing-left" />
              <path d="M106 60 C110 73 108 88 100 94 C104 84 104 70 102 62 Z" fill="#1e293b" className="owl-wing-right" />

              {/* Head group with ear tufts & animated head-tilt */}
              <g className="owl-head-group">
                {/* Ear tufts */}
                <path d="M60 42 L52 24 L68 34 Z" fill="#334155" className="owl-tuft-left" />
                <path d="M100 42 L108 24 L92 34 Z" fill="#334155" className="owl-tuft-right" />

                {/* Head circle */}
                <circle cx="80" cy="46" r="22" fill="#334155" stroke="#1e293b" strokeWidth="2" />

                {/* Face disc shadows */}
                <circle cx="71" cy="46" r="11" fill="#1e293b" />
                <circle cx="89" cy="46" r="11" fill="#1e293b" />

                {/* Big White Sclera */}
                <circle cx="71" cy="46" r="8.5" fill="#f8fafc" />
                <circle cx="89" cy="46" r="8.5" fill="#f8fafc" />

                {/* Glowing Amber Irises */}
                <circle cx="71" cy="46" r="6.5" fill="#fab005" className="owl-iris" />
                <circle cx="89" cy="46" r="6.5" fill="#fab005" className="owl-iris" />

                {/* Pupils */}
                <circle cx="71" cy="46" r="4.2" fill="#0f172a" className="owl-pupil" />
                <circle cx="89" cy="46" r="4.2" fill="#0f172a" className="owl-pupil" />
                <circle cx="69.5" cy="44" r="1.3" fill="#ffffff" />
                <circle cx="87.5" cy="44" r="1.3" fill="#ffffff" />

                {/* Sleepy Eyelids that slide open */}
                <path d="M62 46 Q71 55 80 46 Q71 38 62 46 Z" fill="#334155" className="owl-eyelid-path owl-eyelid-left" />
                <path d="M80 46 Q89 55 98 46 Q89 38 80 46 Z" fill="#334155" className="owl-eyelid-path owl-eyelid-right" />

                {/* Beak */}
                <path d="M77 48 L83 48 L80 56 Z" fill="#f59f00" stroke="#d97706" strokeWidth="1" />
              </g>

              {/* Twinkling nocturnal stars */}
              <g className="owl-twinkle-stars">
                <text x="24" y="36" className="owl-star owl-star-1">✦</text>
                <text x="132" y="32" className="owl-star owl-star-2">★</text>
                <text x="120" y="16" className="owl-star owl-star-3">✦</text>
              </g>
            </svg>
          </div>
        )}
      </div>
    </aside>
  );
}
