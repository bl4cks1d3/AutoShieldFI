export const PROGRAM_ID =
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "GPnGSA7KH3vqnF1KfzHGzQNvnEBVD3XRfCayEBhQsuRC";

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export const CLUSTER_LABEL = process.env.NEXT_PUBLIC_CLUSTER_LABEL ?? "Devnet";

export const STABLE_SYMBOL = process.env.NEXT_PUBLIC_STABLE_SYMBOL ?? "tBRL";

/**
 * Modo demonstracao (simulacao local no navegador). Em deploys publicos na
 * rede de teste use NEXT_PUBLIC_ENABLE_DEMO=false: o app fica somente on-chain,
 * sem seletor de modo nem controles de simulacao.
 */
export const DEMO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO !== "false";

export const DEFAULT_MODE: "demo" | "chain" =
  !DEMO_ENABLED || process.env.NEXT_PUBLIC_DEFAULT_MODE === "chain" ? "chain" : "demo";

export const EXPLORER_CLUSTER = process.env.NEXT_PUBLIC_EXPLORER_CLUSTER ?? "devnet";

export function explorerTx(sig: string): string {
  const q = EXPLORER_CLUSTER === "mainnet-beta" ? "" : `?cluster=${EXPLORER_CLUSTER}`;
  if (EXPLORER_CLUSTER === "localnet")
    return `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`;
  return `https://explorer.solana.com/tx/${sig}${q}`;
}

export function explorerAddr(addr: string): string {
  if (EXPLORER_CLUSTER === "localnet")
    return `https://explorer.solana.com/address/${addr}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`;
  const q = EXPLORER_CLUSTER === "mainnet-beta" ? "" : `?cluster=${EXPLORER_CLUSTER}`;
  return `https://explorer.solana.com/address/${addr}${q}`;
}

/** Gateway publico para abrir evidencias gravadas como ipfs://CID. */
export const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io/ipfs/";

export function ipfsUrl(uri: string): string | null {
  const m = uri.match(/^ipfs:\/\/([A-Za-z0-9]+)/);
  return m ? `${IPFS_GATEWAY}${m[1]}` : null;
}
