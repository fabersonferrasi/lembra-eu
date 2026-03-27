import type { NextConfig } from "next";

const withPWA = require("next-pwa")({
  dest: "public",
  disable: false, // Force SW on dev to test Background Tasks
  register: true,
  skipWaiting: true,
  customWorkerDir: "worker"
});

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

export default withPWA(nextConfig);
