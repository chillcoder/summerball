// Tiny dependency-free SVG sparkline. Server-renderable (no hooks).
export default function Sparkline({
  values,
  width = 300,
  height = 44,
  stroke = "#d68f23",
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (values.length < 2) return null;

  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1; // flat line guard
  const stepX = (width - pad * 2) / (values.length - 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const pts = values.map((v, i) => [pad + i * stepX, y(v)] as const);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="Trend over games"
    >
      <polyline
        points={pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map(([px, py], i) => (
        <circle
          key={i}
          cx={px.toFixed(1)}
          cy={py.toFixed(1)}
          r={i === pts.length - 1 ? 3.5 : 2}
          fill={stroke}
          opacity={i === pts.length - 1 ? 1 : 0.55}
        />
      ))}
    </svg>
  );
}
