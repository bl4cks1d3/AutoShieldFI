import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Politica de seguranca do conteudo: o app so carrega codigo proprio, fala com
// RPCs/IPFS via HTTPS e nao pode ser embutido em outro site (anti-clickjacking,
// importante para dApps em que o usuario aprova transacoes na carteira).
// Excecoes: login social da Privy (iframe da carteira embutida em auth.privy.io
// e captcha Cloudflare Turnstile).
const PRIVY_FRAMES = "https://auth.privy.io https://challenges.cloudflare.com";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  `frame-src 'self' ${PRIVY_FRAMES}`,
  `child-src 'self' ${PRIVY_FRAMES}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss:" + (isDev ? " http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*" : ""),
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
