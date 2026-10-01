"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Check, ChevronsUpDown, FastForward, PanelLeft, RotateCcw, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { advanceDemoTime, resetDemo } from "@/lib/client/demo";
import { CLUSTER_LABEL, DEMO_ENABLED } from "@/lib/config";
import { shortAddr } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { isRole, ROLE_KEYS, roleForPath, ROLES, TONE, type Role } from "@/lib/roles";
import { Footer } from "./Footer";
import { LangSwitch } from "./LangSwitch";
import { LoginButton, PRIVY_ENABLED } from "./PrivyAuth";
import { useApp } from "./Providers";
import { WalletControls } from "./WalletControls";

const ROLE_KEY = "autoshield-role";

const RoleCtx = createContext<{ role: Role; setRole: (r: Role) => void } | null>(null);

export function useRole() {
  const c = useContext(RoleCtx);
  if (!c) throw new Error("useRole fora do AppShell");
  return c;
}

export function RoleIcon({ role, size = 28 }: { role: Role; size?: number }) {
  const R = ROLES[role];
  const tone = TONE[R.tone];
  return (
    <span
      className="grid flex-none place-items-center rounded-lg"
      style={{ width: size, height: size, background: tone.bg, color: tone.fg }}
    >
      <R.icon className="size-4" />
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [role, setRoleState] = useState<Role>("motorista");
  const [open, setOpen] = useState(false);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try {
      window.localStorage.setItem(ROLE_KEY, r);
    } catch {
      /* ignora */
    }
  }, []);

  // Perfil: ?perfil= da landing > rota atual > ultimo escolhido.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("perfil");
    if (isRole(q)) return setRole(q);
    const fromPath = roleForPath(path);
    if (fromPath) return setRole(fromPath);
    try {
      const saved = window.localStorage.getItem(ROLE_KEY);
      if (isRole(saved)) setRoleState(saved);
    } catch {
      /* ignora */
    }
  }, [path, setRole]);

  useEffect(() => setOpen(false), [path, role]);

  return (
    <RoleCtx.Provider value={{ role, setRole }}>
      <div className="flex min-h-dvh">
        {open && <div className="fixed inset-0 z-40 bg-[rgba(15,26,23,0.18)] lg:hidden" onClick={() => setOpen(false)} />}
        <Sidebar open={open} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileBar onMenu={() => setOpen(true)} />
          <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-7 px-4 pb-12 pt-8 sm:px-8 lg:px-10">
            {children}
            <Footer />
          </main>
        </div>
      </div>
    </RoleCtx.Provider>
  );
}

function MobileBar({ onMenu }: { onMenu: () => void }) {
  const { role } = useRole();
  const { lang, t } = useI18n();
  return (
    <div className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b-[0.5px] border-[var(--border)] bg-[rgba(245,247,246,0.8)] px-3 backdrop-blur-xl backdrop-saturate-[1.8] lg:hidden">
      <button onClick={onMenu} aria-label={t("Menu", "Menu")} className="grid size-11 place-items-center text-[var(--accent)]">
        <PanelLeft className="size-[22px]" />
      </button>
      <span className="text-[17px] font-semibold tracking-tight">
        AutoShield<span className="text-[var(--accent)]">FI</span>
      </span>
      <span className="ml-auto text-[13px] text-[var(--muted)]">{lang === "en" ? ROLES[role].en : ROLES[role].pt}</span>
    </div>
  );
}

