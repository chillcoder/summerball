"use client";

import { useState } from "react";
import BeerkatsBadge from "./BeerkatsBadge";

/**
 * Renders the real Beerkats logo from /public/beerkats-logo.png. If the file
 * isn't present (or fails to load), it falls back to the vector badge so the
 * infographic never breaks. The PNG sits on the same cream background, so it
 * composites seamlessly into the header.
 */
export default function BeerkatsLogo({ size = 150 }: { size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) return <BeerkatsBadge size={size} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/beerkats-logo.png"
      alt="Beerkats"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}
