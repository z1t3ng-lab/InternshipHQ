import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.DEMO_MODE === "true" ? ".next-demo" : ".next",
  serverExternalPackages: ["better-sqlite3"],
  turbopack: { root: process.cwd() },
};
export default config;
