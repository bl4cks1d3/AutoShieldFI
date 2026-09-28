import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AutoShieldFI — Proteção veicular descentralizada",
    short_name: "AutoShieldFI",
    description: "Contrate proteção veicular, acione sinistros e receba cashback na Solana.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1311",
    theme_color: "#0f9f75",
    lang: "pt-BR",
    categories: ["finance", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Contratar proteção", url: "/cotar" },
      { name: "Acionar sinistro", url: "/sinistros" },
    ],
  };
}
