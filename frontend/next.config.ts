import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Prevents double mounting WebSocket connections in dev mode
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: "http://localhost:8080/api/:path*",
      },
    ];
  },
};

export default nextConfig;
