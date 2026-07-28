// The real Beerkats logo (transparent PNG at /public/beerkats-logo.png),
// for use across the app chrome. Server component — no interactivity needed.
export default function BrandLogo({
  size = 96,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/beerkats-logo.png"
      alt="Beerkats"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
