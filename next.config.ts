import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second dev server (e.g. for automated browser tests) build into its own folder
  // instead of sharing .next with the main one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
