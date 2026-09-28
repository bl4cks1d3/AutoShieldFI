"use client";

import { Clock, KeyRound, Landmark, Pause, Play, Settings2, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAction, useApp, useData } from "@/components/Providers";
import { Chip, Empty, Loading, PageHeader, PoolMissing, Row, Spinner, WalletGate } from "@/components/ui";
import { fmtDate, fmtDuration, fmtMoney, shortAddr, toBase } from "@/lib/format";
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
  return (
    <div>
      <PageHeader
        title="Governança do pool"
        subtitle="Parâmetros econômicos, comitê de avaliadores, pausa de emergência e autoridade."
      />
      <WalletGate>
        <AdminView />
      </WalletGate>
    </div>
  );
}

function AdminView() {
  const { client } = useApp();
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
        <span className="text-[var(--muted)]">Autoridade:</span>
        <span className="font-mono">{shortAddr(pool.authority)}</span>
        {isAuthority ? <Chip tone="ok">Você é a autoridade</Chip> : <Chip tone="warn">Somente leitura</Chip>}
        <span className="ml-auto">{pool.paused ? <Chip tone="bad">Pool pausado</Chip> : <Chip tone="ok">Operando</Chip>}</span>
      </div>

      {isPendingAuthority && <AcceptAuthority pool={pool} />}

      <PendingChanges pool={pool} now={now} isAuthority={isAuthority} />

      {!isAuthority && (
        <Empty icon={<KeyRound className="size-6" />} title="Carteira sem permissão de governança">
          <p>
            Apenas a autoridade do pool pode alterar parâmetros. Conecte a carteira{" "}
            <span className="font-mono">{shortAddr(pool.authority)}</span> ou peça uma transferência de autoridade.
          </p>
        </Empty>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ParamsForm pool={pool} disabled={!isAuthority} />
        <div className="flex flex-col gap-6">
          <AssessorsForm pool={pool} disabled={!isAuthority} />
          <TreasuryCard pool={pool} disabled={!isAuthority} />
          <DangerZone pool={pool} disabled={!isAuthority} />
        </div>
      </div>
    </div>
  );
}

type ParamField = { key: keyof PoolParams; label: string; unit: "pct" | "secs" | "money"; hint: string };

const FIELDS: ParamField[] = [
  { key: "baseRateBps", label: "Taxa base anual", unit: "pct", hint: "Sobre o valor FIPE (máx. 50%)" },
  { key: "cashbackBps", label: "Cashback", unit: "pct", hint: "Parte do prêmio devolvida sem sinistro" },
  { key: "protocolFeeBps", label: "Taxa do protocolo", unit: "pct", hint: "Parte do prêmio para a tesouraria (máx. 30%)" },
  { key: "minCollateralBps", label: "Colateral mínimo", unit: "pct", hint: "Sobre a cobertura ativa" },
  { key: "withdrawCooldownSecs", label: "Carência de saque (LP)", unit: "secs", hint: "Segundos após o aporte" },
  { key: "claimVotingSecs", label: "Prazo de votação", unit: "secs", hint: "Janela para os avaliadores" },
  { key: "secondsPerDay", label: "Segundos por dia", unit: "secs", hint: "86400 em produção; 60 acelera a demo" },
  { key: "claimWaitingSecs", label: "Carência para sinistros", unit: "secs", hint: "Após a contratação (604800 = 7 dias)" },
  { key: "installmentGraceSecs", label: "Tolerância de parcela", unit: "secs", hint: "Atraso aceito antes de caducar" },
  { key: "governanceDelaySecs", label: "Timelock de governança", unit: "secs", hint: "Espera entre propor e aplicar" },
  { key: "inspectionFee", label: "Taxa de vistoria", unit: "money", hint: "Paga pelo motorista ao avaliador" },
  { key: "voteReward", label: "Remuneração por voto", unit: "money", hint: "Paga da tesouraria a cada voto" },
  { key: "minVehicleValue", label: "Valor FIPE mínimo", unit: "money", hint: "Evita apólices de valor irrisório" },
];

function toInput(p: PoolParams, f: ParamField) {
  const v = p[f.key] as number;
  if (f.unit === "pct") return String(v / 100).replace(".", ",");
  if (f.unit === "money") return String(v / UNIT).replace(".", ",");
  return String(v);
}

function ParamsForm({ pool, disabled }: { pool: PoolInfo; disabled: boolean }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const [values, setValues] = useState<Record<string, string>>({});
  const [faucet, setFaucet] = useState(pool.params.faucetEnabled);

  useEffect(() => {
    setValues(Object.fromEntries(FIELDS.map((f) => [f.key, toInput(pool.params, f)])));
    setFaucet(pool.params.faucetEnabled);
  }, [pool.params]);

  const parsed: PoolParams = { ...pool.params, faucetEnabled: faucet };
  let valid = true;
  for (const f of FIELDS) {
    const n = Number((values[f.key] ?? "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0) valid = false;
    (parsed as unknown as Record<string, number>)[f.key] =
      f.unit === "pct" ? Math.round(n * 100) : f.unit === "money" ? Math.round(n * UNIT) : Math.round(n);
  }

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Settings2 className="size-5 text-[var(--accent)]" /> Parâmetros econômicos
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {f.label}{" "}
              <span className="text-[var(--muted)]">({f.unit === "pct" ? "%" : f.unit === "money" ? "tBRL" : "s"})</span>
            </span>
            <input
              className="input num"
              inputMode="decimal"
              disabled={disabled}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
            <span className="text-xs text-[var(--muted)]">{f.hint}</span>
          </label>
        ))}
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={faucet} disabled={disabled} onChange={(e) => setFaucet(e.target.checked)} />
        Faucet de token de teste habilitado
      </label>
      <button
        className="btn btn-primary mt-5 w-full"
        disabled={disabled || !valid || !!busy}
        onClick={() => run("params", () => client.proposeParams(parsed), "Mudança proposta: aguarde o timelock")}
      >
        {busy === "params" && <Spinner />} Propor parâmetros
      </button>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Mudanças só valem depois do timelock de {fmtDuration(pool.params.governanceDelaySecs)}, dando tempo para a
        comunidade reagir.
      </p>
    </section>
  );
}

