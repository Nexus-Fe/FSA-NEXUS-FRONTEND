import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXUS_DEV_PREVIEW === "1" ? "build" : undefined,
  output: "standalone",
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: {
      exclude: ["error"],
    },
  },
  experimental: {
    agentFeedback: false,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
