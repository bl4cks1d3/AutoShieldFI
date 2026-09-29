"use client";

import { LANGS, useI18n } from "@/lib/i18n";

/** Controle segmentado PT-BR / EN. */
export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={`flex rounded-[9px] bg-[rgba(118,118,128,0.12)] p-0.5 ${className}`} role="group" aria-label={t("Idioma", "Language")}>
      {LANGS.map((l) => (
        <button
          key={l.key}
          onClick={() => setLang(l.key)}
          title={l.label}
          aria-pressed={lang === l.key}
          className={`h-7 flex-1 whitespace-nowrap rounded-[7px] px-2.5 text-[13px] font-semibold transition ${
            lang === l.key ? "bg-white text-[var(--fg)] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0_0.5px_rgba(0,0,0,0.04)]" : "text-[var(--muted)]"
          }`}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
