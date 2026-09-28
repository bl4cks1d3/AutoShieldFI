"use client";

import { KeyRound, Pause, Play, Settings2, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAction, useApp, useData } from "@/components/Providers";
import { Chip, Empty, Loading, PageHeader, PoolMissing, Row, Spinner, WalletGate } from "@/components/ui";
import { shortAddr } from "@/lib/format";
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
  const { data: pool, loading } = useData((c) => c.getPool());

  if (loading && !pool) return <Loading />;
  if (!pool) return <PoolMissing />;

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
          <DangerZone pool={pool} disabled={!isAuthority} />
        </div>
      </div>
    </div>
  );
}

type ParamField = { key: keyof PoolParams; label: string; unit: "pct" | "secs"; hint: string };

const FIELDS: ParamField[] = [
  { key: "baseRateBps", label: "Taxa base anual", unit: "pct", hint: "Sobre o valor FIPE (máx. 50%)" },
  { key: "cashbackBps", label: "Cashback", unit: "pct", hint: "Parte do prêmio devolvida sem sinistro" },
  { key: "minCollateralBps", label: "Colateral mínimo", unit: "pct", hint: "Sobre a cobertura ativa" },
  { key: "withdrawCooldownSecs", label: "Carência de saque (LP)", unit: "secs", hint: "Segundos após o aporte" },
  { key: "claimVotingSecs", label: "Prazo de votação", unit: "secs", hint: "Janela para os avaliadores" },
  { key: "secondsPerDay", label: "Segundos por dia", unit: "secs", hint: "86400 em produção; 60 acelera a demo" },
];

function toInput(p: PoolParams, f: ParamField) {
  const v = p[f.key] as number;
  return f.unit === "pct" ? String(v / 100).replace(".", ",") : String(v);
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
    (parsed as unknown as Record<string, number>)[f.key] = f.unit === "pct" ? Math.round(n * 100) : Math.round(n);
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
              {f.label} <span className="text-[var(--muted)]">({f.unit === "pct" ? "%" : "s"})</span>
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
        onClick={() => run("params", () => client.updateParams(parsed), "Parâmetros atualizados")}
      >
        {busy === "params" && <Spinner />} Salvar parâmetros
      </button>
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
        onClick={() => run("assessors", () => client.setAssessors(list, threshold), "Comitê atualizado")}
      >
        {busy === "assessors" && <Spinner />} Salvar comitê
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
        Pausar bloqueia novas apólices e aportes de liquidez; sinistros em andamento continuam. Transferir a autoridade é irreversível para esta carteira.
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
          placeholder="Nova autoridade (chave pública)"
          disabled={disabled}
          value={newAuth}
          onChange={(e) => setNewAuth(e.target.value)}
        />
        <button
          className="btn btn-danger"
          disabled={disabled || !authOk || !!busy}
          onClick={() => {
            if (!confirm(`Transferir a autoridade do pool para ${newAuth.trim()}? Você perderá o acesso de governança.`)) return;
            run("auth", () => client.transferAuthority(newAuth.trim()), "Autoridade transferida").then(
              (sig) => sig && setNewAuth(""),
            );
          }}
        >
          {busy === "auth" && <Spinner />} Transferir
        </button>
      </div>
    </section>
  );
}
