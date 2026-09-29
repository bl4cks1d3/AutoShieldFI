"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bike,
  Car,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  CloudHail,
  Coins,
  Droplets,
  FileCheck2,
  FileWarning,
  Landmark,
  Percent,
  Plus,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useRole } from "@/components/AppShell";
import { useAction, useApp, useData } from "@/components/Providers";
import { EvidenceLink, Loading, PageHeader, PoolMissing, Spinner, WalletGate } from "@/components/ui";
import { CLUSTER_LABEL, STABLE_SYMBOL } from "@/lib/config";
import { fmtDate, fmtDuration, fmtMoney, fmtNum, fmtPct, shortAddr } from "@/lib/format";
import { kindLabel, statusLabel, tierLabel, useI18n } from "@/lib/i18n";
import { displayPlate } from "@/lib/plate";
import { policyStatus } from "@/lib/policyStatus";
import { DEDUCTIBLE_BPS, installmentAmount, MAX_INSTALLMENTS, paidUntil, UNIT } from "@/lib/pricing";
import { ROLES, TONE, type Tone } from "@/lib/roles";
import type { AutoShieldClient, ClaimInfo, ClaimKind, ClaimStatus, DriverInfo, PolicyInfo, PoolInfo, StakeInfo } from "@/lib/types";

// ---------------------------------------------------------------------------
// Pecas visuais do painel

function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="chip flex-none" style={{ background: TONE[tone].bg, color: TONE[tone].fg }}>
      {children}
    </span>
  );
}

function Dot({ tone, icon: Icon }: { tone: Tone; icon: LucideIcon }) {
  return (
    <span className="grid size-8 flex-none place-items-center rounded-full" style={{ background: TONE[tone].bg, color: TONE[tone].fg }}>
      <Icon className="size-4" />
    </span>
  );
}

function StatTile({ label, value, icon: Icon }: { label: string; value: ReactNode; icon: LucideIcon }) {
  return (
    <div className="card flex flex-col gap-2.5 p-4">
      <span className="grid size-[30px] place-items-center rounded-[9px] bg-[var(--accent-soft)] text-[var(--accent)]">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xs text-[var(--muted)]">{label}</p>
        <p className="num mt-0.5 text-[19px] font-bold tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function SectionHead({ title, href, link, right }: { title: string; href?: string; link?: string; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-1">
      <h2 className="section-title">{title}</h2>
      {href && link && (
        <Link href={href} className="text-[15px]">
          {link}
        </Link>
      )}
      {right}
    </div>
  );
}

