"use client";

import { AlertTriangle, ArrowRightLeft, ClipboardCheck, Wallet, Coins, ExternalLink, FileWarning, Hourglass, ShieldCheck, ShieldOff, Undo2 } from "lucide-react";
import Link from "next/link";
import { useAction, useApp, useData } from "@/components/Providers";
import { Chip, Empty, Loading, PageHeader, Progress, Row, Spinner, WalletGate } from "@/components/ui";
import { explorerAddr } from "@/lib/config";
import { shortAddr } from "@/lib/format";
import { fmtDate, fmtDuration, fmtMoney } from "@/lib/format";
import { tierLabel, useI18n } from "@/lib/i18n";
import { displayPlate, policyPhase } from "@/lib/plate";
import { policyStatus } from "@/lib/policyStatus";
import { cancellationRefund, installmentAmount, paidUntil } from "@/lib/pricing";
import { PublicKey } from "@solana/web3.js";
import { useState } from "react";
import type { PolicyInfo, PoolParams } from "@/lib/types";

export default function ApolicesPage() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader
        title={t("Minhas apólices", "My policies")}
        subtitle={t("Acompanhe vigência, sinistros e resgate seu cashback.", "Track your coverage and claims, and redeem your cashback.")}
        action={
          <Link href="/cotar" className="btn btn-primary">
            {t("Nova apólice", "New policy")}
          </Link>
        }
      />
      <WalletGate>
        <PolicyList />
      </WalletGate>
    </div>
  );
}

function PolicyList() {
  const { client } = useApp();
  const { t } = useI18n();
  const { data, loading } = useData(
    async (c) => {
      const [policies, all, now, pool] = await Promise.all([c.getPolicies(c.wallet!), c.getPolicies(), c.now(), c.getPool()]);
      return {
        policies,
        // Apolices que outra pessoa quer transferir para esta carteira (venda do veiculo).
        incoming: all.filter((p) => p.pendingOwner === c.wallet && p.status === "active"),
        now,
        params: pool?.params ?? null,
      };
    },
    [client.wallet],
  );

  if (loading && !data) return <Loading />;
  const incoming = data?.incoming.length ? <IncomingTransfers policies={data.incoming} /> : null;
  if (!data?.policies.length)
    return (
      <>
      {incoming}
      <Empty icon={<ShieldOff className="size-6" />} title={t("Você ainda não tem apólices", "You don't have any policies yet")}>
        <p>{t("Faça uma cotação e proteja seu veículo em poucos cliques.", "Get a quote and protect your vehicle in a few clicks.")}</p>
        <Link href="/cotar" className="btn btn-primary mt-4">
          {t("Fazer cotação", "Get a quote")}
        </Link>
      </Empty>
      </>
    );

  return (
    <div className="flex flex-col gap-4">
      {incoming}
      <div className="grid gap-4 md:grid-cols-2">
        {data.policies.map((p) => (
          <PolicyCard key={p.address} p={p} now={data.now} params={data.params} />
        ))}
      </div>
    </div>
  );
}

