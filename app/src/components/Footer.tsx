"use client";

import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="text-xs text-[var(--muted)] [text-wrap:pretty]">
      {t(
        "AutoShieldFI · Proteção veicular descentralizada na Solana · Projeto de hackathon — não é um produto de seguro regulado pela SUSEP.",
        "AutoShieldFI · Decentralized vehicle protection on Solana · Hackathon project — not an insurance product regulated by SUSEP (Brazil's insurance regulator).",
      )}
    </footer>
  );
}
