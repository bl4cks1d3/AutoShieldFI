"use client";

// Internacionalizacao simples: PT-BR e English. Cada texto fica ao lado do
// codigo que o usa, como t("Texto", "Text"); rotulos compartilhados e mensagens
// de erro do contrato ficam neste arquivo.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ClaimKind, ClaimStatus, Tier } from "./types";

export type Lang = "pt" | "en";

export const LANGS: { key: Lang; label: string; short: string }[] = [
  { key: "pt", label: "Português (Brasil)", short: "PT-BR" },
  { key: "en", label: "English", short: "EN" },
];

const LANG_KEY = "autoshield-lang";

// Idioma atual fora do React (formatadores e mensagens de erro).
let current: Lang = "pt";

export function getLang(): Lang {
  return current;
}

export function locale(lang: Lang = current): string {
  return lang === "en" ? "en-US" : "pt-BR";
}

/** Escolhe o texto do idioma atual (uso fora de componentes). */
export function tr(pt: string, en: string, lang: Lang = current): string {
  return lang === "en" ? en : pt;
}

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (pt: string, en: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt");

  useEffect(() => {
    let initial: Lang = "pt";
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (saved === "pt" || saved === "en") initial = saved;
      else if (!navigator.language.toLowerCase().startsWith("pt")) initial = "en";
    } catch {
      /* ignora */
    }
    setLangState(initial);
  }, []);

  useEffect(() => {
    current = lang;
    document.documentElement.lang = locale(lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    current = l;
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignora */
    }
  }, []);

  const value = useMemo<I18nCtx>(() => {
    current = lang;
    return { lang, setLang, t: (pt, en) => (lang === "en" ? en : pt) };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n fora do I18nProvider");
  return c;
}

// ---------------------------------------------------------------------------
// Rotulos compartilhados

type Labels<K extends string> = Record<K, { pt: string; en: string }>;

const TIER: Labels<Tier> = {
  basic: { pt: "Básico", en: "Basic" },
  standard: { pt: "Essencial", en: "Essential" },
  premium: { pt: "Completo", en: "Complete" },
  theftOnly: { pt: "Roubo e furto", en: "Theft only" },
  appDriver: { pt: "Motorista de App", en: "Ride-hailing driver" },
};

const TIER_DESC: Labels<Tier> = {
  basic: { pt: "Roubo, furto e eventos da natureza", en: "Theft and natural events" },
  standard: { pt: "Básico + colisão", en: "Basic + collision" },
  premium: {
    pt: "Essencial + danos a terceiros e outros eventos",
    en: "Essential + third-party damage and other events",
  },
  theftOnly: { pt: "Só roubo e furto — o mais barato", en: "Theft only — the cheapest plan" },
  appDriver: {
    pt: "Uber, 99, iFood: roubo, colisão, terceiros e natureza — contratação mensal",
    en: "Uber, 99, iFood: theft, collision, third party and natural events — monthly",
  },
};

const KIND: Labels<ClaimKind> = {
  theft: { pt: "Roubo / furto", en: "Theft" },
  collision: { pt: "Colisão", en: "Collision" },
  thirdParty: { pt: "Danos a terceiros", en: "Third-party damage" },
  naturalEvent: { pt: "Evento da natureza", en: "Natural event" },
  other: { pt: "Outros", en: "Other" },
};

const STATUS: Labels<ClaimStatus> = {
  pending: { pt: "Em análise", en: "Under review" },
  approved: { pt: "Aprovado", en: "Approved" },
  rejected: { pt: "Recusado", en: "Rejected" },
  paid: { pt: "Pago", en: "Paid" },
  appealed: { pt: "Em recurso", en: "Under appeal" },
};

export const tierLabel = (t: Tier, lang: Lang = current) => TIER[t][lang];
export const tierDesc = (t: Tier, lang: Lang = current) => TIER_DESC[t][lang];
export const kindLabel = (k: ClaimKind, lang: Lang = current) => KIND[k][lang];
export const statusLabel = (s: ClaimStatus, lang: Lang = current) => STATUS[s][lang];

// ---------------------------------------------------------------------------
// Mensagens de erro (contrato, simulador de demonstracao e rotas FIPE)

/** Chave de comparacao: sem acentos, minusculas, sem pontuacao final. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.\s]+$/, "")
    .trim();
}

const ERRORS_EN: Record<string, string> = Object.fromEntries(
  (
    [
      ["Parâmetro inválido", "Invalid parameter"],
      ["O protocolo está pausado", "The protocol is paused"],
      ["Operação não autorizada", "Unauthorized operation"],
      ["Overflow aritmético", "Arithmetic overflow"],
      ["Duração da apólice fora do intervalo permitido (30 a 365 dias)", "Policy duration outside the allowed range (30 to 365 days)"],
      ["Valor do veículo inválido", "Invalid vehicle value"],
      ["Texto excede o tamanho máximo", "Text exceeds the maximum length"],
      ["Plano de cobertura inválido", "Invalid coverage plan"],
      ["Liquidez insuficiente no pool para garantir a cobertura", "Not enough pool liquidity to back this coverage"],
      ["A apólice não está ativa", "The policy is not active"],
      ["A apólice está fora do período de vigência", "The policy is outside its coverage period"],
      ["Já existe um sinistro em aberto para esta apólice", "This policy already has an open claim"],
      ["O plano contratado não cobre este tipo de sinistro", "The selected plan does not cover this type of claim"],
      ["Valor solicitado excede o limite de cobertura restante", "Requested amount exceeds the remaining coverage"],
      ["O sinistro não está pendente", "The claim is not pending"],
      ["O sinistro não está aprovado", "The claim is not approved"],
      ["Avaliador já votou neste sinistro", "Assessor has already voted on this claim"],
      ["Assinante não é um avaliador do pool", "Signer is not a pool assessor"],
      ["A apólice ainda está vigente", "The policy is still in force"],
      ["Sinistro em aberto impede a liquidação da apólice", "An open claim prevents settling the policy"],
      ["Saldo de cotas insuficiente", "Insufficient share balance"],
      ["Período de carência de saque ainda não terminou", "Withdrawal cooldown has not ended yet"],
      ["Saque deixaria o pool abaixo do colateral mínimo", "Withdrawal would leave the pool below minimum collateral"],
      ["Valor acima do limite do faucet", "Amount above the faucet limit"],
      ["Quantidade deve ser maior que zero", "Amount must be greater than zero"],
      ["Período de votação encerrado", "Voting period has ended"],
      ["Período de votação ainda em andamento", "Voting period is still open"],
      ["Este veículo já possui uma apólice ativa", "This vehicle already has an active policy"],
      ["Hash da placa não confere com a placa informada", "Plate hash does not match the plate entered"],
      ["Sinistro dentro do período de carência da apólice", "Claim filed within the policy waiting period"],
      ["Avaliador não pode votar ou vistoriar a própria apólice", "Assessors cannot vote on or inspect their own policy"],
      ["A apólice ainda não passou pela vistoria", "The policy has not been inspected yet"],
      ["A vistoria desta apólice já foi realizada", "This policy has already been inspected"],
      ["Número de parcelas inválido para a vigência escolhida", "Invalid number of installments for this term"],
      ["Todas as parcelas desta apólice já foram pagas", "All installments of this policy are already paid"],
      ["Apólice caducada por parcela em atraso", "Policy lapsed due to an overdue installment"],
      ["Não há mudança de governança pendente", "There is no pending governance change"],
      ["Timelock de governança ainda não expirou", "Governance timelock has not expired yet"],
      ["Assinante não é a autoridade proposta", "Signer is not the proposed authority"],
      ["Saldo insuficiente na tesouraria do protocolo", "Insufficient protocol treasury balance"],
      ["Primeiro aporte abaixo do mínimo", "First deposit below the minimum"],
      ["Liquidez livre insuficiente para pagar o sinistro agora", "Not enough free liquidity to pay this claim now"],
      ["Cobertura acima do limite de exposição do pool por apólice", "Coverage above the pool's per-policy exposure limit"],
      ["Saque não solicitado ou acima das cotas solicitadas", "Withdrawal not requested or above the requested shares"],
      ["Aviso prévio de saque ainda em andamento", "Withdrawal notice period still running"],
      ["Conta ainda em uso e não pode ser fechada", "Account is still in use and cannot be closed"],
      ["Oficina não credenciada ou inativa", "Repair shop not accredited or inactive"],
      ["Destinatário do pagamento inválido", "Invalid payment recipient"],
      ["O sinistro não foi recusado", "The claim was not rejected"],
      ["Este sinistro já teve recurso", "This claim has already been appealed"],
      ["Prazo de recurso encerrado", "The appeal window has closed"],
      ["Não há avaliadores aptos a julgar o recurso", "There are no assessors eligible to judge the appeal"],
      ["Avaliador que votou na primeira rodada não vota no recurso", "Assessors who voted in the first round cannot vote on the appeal"],
      ["Percentual da FIPE inválido (use 90, 100 ou 110)", "Invalid FIPE percentage (use 90, 100 or 110)"],
      ["Assinante não é o oráculo de preços do pool", "Signer is not the pool's price oracle"],
      ["Variação do valor FIPE acima do limite por atualização", "FIPE value change above the per-update limit"],
      ["Não há transferência pendente para esta carteira", "There is no pending transfer for this wallet"],
      ["Placa inválida", "Invalid plate"],
      ["Prêmio acima do máximo aceito", "Premium above the accepted maximum"],
      ["Sinistro não encontrado", "Claim not found"],
      ["Saldo insuficiente para a operação", "Insufficient balance for this operation"],
      ["Transação cancelada na carteira", "Transaction cancelled in the wallet"],
      ["Conecte sua carteira Solana", "Connect your Solana wallet"],
      ["Conecte uma carteira para assinar transações", "Connect a wallet to sign transactions"],
      // Rotas /api/fipe e /api/placa
      ["Veículo não encontrado na tabela FIPE", "Vehicle not found in the FIPE table"],
      ["Limite de consultas FIPE atingido, tente mais tarde", "FIPE lookup limit reached, try again later"],
      ["Tipo de veículo inválido (use carros, motos ou caminhoes)", "Invalid vehicle type (use carros, motos or caminhoes)"],
      ["Consulta por placa não configurada no servidor (defina PLACA_API_TOKEN)", "Plate lookup is not configured on the server (set PLACA_API_TOKEN)"],
      ["Token da API de placas inválido", "Invalid plate API token"],
      ["Créditos da API de placas esgotados", "Plate API credits exhausted"],
      ["Placa não encontrada", "Plate not found"],
      ["Limite de consultas por placa atingido", "Plate lookup limit reached"],
      ["Placa inválida (ex.: ABC1D23 ou ABC1234)", "Invalid plate (e.g. ABC1D23 or ABC1234)"],
      ["Veículo encontrado, mas sem correspondência na tabela FIPE", "Vehicle found, but with no match in the FIPE table"],
      // Rota /api/evidence (IPFS)
      ["Falha ao enviar evidências", "Failed to upload evidence"],
      ["Armazenamento IPFS não configurado", "IPFS storage is not configured"],
      ["Envio inválido", "Invalid upload"],
      ["Nenhum arquivo enviado", "No files uploaded"],
      ["Falha ao enviar para o IPFS", "Failed to upload to IPFS"],
    ] as const
  ).map(([pt, en]) => [norm(pt), en]),
);

/** Traduz uma mensagem conhecida (em portugues, com ou sem acentos) para o idioma atual. */
export function translateError(msg: string, lang: Lang = current): string {
  if (lang === "pt") return msg;
  const hit = ERRORS_EN[norm(msg)];
  if (hit) return hit;
  // Mensagens com prefixo variavel, ex.: "Tabela FIPE indisponível (500)"
  const m = msg.match(/^(Tabela FIPE indisponível|Serviço de placas indisponível|Falha na consulta|IPFS indisponível) \((\d+)\)$/);
  if (m) {
    const base = {
      "Tabela FIPE indisponível": "FIPE table unavailable",
      "Serviço de placas indisponível": "Plate service unavailable",
      "Falha na consulta": "Lookup failed",
      "IPFS indisponível": "IPFS unavailable",
    }[m[1]];
    return `${base} (${m[2]})`;
  }
  let v: RegExpMatchArray | null;
  if ((v = msg.match(/^Máximo de (\d+) arquivos$/))) return `Maximum of ${v[1]} files`;
  if ((v = msg.match(/^(.+) excede 10 MB$/))) return `${v[1]} exceeds 10 MB`;
  if ((v = msg.match(/^Tipo não permitido: (.+)$/))) return `File type not allowed: ${v[1]}`;
  return msg;
}
