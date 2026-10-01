"use client";

// Controles da carteira de extensao com botoes sempre visiveis. O menu suspenso
// do WalletMultiButton abre para baixo e fica cortado no rodape da barra lateral;
// aqui "Trocar" desconecta e abre a lista de carteiras em uma janela (modal).

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Check, Copy, LogOut, Repeat, Wallet } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export function WalletControls() {
  const { connected, connecting, disconnect, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  if (!connected)
    return (
      <button className="btn btn-primary w-full justify-center" disabled={connecting} onClick={() => setVisible(true)}>
        <Wallet className="size-4" /> {connecting ? t("Conectando…", "Connecting…") : t("Conectar carteira", "Connect wallet")}
      </button>
    );

  const copy = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sem permissao de area de transferencia */
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        className="btn btn-primary w-full justify-center"
        onClick={async () => {
          await disconnect();
          setVisible(true);
        }}
      >
        <Repeat className="size-4" /> {t("Trocar carteira", "Switch wallet")}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-ghost justify-center" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? t("Copiado", "Copied") : t("Copiar", "Copy")}
        </button>
        <button className="btn btn-ghost justify-center" onClick={() => disconnect()}>
          <LogOut className="size-4" /> {t("Sair", "Disconnect")}
        </button>
      </div>
    </div>
  );
}
