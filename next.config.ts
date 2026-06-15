import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server Actions are GA in Next 16; same-origin invocations (localhost and the
  // deployed *.vercel.app domain) are allowed by default — no extra config needed.
};

export default nextConfig;
