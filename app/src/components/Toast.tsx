"use client";

import { CheckCircle2, ExternalLink, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { explorerTx } from "@/lib/config";
import { useI18n } from "@/lib/i18n";

interface Toast {
  id: number;
  kind: "success" | "error";
  title: string;
  body?: string;
  sig?: string;
}

const Ctx = createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { t: tt } = useI18n();

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => dismiss(id), t.kind === "error" ? 9000 : 6000);
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 sm:w-96" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="card flex items-start gap-3 p-4 shadow-lg animate-[fadein_.2s_ease-out]"
            role={t.kind === "error" ? "alert" : "status"}
            data-toast={t.kind}
          >
            {t.kind === "success" ? (
              <CheckCircle2 className="size-5 shrink-0 text-[var(--ok)]" />
            ) : (
              <XCircle className="size-5 shrink-0 text-[var(--bad)]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.title}</p>
              {t.body && <p className="text-sm text-[var(--muted)] break-words">{t.body}</p>}
              {t.sig && !t.sig.startsWith("demo-") && (
                <a
                  href={explorerTx(t.sig)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
                >
                  {tt("Ver no Explorer", "View on Explorer")} <ExternalLink className="size-3" />
                </a>
              )}
              {t.sig?.startsWith("demo-") && (
                <p className="mt-1 text-xs text-[var(--muted)]">{tt("Simulação local", "Local simulation")} · {t.sig}</p>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-[var(--muted)] hover:text-[var(--fg)]" aria-label={tt("Fechar", "Close")}>
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToastCtx() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToastCtx fora do ToastProvider");
  return c;
}
