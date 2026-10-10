import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Isolated local QA can run beside an already built studio instance.
  distDir: process.env.INVITATION_BUILD_DIR || ".next",
};

export default nextConfig;
