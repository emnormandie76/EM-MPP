import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // PGlite (tests only) is loaded from node_modules instead of being bundled,
  // and left out of the Vercel functions: production never loads it (21 MB).
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingExcludes: { "/*": ["./node_modules/@electric-sql/pglite/**/*"] },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
