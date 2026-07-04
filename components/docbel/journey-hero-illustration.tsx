/**
 * Illustration hero de l'écran d'explication d'un dossier (journey).
 *
 * Scène SVG dessinée maison (contrainte : pas de visuel ONEM/tiers) : un
 * « chemin de la demande » qui serpente d'un chapeau de diplômé vers un
 * document validé, un calendrier, un portefeuille (allocations) et un dossier
 * classé. Palette glass via tokens CSS → dark néon hérité gratuitement.
 *
 * Animations douces et `prefers-reduced-motion`-safe (flottement, scintillement
 * des étincelles, flux du chemin) — désactivées si l'utilisateur réduit les
 * animations. Purement décorative (aria-hidden).
 */

const A = "var(--glass-accent-deep)";
const SOFT = "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)";
const SOFT2 = "color-mix(in oklab, var(--glass-accent-deep) 8%, transparent)";
const POP = "var(--glass-pop-fg)";
const POPSOFT = "color-mix(in oklab, var(--glass-pop-fg) 22%, transparent)";
const INK = "color-mix(in oklab, var(--glass-accent-deep) 55%, transparent)";

export function JourneyHeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 300"
      className={className}
      role="presentation"
      aria-hidden="true"
      fill="none"
    >
      <style>{`
        @keyframes jh-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
        @keyframes jh-float2 { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
        @keyframes jh-tw { 0%,100% { opacity:.25; transform:scale(.7) } 50% { opacity:1; transform:scale(1) } }
        @keyframes jh-dash { to { stroke-dashoffset: -220 } }
        .jh-a{ transform-box: fill-box; transform-origin: center; animation: jh-float 6s ease-in-out infinite }
        .jh-b{ transform-box: fill-box; transform-origin: center; animation: jh-float2 7s ease-in-out infinite .6s }
        .jh-c{ transform-box: fill-box; transform-origin: center; animation: jh-float 6.5s ease-in-out infinite 1.1s }
        .jh-d{ transform-box: fill-box; transform-origin: center; animation: jh-float2 7.5s ease-in-out infinite .3s }
        .jh-tw{ transform-box: fill-box; transform-origin: center; animation: jh-tw 3s ease-in-out infinite }
        .jh-flow{ stroke-dasharray: 10 12; animation: jh-dash 5s linear infinite }
        @media (prefers-reduced-motion: reduce){
          .jh-a,.jh-b,.jh-c,.jh-d,.jh-tw,.jh-flow{ animation: none }
        }
      `}</style>

      {/* Halo ambiant */}
      <ellipse cx="300" cy="150" rx="230" ry="150" fill={SOFT2} />

      {/* ── Chemin de la demande (serpente entre les éléments) ── */}
      <path
        d="M70 232 C 150 232, 150 150, 230 150 S 320 96, 400 108 S 470 150, 486 128"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="4 12"
      />
      <path
        className="jh-flow"
        d="M70 232 C 150 232, 150 150, 230 150 S 320 96, 400 108 S 470 150, 486 128"
        stroke={A}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* ── 1. Chapeau de diplômé sur une pile de livres ── */}
      <g className="jh-a">
        {/* livres */}
        <rect x="34" y="236" width="86" height="16" rx="4" fill={SOFT} stroke={A} strokeWidth="2.5" />
        <rect x="42" y="222" width="78" height="16" rx="4" fill={SOFT2} stroke={A} strokeWidth="2.5" />
        <rect x="38" y="208" width="72" height="16" rx="4" fill={POPSOFT} stroke={A} strokeWidth="2.5" />
        {/* toque */}
        <path d="M74 176 L112 190 L74 204 L36 190 Z" fill={SOFT} stroke={A} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M74 204 L74 196" stroke={A} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M100 195 L100 210" stroke={A} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="100" cy="212" r="3" fill={POP} />
      </g>

      {/* ── 2. Document validé ── */}
      <g className="jh-b">
        <rect x="196" y="112" width="60" height="76" rx="8" fill="color-mix(in oklab, var(--glass-accent-deep) 6%, var(--glass-surface, transparent))" stroke={A} strokeWidth="2.5" />
        <path d="M208 132 h30 M208 146 h30 M208 160 h20" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="246" cy="176" r="15" fill={POPSOFT} stroke={A} strokeWidth="2.5" />
        <path d="M240 176 l4 4 8-9" stroke={POP} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* ── 3. Calendrier (stage 156 j) ── */}
      <g className="jh-c">
        <rect x="292" y="64" width="66" height="60" rx="9" fill={SOFT} stroke={A} strokeWidth="2.5" />
        <path d="M292 82 h66" stroke={A} strokeWidth="2.5" />
        <path d="M306 58 v10 M344 58 v10" stroke={A} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="308" cy="96" r="2.6" fill={A} />
        <circle cx="325" cy="96" r="2.6" fill={A} />
        <circle cx="342" cy="96" r="2.6" fill={POP} />
        <circle cx="308" cy="110" r="2.6" fill={A} />
        <circle cx="325" cy="110" r="2.6" fill={A} />
      </g>

      {/* ── 4. Portefeuille + pièce (allocations) ── */}
      <g className="jh-d">
        <rect x="380" y="118" width="72" height="52" rx="12" fill={SOFT} stroke={A} strokeWidth="2.5" />
        <path d="M380 134 h72" stroke={A} strokeWidth="2.5" />
        <rect x="428" y="138" width="24" height="16" rx="8" fill={SOFT2} stroke={A} strokeWidth="2.5" />
        <circle cx="440" cy="146" r="2.6" fill={A} />
        <circle cx="426" cy="104" r="15" fill={POPSOFT} stroke={A} strokeWidth="2.5" />
        <path d="M420 104 h12 M426 98 v12" stroke={POP} strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* ── 5. Dossier classé (droite) ── */}
      <g className="jh-b" style={{ animationDelay: "1.4s" }}>
        <path d="M460 176 h44 a4 4 0 0 1 4 4 v34 a4 4 0 0 1 -4 4 h-44 a4 4 0 0 1 -4 -4 v-42 a4 4 0 0 1 4 -4 h12 l6 8" fill={SOFT} stroke={A} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="482" cy="200" r="9" fill={POPSOFT} stroke={A} strokeWidth="2" />
        <path d="M478 200 l3 3 5-6" stroke={POP} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* ── Étincelles ── */}
      {[
        { x: 160, y: 90, s: 7, d: "0s" },
        { x: 372, y: 46, s: 9, d: ".8s" },
        { x: 130, y: 176, s: 6, d: "1.4s" },
        { x: 486, y: 90, s: 7, d: ".4s" },
        { x: 268, y: 70, s: 5, d: "1.9s" },
      ].map((p) => (
        <path
          key={`${p.x}-${p.y}`}
          className="jh-tw"
          style={{ animationDelay: p.d }}
          d={`M${p.x} ${p.y - p.s} C ${p.x + p.s * 0.3} ${p.y - p.s * 0.3}, ${p.x + p.s * 0.3} ${p.y - p.s * 0.3}, ${p.x + p.s} ${p.y} C ${p.x + p.s * 0.3} ${p.y + p.s * 0.3}, ${p.x + p.s * 0.3} ${p.y + p.s * 0.3}, ${p.x} ${p.y + p.s} C ${p.x - p.s * 0.3} ${p.y + p.s * 0.3}, ${p.x - p.s * 0.3} ${p.y + p.s * 0.3}, ${p.x - p.s} ${p.y} C ${p.x - p.s * 0.3} ${p.y - p.s * 0.3}, ${p.x - p.s * 0.3} ${p.y - p.s * 0.3}, ${p.x} ${p.y - p.s} Z`}
          fill={p.s > 6 ? POP : A}
        />
      ))}
    </svg>
  );
}