/** Apolices oferecidas a esta carteira na venda de um veiculo. */
function IncomingTransfers({ policies }: { policies: PolicyInfo[] }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const { lang, t } = useI18n();
  return (
    <section className="card-hero p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <ArrowRightLeft className="size-5 text-[var(--accent)]" /> {t("Transferências para você", "Transfers to you")}
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {t(
          "O vendedor do veículo indicou sua carteira. Ao aceitar, a apólice (cobertura e cashback acumulado) passa a ser sua.",
          "The vehicle seller named your wallet. By accepting, the policy (coverage and accrued cashback) becomes yours.",
        )}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {policies.map((p) => (
          <div key={p.address} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.model} · {p.year}</p>
              <p className="text-xs text-[var(--muted)]">
                {t("Apólice", "Policy")} #{p.id} · {tierLabel(p.tier, lang)} · {t("de", "from")} {shortAddr(p.owner)} ·{" "}
                {t("até", "until")} {fmtDate(p.endTs)}
              </p>
            </div>
            <button
              className="btn btn-primary"
              disabled={!!busy}
              onClick={() =>
                run(`accept-${p.address}`, () => client.acceptTransfer(p.address), t("Apólice transferida para você", "Policy transferred to you"))
              }
            >
              {busy === `accept-${p.address}` && <Spinner />} {t("Aceitar", "Accept")}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function PolicyCard({ p, now, params }: { p: PolicyInfo; now: number; params: PoolParams | null }) {
  const grace = params?.installmentGraceSecs ?? 0;
  const [panel, setPanel] = useState<"none" | "cancel" | "transfer">("none");
  const [buyer, setBuyer] = useState("");
  const { client } = useApp();
  const { run, busy } = useAction();
  const { lang, t } = useI18n();
  const total = p.endTs - p.startTs;
  const elapsed = Math.min(Math.max(now - p.startTs, 0), total);
  const expired = now > p.endTs;
  const active = p.status === "active";
  const phase = policyPhase(p, now, grace);
  const fullyPaid = p.installmentsPaid >= p.installments;
  const nextAmount = installmentAmount(p.premiumTotal, p.installments, p.installmentsPaid + 1);
  const dueAt = paidUntil(p);
  const canSettle = active && !p.hasOpenClaim && (expired || phase === "lapsed");
  const cashbackOnSettle = expired && fullyPaid && !p.hadPaidClaim && p.inspected && p.cashbackAmount > 0;

  const refund = params ? cancellationRefund(p, now, params) : null;
  const buyerOk = (() => {
    try {
      return buyer.length > 30 && buyer !== p.owner && !!new PublicKey(buyer);
    } catch {
      return false;
    }
  })();
  const st = policyStatus(p, now, grace);
  const status = { label: lang === "en" ? st.en : st.pt, tone: st.tone };

  const settle = () =>
    run(
      `settle-${p.address}`,
      () => client.settle(p.address),
      cashbackOnSettle
        ? t(`Cashback de ${fmtMoney(p.cashbackAmount)} recebido!`, `${fmtMoney(p.cashbackAmount)} cashback received!`)
        : t("Apólice encerrada", "Policy closed"),
    );

  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {t("Apólice", "Policy")} #{p.id} · {tierLabel(p.tier, lang)}
          </p>
          <h3 className="mt-1 text-lg font-bold">{p.model}</h3>
          <p className="text-sm text-[var(--muted)]">
            <span className="rounded bg-[var(--bg-soft)] px-1.5 py-0.5 font-mono text-[var(--fg)]">{displayPlate(p)}</span> · {p.year}
          </p>
        </div>
        <Chip tone={status.tone}>{status.label}</Chip>
      </div>

      {active && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
            <span>{fmtDate(p.startTs)}</span>
            <span>
              {expired
                ? t("vencida", "expired")
                : t(`restam ${fmtDuration(p.endTs - now)}`, `${fmtDuration(p.endTs - now)} left`)}
            </span>
          </div>
          <Progress value={total ? elapsed / total : 1} />
        </div>
      )}

      <div className="mt-4 divide-y divide-[var(--border)] text-sm">
        <Row label={t("Cobertura restante", "Remaining coverage")} value={fmtMoney(p.coverageLimit - p.totalPaidOut)} />
        <Row
          label={
            p.installments > 1
              ? t(
                  `Prêmio pago (${p.installmentsPaid}/${p.installments} parcelas)`,
                  `Premium paid (${p.installmentsPaid}/${p.installments} installments)`,
                )
              : t("Prêmio pago", "Premium paid")
          }
          value={
            p.installments > 1
              ? `${fmtMoney(p.premiumPaid)} ${t("de", "of")} ${fmtMoney(p.premiumTotal)}`
              : fmtMoney(p.premiumPaid)
          }
        />
        {active && !fullyPaid && phase !== "lapsed" && (
          <Row
            label={t("Próxima parcela", "Next installment")}
            value={`${fmtMoney(nextAmount)} ${t("até", "by")} ${fmtDate(dueAt)}`}
          />
        )}
        <Row label={t("Franquia", "Deductible")} value={fmtMoney(p.deductible)} />
        <Row label={t("Vigência até", "Coverage until")} value={fmtDate(p.endTs)} />
        {p.totalPaidOut > 0 && <Row label={t("Indenizações recebidas", "Payouts received")} value={fmtMoney(p.totalPaidOut)} />}
        <Row
          label="Cashback"
          value={
            p.cashbackRedeemed ? (
              <span className="text-[var(--ok)]">
                {fmtMoney(p.cashbackAmount)} {t("resgatado", "redeemed")}
              </span>
            ) : p.hadPaidClaim || p.status !== "active" ? (
              <span className="text-[var(--muted)]">{t("não se aplica", "not applicable")}</span>
            ) : !fullyPaid ? (
              <span className="text-[var(--ok)]">
                {fmtMoney(p.cashbackAmount)} {t("acumulado", "accrued")}
              </span>
            ) : (
              <span className="text-[var(--ok)]">{fmtMoney(p.cashbackAmount)}</span>
            )
          }
        />
      </div>

      {phase === "inspection" && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--muted)]">
          <ClipboardCheck className="mt-0.5 size-3.5 shrink-0" />{" "}
          {t(
            "Um avaliador precisa confirmar o veículo e o valor FIPE. Se a vistoria for recusada, o prêmio pago volta; a taxa de vistoria fica com o avaliador.",
            "An assessor must confirm the vehicle and its FIPE value. If the inspection is rejected, the premium paid is refunded; the inspection fee goes to the assessor.",
          )}
        </p>
      )}
      {phase === "overdue" && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--warn)]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{" "}
          {t(
            `Parcela vencida: sem cobertura até o pagamento. Pague antes de ${fmtDate(dueAt + grace)} ou a apólice caduca.`,
            `Installment overdue: no coverage until it is paid. Pay before ${fmtDate(dueAt + grace)} or the policy lapses.`,
          )}
        </p>
      )}
      {phase === "lapsed" && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--muted)]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{" "}
          {t(
            "A apólice caducou por falta de pagamento. Encerre-a para liberar a placa e contratar de novo.",
            "The policy lapsed due to non-payment. Close it to free the plate and buy a new policy.",
          )}
        </p>
      )}
      {phase === "waiting" && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--muted)]">
          <Hourglass className="mt-0.5 size-3.5 shrink-0" />{" "}
          {t(
            `Vistoria aprovada. Sinistros aceitos a partir de ${fmtDate(p.claimsAllowedFrom)} (carência de ${fmtDuration(p.claimsAllowedFrom - p.startTs)}).`,
            `Inspection approved. Claims accepted from ${fmtDate(p.claimsAllowedFrom)} (${fmtDuration(p.claimsAllowedFrom - p.startTs)} waiting period).`,
          )}
        </p>
      )}
      {p.status === "cancelled" && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--muted)]">
          <Undo2 className="mt-0.5 size-3.5 shrink-0" />{" "}
          {t(
            `Vistoria recusada: ${fmtMoney(p.premiumPaid)} devolvidos e placa liberada para nova contratação.`,
            `Inspection rejected: ${fmtMoney(p.premiumPaid)} refunded and the plate is free for a new policy.`,
          )}
        </p>
      )}
      {p.status === "cancelledByOwner" && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--muted)]">
          <Undo2 className="mt-0.5 size-3.5 shrink-0" />{" "}
          {t("Cancelada por você. A placa está livre para uma nova contratação.", "Cancelled by you. The plate is free for a new policy.")}
        </p>
      )}
      {active && p.pendingOwner && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--info)]">
          <ArrowRightLeft className="mt-0.5 size-3.5 shrink-0" />{" "}
          {t(
            `Transferência proposta para ${shortAddr(p.pendingOwner)}. Aguardando o comprador aceitar.`,
            `Transfer proposed to ${shortAddr(p.pendingOwner)}. Waiting for the buyer to accept.`,
          )}{" "}
          <button
            className="font-semibold underline"
            disabled={!!busy}
            onClick={() => run(`tr-${p.address}`, () => client.proposeTransfer(p.address, null), t("Transferência desfeita", "Transfer withdrawn"))}
          >
            {t("Desfazer", "Undo")}
          </button>
        </p>
      )}

      {panel === "cancel" && refund && (
        <div className="mt-4 rounded-xl bg-[var(--bg-soft)] p-3 text-sm">
          <p className="font-semibold">
            {refund.coolingOff
              ? t("Direito de arrependimento (7 dias)", "Right of withdrawal (7 days)")
              : t("Cancelar apólice", "Cancel policy")}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {refund.coolingOff
              ? t(
                  `Até ${fmtDate(refund.coolingOffEnd)} você recebe de volta tudo o que pagou, inclusive a taxa de vistoria (CDC, art. 49).`,
                  `Until ${fmtDate(refund.coolingOffEnd)} you get back everything you paid, including the inspection fee (Brazilian Consumer Code, art. 49).`,
                )
              : p.hadPaidClaim
                ? t("Esta apólice já teve sinistro indenizado: não há devolução.", "This policy already had a paid claim: there is no refund.")
                : t(
                    "Você recebe o prêmio pago e ainda não usado, proporcional ao tempo restante, sem a taxa do protocolo. O cashback acumulado é perdido.",
                    "You get back the premium paid and not yet used, pro rata to the remaining time, minus the protocol fee. Accrued cashback is forfeited.",
                  )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="num font-semibold">
              {t("Devolução", "Refund")}: {fmtMoney(refund.refund)}
            </span>
            <button
              className="btn btn-danger ml-auto"
              disabled={!!busy}
              onClick={() =>
                run(`cancel-${p.address}`, () => client.cancelPolicy(p.address), t("Apólice cancelada", "Policy cancelled")).then(
                  (sig) => sig && setPanel("none"),
                )
              }
            >
              {busy === `cancel-${p.address}` && <Spinner />} {t("Confirmar cancelamento", "Confirm cancellation")}
            </button>
          </div>
        </div>
      )}

      {panel === "transfer" && (
        <div className="mt-4 rounded-xl bg-[var(--bg-soft)] p-3 text-sm">
          <p className="font-semibold">{t("Transferir na venda do veículo", "Transfer on vehicle sale")}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t(
              "Informe a carteira do comprador. A transferência só vale quando ele aceitar pelo app.",
              "Enter the buyer's wallet. The transfer only takes effect once they accept in the app.",
            )}
          </p>
          <div className="mt-2 flex gap-2">
            <input
              className="input flex-1 font-mono text-sm"
              placeholder={t("Carteira do comprador", "Buyer's wallet")}
              value={buyer}
              onChange={(e) => setBuyer(e.target.value.trim())}
            />
            <button
              className="btn btn-primary"
              disabled={!!busy || !buyerOk}
              onClick={() =>
                run(`tr-${p.address}`, () => client.proposeTransfer(p.address, buyer), t("Transferência proposta", "Transfer proposed")).then(
                  (sig) => sig && (setPanel("none"), setBuyer("")),
                )
              }
            >
              {busy === `tr-${p.address}` && <Spinner />} {t("Propor", "Propose")}
            </button>
          </div>
        </div>
      )}

      {p.hadPaidClaim && active && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <AlertTriangle className="size-3.5" />{" "}
          {t("Sinistro indenizado: o cashback volta para o pool.", "Claim paid out: the cashback goes back to the pool.")}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {phase === "covered" && !p.hasOpenClaim && (
          <Link href={`/sinistros?policy=${p.address}`} className="btn btn-ghost">
            <FileWarning className="size-4" /> {t("Acionar sinistro", "File a claim")}
          </Link>
        )}
        {active && p.hasOpenClaim && (
          <Link href="/sinistros" className="btn btn-ghost">
            <FileWarning className="size-4" /> {t("Acompanhar sinistro", "Track claim")}
          </Link>
        )}
        {active && !fullyPaid && !expired && phase !== "lapsed" && (
          <button
            className={`btn ${phase === "overdue" ? "btn-primary" : "btn-ghost"}`}
            disabled={!!busy}
            onClick={() =>
              run(
                `inst-${p.address}`,
                () => client.payInstallment(p.address),
                t(
                  `Parcela ${p.installmentsPaid + 1}/${p.installments} paga`,
                  `Installment ${p.installmentsPaid + 1}/${p.installments} paid`,
                ),
              )
            }
          >
            {busy === `inst-${p.address}` ? <Spinner /> : <Wallet className="size-4" />}{" "}
            {t("Pagar parcela", "Pay installment")} {p.installmentsPaid + 1}/{p.installments}
          </button>
        )}
        {canSettle && (
          <button className="btn btn-primary" disabled={!!busy} onClick={settle}>
            {busy === `settle-${p.address}` ? <Spinner /> : <Coins className="size-4" />}
            {cashbackOnSettle
              ? `${t("Resgatar", "Redeem")} ${fmtMoney(p.cashbackAmount)}`
              : t("Encerrar apólice", "Close policy")}
          </button>
        )}
        {active && !p.hasOpenClaim && (
          <button className="btn btn-ghost" onClick={() => setPanel(panel === "cancel" ? "none" : "cancel")}>
            <Undo2 className="size-4" />
            {refund?.coolingOff ? t("Arrependimento", "Withdraw") : t("Cancelar", "Cancel")}
          </button>
        )}
        {active && !p.hasOpenClaim && !p.pendingOwner && client.mode === "chain" && (
          <button className="btn btn-ghost" onClick={() => setPanel(panel === "transfer" ? "none" : "transfer")}>
            <ArrowRightLeft className="size-4" /> {t("Transferir", "Transfer")}
          </button>
        )}
        {p.status !== "active" && !p.hasOpenClaim && (
          <button
            className="btn btn-ghost"
            disabled={!!busy}
            title={t(
              "Fecha a conta da apólice e dos sinistros resolvidos na blockchain e devolve o aluguel em SOL",
              "Closes the policy account and its resolved claims on-chain and returns the rent in SOL",
            )}
            onClick={() =>
              run(
                `close-${p.address}`,
                () => client.closePolicy(p.address),
                client.mode === "chain"
                  ? t("Conta fechada: aluguel em SOL devolvido", "Account closed: SOL rent returned")
                  : t("Apólice arquivada", "Policy archived"),
              )
            }
          >
            {busy === `close-${p.address}` && <Spinner />}{" "}
            {client.mode === "chain" ? t("Recuperar SOL", "Recover SOL") : t("Arquivar", "Archive")}
          </button>
        )}
        {p.status === "settled" && (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)]">
            <ShieldCheck className="size-4" /> {t("Ciclo concluído", "Cycle complete")}
          </span>
        )}
        {client.mode === "chain" && (
          <a
            href={explorerAddr(p.address)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost ml-auto !px-3"
            title={t("Ver conta on-chain", "View on-chain account")}
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>
    </div>
  );
}
