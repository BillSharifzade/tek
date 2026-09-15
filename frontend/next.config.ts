import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // backend images are placeholder URLs / external CDN; optimisation is not needed in dev
    unoptimized: true,
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
  // dev server is reached through 127.0.0.1 / docker bridge as well as localhost
  allowedDevOrigins: ["127.0.0.1", "localhost", "172.17.0.1"],
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