function AssessorsForm({ pool, disabled }: { pool: PoolInfo; disabled: boolean }) {
  const { client } = useApp();
  const { run, busy } = useAction();
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
        <Users className="size-5 text-[var(--accent)]" /> Comitê de avaliadores
      </h2>
      <ul className="mt-4 divide-y divide-[var(--border)] text-sm">
        {list.map((a) => (
          <li key={a} className="flex items-center gap-2 py-2">
            <span className="font-mono">{shortAddr(a)}</span>
            {a === client.wallet && <Chip tone="info">você</Chip>}
            <button
              className="ml-auto text-[var(--muted)] hover:text-[var(--bad)] disabled:opacity-40"
              disabled={disabled}
              onClick={() => setList(list.filter((x) => x !== a))}
              aria-label="Remover avaliador"
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
            placeholder="Chave pública do avaliador"
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
            aria-label="Adicionar avaliador"
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
          + Adicionar minha carteira
        </button>
      )}
      <div className="mt-4 divide-y divide-[var(--border)] text-sm">
        <Row
          label="Quórum de aprovação"
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
              de {list.length}
            </span>
          }
        />
      </div>
      <button
        className="btn btn-primary mt-4 w-full"
        disabled={disabled || !valid || !changed || !!busy}
        onClick={() => run("assessors", () => client.proposeAssessors(list, threshold), "Novo comitê proposto: aguarde o timelock")}
      >
        {busy === "assessors" && <Spinner />} Propor comitê
      </button>
    </section>
  );
}

