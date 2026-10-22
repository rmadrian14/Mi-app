import type { ColorKey } from "@/lib/calendar";

// Clases completas (Tailwind solo genera las que ve escritas enteras).
export const COLOR_UI: Record<ColorKey, { etiqueta: string; punto: string; solido: string; suave: string; texto: string; anillo: string }> = {
  azul: { etiqueta: "Azul", punto: "bg-sky-500", solido: "bg-sky-600 hover:bg-sky-500 text-white", suave: "bg-sky-500/15 hover:bg-sky-500/25 text-sky-100", texto: "text-sky-300", anillo: "ring-sky-400" },
  esmeralda: { etiqueta: "Verde", punto: "bg-emerald-500", solido: "bg-emerald-600 hover:bg-emerald-500 text-white", suave: "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-100", texto: "text-emerald-300", anillo: "ring-emerald-400" },
  rojo: { etiqueta: "Rojo", punto: "bg-rose-500", solido: "bg-rose-600 hover:bg-rose-500 text-white", suave: "bg-rose-500/15 hover:bg-rose-500/25 text-rose-100", texto: "text-rose-300", anillo: "ring-rose-400" },
  ambar: { etiqueta: "Ámbar", punto: "bg-amber-500", solido: "bg-amber-600 hover:bg-amber-500 text-white", suave: "bg-amber-500/15 hover:bg-amber-500/25 text-amber-100", texto: "text-amber-300", anillo: "ring-amber-400" },
  violeta: { etiqueta: "Violeta", punto: "bg-violet-500", solido: "bg-violet-600 hover:bg-violet-500 text-white", suave: "bg-violet-500/15 hover:bg-violet-500/25 text-violet-100", texto: "text-violet-300", anillo: "ring-violet-400" },
  rosa: { etiqueta: "Rosa", punto: "bg-pink-500", solido: "bg-pink-600 hover:bg-pink-500 text-white", suave: "bg-pink-500/15 hover:bg-pink-500/25 text-pink-100", texto: "text-pink-300", anillo: "ring-pink-400" },
  cian: { etiqueta: "Cian", punto: "bg-cyan-500", solido: "bg-cyan-700 hover:bg-cyan-600 text-white", suave: "bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-100", texto: "text-cyan-300", anillo: "ring-cyan-400" },
  gris: { etiqueta: "Gris", punto: "bg-slate-400", solido: "bg-slate-600 hover:bg-slate-500 text-white", suave: "bg-slate-500/20 hover:bg-slate-500/30 text-slate-100", texto: "text-slate-300", anillo: "ring-slate-300" },
};

export const HORA_PX = 48; // alto de una hora en las vistas de día y semana
export const PASO_MIN = 15; // los eventos se ajustan a cuartos de hora al crearlos o moverlos

export const inputCls =
  "w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 [color-scheme:dark]";
export const btnPrimario =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-indigo-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-60";
export const btnSecundario =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-60";
export const btnIcono = "grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-slate-800 hover:text-white";
