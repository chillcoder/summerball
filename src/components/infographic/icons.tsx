import { C } from "./theme";

type IconProps = { size?: number; color?: string };

const base = (color: string) => ({ stroke: color, fill: "none", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export function HomePlateIcon({ size = 26, color = C.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base(color)}>
      <path d="M5 4 H19 V13 L12 20 L5 13 Z" />
    </svg>
  );
}

export function BatterIcon({ size = 26, color = C.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base(color)}>
      <circle cx="9" cy="5" r="2" />
      <path d="M9 7 V13 M9 13 L6 20 M9 13 L12 19" />
      <path d="M9 9 L18 4" />
    </svg>
  );
}

export function BatIcon({ size = 26, color = C.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base(color)}>
      <path d="M5 19 L16 8" />
      <path d="M15 7 q4 -4 4 0 q0 4 -4 4 Z" fill={color} />
      <circle cx="5" cy="19" r="1.4" fill={color} />
    </svg>
  );
}

export function WalkIcon({ size = 26, color = C.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base(color)}>
      <circle cx="13" cy="4" r="2" />
      <path d="M13 6 L11 13 L14 20 M11 13 L7 18 M13 8 L17 11" />
    </svg>
  );
}

export function WingedBallIcon({ size = 26, color = C.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base(color)}>
      <circle cx="14" cy="12" r="4.5" />
      <path d="M9 9 q-5 -1 -7 1 M9 12 q-6 0 -8 2 M9 15 q-5 1 -7 3" />
    </svg>
  );
}

export function DiamondIcon({ size = 26, color = C.ink, label }: IconProps & { label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base(color)}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" transform="rotate(45 12 12)" />
      {label && (
        <text x="12" y="14.5" textAnchor="middle" fontSize="7" fontFamily="var(--font-anton), sans-serif" fill={color} stroke="none">
          {label}
        </text>
      )}
    </svg>
  );
}

export function BallIcon({ size = 26, color = C.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base(color)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M7 6 q3 6 0 12 M17 6 q-3 6 0 12" />
    </svg>
  );
}

export function ShieldIcon({ size = 26, color = C.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base(color)}>
      <path d="M12 3 L19 6 V12 Q19 18 12 21 Q5 18 5 12 V6 Z" />
    </svg>
  );
}

export function BarsIcon({ size = 26, color = C.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base(color)}>
      <path d="M5 19 V14 M12 19 V9 M19 19 V5" />
    </svg>
  );
}

export function TargetIcon({ size = 26, color = C.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base(color)}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="0.6" fill={color} />
    </svg>
  );
}

export function MotionBallIcon({ size = 26, color = C.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base(color)}>
      <circle cx="15" cy="12" r="5" />
      <path d="M7 9 H2 M7 12 H1 M7 15 H3" />
    </svg>
  );
}

export function CrossedBatsIcon({ size = 26, color = C.ink }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base(color)}>
      <path d="M4 20 L18 6 M20 20 L6 6" />
      <path d="M17 5 q3 -3 3 0 q0 3 -3 3 Z M7 5 q-3 -3 -3 0 q0 3 3 3 Z" fill={color} />
    </svg>
  );
}
