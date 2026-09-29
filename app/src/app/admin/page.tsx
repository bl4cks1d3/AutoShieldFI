"use client";

import { Clock, KeyRound, Landmark, Pause, Play, Settings2, Trash2, UserPlus, Users, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAction, useApp, useData } from "@/components/Providers";
import { Chip, Empty, Loading, PageHeader, PoolMissing, Row, Spinner, WalletGate } from "@/components/ui";
import { fmtDate, fmtDuration, fmtInput, fmtMoney, shortAddr, toBase } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { UNIT } from "@/lib/pricing";
import type { PoolInfo, PoolParams } from "@/lib/types";

const MAX_ASSESSORS = 5;

function isPubkey(s: string) {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

export default function AdminPage() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader
        title={t("Governança do pool", "Pool governance")}
        subtitle={t(
          "Parâmetros econômicos, comitê de avaliadores, pausa de emergência e autoridade.",
          "Economic parameters, assessor committee, emergency pause and authority.",
        )}
      />
      <WalletGate>
        <AdminView />
      </WalletGate>
    </div>
  );
}

function AdminView() {
  const { client } = useApp();
  const { t } = useI18n();
  const { data, loading } = useData(async (c) => ({ pool: await c.getPool(), now: await c.now() }));
  const pool = data?.pool;

  if (loading && !data) return <Loading />;
  if (!pool) return <PoolMissing />;
  const now = data!.now;
  const isPendingAuthority =
    !!pool.pendingAuthority && (client.mode === "demo" || pool.pendingAuthority === client.wallet);

  const isAuthority = client.mode === "demo" || pool.authority === client.wallet;

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
        <KeyRound className="size-4 text-[var(--accent)]" />
        <span className="text-[var(--muted)]">{t("Autoridade", "Authority")}:</span>
        <span className="font-mono">{shortAddr(pool.authority)}</span>
        {isAuthority ? (
          <Chip tone="ok">{t("Você é a autoridade", "You are the authority")}</Chip>
        ) : (
          <Chip tone="warn">{t("Somente leitura", "Read only")}</Chip>
        )}
        <span className="ml-auto">
          {pool.paused ? (
            <Chip tone="bad">{t("Pool pausado", "Pool paused")}</Chip>
          ) : (
            <Chip tone="ok">{t("Operando", "Operating")}</Chip>
          )}
        </span>
      </div>

      {isPendingAuthority && <AcceptAuthority pool={pool} />}

      <PendingChanges pool={pool} now={now} isAuthority={isAuthority} />

      {!isAuthority && (
        <Empty
          icon={<KeyRound className="size-6" />}
          title={t("Carteira sem permissão de governança", "Wallet without governance permission")}
        >
          <p>
            {t(
              "Apenas a autoridade do pool pode alterar parâmetros. Conecte a carteira",
              "Only the pool authority can change parameters. Connect the wallet",
            )}{" "}
            <span className="font-mono">{shortAddr(pool.authority)}</span>{" "}
            {t("ou peça uma transferência de autoridade.", "or ask for an authority transfer.")}
          </p>
        </Empty>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ParamsForm pool={pool} disabled={!isAuthority} />
        <div className="flex flex-col gap-6">
          <AssessorsForm pool={pool} disabled={!isAuthority} />
          <TreasuryCard pool={pool} disabled={!isAuthority} />
          <ShopsCard disabled={!isAuthority} />
          <DangerZone pool={pool} disabled={!isAuthority} />
        </div>
      </div>
    </div>
  );
}

type Txt = { pt: string; en: string };
type ParamField = { key: keyof PoolParams; label: Txt; unit: "pct" | "secs" | "money" | "int"; hint: Txt };

const FIELDS: ParamField[] = [
  { key: "baseRateBps", label: { pt: "Taxa base anual", en: "Annual base rate" }, unit: "pct", hint: { pt: "Sobre o valor FIPE (máx. 50%)", en: "On the FIPE value (max. 50%)" } },
  { key: "cashbackBps", label: { pt: "Cashback", en: "Cashback" }, unit: "pct", hint: { pt: "Parte do prêmio devolvida sem sinistro", en: "Share of the premium returned with no claims" } },
  { key: "protocolFeeBps", label: { pt: "Taxa do protocolo", en: "Protocol fee" }, unit: "pct", hint: { pt: "Parte do prêmio para a tesouraria (máx. 30%)", en: "Share of the premium to the treasury (max. 30%)" } },
  { key: "minCollateralBps", label: { pt: "Colateral mínimo", en: "Minimum collateral" }, unit: "pct", hint: { pt: "Sobre a cobertura ativa", en: "On active coverage" } },
  { key: "withdrawCooldownSecs", label: { pt: "Carência de saque (LP)", en: "Withdrawal cooldown (LP)" }, unit: "secs", hint: { pt: "Segundos após o aporte", en: "Seconds after depositing" } },
  { key: "claimVotingSecs", label: { pt: "Prazo de votação", en: "Voting window" }, unit: "secs", hint: { pt: "Janela para os avaliadores", en: "Time assessors have to vote" } },
  { key: "secondsPerDay", label: { pt: "Segundos por dia", en: "Seconds per day" }, unit: "secs", hint: { pt: "86400 em produção; 60 acelera a demo", en: "86400 in production; 60 speeds up the demo" } },
  { key: "claimWaitingSecs", label: { pt: "Carência para sinistros", en: "Claim waiting period" }, unit: "secs", hint: { pt: "Após a contratação (604800 = 7 dias)", en: "After purchase (604800 = 7 days)" } },
  { key: "installmentGraceSecs", label: { pt: "Tolerância de parcela", en: "Installment grace period" }, unit: "secs", hint: { pt: "Atraso aceito antes de caducar", en: "Delay allowed before the policy lapses" } },
  { key: "governanceDelaySecs", label: { pt: "Timelock de governança", en: "Governance timelock" }, unit: "secs", hint: { pt: "Espera entre propor e aplicar", en: "Wait between proposing and applying" } },
  { key: "inspectionFee", label: { pt: "Taxa de vistoria", en: "Inspection fee" }, unit: "money", hint: { pt: "Paga pelo motorista ao avaliador", en: "Paid by the driver to the assessor" } },
  { key: "voteReward", label: { pt: "Remuneração por voto", en: "Reward per vote" }, unit: "money", hint: { pt: "Paga da tesouraria a cada voto", en: "Paid from the treasury for each vote" } },
  { key: "minVehicleValue", label: { pt: "Valor FIPE mínimo", en: "Minimum FIPE value" }, unit: "money", hint: { pt: "Evita apólices de valor irrisório", en: "Prevents negligible-value policies" } },
  { key: "inspectionThreshold", label: { pt: "Quórum de vistoria", en: "Inspection quorum" }, unit: "int", hint: { pt: "Votos para aprovar uma vistoria", en: "Votes needed to approve an inspection" } },
  { key: "withdrawNoticeSecs", label: { pt: "Aviso prévio de saque (LP)", en: "Withdrawal notice (LP)" }, unit: "secs", hint: { pt: "Entre pedir e sacar liquidez", en: "Between requesting and withdrawing liquidity" } },
  { key: "maxPolicyCoverageBps", label: { pt: "Cobertura máx. por apólice", en: "Max. coverage per policy" }, unit: "pct", hint: { pt: "Sobre o patrimônio do pool (até 1000%)", en: "On pool equity (up to 1000%)" } },
];

function toInput(p: PoolParams, f: ParamField) {
  const v = p[f.key] as number;
  if (f.unit === "pct") return fmtInput(v / 100);
  if (f.unit === "money") return fmtInput(v / UNIT);
  return String(v);
}

function ParamsForm({ pool, disabled }: { pool: PoolInfo; disabled: boolean }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const { lang, t } = useI18n();
  const [values, setValues] = useState<Record<string, string>>({});
  const [faucet, setFaucet] = useState(pool.params.faucetEnabled);

  useEffect(() => {
    setValues(Object.fromEntries(FIELDS.map((f) => [f.key, toInput(pool.params, f)])));
    setFaucet(pool.params.faucetEnabled);
  }, [pool.params, lang]);

  const parsed: PoolParams = { ...pool.params, faucetEnabled: faucet };
  let valid = true;
  for (const f of FIELDS) {
    const raw = values[f.key] ?? "";
    const n = Number(lang === "en" ? raw.replace(/,/g, "") : raw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) valid = false;
    (parsed as unknown as Record<string, number>)[f.key] =
      f.unit === "pct" ? Math.round(n * 100) : f.unit === "money" ? Math.round(n * UNIT) : Math.round(n);
  }

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Settings2 className="size-5 text-[var(--accent)]" /> {t("Parâmetros econômicos", "Economic parameters")}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {f.label[lang]}{" "}
              {f.unit !== "int" && (
                <span className="text-[var(--muted)]">({f.unit === "pct" ? "%" : f.unit === "money" ? "tBRL" : "s"})</span>
              )}
            </span>
            <input
              className="input num"
              inputMode="decimal"
              disabled={disabled}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
            <span className="text-xs text-[var(--muted)]">{f.hint[lang]}</span>
          </label>
        ))}
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={faucet} disabled={disabled} onChange={(e) => setFaucet(e.target.checked)} />
        {t("Faucet de token de teste habilitado", "Test token faucet enabled")}
      </label>
      <button
        className="btn btn-primary mt-5 w-full"
        disabled={disabled || !valid || !!busy}
        onClick={() => run("params", () => client.proposeParams(parsed), t("Mudança proposta: aguarde o timelock", "Change proposed: wait for the timelock"))}
      >
        {busy === "params" && <Spinner />} {t("Propor parâmetros", "Propose parameters")}
      </button>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {t(
          `Mudanças só valem depois do timelock de ${fmtDuration(pool.params.governanceDelaySecs)}, dando tempo para a comunidade reagir.`,
          `Changes only take effect after the ${fmtDuration(pool.params.governanceDelaySecs)} timelock, giving the community time to react.`,
        )}
      </p>
    </section>
  );
}

