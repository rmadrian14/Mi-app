import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { moverInicio, type BorradorEvento } from "@/lib/calendar-form";
import { diasEntre, sumarDias, type Fecha } from "@/lib/calendar";
import { inputCls } from "./estilos";

// Evento | Tarea
export function SelectorTipo({ tipo, onCambiar }: { tipo: BorradorEvento["tipo"]; onCambiar: (t: BorradorEvento["tipo"]) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5" role="tablist">
      {(["evento", "tarea"] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={tipo === t}
          onClick={() => onCambiar(t)}
          className={cn("rounded-md px-3 py-1 text-xs font-semibold transition", tipo === t ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white")}
        >
          {t === "evento" ? "Evento" : "Tarea"}
        </button>
      ))}
    </div>
  );
}

// Fecha y hora: lo mismo que en Google. Evento: día · hora – hora (y día final si dura más de un día);
// todo el día: día – día; tarea: día y, si se quiere, hora.
export function FilaFechas({ b, onCambiar, compacta = false }: { b: BorradorEvento; onCambiar: (b: BorradorEvento) => void; compacta?: boolean }) {
  const esTarea = b.tipo === "tarea";
  const conHoras = esTarea ? b.conHora : !b.todoElDia;
  const variasFechas = b.fechaFin !== b.fechaIni;
  const campo = cn(inputCls, "py-1.5");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" aria-label="Día" value={b.fechaIni} onChange={(e) => onCambiar(moverInicio(b, e.target.value, b.horaIni))} className={cn(campo, "w-[10rem] flex-none")} />
        {conHoras && (
          <input type="time" step={900} aria-label="Hora de inicio" value={b.horaIni} onChange={(e) => onCambiar(moverInicio(b, b.fechaIni, e.target.value))} className={cn(campo, "w-[7rem] flex-none")} />
        )}
        {!esTarea && conHoras && (
          <>
            <span className="text-slate-500">–</span>
            <input type="time" step={900} aria-label="Hora de fin" value={b.horaFin} onChange={(e) => onCambiar({ ...b, horaFin: e.target.value })} className={cn(campo, "w-[7rem] flex-none")} />
            {variasFechas && (
              <input type="date" aria-label="Día de fin" value={b.fechaFin} min={b.fechaIni} onChange={(e) => onCambiar({ ...b, fechaFin: e.target.value })} className={cn(campo, "w-[10rem] flex-none")} />
            )}
          </>
        )}
        {!esTarea && !conHoras && (
          <>
            <span className="text-slate-500">–</span>
            <input type="date" aria-label="Último día" value={b.fechaFin} min={b.fechaIni} onChange={(e) => onCambiar({ ...b, fechaFin: e.target.value })} className={cn(campo, "w-[10rem] flex-none")} />
          </>
        )}
      </div>
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400", compacta && "text-[11.5px]")}>
        {!esTarea ? (
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={b.todoElDia} onChange={(e) => onCambiar({ ...b, todoElDia: e.target.checked, fechaFin: e.target.checked ? sumarDias(b.fechaIni, Math.max(0, diasEntre(b.fechaIni, b.fechaFin))) : b.fechaFin })} className="h-4 w-4 accent-emerald-500" />
            Todo el día
          </label>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={b.conHora} onChange={(e) => onCambiar({ ...b, conHora: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
            Con hora
          </label>
        )}
        {!esTarea && conHoras && !variasFechas && (
          <button type="button" onClick={() => onCambiar({ ...b, fechaFin: sumarDias(b.fechaIni, 1) })} className="font-semibold text-slate-500 hover:text-emerald-400">
            + Otro día de fin
          </button>
        )}
      </div>
    </div>
  );
}

// «Se entiende: Mañana, 23 oct · 10:30», con un botón para no interpretar la frase.
export function FraseEntendida({ piezas, onIgnorar }: { piezas: string[]; onIgnorar: () => void }) {
  if (piezas.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs" aria-live="polite">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
      <span className="text-slate-500">Se entiende:</span>
      {piezas.map((p) => (
        <span key={p} className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-200">
          {p}
        </span>
      ))}
      <button type="button" onClick={onIgnorar} aria-label="No interpretar la frase" title="Dejar la frase tal cual" className="grid h-5 w-5 place-items-center rounded-full text-slate-500 hover:bg-slate-800 hover:text-white">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export const fechaValida = (f: Fecha) => /^\d{4}-\d{2}-\d{2}$/.test(f);
