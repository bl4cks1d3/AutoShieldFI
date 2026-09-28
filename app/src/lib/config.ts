export const PROGRAM_ID =
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "GPnGSA7KH3vqnF1KfzHGzQNvnEBVD3XRfCayEBhQsuRC";

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export const CLUSTER_LABEL = process.env.NEXT_PUBLIC_CLUSTER_LABEL ?? "Devnet";

export const STABLE_SYMBOL = process.env.NEXT_PUBLIC_STABLE_SYMBOL ?? "tBRL";

export const DEFAULT_MODE: "demo" | "chain" =
  process.env.NEXT_PUBLIC_DEFAULT_MODE === "chain" ? "chain" : "demo";

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