function AssessorsForm({ pool, disabled }: { pool: PoolInfo; disabled: boolean }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const { t } = useI18n();
  const [list, setList] = useState<string[]>(pool.assessors);
  const [threshold, setThreshold] = useState(pool.approvalThreshold);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setList(pool.assessors);
    setThreshold(pool.approvalThreshold);
  }, [pool.assessors, pool.approvalThreshold]);

  const draftOk = (client.mode === "demo" ? draft.trim().length > 0 : isPubkey(draft.trim())) && !list.includes(draft.trim());
  const valid = list.length > 0 && list.length <= MAX_ASSESSORS && threshold >= 1 && threshold <= list.length;
  const changed = threshold !== pool.approvalThreshold || list.join() !== pool.assessors.join();

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Users className="size-5 text-[var(--accent)]" /> {t("Comitê de avaliadores", "Assessor committee")}
      </h2>
      <ul className="mt-4 divide-y divide-[var(--border)] text-sm">
        {list.map((a) => (
          <li key={a} className="flex items-center gap-2 py-2">
            <span className="font-mono">{shortAddr(a)}</span>
            {a === client.wallet && <Chip tone="info">{t("você", "you")}</Chip>}
            <button
              className="ml-auto text-[var(--muted)] hover:text-[var(--bad)] disabled:opacity-40"
              disabled={disabled}
              onClick={() => setList(list.filter((x) => x !== a))}
              aria-label={t("Remover avaliador", "Remove assessor")}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {list.length < MAX_ASSESSORS && (
        <div className="mt-3 flex gap-2">
          <input
            className="input flex-1 font-mono text-sm"
            placeholder={t("Chave pública do avaliador", "Assessor public key")}
            disabled={disabled}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            className="btn btn-ghost !px-3"
            disabled={disabled || !draftOk}
            onClick={() => {
              setList([...list, draft.trim()]);
              setDraft("");
            }}
            aria-label={t("Adicionar avaliador", "Add assessor")}
          >
            <UserPlus className="size-4" />
          </button>
        </div>
      )}
      {client.wallet && !list.includes(client.wallet) && list.length < MAX_ASSESSORS && (
        <button
          className="mt-2 text-sm font-semibold text-[var(--accent)] hover:underline disabled:opacity-40"
          disabled={disabled}
          onClick={() => setList([...list, client.wallet!])}
        >
          + {t("Adicionar minha carteira", "Add my wallet")}
        </button>
      )}
      <div className="mt-4 divide-y divide-[var(--border)] text-sm">
        <Row
          label={t("Quórum de aprovação", "Approval quorum")}
          value={
            <span className="inline-flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={list.length}
                className="input num w-20 !py-1"
                disabled={disabled}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              {t("de", "of")} {list.length}
            </span>
          }
        />
      </div>
      <button
        className="btn btn-primary mt-4 w-full"
        disabled={disabled || !valid || !changed || !!busy}
        onClick={() => run("assessors", () => client.proposeAssessors(list, threshold), t("Novo comitê proposto: aguarde o timelock", "New committee proposed: wait for the timelock"))}
      >
        {busy === "assessors" && <Spinner />} {t("Propor comitê", "Propose committee")}
      </button>
    </section>
  );
}

function DangerZone({ pool, disabled }: { pool: PoolInfo; disabled: boolean }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const { t } = useI18n();
  const [newAuth, setNewAuth] = useState("");
  const authOk = client.mode === "demo" ? newAuth.trim().length > 0 : isPubkey(newAuth.trim());

  return (
    <section className="card border-[var(--bad)]/40 p-5">
      <h2 className="font-semibold">{t("Zona de risco", "Danger zone")}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {t(
          "Pausar bloqueia novas apólices e aportes de liquidez; sinistros em andamento continuam. A transferência de autoridade só vale quando a nova carteira assinar o aceite.",
          "Pausing blocks new policies and liquidity deposits; claims in progress continue. An authority transfer only takes effect once the new wallet signs to accept it.",
        )}
      </p>
      <button
        className={`btn mt-4 w-full ${pool.paused ? "btn-primary" : "btn-danger"}`}
        disabled={disabled || !!busy}
        onClick={() =>
          run("pause", () => client.setPaused(!pool.paused), pool.paused ? t("Pool reativado", "Pool resumed") : t("Pool pausado", "Pool paused"))
        }
      >
        {busy === "pause" ? <Spinner /> : pool.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        {pool.paused ? t("Reativar pool", "Resume pool") : t("Pausar pool", "Pause pool")}
      </button>
      <div className="mt-4 flex gap-2">
        <input
          className="input flex-1 font-mono text-sm"
          placeholder={t("Propor nova autoridade (chave pública)", "Propose new authority (public key)")}
          disabled={disabled}
          value={newAuth}
          onChange={(e) => setNewAuth(e.target.value)}
        />
        <button
          className="btn btn-danger"
          disabled={disabled || !authOk || !!busy}
          onClick={() => {
            run("auth", () => client.proposeAuthority(newAuth.trim()), t("Autoridade proposta: a nova carteira precisa aceitar", "Authority proposed: the new wallet must accept")).then(
              (sig) => sig && setNewAuth(""),
            );
          }}
        >
          {busy === "auth" && <Spinner />} {t("Propor", "Propose")}
        </button>
      </div>
    </section>
  );
}

function PendingChanges({ pool, now, isAuthority }: { pool: PoolInfo; now: number; isAuthority: boolean }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const { lang, t } = useI18n();
  const hasParams = !!pool.pendingParams;
  const hasAssessors = pool.pendingAssessors.length > 0;
  if (!hasParams && !hasAssessors && !pool.pendingAuthority) return null;

  const changed = hasParams
    ? FIELDS.filter((f) => pool.pendingParams![f.key] !== pool.params[f.key]).map(
        (f) => `${f.label[lang]}: ${toInput(pool.params, f)} → ${toInput(pool.pendingParams!, f)}`,
      )
    : [];

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Clock className="size-5 text-[var(--accent)]" /> {t("Mudanças pendentes (timelock)", "Pending changes (timelock)")}
      </h2>
      <div className="mt-3 flex flex-col gap-4 text-sm">
        {hasParams && (
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="font-medium">{t("Parâmetros", "Parameters")}</p>
            <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
              {(changed.length ? changed : [t("Faucet ou valores iguais aos atuais", "Faucet or values equal to the current ones")]).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <GateRow eta={pool.pendingParamsEta} now={now} busy={!!busy}
              onApply={() => run("apply-params", () => client.applyParams(), t("Parâmetros aplicados", "Parameters applied"))} />
          </div>
        )}
        {hasAssessors && (
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="font-medium">
              {t("Comitê", "Committee")}: {pool.pendingAssessors.map(shortAddr).join(", ")} · {t("quórum", "quorum")}{" "}
              {pool.pendingThreshold}
            </p>
            <GateRow eta={pool.pendingAssessorsEta} now={now} busy={!!busy}
              onApply={() => run("apply-assessors", () => client.applyAssessors(), t("Comitê aplicado", "Committee applied"))} />
          </div>
        )}
        {pool.pendingAuthority && (
          <p className="rounded-xl border border-[var(--border)] p-3">
            {t("Autoridade proposta", "Proposed authority")}:{" "}
            <span className="font-mono">{shortAddr(pool.pendingAuthority)}</span> —{" "}
            {t("aguardando o aceite dessa carteira.", "waiting for this wallet to accept.")}
          </p>
        )}
        {isAuthority && (
          <button
            className="btn btn-ghost self-start"
            disabled={!!busy}
            onClick={() => run("cancel", () => client.cancelPending(), t("Mudanças pendentes canceladas", "Pending changes cancelled"))}
          >
            {busy === "cancel" && <Spinner />} {t("Cancelar mudanças pendentes", "Cancel pending changes")}
          </button>
        )}
      </div>
    </section>
  );
}

function GateRow({ eta, now, busy, onApply }: { eta: number; now: number; busy: boolean; onApply: () => void }) {
  const ready = now >= eta;
  const { t } = useI18n();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <span className="text-xs text-[var(--muted)]">
        {ready
          ? t("Timelock cumprido", "Timelock complete")
          : t(`Libera em ${fmtDuration(eta - now)} (${fmtDate(eta)})`, `Unlocks in ${fmtDuration(eta - now)} (${fmtDate(eta)})`)}
      </span>
      <button className="btn btn-primary ml-auto !py-1.5" disabled={!ready || busy} onClick={onApply}>
        {t("Aplicar", "Apply")}
      </button>
    </div>
  );
}

function AcceptAuthority({ pool }: { pool: PoolInfo }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const { t } = useI18n();
  return (
    <section className="card flex flex-wrap items-center gap-3 border-[var(--accent)] p-4 text-sm">
      <KeyRound className="size-5 text-[var(--accent)]" />
      <span>
        {t("A autoridade do pool foi proposta para", "Pool authority has been proposed to")}{" "}
        <span className="font-mono">{shortAddr(pool.pendingAuthority ?? "")}</span>.{" "}
        {t("Assine para aceitar.", "Sign to accept.")}
      </span>
      <button
        className="btn btn-primary ml-auto"
        disabled={!!busy}
        onClick={() => run("accept", () => client.acceptAuthority(), t("Autoridade aceita", "Authority accepted"))}
      >
        {busy === "accept" && <Spinner />} {t("Aceitar autoridade", "Accept authority")}
      </button>
    </section>
  );
}

function TreasuryCard({ pool, disabled }: { pool: PoolInfo; disabled: boolean }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const { t } = useI18n();
  const [amount, setAmount] = useState("");
  const base = toBase(amount);
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Landmark className="size-5 text-[var(--accent)]" /> {t("Tesouraria do protocolo", "Protocol treasury")}
      </h2>
      <div className="mt-3 divide-y divide-[var(--border)] text-sm">
        <Row label={t("Disponível para saque", "Available to withdraw")} value={fmtMoney(pool.treasuryAccrued)} strong />
        <Row label={t("Taxas do protocolo arrecadadas", "Protocol fees collected")} value={fmtMoney(pool.totalProtocolFees)} />
        <Row label={t("Pago a avaliadores (vistorias + votos)", "Paid to assessors (inspections + votes)")} value={fmtMoney(pool.totalAssessorRewards)} />
        <Row label={t("Taxas de vistoria pendentes", "Pending inspection fees")} value={fmtMoney(pool.pendingInspectionFees)} />
      </div>
      <div className="mt-4 flex gap-2">
        <input
          className="input num flex-1"
          inputMode="decimal"
          placeholder={t("Valor em tBRL", "Amount in tBRL")}
          disabled={disabled}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
        />
        <button
          className="btn btn-primary"
          disabled={disabled || base <= 0 || base > pool.treasuryAccrued || !!busy}
          onClick={() =>
            run("treasury", () => client.withdrawTreasury(base), t("Receita sacada da tesouraria", "Revenue withdrawn from the treasury")).then(
              (sig) => sig && setAmount(""),
            )
          }
        >
          {busy === "treasury" && <Spinner />} {t("Sacar", "Withdraw")}
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {t(
          "O saque nunca toca no patrimônio dos LPs, no cashback reservado nem nas taxas de vistoria pendentes.",
          "Withdrawals never touch LP equity, reserved cashback or pending inspection fees.",
        )}
      </p>
    </section>
  );
}

