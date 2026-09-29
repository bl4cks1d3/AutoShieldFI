import type { Metadata, Viewport } from "next";
import { Shell } from "@/components/AppShell";
import { Providers } from "@/components/Providers";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoShieldFI — Proteção veicular descentralizada",
  description:
    "Proteção veicular acessível e transparente na Solana: contrate, acione sinistros on-chain e receba cashback quando não usar.",
  applicationName: "AutoShieldFI",
  appleWebApp: { capable: true, title: "AutoShieldFI", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f7f6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-dvh">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
        <RegisterSW />
      </body>
    </html>
  );
}