function Bar({ pct, color = "var(--accent)", mark }: { pct: number; color?: string; mark?: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative h-1.5 rounded-full bg-[var(--bg-soft)]">
      <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
      {mark !== undefined && (
        <div className="absolute -top-[3px] h-3 w-0.5 rounded-sm bg-[var(--warn)]" style={{ left: `${Math.min(100, mark)}%` }} />
      )}
    </div>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">{children}</div>;
}

interface HeroProps {
  label: string;
  value: string;
  sub?: ReactNode;
  actions?: ReactNode;
}

function Hero({ label, value, sub, actions }: HeroProps) {
  const { mode } = useApp();
  const { t } = useI18n();
  return (
    <div className="card-hero flex flex-col gap-4 p-[22px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--accent-strong)]">{label}</p>
          <p className="num mt-1.5 text-[34px] font-bold tracking-[-0.03em]">
            {value} <span className="text-[17px] font-semibold text-[var(--muted)]">{STABLE_SYMBOL}</span>
          </p>
          {sub && <p className="num mt-1 text-[13px] text-[var(--muted)]">{sub}</p>}
        </div>
        <span className="chip flex-none bg-white text-[var(--accent)] shadow-[0_0_0_0.5px_rgba(15,159,117,0.2)]">
          <span className="size-1.5 rounded-full bg-[var(--accent)]" />
          {mode === "demo" ? t("Demo", "Demo") : CLUSTER_LABEL}
        </span>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Botoes de faucet de tBRL e airdrop de SOL (rede de teste). */
function FundingActions() {
  const { client, mode } = useApp();
  const { connection } = useConnection();
  const { run, busy } = useAction();
  const { t } = useI18n();
  const { data: pool } = useData((c) => c.getPool());

  const airdrop = () =>
    run(
      "airdrop",
      async () => {
        const sig = await connection.requestAirdrop(new PublicKey(client.wallet!), 2 * LAMPORTS_PER_SOL);
        const bh = await connection.getLatestBlockhash();
        await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
        return sig;
      },
      t("+2 SOL recebidos para taxas", "+2 SOL received for fees"),
    );

  return (
    <>
      {pool?.params.faucetEnabled && (
        <button
          className="btn btn-white"
          disabled={!!busy}
          onClick={() => run("faucet", () => client.faucet(50_000 * UNIT), `+${fmtNum(50_000)} ${STABLE_SYMBOL} ${t("recebidos", "received")}`)}
        >
          {busy === "faucet" ? <Spinner className="size-3.5" /> : <Coins className="size-3.5" />} Faucet {STABLE_SYMBOL}
        </button>
      )}
      {mode === "chain" && CLUSTER_LABEL.toLowerCase() !== "mainnet" && (
        <button className="btn btn-white" disabled={!!busy} onClick={airdrop}>
          {busy === "airdrop" ? <Spinner className="size-3.5" /> : <Droplets className="size-3.5" />} Airdrop SOL
        </button>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Dados

interface DashData {
  pool: PoolInfo | null;
  now: number;
  balance: number;
  sol: number | null;
  myPolicies: PolicyInfo[];
  myClaims: ClaimInfo[];
  stake: StakeInfo | null;
  allPolicies: PolicyInfo[];
  allClaims: ClaimInfo[];
  driver: DriverInfo | null;
}

async function load(c: AutoShieldClient, getSol: (w: string) => Promise<number>): Promise<DashData> {
  const w = c.wallet;
  const [pool, now, balance, sol, myPolicies, myClaims, stake, allPolicies, allClaims, driver] = await Promise.all([
    c.getPool(),
    c.now(),
    w ? c.getBalance(w) : Promise.resolve(0),
    w && c.mode === "chain" ? getSol(w).catch(() => null) : Promise.resolve(null),
    w ? c.getPolicies(w) : Promise.resolve([]),
    w ? c.getClaims(w) : Promise.resolve([]),
    w ? c.getStake(w) : Promise.resolve(null),
    c.getPolicies(),
    c.getClaims(),
    w ? c.getDriver(w) : Promise.resolve(null),
  ]);
  return { pool, now, balance, sol, myPolicies, myClaims, stake, allPolicies, allClaims, driver };
}

// ---------------------------------------------------------------------------
// Pagina

export default function PainelPage() {
  const { role } = useRole();
  const { lang, t } = useI18n();
  const R = ROLES[role];

  const primary: Record<typeof role, { href: string; label: string; secondary?: { href: string; label: string } }> = {
    motorista: {
      href: "/cotar",
      label: t("Nova cotação", "New quote"),
      secondary: { href: "/sinistros", label: t("Acionar sinistro", "File a claim") },
    },
    investidor: {
      href: "/pool",
      label: t("Aportar", "Deposit"),
      secondary: { href: "/pool", label: t("Resgatar", "Withdraw") },
    },
    avaliador: { href: "/avaliacao", label: t("Abrir fila", "Open queue") },
    governanca: { href: "/admin", label: t("Propor alteração", "Propose change") },
  };
  const P = primary[role];

  return (
    <div>
      <PageHeader
        title={t(`Início · ${R.pt}`, `Home · ${R.en}`)}
        action={
          <>
            {P.secondary && (
              <Link href={P.secondary.href} className="btn btn-ghost">
                {P.secondary.label}
              </Link>
            )}
            <Link href={P.href} className="btn btn-primary">
              <Plus className="size-4" /> {P.label}
            </Link>
          </>
        }
      />
      <WalletGate>
        <Dashboard key={lang} />
      </WalletGate>
    </div>
  );
}

function Dashboard() {
  const { role } = useRole();
  const { client } = useApp();
  const { connection } = useConnection();
  const { data, loading } = useData((c) => load(c, (w) => connection.getBalance(new PublicKey(w))), [client.wallet, connection]);

  if (loading && !data) return <Loading />;
  if (!data?.pool) return <PoolMissing />;
  const d = { ...data, pool: data.pool };

  if (role === "investidor") return <InvestorView d={d} />;
  if (role === "avaliador") return <AssessorView d={d} />;
  if (role === "governanca") return <GovernanceView d={d} />;
  return <DriverView d={d} />;
}

type D = DashData & { pool: PoolInfo };

// ----------------------------------------------------------------- Motorista

const KIND_ICON: Record<ClaimKind, LucideIcon> = {
  theft: ShieldAlert,
  collision: Car,
  thirdParty: Users,
  naturalEvent: CloudHail,
  other: FileWarning,
};

const CLAIM_TONE: Record<ClaimStatus, Tone> = { pending: "warn", approved: "info", rejected: "bad", paid: "ok", appealed: "info" };

function DriverView({ d }: { d: D }) {
  const { lang, t } = useI18n();
  const grace = d.pool.params.installmentGraceSecs;
  const policies = [...d.myPolicies].sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || b.id - a.id);
  const claims = [...d.myClaims].sort((a, b) => b.createdTs - a.createdTs);
  const policyById = new Map(d.myPolicies.map((p) => [p.address, p]));

  return (
    <div className="flex flex-col gap-7">
      <section className="grid gap-4 md:grid-cols-2">
        <Hero
          label={t("Saldo na carteira", "Wallet balance")}
          value={fmtMoney(d.balance, false)}
          sub={
            <>
              {d.sol !== null
                ? t(`${fmtNum(d.sol / LAMPORTS_PER_SOL, 3)} SOL para taxas`, `${fmtNum(d.sol / LAMPORTS_PER_SOL, 3)} SOL for fees`)
                : t("Modo demonstração — dados simulados no navegador", "Demo mode — data simulated in your browser")}
              {" · "}
              <span className={d.driver?.bonusClass ? "font-semibold text-[var(--ok)]" : ""}>
                {t(`Bônus classe ${d.driver?.bonusClass ?? 0}`, `Bonus class ${d.driver?.bonusClass ?? 0}`)}
                {d.driver?.bonusClass ? ` (−${d.driver.bonusClass * 4}%)` : ""}
              </span>
            </>
          }
          actions={<FundingActions />}
        />
        <PoolStats
          pool={d.pool}
          items={["capital", "active", "claimsPaid", "cashback"]}
        />
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2.5">
          <SectionHead title={t("Minhas apólices", "My policies")} href="/apolices" link={t("Ver todas", "See all")} />
          <div className="card list-card overflow-hidden">
            {policies.length === 0 ? (
              <EmptyRow>
                {t("Você ainda não tem apólices.", "You don't have any policies yet.")}{" "}
                <Link href="/cotar">{t("Fazer cotação", "Get a quote")}</Link>
              </EmptyRow>
            ) : (
              policies.slice(0, 3).map((p) => {
                const st = policyStatus(p, d.now, grace);
                const total = p.endTs - p.startTs;
                const elapsed = Math.min(Math.max(d.now - p.startTs, 0), total);
                const fullyPaid = p.installmentsPaid >= p.installments;
                const Icon = /moto|cg |biz|titan|fan/i.test(p.model) ? Bike : Car;
                return (
                  <Link key={p.address} href="/apolices" className="block p-[18px] text-[var(--fg)] hover:bg-[rgba(0,0,0,0.015)] hover:text-[var(--fg)]">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 flex-none place-items-center rounded-[11px] bg-[var(--bg-soft)] text-[var(--accent)]">
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[var(--muted)]">
                          {t("Apólice", "Policy")} #{p.id} · {tierLabel(p.tier, lang)}
                        </p>
                        <p className="mt-px truncate text-base font-semibold tracking-tight">{p.model}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
                          <span className="rounded-[5px] bg-[var(--bg-soft)] px-1.5 py-px font-mono text-xs text-[var(--fg)]">{displayPlate(p)}</span>
                          {p.year}
                        </p>
                      </div>
                      <Chip tone={st.tone}>{lang === "en" ? st.en : st.pt}</Chip>
                    </div>
                    {p.status === "active" && (
                      <div className="mt-3.5">
                        <div className="num mb-1.5 flex justify-between text-xs text-[var(--muted)]">
                          <span>{fmtDate(p.startTs).split(",")[0]}</span>
                          <span>
                            {d.now > p.endTs
                              ? t("vencida", "expired")
                              : t(`restam ${fmtDuration(p.endTs - d.now)}`, `${fmtDuration(p.endTs - d.now)} left`)}
                          </span>
                        </div>
                        <Bar pct={total ? (elapsed / total) * 100 : 100} />
                      </div>
                    )}
                    <div className="mt-3.5 grid grid-cols-3 gap-2">
                      <Mini label={t("Cobertura restante", "Remaining coverage")} value={fmtMoney(p.coverageLimit - p.totalPaidOut, false)} />
                      <Mini
                        label={t("Próxima parcela", "Next installment")}
                        value={
                          p.installments <= 1
                            ? t("À vista", "Upfront")
                            : fullyPaid
                              ? t("Quitada", "Paid off")
                              : `${fmtMoney(installmentAmount(p.premiumTotal, p.installments, p.installmentsPaid + 1), false)} · ${fmtDate(paidUntil(p)).slice(0, 5)}`
                        }
                      />
                      <Mini label="Cashback" value={fmtMoney(p.hadPaidClaim ? 0 : p.cashbackAmount, false)} accent />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <SectionHead title={t("Sinistros", "Claims")} href="/sinistros" link={t("Ver todos", "See all")} />
          <div className="card list-card overflow-hidden">
            {claims.length === 0 ? (
              <EmptyRow>{t("Nenhum sinistro registrado.", "No claims filed.")}</EmptyRow>
            ) : (
              claims.slice(0, 5).map((c) => {
                const pol = policyById.get(c.policy);
                const meta =
                  c.status === "pending"
                    ? t(
                        `Apólice #${pol?.id ?? "?"} · ${c.approvals} de ${d.pool.approvalThreshold} votos`,
                        `Policy #${pol?.id ?? "?"} · ${c.approvals} of ${d.pool.approvalThreshold} votes`,
                      )
                    : `${t("Apólice", "Policy")} #${pol?.id ?? "?"} · ${fmtDate(c.resolvedTs || c.createdTs).split(",")[0]}`;
                return (
                  <Link key={c.address} href="/sinistros" className="flex items-center gap-3 px-4 py-3 text-[var(--fg)] hover:text-[var(--fg)]">
                    <Dot tone={CLAIM_TONE[c.status]} icon={KIND_ICON[c.kind]} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold">{kindLabel(c.kind, lang)}</p>
                      <p className="mt-px text-xs text-[var(--muted)]">{meta}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="num text-sm font-semibold">
                        {c.status === "rejected" ? "—" : fmtMoney(c.status === "paid" ? c.payoutAmount : c.amountRequested, false)}
                      </span>
                      <Chip tone={CLAIM_TONE[c.status]}>{statusLabel(c.status, lang)}</Chip>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-[var(--muted)]">{label}</p>
      <p className={`num mt-0.5 truncate text-sm font-semibold ${accent ? "text-[var(--accent)]" : ""}`}>{value}</p>
    </div>
  );
}

type StatKey = "capital" | "active" | "claimsPaid" | "cashback" | "premiums" | "assessors" | "protocolFees";

function PoolStats({ pool, items }: { pool: PoolInfo; items: StatKey[] }) {
  const { t } = useI18n();
  const all: Record<StatKey, { label: string; value: string; icon: LucideIcon }> = {
    capital: { label: t("Capital no pool", "Pool capital"), value: fmtMoney(pool.vaultBalance), icon: Landmark },
    active: { label: t("Apólices ativas", "Active policies"), value: String(pool.activePolicies), icon: ShieldCheck },
    claimsPaid: { label: t("Sinistros pagos", "Claims paid"), value: fmtMoney(pool.totalClaimsPaid), icon: FileCheck2 },
    cashback: { label: t("Cashback devolvido", "Cashback returned"), value: fmtMoney(pool.totalCashbackPaid), icon: Coins },
    premiums: { label: t("Prêmios arrecadados", "Premiums collected"), value: fmtMoney(pool.totalPremiums), icon: TrendingUp },
    assessors: { label: t("Avaliadores", "Assessors"), value: String(pool.assessors.length), icon: Users },
    protocolFees: { label: t("Taxa do protocolo arrecadada", "Protocol fees collected"), value: fmtMoney(pool.totalProtocolFees), icon: Percent },
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((k) => (
        <StatTile key={k} {...all[k]} />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------- Investidor

function poolMath(pool: PoolInfo) {
  const liabilities = pool.reservedCashback + pool.treasuryAccrued + pool.pendingInspectionFees;
  const nav = Math.max(0, pool.vaultBalance - liabilities);
  const sharePrice = pool.totalShares ? nav / pool.totalShares : 1;
  const required = (pool.totalActiveCoverage * pool.params.minCollateralBps) / 10_000 + pool.pendingClaims;
  const collateral = pool.totalActiveCoverage ? nav / pool.totalActiveCoverage : 0;
  const utilization = nav ? required / nav : 0;
  return { nav, sharePrice, required, collateral, utilization };
}

function InvestorView({ d }: { d: D }) {
  const { t } = useI18n();
  const m = poolMath(d.pool);
  const shares = d.stake?.shares ?? 0;
  const myValue = Math.floor(shares * m.sharePrice);
  const rawPnl = d.stake ? myValue + d.stake.totalWithdrawn - d.stake.totalDeposited : 0;
  const pnl = Math.abs(rawPnl) < 10_000 ? 0 : rawPnl;
  const minPct = d.pool.params.minCollateralBps / 100;

  const flows: { label: string; meta: string; amount: number; sign: "+" | "−"; tone: Tone; icon: LucideIcon }[] = [
    { label: t("Prêmios recebidos", "Premiums received"), meta: t("Total pago pelos motoristas", "Total paid by drivers"), amount: d.pool.totalPremiums, sign: "+", tone: "ok", icon: ArrowDownLeft },
    { label: t("Indenizações pagas", "Payouts"), meta: t("Sinistros aprovados", "Approved claims"), amount: d.pool.totalClaimsPaid, sign: "−", tone: "bad", icon: ArrowUpRight },
    { label: t("Cashback devolvido", "Cashback returned"), meta: t("Apólices sem sinistro", "Policies with no claims"), amount: d.pool.totalCashbackPaid, sign: "−", tone: "neutral", icon: Coins },
    { label: t("Taxa do protocolo", "Protocol fee"), meta: t("Enviada à tesouraria", "Sent to the treasury"), amount: d.pool.totalProtocolFees, sign: "−", tone: "info", icon: Percent },
  ];

  return (
    <div className="flex flex-col gap-7">
      <section className="grid gap-4 md:grid-cols-2">
        <Hero
          label={t("Sua posição no pool", "Your pool position")}
          value={fmtMoney(myValue, false)}
          sub={
            <>
              {fmtNum(shares / UNIT)} {t("cotas", "shares")} ·{" "}
              <span className={pnl > 0 ? "text-[var(--ok)]" : pnl < 0 ? "text-[var(--bad)]" : ""}>
                {pnl > 0 ? "+" : pnl < 0 ? "−" : ""}
                {fmtMoney(Math.abs(pnl))} {t("de resultado", "result")}
              </span>
            </>
          }
          actions={<FundingActions />}
        />
        <PoolStats pool={d.pool} items={["capital", "premiums", "claimsPaid", "active"]} />
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-2">
        <div className="card flex flex-col gap-[18px] p-5">
          <h2 className="section-title">{t("Saúde do pool", "Pool health")}</h2>
          <div>
            <div className="mb-2 flex justify-between text-[13px]">
              <span className="text-[var(--muted)]">{t("Colateral", "Collateral")}</span>
              <span className="num font-semibold">{d.pool.totalActiveCoverage ? fmtPct(m.collateral) : "—"}</span>
            </div>
            <Bar pct={m.collateral * 100} mark={minPct} />
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              {t(
                `Mínimo on-chain de ${fmtPct(minPct / 100, 0)} da cobertura ativa para aceitar novas apólices`,
                `On-chain minimum of ${fmtPct(minPct / 100, 0)} of active coverage to accept new policies`,
              )}
            </p>
          </div>
          <div>
            <div className="mb-2 flex justify-between text-[13px]">
              <span className="text-[var(--muted)]">{t("Capital comprometido", "Capital committed")}</span>
              <span className="num font-semibold">{fmtPct(m.utilization)}</span>
            </div>
            <Bar pct={m.utilization * 100} color={m.utilization > 0.8 ? "var(--warn)" : "var(--info)"} />
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              {t("Capital mínimo exigido em relação ao patrimônio dos cotistas", "Required minimum capital relative to shareholder equity")}
            </p>
          </div>
          <div className="num grid grid-cols-2 gap-3 border-t-[0.5px] border-[var(--border)] pt-4 text-sm">
            <Mini label={t("Valor da cota", "Share price")} value={fmtNum(m.sharePrice, 4)} />
            <Mini label={t("Livre para saque", "Free to withdraw")} value={fmtMoney(Math.max(0, m.nav - m.required), false)} />
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <SectionHead title={t("Fluxos do pool", "Pool flows")} href="/pool" link={t("Detalhes", "Details")} />
          <div className="card list-card overflow-hidden">
            {flows.map((f) => (
              <div key={f.label} className="flex items-center gap-3 px-4 py-3">
                <Dot tone={f.tone} icon={f.icon} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{f.label}</p>
                  <p className="mt-px text-xs text-[var(--muted)]">{f.meta}</p>
                </div>
                <span className={`num text-[15px] font-semibold ${f.sign === "+" && f.amount > 0 ? "text-[var(--ok)]" : ""}`}>
                  {f.amount > 0 ? f.sign : ""}
                  {fmtMoney(f.amount, false)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------- Avaliador

function AssessorView({ d }: { d: D }) {
  const { client } = useApp();
  const { lang, t } = useI18n();
  const me = client.wallet ?? "";
  const ids = client.mode === "demo" ? client.assessorIdentities : [me];
  const isAssessor = d.pool.assessors.some((a) => ids.includes(a));
  const quorum = Math.max(1, Math.min(d.pool.params.inspectionThreshold, d.pool.assessors.length));

  const inspections = d.allPolicies.filter((p) => p.status === "active" && !p.inspected);
  const claimsOpen = d.allClaims.filter((c) => c.status === "pending" && d.now <= c.votingDeadline);
  const votedBy = (voters: string[]) => voters.some((v) => ids.includes(v));
  const toInspect = inspections.filter((p) => !votedBy(p.inspectionVoters) && !ids.includes(p.owner));
  const toVote = claimsOpen.filter((c) => !votedBy(c.voters) && !ids.includes(c.claimant));
  const myVotes =
    d.allClaims.filter((c) => votedBy(c.voters)).length + d.allPolicies.filter((p) => votedBy(p.inspectionVoters)).length;
  const policyById = new Map(d.allPolicies.map((p) => [p.address, p]));
  const waiting = toInspect.length + toVote.length;

  return (
    <div className="flex flex-col gap-7">
      <section className="grid gap-4 md:grid-cols-2">
        <Hero
          label={t("Recompensas pagas a avaliadores", "Rewards paid to assessors")}
          value={fmtMoney(d.pool.totalAssessorRewards, false)}
          sub={
            isAssessor
              ? t(`${waiting} itens aguardando seu voto`, `${waiting} items awaiting your vote`)
              : t("Sua carteira não é avaliadora — apenas leitura", "Your wallet is not an assessor — read only")
          }
          actions={<FundingActions />}
        />
        <div className="grid grid-cols-2 gap-3">
          <StatTile label={t("Vistorias pendentes", "Pending inspections")} value={inspections.length} icon={ClipboardCheck} />
          <StatTile label={t("Sinistros para votar", "Claims to vote on")} value={claimsOpen.length} icon={FileWarning} />
          <StatTile label={t("Votos emitidos", "Votes cast")} value={myVotes} icon={Vote} />
          <StatTile
            label={t("Quórum de sinistros", "Claim quorum")}
            value={`${d.pool.approvalThreshold} ${t("de", "of")} ${d.pool.assessors.length}`}
            icon={CheckCheck}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHead
          title={t("Aguardando seu voto", "Awaiting your vote")}
          right={
            <span className="text-[13px] text-[var(--muted)]">
              {t(`Quórum de vistoria: ${quorum}`, `Inspection quorum: ${quorum}`)}
            </span>
          }
        />
        {waiting === 0 ? (
          <div className="card">
            <EmptyRow>{t("Nada pendente para você agora.", "Nothing pending for you right now.")}</EmptyRow>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {toVote.map((c) => {
              const pol = policyById.get(c.policy);
              return (
                <QueueCard
                  key={c.address}
                  type={t("Sinistro", "Claim")}
                  policyId={pol?.id}
                  title={`${kindLabel(c.kind, lang)}${pol ? ` · ${pol.model}` : ""}`}
                  detail={`${t("Pedido", "Requested")} ${fmtMoney(c.amountRequested)}${pol ? ` · ${t("franquia", "deductible")} ${fmtMoney(pol.deductible, false)}` : ""}`}
                  votes={t(`${c.approvals} de ${d.pool.approvalThreshold} votos`, `${c.approvals} of ${d.pool.approvalThreshold} votes`)}
                  tone="warn"
                  evidence={c.evidenceUri}
                />
              );
            })}
            {toInspect.map((p) => (
              <QueueCard
                key={p.address}
                type={t("Vistoria", "Inspection")}
                policyId={p.id}
                title={`${p.model} · ${p.year}`}
                detail={`FIPE ${fmtMoney(p.vehicleValue)}`}
                votes={t(`${p.inspectionApprovals} de ${quorum} votos`, `${p.inspectionApprovals} of ${quorum} votes`)}
                tone="neutral"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QueueCard(props: {
  type: string;
  policyId?: number;
  title: string;
  detail: string;
  votes: string;
  tone: Tone;
  evidence?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="card flex flex-col gap-3.5 p-[18px]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted)]">
            {props.type} · {t("Apólice", "Policy")} #{props.policyId ?? "?"}
          </p>
          <p className="mt-0.5 truncate text-base font-semibold">{props.title}</p>
          <p className="num mt-1 text-[13px] text-[var(--muted)]">{props.detail}</p>
        </div>
        <Chip tone={props.tone}>{props.votes}</Chip>
      </div>
      {props.evidence && <EvidenceLink uri={props.evidence} />}
      <Link href="/avaliacao" className="btn btn-primary !h-9 !rounded-[10px]">
        {t("Revisar e votar", "Review and vote")} <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

// ----------------------------------------------------------------- Governanca

function GovernanceView({ d }: { d: D }) {
  const { client } = useApp();
  const { t } = useI18n();
  const m = poolMath(d.pool);
  const p = d.pool.params;
  const params: [string, string][] = [
    [t("Taxa base", "Base rate"), t(`${fmtNum(p.baseRateBps / 100)}% ao ano`, `${fmtNum(p.baseRateBps / 100)}% per year`)],
    ["Cashback", t(`${fmtNum(p.cashbackBps / 100)}% do prêmio`, `${fmtNum(p.cashbackBps / 100)}% of premium`)],
    [t("Franquia (danos parciais)", "Deductible (partial damage)"), t(`${DEDUCTIBLE_BPS / 100}% da FIPE`, `${DEDUCTIBLE_BPS / 100}% of FIPE`)],
    [t("Quórum de avaliadores", "Assessor quorum"), `${d.pool.approvalThreshold} ${t("de", "of")} ${d.pool.assessors.length}`],
    [t("Colateral mínimo", "Minimum collateral"), `${fmtNum(p.minCollateralBps / 100)}%`],
    [t("Parcelamento", "Installments"), t(`até ${MAX_INSTALLMENTS}x`, `up to ${MAX_INSTALLMENTS}x`)],
    [t("Timelock de governança", "Governance timelock"), fmtDuration(p.governanceDelaySecs)],
  ];

  return (
    <div className="flex flex-col gap-7">
      <section className="grid gap-4 md:grid-cols-2">
        <Hero
          label={t("Capital no pool", "Pool capital")}
          value={fmtMoney(d.pool.vaultBalance, false)}
          sub={
            d.pool.totalActiveCoverage
              ? t(
                  `Colateral em ${fmtPct(m.collateral)} · mínimo ${fmtNum(p.minCollateralBps / 100)}%`,
                  `Collateral at ${fmtPct(m.collateral)} · minimum ${fmtNum(p.minCollateralBps / 100)}%`,
                )
              : t("Sem cobertura ativa no momento", "No active coverage right now")
          }
          actions={<FundingActions />}
        />
        <PoolStats pool={d.pool} items={["active", "assessors", "protocolFees", "cashback"]} />
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2.5">
          <SectionHead title={t("Parâmetros do pool", "Pool parameters")} href="/admin" link={t("Editar", "Edit")} />
          <div className="card list-card overflow-hidden">
            {params.map(([label, value]) => (
              <Link key={label} href="/admin" className="flex items-center gap-3 px-4 py-3 text-[var(--fg)] hover:text-[var(--fg)]">
                <span className="flex-1 text-[15px]">{label}</span>
                <span className="num text-[15px] text-[var(--muted)]">{value}</span>
                <ChevronRight className="size-3.5 text-[#b9c5c1]" />
              </Link>
            ))}
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 text-[15px]">Faucet {STABLE_SYMBOL}</span>
              <span className={`chip ${p.faucetEnabled ? "bg-[var(--ok-soft)] text-[var(--ok)]" : "bg-[var(--bg-soft)] text-[var(--muted)]"}`}>
                {p.faucetEnabled ? t("Ligado", "On") : t("Desligado", "Off")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <SectionHead title={t("Comitê de avaliadores", "Assessor committee")} href="/admin" link={t("Gerenciar", "Manage")} />
          <div className="card list-card overflow-hidden">
            {d.pool.assessors.map((a) => {
              const votes =
                d.allClaims.filter((c) => c.voters.includes(a)).length +
                d.allPolicies.filter((pl) => pl.inspectionVoters.includes(a)).length;
              return (
                <div key={a} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-8 flex-none place-items-center rounded-full bg-[var(--warn-soft)] text-[13px] font-bold text-[var(--warn)]">
                    {a[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[15px] font-semibold">{shortAddr(a)}</p>
                    <p className="mt-px text-xs text-[var(--muted)]">
                      {t(`${votes} votos`, `${votes} votes`)}
                      {a === client.wallet ? ` · ${t("você", "you")}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