/** Oficinas credenciadas: recebem direto a indenizacao de danos parciais. */
function ShopsCard({ disabled }: { disabled: boolean }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const { t } = useI18n();
  const { data: shops } = useData((c) => c.getRepairShops());
  const [wallet, setWallet] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const walletOk = client.mode === "demo" ? wallet.trim().length > 0 : isPubkey(wallet.trim());
  const valid = walletOk && name.trim().length > 1 && !(shops ?? []).some((s) => s.wallet === wallet.trim());

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Wrench className="size-5 text-[var(--accent)]" /> {t("Oficinas credenciadas", "Accredited repair shops")}
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {t(
          "Nos danos parciais, o motorista pode escolher uma oficina credenciada e a indenização vai direto para ela.",
          "For partial damage, drivers can pick an accredited shop and the payout goes straight to it.",
        )}
      </p>
      <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
        {(shops ?? []).map((s) => (
          <li key={s.wallet} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {s.name}
                {s.city ? <span className="text-[var(--muted)]"> · {s.city}</span> : null}
              </p>
              <p className="text-xs text-[var(--muted)]">
                <span className="font-mono">{shortAddr(s.wallet)}</span> · {s.claimsPaid} {t("reparos", "repairs")} ·{" "}
                {fmtMoney(s.totalReceived)}
              </p>
            </div>
            <Chip tone={s.active ? "ok" : "neutral"}>{s.active ? t("Ativa", "Active") : t("Suspensa", "Suspended")}</Chip>
            <button
              className="text-xs font-semibold text-[var(--accent)] hover:underline disabled:opacity-40"
              disabled={disabled || !!busy}
              onClick={() =>
                run(
                  `shop-${s.wallet}`,
                  () => client.setShopActive(s.wallet, !s.active),
                  s.active ? t("Oficina suspensa", "Shop suspended") : t("Oficina reativada", "Shop reactivated"),
                )
              }
            >
              {s.active ? t("Suspender", "Suspend") : t("Reativar", "Reactivate")}
            </button>
          </li>
        ))}
        {shops && shops.length === 0 && (
          <li className="py-2 text-[var(--muted)]">{t("Nenhuma oficina credenciada ainda.", "No accredited shops yet.")}</li>
        )}
      </ul>
      <div className="mt-3 grid gap-2">
        <input
          className="input font-mono text-sm"
          placeholder={t("Carteira da oficina", "Shop wallet")}
          disabled={disabled}
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder={t("Nome", "Name")}
            maxLength={48}
            disabled={disabled}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input w-36 text-sm"
            placeholder={t("Cidade", "City")}
            maxLength={32}
            disabled={disabled}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <button
          className="btn btn-primary"
          disabled={disabled || !valid || !!busy}
          onClick={() =>
            run("shop-new", () => client.registerShop(wallet.trim(), name.trim(), city.trim()), t("Oficina credenciada", "Shop accredited")).then(
              (sig) => sig && (setWallet(""), setName(""), setCity("")),
            )
          }
        >
          {busy === "shop-new" && <Spinner />} {t("Credenciar oficina", "Accredit shop")}
        </button>
      </div>
    </section>
  );
}