function Sidebar({ open }: { open: boolean }) {
  const path = usePathname();
  const { role, setRole } = useRole();
  const { lang, t } = useI18n();
  const [menu, setMenu] = useState(false);
  const R = ROLES[role];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[260px] flex-none flex-col border-r-[0.5px] border-[var(--border)] bg-[rgba(236,243,240,0.78)] backdrop-blur-2xl backdrop-saturate-[1.8] transition-transform duration-300 ease-[cubic-bezier(.32,.72,0,1)] lg:sticky lg:top-0 lg:translate-x-0 ${
        open ? "translate-x-0 shadow-[0_10px_40px_rgba(15,26,23,0.18)]" : "-translate-x-[102%]"
      }`}
    >
      <Link href="/" className="flex items-center gap-2.5 px-3.5 pb-3.5 pt-[18px] text-[var(--fg)] hover:text-[var(--fg)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon.svg" alt="" className="size-8 rounded-lg shadow-[0_1px_2px_rgba(11,122,90,0.25)]" />
        <span className="text-[17px] font-bold tracking-tight">
          AutoShield<span className="text-[var(--accent)]">FI</span>
        </span>
      </Link>

      <div className="relative px-2.5 pb-3.5">
        <button
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
          className="flex w-full items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 text-left shadow-[0_0_0_0.5px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]"
        >
          <RoleIcon role={role} />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-[var(--muted)]">{t("Perfil", "Profile")}</span>
            <span className="block text-sm font-semibold text-[var(--fg)]">{lang === "en" ? R.en : R.pt}</span>
          </span>
          <ChevronsUpDown className="size-4 text-[var(--faint)]" />
        </button>
        {menu && (
          <div className="absolute inset-x-2.5 top-[calc(100%-8px)] z-10 rounded-[13px] bg-white/90 p-1.5 shadow-[0_0_0_0.5px_rgba(0,0,0,0.1),0_12px_32px_rgba(15,26,23,0.16)] backdrop-blur-xl">
            {ROLE_KEYS.map((k) => (
              <Link
                key={k}
                href="/painel"
                onClick={() => {
                  setRole(k);
                  setMenu(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-sm font-medium text-[var(--fg)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]"
              >
                <RoleIcon role={k} size={26} />
                <span className="flex-1">{lang === "en" ? ROLES[k].en : ROLES[k].pt}</span>
                {k === role ? <Check className="size-4 text-[var(--accent)]" /> : <span className="w-4" />}
              </Link>
            ))}
          </div>
        )}
      </div>

      <nav className="flex flex-col gap-0.5 px-2.5">
        {R.nav.map((n) => {
          const on = n.href === "/painel" ? path === "/painel" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-sm ${
                on
                  ? "bg-[rgba(15,159,117,0.14)] font-semibold text-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                  : "font-medium text-[var(--fg)] hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--fg)]"
              }`}
            >
              <n.icon className={`size-[18px] ${on ? "text-[var(--accent)]" : "text-[var(--muted)]"}`} />
              {lang === "en" ? n.en : n.pt}
            </Link>
          );
        })}
      </nav>

      <SidebarFooter />
    </aside>
  );
}

