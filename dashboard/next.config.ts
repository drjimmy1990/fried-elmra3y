import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/dashboard',
        destination: '/',
      },
      {
        source: '/dashboard/:path*',
        destination: '/:path*',
      },
    ];
  },
};

export default nextConfig;
