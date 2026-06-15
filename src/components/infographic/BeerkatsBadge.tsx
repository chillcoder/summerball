import { C } from "./theme";

/**
 * Beerkats badge — a roundel combining a baseball, a foaming beer glass, and a
 * crossed bat, with a banner and stars. Vector-built so it scales crisply in
 * the exported PNG.
 */
export default function BeerkatsBadge({ size = 150 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer ring */}
      <circle cx="100" cy="100" r="96" fill={C.ink} />
      <circle cx="100" cy="100" r="88" fill={C.sage} />
      <circle cx="100" cy="100" r="80" fill={C.card} />

      {/* Crossed bat behind */}
      <g transform="rotate(45 100 92)">
        <rect x="96" y="40" width="9" height="74" rx="4.5" fill={C.ink} />
        <rect x="95" y="108" width="11" height="14" rx="3" fill={C.ink} />
      </g>

      {/* Baseball */}
      <circle cx="80" cy="96" r="34" fill="#FBF7EE" stroke={C.ink} strokeWidth="2.5" />
      <path d="M64 74 Q72 96 64 118" stroke={C.red} strokeWidth="2.5" fill="none" />
      <path d="M96 74 Q88 96 96 118" stroke={C.red} strokeWidth="2.5" fill="none" />
      {[80, 88, 96, 104, 112].map((y) => (
        <g key={`l${y}`}>
          <path d={`M66 ${y} l4 -2`} stroke={C.red} strokeWidth="1.6" />
          <path d={`M90 ${y} l4 2`} stroke={C.red} strokeWidth="1.6" />
        </g>
      ))}

      {/* Beer glass with foam */}
      <g transform="translate(104 66)">
        <path d="M2 14 H40 L36 70 Q35 78 28 78 H14 Q7 78 6 70 Z" fill={C.gold} stroke={C.ink} strokeWidth="2.5" />
        <path d="M40 24 q12 2 11 14 q-1 12 -12 11" fill="none" stroke={C.ink} strokeWidth="2.5" />
        {/* Foam */}
        <path d="M0 16 q2 -12 12 -9 q4 -9 14 -5 q9 -3 13 6 q8 1 6 10 q-6 4 -11 1 q-6 5 -14 1 q-7 4 -13 -1 q-8 -1 -7 -4 Z" fill="#FBF7EE" stroke={C.ink} strokeWidth="2.5" />
        {/* Bubbles */}
        <circle cx="14" cy="40" r="2.4" fill="#FBF7EE" opacity="0.7" />
        <circle cx="24" cy="52" r="2" fill="#FBF7EE" opacity="0.6" />
      </g>

      {/* Banner */}
      <g>
        <path d="M30 132 H170 L160 156 H40 Z" fill={C.ink} />
        <path d="M30 132 L40 156 H26 Z" fill={C.teal} />
        <path d="M170 132 L160 156 H174 Z" fill={C.teal} />
        <text x="100" y="150" textAnchor="middle" fill={C.card} fontFamily="var(--font-anton), sans-serif" fontSize="20" letterSpacing="1.5">
          BEERKATS
        </text>
      </g>

      {/* Stars */}
      <text x="100" y="176" textAnchor="middle" fill={C.gold} fontSize="11" letterSpacing="3">★ ★ ★</text>
    </svg>
  );
}
