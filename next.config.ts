import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ["uaisotrem.ddns.net"],
  typescript: {
    ignoreBuildErrors: true, 
  },
};

export default nextConfig;
