"use client";

import { ArrowRight, BadgeCheck, Car, Coins, FileCheck2, Landmark, ShieldCheck, Smartphone, Users } from "lucide-react";
import Link from "next/link";
import { useData } from "@/components/Providers";
import { fmtMoney, TIER_DESC, TIER_LABEL } from "@/lib/format";
import { quote, UNIT } from "@/lib/pricing";
import type { Tier } from "@/lib/types";

const STEPS = [
  {
    icon: Car,
    title: "Cote em segundos",
    text: "Informe seu veículo (tabela FIPE), escolha o plano e a vigência. O prêmio é calculado por uma fórmula pública, on-chain.",
  },
  {
    icon: ShieldCheck,
    title: "Contrate com sua carteira",
    text: "O pagamento vai para o cofre do pool de risco e a apólice vira uma conta na Solana. Um avaliador faz a vistoria; se recusar, o prêmio volta inteiro.",
  },
  {
    icon: FileCheck2,
    title: "Sinistro 100% digital",
    text: "Registre o ocorrido com fotos e descrição. Avaliadores independentes votam on-chain e o pagamento sai do cofre automaticamente.",
  },
  {
    icon: Coins,
    title: "Não usou? Receba de volta",
    text: "Ao fim da vigência sem sinistro, 20% do prêmio volta para você em cashback — e quem aporta capital no pool é remunerado pelos prêmios.",
  },
];

export default function Home() {
  const { data: pool } = useData((c) => c.getPool());
  const params = pool?.params ?? { baseRateBps: 350, cashbackBps: 2000 };
  const example = 60_000 * UNIT;

  return (
    <div className="flex flex-col gap-16">
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <span className="chip bg-[var(--accent-soft)] text-[var(--accent)]">
            <BadgeCheck className="size-3.5" /> Construído na Solana
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Proteção veicular <span className="text-[var(--accent)]">acessível, transparente</span> e que devolve
            quando você não usa.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-[var(--muted)]">
            Só cerca de 30% da frota brasileira tem seguro. O AutoShieldFI usa um pool de risco mutualista em smart
            contracts para reduzir custos, automatizar sinistros e premiar bons motoristas.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/cotar" className="btn btn-primary">
              Fazer cotação <ArrowRight className="size-4" />
            </Link>
            <Link href="/pool" className="btn btn-ghost">
              Aportar no pool
            </Link>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]">
            <Smartphone className="size-4" /> Instale como app no celular (PWA) direto pelo navegador.
          </p>
        </div>

        <div className="card p-6">
          <p className="text-sm font-semibold text-[var(--muted)]">Exemplo · carro FIPE {fmtMoney(example)} · 12 meses</p>
          <div className="mt-4 flex flex-col gap-3">
            {(["basic", "standard", "premium"] as Tier[]).map((t) => {
              const q = quote(params, example, t, 365);
              return (
                <div key={t} className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3">
                  <div>
                    <p className="font-semibold">{TIER_LABEL[t]}</p>
                    <p className="text-xs text-[var(--muted)]">{TIER_DESC[t]}</p>
                  </div>
                  <div className="text-right">
                    <p className="num font-bold">{fmtMoney(q.monthlyEquivalent)}/mês</p>
                    <p className="num text-xs text-[var(--ok)]">até {fmtMoney(q.cashback)} de volta</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {pool && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">Capital no pool</p>
            <p className="num mt-1 text-xl font-bold">{fmtMoney(pool.vaultBalance)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">Apólices ativas</p>
            <p className="num mt-1 text-xl font-bold">{pool.activePolicies}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">Sinistros pagos</p>
            <p className="num mt-1 text-xl font-bold">{fmtMoney(pool.totalClaimsPaid)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">Cashback devolvido</p>
            <p className="num mt-1 text-xl font-bold">{fmtMoney(pool.totalCashbackPaid)}</p>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-2xl font-bold tracking-tight">Como funciona</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <s.icon className="size-5" />
                </span>
                <span className="text-sm font-bold text-[var(--muted)]">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-6">
          <Users className="size-6 text-[var(--accent)]" />
          <h3 className="mt-3 font-semibold">Para motoristas</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Preço justo, sem letras miúdas: regras de cobertura, franquia (5% da FIPE para danos parciais) e cashback
            estão no código do contrato.
          </p>
        </div>
        <div className="card p-6">
          <Landmark className="size-6 text-[var(--accent)]" />
          <h3 className="mt-3 font-semibold">Para provedores de liquidez</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Aporte stablecoin no pool, receba cotas e ganhe com os prêmios. Um colateral mínimo on-chain protege a
            solvência de todas as apólices.
          </p>
        </div>
        <div className="card p-6">
          <FileCheck2 className="size-6 text-[var(--accent)]" />
          <h3 className="mt-3 font-semibold">Para avaliadores</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Comitê de avaliadores com quórum configurável decide cada sinistro. Todo voto fica registrado on-chain.
          </p>
        </div>
      </section>
    </div>
  );
}
