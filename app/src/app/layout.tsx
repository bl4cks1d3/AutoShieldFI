import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "AutoShieldFI — Proteção veicular descentralizada",
  description:
    "Proteção veicular acessível e transparente na Solana: contrate, acione sinistros on-chain e receba cashback quando não usar.",
  applicationName: "AutoShieldFI",
  appleWebApp: { capable: true, title: "AutoShieldFI", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1311" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-dvh">
        <Providers>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-sm text-[var(--muted)]">
            AutoShieldFI · Proteção veicular descentralizada na Solana · Projeto de hackathon — não é um produto de
            seguro regulado pela SUSEP.
          </footer>
        </Providers>
        <RegisterSW />
      </body>
    </html>
  );
}
