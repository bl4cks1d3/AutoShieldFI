"use client";

import { ArrowRight, BadgeCheck, Car, ChevronRight, Coins, FileCheck2, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useData } from "@/components/Providers";
import { fmtMoney } from "@/lib/format";
import { tierDesc, tierLabel, useI18n } from "@/lib/i18n";
import { quote, UNIT } from "@/lib/pricing";
import { ROLE_KEYS, ROLES, TONE } from "@/lib/roles";
import type { Tier } from "@/lib/types";

const TECH = ["Solana", "Rust + Anchor", "Next.js", "PWA", "Phantom", "Solflare", "Backpack", "Google (Privy)", "Tabela FIPE", "IPFS (Pinata)", "Helius RPC"];

export default function Home() {
  const { lang, t } = useI18n();
  const { data: pool } = useData((c) => c.getPool());
  const params = pool?.params ?? { baseRateBps: 350, cashbackBps: 2000 };
  const example = 60_000 * UNIT;

  const steps = [
    {
      icon: Car,
      title: t("Cote em segundos", "Get a quote in seconds"),
      text: t(
        "Informe seu veículo (tabela FIPE), escolha o plano e a vigência. O prêmio é calculado por uma fórmula pública, on-chain.",
        "Enter your vehicle (FIPE price table), pick a plan and a term. The premium is calculated by a public, on-chain formula.",
      ),
    },
    {
      icon: ShieldCheck,
      title: t("Contrate com sua carteira", "Buy with your wallet"),
      text: t(
        "Pague à vista ou em até 12x sem juros direto da carteira — ou entre com Google. A apólice vira uma conta na Solana e um avaliador faz a vistoria antes da cobertura começar.",
        "Pay upfront or in up to 12 interest-free installments from your wallet — or sign in with Google. The policy becomes a Solana account, and an assessor inspects the vehicle before coverage starts.",
      ),
    },
    {
      icon: FileCheck2,
      title: t("Sinistro 100% digital", "100% digital claims"),
      text: t(
        "Registre o ocorrido com fotos e descrição. Avaliadores independentes votam on-chain e o pagamento sai do cofre automaticamente.",
        "Report the incident with photos and a description. Independent assessors vote on-chain and the payout leaves the vault automatically.",
      ),
    },
    {
      icon: Coins,
      title: t("Não usou? Receba de volta", "Didn't use it? Get money back"),
      text: t(
        "Ao fim da vigência sem sinistro, 20% do prêmio volta para você em cashback — e quem aporta capital no pool é remunerado pelos prêmios.",
        "If the term ends with no claims, 20% of the premium comes back to you as cashback — and those who provide capital to the pool earn from the premiums.",
      ),
    },
  ];

  const profiles = {
    motorista: {
      title: t("Para motoristas", "For drivers"),
      text: t(
        "Preço justo, sem letras miúdas: regras de cobertura, franquia (5% da FIPE para danos parciais) e cashback estão no código do contrato.",
        "Fair pricing, no fine print: coverage rules, the deductible (5% of the FIPE value for partial damage) and cashback live in the contract code.",
      ),
      cta: t("Proteger meu veículo", "Protect my vehicle"),
    },
    investidor: {
      title: t("Para provedores de liquidez", "For liquidity providers"),
      text: t(
        "Aporte stablecoin no pool, receba cotas e ganhe com os prêmios. Um colateral mínimo on-chain protege a solvência de todas as apólices.",
        "Deposit stablecoins into the pool, receive shares and earn from premiums. An on-chain minimum collateral protects the solvency of every policy.",
      ),
      cta: t("Aportar no pool", "Provide liquidity"),
    },
    avaliador: {
      title: t("Para avaliadores", "For assessors"),
      text: t(
        "Comitê de avaliadores com quórum configurável decide cada sinistro. Todo voto fica registrado on-chain.",
        "A committee of assessors with a configurable quorum decides each claim. Every vote is recorded on-chain.",
      ),
      cta: t("Painel do avaliador", "Assessor panel"),
    },
    governanca: {
      title: t("Governança", "Governance"),
      text: t(
        "Parâmetros do pool, taxas e comitê de avaliadores, com cada alteração registrada on-chain e sujeita a timelock.",
        "Pool parameters, fees and the assessor committee, with every change recorded on-chain and subject to a timelock.",
      ),
      cta: t("Abrir governança", "Open governance"),
    },
  };

  return (
    <>
      <section className="grid items-center gap-12 pt-[72px] lg:grid-cols-2">
        <div>
          <span className="chip bg-[var(--accent-soft)] !px-3 !py-1 text-[var(--accent)]">
            <BadgeCheck className="size-3.5" /> {t("Construído na Solana", "Built on Solana")}
          </span>
          <h1 className="mt-[18px] text-[clamp(36px,5.2vw,56px)] font-bold leading-[1.05] tracking-[-0.035em] [text-wrap:balance]">
            {lang === "en" ? (
              <>
                Vehicle protection that is <span className="text-[var(--accent)]">affordable, transparent</span> and pays
                you back when you don&apos;t use it.
              </>
            ) : (
              <>
                Proteção veicular <span className="text-[var(--accent)]">acessível, transparente</span> e que devolve
                quando você não usa.
              </>
            )}
          </h1>
          <p className="mt-5 max-w-[540px] text-[19px] leading-relaxed text-[var(--muted)] [text-wrap:pretty]">
            {t(
              "Só cerca de 30% da frota brasileira tem seguro. O AutoShieldFI usa um pool de risco mutualista em smart contracts para reduzir custos, automatizar sinistros e premiar bons motoristas.",
              "Only about 30% of Brazil's vehicles are insured. AutoShieldFI uses a mutual risk pool in smart contracts to cut costs, automate claims and reward good drivers.",
            )}
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link href="/cotar" className="btn btn-primary btn-lg">
              {t("Fazer cotação", "Get a quote")} <ArrowRight className="size-4" />
            </Link>
            <Link href="/painel?perfil=investidor" className="btn btn-ghost btn-lg">
              {t("Aportar no pool", "Provide liquidity")}
            </Link>
          </div>
          <p className="mt-[18px] flex items-center gap-2 text-[13px] text-[var(--muted)]">
            <Smartphone className="size-4" />
            {t("Instale como app no celular (PWA) direto pelo navegador.", "Install it as a phone app (PWA) straight from your browser.")}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-[22px] shadow-[var(--shadow-float)]">
          <p className="mb-3.5 text-[13px] font-semibold text-[var(--muted)]">
            {t("Exemplo · carro FIPE", "Example · car worth")} {fmtMoney(example)} · {t("12 meses", "12 months")}
          </p>
          <div className="flex flex-col gap-2">
            {(["basic", "standard", "premium"] as Tier[]).map((tier) => {
              const q = quote(params, example, tier, 365);
              return (
                <div key={tier} className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--bg)] px-4 py-3.5">
                  <div>
                    <p className="text-base font-semibold">{tierLabel(tier, lang)}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{tierDesc(tier, lang)}</p>
                  </div>
                  <div className="flex-none text-right">
                    <p className="num text-base font-bold">
                      {fmtMoney(q.monthlyEquivalent)}/{t("mês", "mo")}
                    </p>
                    <p className="num mt-0.5 text-xs text-[var(--accent)]">
                      {t("até", "up to")} {fmtMoney(q.cashback)} {t("de volta", "back")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {pool && (
        <section className="-mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [t("Capital no pool", "Pool capital"), fmtMoney(pool.vaultBalance)],
            [t("Apólices ativas", "Active policies"), String(pool.activePolicies)],
            [t("Sinistros pagos", "Claims paid"), fmtMoney(pool.totalClaimsPaid)],
            [t("Cashback devolvido", "Cashback returned"), fmtMoney(pool.totalCashbackPaid)],
          ].map(([label, value]) => (
            <div key={label} className="card p-[18px]">
              <p className="text-xs text-[var(--muted)]">{label}</p>
              <p className="num mt-1 text-[22px] font-bold tracking-tight">{value}</p>
            </div>
          ))}
        </section>
      )}

      <section id="como-funciona" className="flex scroll-mt-20 flex-col gap-7">
        <h2 className="text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.03em]">{t("Como funciona", "How it works")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-col gap-3.5 rounded-[20px] bg-white p-[22px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <s.icon className="size-5" />
                </span>
                <span className="num text-[13px] font-bold text-[var(--faint)]">0{i + 1}</span>
              </div>
              <div>
                <h3 className="text-[17px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)] [text-wrap:pretty]">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="perfis" className="flex scroll-mt-20 flex-col gap-7">
        <div>
          <h2 className="text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.03em]">{t("Escolha como participar", "Choose how to take part")}</h2>
          <p className="mt-2 text-[17px] text-[var(--muted)]">{t("Cada perfil tem seu próprio painel no app.", "Each profile has its own dashboard in the app.")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_KEYS.map((k) => {
            const R = ROLES[k];
            const tone = TONE[R.tone];
            const p = profiles[k];
            return (
              <Link
                key={k}
                href={`/painel?perfil=${k}`}
                className="flex flex-col gap-3.5 rounded-[20px] bg-white p-[22px] text-[var(--fg)] shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:text-[var(--fg)] hover:shadow-[0_0_0_1px_rgba(15,159,117,0.35),0_10px_30px_rgba(15,60,45,0.08)]"
              >
                <span className="grid size-11 place-items-center rounded-[13px]" style={{ background: tone.bg, color: tone.fg }}>
                  <R.icon className="size-5" />
                </span>
                <div className="flex-1">
                  <h3 className="text-[17px] font-semibold">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)] [text-wrap:pretty]">{p.text}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]">
                  {p.cta} <ChevronRight className="size-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section
        id="transparencia"
        className="grid scroll-mt-20 items-center gap-8 rounded-[28px] bg-[linear-gradient(160deg,#e6f6ef_0%,#f4fbf8_100%)] p-[clamp(28px,5vw,56px)] shadow-[0_0_0_0.5px_rgba(15,159,117,0.18)] lg:grid-cols-2"
      >
        <div>
          <h2 className="text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.03em]">{t("Transparência total", "Full transparency")}</h2>
          <p className="mt-3 text-[17px] leading-relaxed text-[var(--fg-soft)] [text-wrap:pretty]">
            {t(
              "Preço, franquia (5% da FIPE para danos parciais), regras de cobertura e cada voto ficam registrados on-chain e podem ser auditados por qualquer pessoa.",
              "Pricing, the deductible (5% of the FIPE value for partial damage), coverage rules and every vote are recorded on-chain and can be audited by anyone.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TECH.map((tech) => (
            <span key={tech} className="rounded-full bg-white px-3.5 py-2 text-sm font-medium shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)]">
              {tech === "Tabela FIPE" ? t("Tabela FIPE", "FIPE price table") : tech}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
