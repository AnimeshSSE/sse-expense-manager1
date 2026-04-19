import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "preview-chat-aecb54aa-1896-480f-86a7-c597a3d3a0c2.space.z.ai",
    "*.space.z.ai",
  ],
  reactStrictMode: false,
  serverExternalPackages: ['@libsql/client'],
};

export default nextConfig;