function DangerZone({ pool, disabled }: { pool: PoolInfo; disabled: boolean }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const [newAuth, setNewAuth] = useState("");
  const authOk = client.mode === "demo" ? newAuth.trim().length > 0 : isPubkey(newAuth.trim());

  return (
    <section className="card border-[var(--bad)]/40 p-5">
      <h2 className="font-semibold">Zona de risco</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Pausar bloqueia novas apólices e aportes de liquidez; sinistros em andamento continuam. A transferência de
        autoridade só vale quando a nova carteira assinar o aceite.
      </p>
      <button
        className={`btn mt-4 w-full ${pool.paused ? "btn-primary" : "btn-danger"}`}
        disabled={disabled || !!busy}
        onClick={() =>
          run("pause", () => client.setPaused(!pool.paused), pool.paused ? "Pool reativado" : "Pool pausado")
        }
      >
        {busy === "pause" ? <Spinner /> : pool.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        {pool.paused ? "Reativar pool" : "Pausar pool"}
      </button>
      <div className="mt-4 flex gap-2">
        <input
          className="input flex-1 font-mono text-sm"
          placeholder="Propor nova autoridade (chave pública)"
          disabled={disabled}
          value={newAuth}
          onChange={(e) => setNewAuth(e.target.value)}
        />
        <button
          className="btn btn-danger"
          disabled={disabled || !authOk || !!busy}
          onClick={() => {
            run("auth", () => client.proposeAuthority(newAuth.trim()), "Autoridade proposta: a nova carteira precisa aceitar").then(
              (sig) => sig && setNewAuth(""),
            );
          }}
        >
          {busy === "auth" && <Spinner />} Propor
        </button>
      </div>
    </section>
  );
}

function PendingChanges({ pool, now, isAuthority }: { pool: PoolInfo; now: number; isAuthority: boolean }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const hasParams = !!pool.pendingParams;
  const hasAssessors = pool.pendingAssessors.length > 0;
  if (!hasParams && !hasAssessors && !pool.pendingAuthority) return null;

  const changed = hasParams
    ? FIELDS.filter((f) => pool.pendingParams![f.key] !== pool.params[f.key]).map(
        (f) => `${f.label}: ${toInput(pool.params, f)} → ${toInput(pool.pendingParams!, f)}`,
      )
    : [];

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Clock className="size-5 text-[var(--accent)]" /> Mudanças pendentes (timelock)
      </h2>
      <div className="mt-3 flex flex-col gap-4 text-sm">
        {hasParams && (
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="font-medium">Parâmetros</p>
            <ul className="mt-1 list-disc pl-5 text-[var(--muted)]">
              {(changed.length ? changed : ["Faucet ou valores iguais aos atuais"]).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <GateRow eta={pool.pendingParamsEta} now={now} busy={!!busy}
              onApply={() => run("apply-params", () => client.applyParams(), "Parâmetros aplicados")} />
          </div>
        )}
        {hasAssessors && (
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="font-medium">
              Comitê: {pool.pendingAssessors.map(shortAddr).join(", ")} · quórum {pool.pendingThreshold}
            </p>
            <GateRow eta={pool.pendingAssessorsEta} now={now} busy={!!busy}
              onApply={() => run("apply-assessors", () => client.applyAssessors(), "Comitê aplicado")} />
          </div>
        )}
        {pool.pendingAuthority && (
          <p className="rounded-xl border border-[var(--border)] p-3">
            Autoridade proposta: <span className="font-mono">{shortAddr(pool.pendingAuthority)}</span> — aguardando o
            aceite dessa carteira.
          </p>
        )}
        {isAuthority && (
          <button
            className="btn btn-ghost self-start"
            disabled={!!busy}
            onClick={() => run("cancel", () => client.cancelPending(), "Mudanças pendentes canceladas")}
          >
            {busy === "cancel" && <Spinner />} Cancelar mudanças pendentes
          </button>
        )}
      </div>
    </section>
  );
}

function GateRow({ eta, now, busy, onApply }: { eta: number; now: number; busy: boolean; onApply: () => void }) {
  const ready = now >= eta;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <span className="text-xs text-[var(--muted)]">
        {ready ? "Timelock cumprido" : `Libera em ${fmtDuration(eta - now)} (${fmtDate(eta)})`}
      </span>
      <button className="btn btn-primary ml-auto !py-1.5" disabled={!ready || busy} onClick={onApply}>
        Aplicar
      </button>
    </div>
  );
}

function AcceptAuthority({ pool }: { pool: PoolInfo }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  return (
    <section className="card flex flex-wrap items-center gap-3 border-[var(--accent)] p-4 text-sm">
      <KeyRound className="size-5 text-[var(--accent)]" />
      <span>
        A autoridade do pool foi proposta para{" "}
        <span className="font-mono">{shortAddr(pool.pendingAuthority ?? "")}</span>. Assine para aceitar.
      </span>
      <button
        className="btn btn-primary ml-auto"
        disabled={!!busy}
        onClick={() => run("accept", () => client.acceptAuthority(), "Autoridade aceita")}
      >
        {busy === "accept" && <Spinner />} Aceitar autoridade
      </button>
    </section>
  );
}

function TreasuryCard({ pool, disabled }: { pool: PoolInfo; disabled: boolean }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const [amount, setAmount] = useState("");
  const base = toBase(amount);
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Landmark className="size-5 text-[var(--accent)]" /> Tesouraria do protocolo
      </h2>
      <div className="mt-3 divide-y divide-[var(--border)] text-sm">
        <Row label="Disponível para saque" value={fmtMoney(pool.treasuryAccrued)} strong />
        <Row label="Taxas do protocolo arrecadadas" value={fmtMoney(pool.totalProtocolFees)} />
        <Row label="Pago a avaliadores (vistorias + votos)" value={fmtMoney(pool.totalAssessorRewards)} />
        <Row label="Taxas de vistoria pendentes" value={fmtMoney(pool.pendingInspectionFees)} />
      </div>
      <div className="mt-4 flex gap-2">
        <input
          className="input num flex-1"
          inputMode="decimal"
          placeholder="Valor em tBRL"
          disabled={disabled}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
        />
        <button
          className="btn btn-primary"
          disabled={disabled || base <= 0 || base > pool.treasuryAccrued || !!busy}
          onClick={() =>
            run("treasury", () => client.withdrawTreasury(base), "Receita sacada da tesouraria").then(
              (sig) => sig && setAmount(""),
            )
          }
        >
          {busy === "treasury" && <Spinner />} Sacar
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        O saque nunca toca no patrimônio dos LPs, no cashback reservado nem nas taxas de vistoria pendentes.
      </p>
    </section>
  );
}
