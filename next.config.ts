import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  serverExternalPackages: ['@libsql/client', '@prisma/adapter-libsql', '@prisma/client', 'nodemailer', 'xlsx'],
};

export default nextConfig;
