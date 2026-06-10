/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // exceljs / googleapis are server-only heavy deps; keep them external so the
  // Next bundler does not mangle them (see Part 8, bug #1).
  serverExternalPackages: ["exceljs", "googleapis"],
};

export default nextConfig;
