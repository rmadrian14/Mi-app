import type { ReactNode } from "react";
import type { Macros } from "@/lib/nutrition";

export const inputCls =
  "w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-slate-600">{hint}</span>}
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={"rounded-2xl border border-slate-800 bg-slate-900/60 p-5 " + className}>{children}</section>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">{children}</p>;
}

export function ChoiceCard({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-xl border p-3 text-left transition " +
        (active
          ? "border-emerald-500 bg-emerald-500/10"
          : "border-slate-800 bg-slate-950 hover:border-slate-600")
      }
    >
      <span className={"block text-sm font-semibold " + (active ? "text-emerald-300" : "text-white")}>{title}</span>
      {detail && <span className="mt-0.5 block text-xs text-slate-500">{detail}</span>}
    </button>
  );
}

export function fmt(n: number, decimales = 0): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

export function MacroPills({ m, className = "" }: { m: Macros; className?: string }) {
  return (
    <span className={"text-[11px] text-slate-400 " + className}>
      <span className="font-semibold text-slate-200">{fmt(m.kcal)} kcal</span> · P {fmt(m.proteina)} · G {fmt(m.grasa)} · H{" "}
      {fmt(m.hidratos)}
    </span>
  );
}

// Barra de avance respecto al objetivo: verde dentro de ±5 %, ámbar hasta ±15 %.
export function colorDesviacion(valor: number, objetivo: number): "ok" | "aviso" | "mal" {
  if (objetivo <= 0) return "ok";
  const d = Math.abs(valor - objetivo) / objetivo;
  if (d <= 0.05) return "ok";
  if (d <= 0.15) return "aviso";
  return "mal";
}

const COLOR_BARRA = { ok: "bg-emerald-500", aviso: "bg-amber-400", mal: "bg-rose-500" } as const;
const COLOR_TEXTO = { ok: "text-emerald-400", aviso: "text-amber-300", mal: "text-rose-400" } as const;

export function MacroBar({
  label,
  valor,
  objetivo,
  unidad,
}: {
  label: string;
  valor: number;
  objetivo: number;
  unidad: string;
}) {
  const estado = colorDesviacion(valor, objetivo);
  const pct = objetivo > 0 ? Math.min(100, (valor / objetivo) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className={COLOR_TEXTO[estado]}>
          {fmt(valor)} / {fmt(objetivo)} {unidad}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div className={"h-full rounded-full transition-all " + COLOR_BARRA[estado]} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Aviso({ children, tono = "ambar" }: { children: ReactNode; tono?: "ambar" | "rojo" | "gris" }) {
  const cls = {
    ambar: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    rojo: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    gris: "border-slate-800 bg-slate-950/60 text-slate-400",
  }[tono];
  return <div className={"rounded-lg border px-3 py-2 text-xs " + cls}>{children}</div>;
}
