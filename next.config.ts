import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel uses its own build pipeline - don't use standalone output for Vercel deployment
  // Uncomment the line below if deploying to a custom server (Docker, Railway, etc.)
  // output: "standalone",
  allowedDevOrigins: [
    "preview-chat-aecb54aa-1896-480f-86a7-c597a3d3a0c2.space.z.ai",
    "*.space.z.ai",
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Serverless function config for Vercel
  serverExternalPackages: ['@libsql/client'],
};

export default nextConfig;
