import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ssh2", "cpu-features", "better-sqlite3", "bcrypt"],
};

export default nextConfig;