function SidebarFooter() {
  const { mode, setMode, client, refresh } = useApp();
  const { wallet: adapter } = useWallet();
  const { t } = useI18n();
  const seg = (on: boolean) =>
    `h-7 flex-1 rounded-[7px] text-[13px] font-semibold transition ${
      on ? "bg-white text-[var(--fg)] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0_0.5px_rgba(0,0,0,0.04)]" : "text-[var(--muted)]"
    }`;

  const source =
    mode === "demo"
      ? t("Simulação local", "Local simulation")
      : `${adapter?.adapter.name ?? (PRIVY_ENABLED ? t("Google / e-mail", "Google / email") : "")} · ${CLUSTER_LABEL}`;

  return (
    <div className="mt-auto flex flex-col gap-3 p-3.5">
      {DEMO_ENABLED ? (
        <div className="flex rounded-[9px] bg-[rgba(118,118,128,0.12)] p-0.5">
          <button onClick={() => setMode("demo")} className={seg(mode === "demo")}>
            Demo
          </button>
          <button onClick={() => setMode("chain")} className={seg(mode === "chain")}>
            {CLUSTER_LABEL}
          </button>
        </div>
      ) : (
        <span className="chip self-start bg-[var(--accent-soft)] text-[var(--accent)]">
          <span className="size-1.5 rounded-full bg-[var(--accent)]" /> {CLUSTER_LABEL}
        </span>
      )}

      {DEMO_ENABLED && mode === "demo" && (
        <div className="flex items-center justify-between gap-2 text-[12px] font-semibold">
          <button
            onClick={() => {
              advanceDemoTime(7 * 86400);
              refresh();
            }}
            className="inline-flex items-center gap-1 text-[var(--fg)]"
            title={t("Avança o relógio da simulação em 7 dias", "Moves the simulation clock forward 7 days")}
          >
            <FastForward className="size-3.5" /> {t("+7 dias", "+7 days")}
          </button>
          <button
            onClick={() => {
              advanceDemoTime(30 * 86400);
              refresh();
            }}
            className="inline-flex items-center gap-1 text-[var(--fg)]"
            title={t("Avança o relógio da simulação em 30 dias", "Moves the simulation clock forward 30 days")}
          >
            <FastForward className="size-3.5" /> {t("+30 dias", "+30 days")}
          </button>
          <button
            onClick={() => {
              if (confirm(t("Apagar todos os dados da demonstração?", "Delete all demo data?"))) {
                resetDemo();
                refresh();
              }
            }}
            className="inline-flex items-center gap-1 text-[var(--bad)]"
          >
            <RotateCcw className="size-3.5" /> {t("Reiniciar", "Reset")}
          </button>
        </div>
      )}

      <LangSwitch />

      <div className="flex flex-col gap-2.5 rounded-xl bg-white p-2.5 shadow-[0_0_0_0.5px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2.5">
          <span className="grid size-[30px] flex-none place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <Wallet className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">
              {client.wallet ? shortAddr(client.wallet) : t("Não conectada", "Not connected")}
            </p>
            <p className="truncate text-[11px] text-[var(--muted)]">
              {client.wallet ? source : t("Conecte para continuar", "Connect to continue")}
            </p>
          </div>
        </div>
        {mode === "chain" && (
          <div className="flex flex-col gap-2 [&_.wallet-adapter-button-trigger]:!w-full [&_.wallet-adapter-button-trigger]:!justify-center">
            {(!client.wallet || adapter) && <WalletControls />}
            {(!client.wallet || !adapter) && <LoginButton className="w-full justify-center" />}
          </div>
        )}
      </div>
    </div>
  );
}

/** Estrutura da landing: barra superior simples, sem menu lateral. */
export function LandingShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b-[0.5px] border-[var(--border)] bg-[rgba(245,247,246,0.8)] backdrop-blur-xl backdrop-saturate-[1.8]">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-6 px-4 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-2 text-[var(--fg)] hover:text-[var(--fg)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon.svg" alt="" className="size-7 rounded-[7px]" />
            <span className="text-[17px] font-bold tracking-tight">
              AutoShield<span className="text-[var(--accent)]">FI</span>
            </span>
          </Link>
          <nav className="hidden gap-5 text-sm md:flex">
            <a href="#como-funciona" className="text-[var(--fg-soft)]">
              {t("Como funciona", "How it works")}
            </a>
            <a href="#perfis" className="text-[var(--fg-soft)]">
              {t("Perfis", "Profiles")}
            </a>
            <a href="#transparencia" className="text-[var(--fg-soft)]">
              {t("Transparência", "Transparency")}
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <LangSwitch className="hidden w-32 sm:flex" />
            <Link href="/painel" className="btn btn-primary !h-8 !px-3.5 !text-[13px]">
              {t("Abrir app", "Open app")}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1120px] flex-col gap-24 px-4 sm:px-8 lg:px-10">{children}</main>
      <div className="mx-auto max-w-[1120px] px-4 pb-10 pt-14 sm:px-8 lg:px-10">
        <Footer />
      </div>
    </div>
  );
}

/** Escolhe a estrutura pela rota: landing em "/", painel com menu lateral no resto. */
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return path === "/" ? <LandingShell>{children}</LandingShell> : <AppShell>{children}</AppShell>;
}
