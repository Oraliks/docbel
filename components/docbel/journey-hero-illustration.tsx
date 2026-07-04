/**
 * Illustration hero de l'écran d'explication d'un dossier — style « pastel
 * premium semi-3D ».
 *
 * Scène SVG dessinée maison (contrainte : pas de visuel ONEM/tiers) : un
 * « parcours administratif lumineux » qui relie une toque de diplômé, un
 * document validé, un calendrier, un portefeuille (allocations) et un dossier
 * classé. Volume donné par des dégradés doux + ombres portées légères (pas de
 * cartoon plat). Couleurs via tokens glass → cohérent clair ET dark néon.
 *
 * Animations douces, `prefers-reduced-motion`-safe. Décorative (aria-hidden).
 */

export function JourneyHeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 340"
      className={className}
      role="presentation"
      aria-hidden="true"
      fill="none"
    >
      <defs>
        {/* Dégradés de volume (clair → moyen) par matériau */}
        <linearGradient id="jh-lav" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--glass-accent-a)" stopOpacity="0.42" />
          <stop offset="1" stopColor="var(--glass-accent-deep)" stopOpacity="0.32" />
        </linearGradient>
        <linearGradient id="jh-lav2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--glass-accent-a)" stopOpacity="0.26" />
          <stop offset="1" stopColor="var(--glass-accent-a)" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id="jh-pink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--glass-accent-c)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--glass-accent-c)" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id="jh-cream" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--glass-accent-d)" stopOpacity="0.34" />
          <stop offset="1" stopColor="var(--glass-accent-d)" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id="jh-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--glass-accent-a)" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id="jh-path" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--glass-accent-a)" />
          <stop offset="0.55" stopColor="var(--glass-accent-deep)" />
          <stop offset="1" stopColor="var(--glass-accent-c)" />
        </linearGradient>
        <radialGradient id="jh-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--glass-accent-a)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--glass-accent-a)" stopOpacity="0" />
        </radialGradient>
        <filter id="jh-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="var(--glass-accent-deep)" floodOpacity="0.16" />
        </filter>
      </defs>

      <style>{`
        @keyframes jh-f1{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes jh-f2{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes jh-tw{0%,100%{opacity:.2;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}
        @keyframes jh-flow{to{stroke-dashoffset:-260}}
        @keyframes jh-pulse{0%,100%{opacity:.55}50%{opacity:1}}
        .jf1{transform-box:fill-box;transform-origin:center;animation:jh-f1 6.5s ease-in-out infinite}
        .jf2{transform-box:fill-box;transform-origin:center;animation:jh-f2 7.5s ease-in-out infinite .7s}
        .jf3{transform-box:fill-box;transform-origin:center;animation:jh-f1 7s ease-in-out infinite 1.2s}
        .jf4{transform-box:fill-box;transform-origin:center;animation:jh-f2 6.8s ease-in-out infinite .4s}
        .jtw{transform-box:fill-box;transform-origin:center;animation:jh-tw 3.2s ease-in-out infinite}
        .jflow{stroke-dasharray:2 14;animation:jh-flow 6s linear infinite}
        .jpulse{animation:jh-pulse 4s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){.jf1,.jf2,.jf3,.jf4,.jtw,.jflow,.jpulse{animation:none}}
      `}</style>

      {/* Halos ambiants */}
      <ellipse cx="180" cy="150" rx="150" ry="120" fill="url(#jh-glow)" className="jpulse" />
      <ellipse cx="410" cy="140" rx="130" ry="110" fill="url(#jh-glow)" className="jpulse" opacity="0.7" />

      {/* ── Chemin lumineux ── */}
      <path
        d="M64 270 C 150 270, 150 176, 236 176 S 340 108, 420 122 S 500 168, 520 140"
        stroke="var(--glass-accent-a)"
        strokeOpacity="0.22"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M64 270 C 150 270, 150 176, 236 176 S 340 108, 420 122 S 500 168, 520 140"
        stroke="url(#jh-path)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        className="jflow"
        d="M64 270 C 150 270, 150 176, 236 176 S 340 108, 420 122 S 500 168, 520 140"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />

      {/* ── 1. Toque de diplômé sur des livres ── */}
      <g className="jf1" filter="url(#jh-soft)">
        <ellipse cx="86" cy="292" rx="52" ry="9" fill="var(--glass-accent-deep)" opacity="0.12" />
        <rect x="44" y="272" width="86" height="16" rx="5" fill="url(#jh-cream)" stroke="var(--glass-accent-deep)" strokeOpacity="0.3" strokeWidth="1.5" />
        <rect x="52" y="258" width="78" height="16" rx="5" fill="url(#jh-lav2)" stroke="var(--glass-accent-deep)" strokeOpacity="0.3" strokeWidth="1.5" />
        <rect x="48" y="244" width="72" height="16" rx="5" fill="url(#jh-pink)" stroke="var(--glass-accent-deep)" strokeOpacity="0.3" strokeWidth="1.5" />
        <path d="M84 206 L128 222 L84 238 L40 222 Z" fill="url(#jh-lav)" stroke="var(--glass-accent-deep)" strokeOpacity="0.4" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M84 238 L84 228" stroke="var(--glass-accent-deep)" strokeOpacity="0.45" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M112 226 L112 244" stroke="var(--glass-accent-deep)" strokeOpacity="0.45" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="112" cy="247" r="3.5" fill="var(--glass-accent-c)" />
      </g>

      {/* ── 2. Document validé ── */}
      <g className="jf2" filter="url(#jh-soft)">
        <ellipse cx="230" cy="212" rx="34" ry="7" fill="var(--glass-accent-deep)" opacity="0.12" />
        <rect x="200" y="130" width="62" height="78" rx="10" fill="url(#jh-paper)" stroke="var(--glass-accent-deep)" strokeOpacity="0.28" strokeWidth="1.6" />
        <path d="M212 150 h34 M212 164 h34 M212 178 h22" stroke="var(--glass-accent-deep)" strokeOpacity="0.34" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="250" cy="196" r="15" fill="url(#jh-pink)" stroke="var(--glass-accent-deep)" strokeOpacity="0.3" strokeWidth="1.6" />
        <path d="M244 196 l4 4 8-9" stroke="var(--glass-accent-c)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* ── 3. Calendrier ── */}
      <g className="jf3" filter="url(#jh-soft)">
        <ellipse cx="326" cy="132" rx="34" ry="7" fill="var(--glass-accent-deep)" opacity="0.12" />
        <rect x="294" y="70" width="66" height="60" rx="11" fill="url(#jh-lav)" stroke="var(--glass-accent-deep)" strokeOpacity="0.3" strokeWidth="1.6" />
        <path d="M294 88 h66" stroke="var(--glass-accent-deep)" strokeOpacity="0.3" strokeWidth="1.6" />
        <path d="M308 63 v10 M346 63 v10" stroke="var(--glass-accent-deep)" strokeOpacity="0.45" strokeWidth="2.2" strokeLinecap="round" />
        {[0, 1, 2].map((c) => [0, 1].map((r) => (
          <circle key={`${c}-${r}`} cx={310 + c * 17} cy={100 + r * 13} r="2.6"
            fill={c === 2 && r === 0 ? "var(--glass-accent-c)" : "var(--glass-accent-deep)"}
            fillOpacity={c === 2 && r === 0 ? 1 : 0.5} />
        )))}
      </g>

      {/* ── 4. Portefeuille + pièce ── */}
      <g className="jf4" filter="url(#jh-soft)">
        <ellipse cx="426" cy="176" rx="40" ry="8" fill="var(--glass-accent-deep)" opacity="0.12" />
        <rect x="388" y="124" width="76" height="54" rx="13" fill="url(#jh-lav)" stroke="var(--glass-accent-deep)" strokeOpacity="0.3" strokeWidth="1.6" />
        <path d="M388 140 h76" stroke="var(--glass-accent-deep)" strokeOpacity="0.3" strokeWidth="1.6" />
        <rect x="440" y="144" width="24" height="16" rx="8" fill="url(#jh-lav2)" stroke="var(--glass-accent-deep)" strokeOpacity="0.3" strokeWidth="1.5" />
        <circle cx="452" cy="152" r="2.6" fill="var(--glass-accent-deep)" fillOpacity="0.6" />
        <circle cx="436" cy="108" r="16" fill="url(#jh-pink)" stroke="var(--glass-accent-deep)" strokeOpacity="0.3" strokeWidth="1.6" />
        <path d="M430 108 h12 M436 102 v12" stroke="var(--glass-accent-c)" strokeWidth="2.6" strokeLinecap="round" />
      </g>

      {/* ── 5. Dossier validé ── */}
      <g className="jf2" style={{ animationDelay: "1.5s" }} filter="url(#jh-soft)">
        <ellipse cx="500" cy="212" rx="34" ry="7" fill="var(--glass-accent-deep)" opacity="0.12" />
        <path d="M470 158 h48 a5 5 0 0 1 5 5 v38 a5 5 0 0 1 -5 5 h-48 a5 5 0 0 1 -5 -5 v-46 a5 5 0 0 1 5 -5 h13 l7 8" fill="url(#jh-cream)" stroke="var(--glass-accent-deep)" strokeOpacity="0.3" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="494" cy="184" r="10" fill="url(#jh-pink)" stroke="var(--glass-accent-deep)" strokeOpacity="0.28" strokeWidth="1.4" />
        <path d="M489 184 l3.5 3.5 6-7" stroke="var(--glass-accent-c)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* ── Étincelles ── */}
      {[
        { x: 170, y: 108, s: 8, d: "0s", pop: true },
        { x: 372, y: 52, s: 10, d: ".9s", pop: false },
        { x: 148, y: 196, s: 6, d: "1.5s", pop: false },
        { x: 520, y: 96, s: 7, d: ".5s", pop: true },
        { x: 276, y: 92, s: 5, d: "2s", pop: false },
        { x: 458, y: 214, s: 6, d: "1.1s", pop: true },
      ].map((p) => (
        <path
          key={`${p.x}-${p.y}`}
          className="jtw"
          style={{ animationDelay: p.d }}
          d={`M${p.x} ${p.y - p.s} C ${p.x + p.s * 0.28} ${p.y - p.s * 0.28}, ${p.x + p.s * 0.28} ${p.y - p.s * 0.28}, ${p.x + p.s} ${p.y} C ${p.x + p.s * 0.28} ${p.y + p.s * 0.28}, ${p.x + p.s * 0.28} ${p.y + p.s * 0.28}, ${p.x} ${p.y + p.s} C ${p.x - p.s * 0.28} ${p.y + p.s * 0.28}, ${p.x - p.s * 0.28} ${p.y + p.s * 0.28}, ${p.x - p.s} ${p.y} C ${p.x - p.s * 0.28} ${p.y - p.s * 0.28}, ${p.x - p.s * 0.28} ${p.y - p.s * 0.28}, ${p.x} ${p.y - p.s} Z`}
          fill={p.pop ? "var(--glass-accent-c)" : "var(--glass-accent-a)"}
        />
      ))}
    </svg>
  );
}
