import { policyPhase } from "./plate";
import type { Tone } from "./roles";
import type { PolicyInfo } from "./types";

/** Rotulo e cor do estado atual de uma apolice, do ponto de vista do motorista. */
export function policyStatus(p: PolicyInfo, now: number, grace: number): { pt: string; en: string; tone: Tone } {
  if (p.status === "cancelledByOwner") return { pt: "Cancelada pelo titular", en: "Cancelled by owner", tone: "neutral" };
  const phase = policyPhase(p, now, grace);
  if (phase === "cancelled") return { pt: "Recusada na vistoria", en: "Rejected at inspection", tone: "bad" };
  if (phase === "settled") return { pt: "Encerrada", en: "Closed", tone: "neutral" };
  if (p.hasOpenClaim) return { pt: "Sinistro em andamento", en: "Claim in progress", tone: "warn" };
  if (phase === "lapsed") return { pt: "Caducada — parcela vencida", en: "Lapsed — installment overdue", tone: "bad" };
  if (phase === "overdue") return { pt: "Parcela em atraso", en: "Installment overdue", tone: "warn" };
  if (phase === "expired") return { pt: "Vencida — liquidar", en: "Expired — settle", tone: "info" };
  if (phase === "inspection") return { pt: "Aguardando vistoria", en: "Awaiting inspection", tone: "warn" };
  if (phase === "waiting") return { pt: "Em carência", en: "Waiting period", tone: "info" };
  return { pt: "Coberta", en: "Covered", tone: "ok" };
}
