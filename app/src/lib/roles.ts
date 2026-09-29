// Perfis do painel e o menu de cada um. Cada item aponta para uma tela existente.

import {
  Car,
  ClipboardCheck,
  FileWarning,
  Landmark,
  LayoutGrid,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type Role = "motorista" | "investidor" | "avaliador" | "governanca";

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral";

export interface NavItem {
  href: string;
  pt: string;
  en: string;
  icon: LucideIcon;
}

export interface RoleDef {
  pt: string;
  en: string;
  icon: LucideIcon;
  tone: Tone;
  nav: NavItem[];
}

const HOME: NavItem = { href: "/painel", pt: "Início", en: "Home", icon: LayoutGrid };

export const ROLES: Record<Role, RoleDef> = {
  motorista: {
    pt: "Motorista",
    en: "Driver",
    icon: Car,
    tone: "ok",
    nav: [
      HOME,
      { href: "/cotar", pt: "Contratar", en: "Get covered", icon: Car },
      { href: "/apolices", pt: "Minhas apólices", en: "My policies", icon: ShieldCheck },
      { href: "/sinistros", pt: "Sinistros", en: "Claims", icon: FileWarning },
    ],
  },
  investidor: {
    pt: "Investidor",
    en: "Investor",
    icon: Landmark,
    tone: "info",
    nav: [HOME, { href: "/pool", pt: "Pool & Staking", en: "Pool & Staking", icon: Landmark }],
  },
  avaliador: {
    pt: "Avaliador",
    en: "Assessor",
    icon: ClipboardCheck,
    tone: "warn",
    nav: [HOME, { href: "/avaliacao", pt: "Vistorias e sinistros", en: "Inspections & claims", icon: ClipboardCheck }],
  },
  governanca: {
    pt: "Governança",
    en: "Governance",
    icon: Scale,
    tone: "neutral",
    nav: [HOME, { href: "/admin", pt: "Parâmetros e comitê", en: "Parameters & committee", icon: Scale }],
  },
};

export const ROLE_KEYS = Object.keys(ROLES) as Role[];

export function isRole(v: string | null | undefined): v is Role {
  return !!v && v in ROLES;
}

/** Perfil dono de uma rota (para trocar de perfil ao navegar direto para ela). */
export function roleForPath(path: string): Role | null {
  for (const k of ROLE_KEYS) {
    if (ROLES[k].nav.some((n) => n.href !== "/painel" && path.startsWith(n.href))) return k;
  }
  return null;
}

export const TONE: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: "var(--ok-soft)", fg: "var(--ok)" },
  warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  bad: { bg: "var(--bad-soft)", fg: "var(--bad)" },
  info: { bg: "var(--info-soft)", fg: "var(--info)" },
  neutral: { bg: "var(--bg-soft)", fg: "var(--fg-soft)" },
};
