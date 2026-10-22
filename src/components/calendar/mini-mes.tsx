import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { cuadriculaMes, inicioMes, MESES, sumarMeses, type Fecha } from "@/lib/calendar";

// Mes pequeño para saltar a cualquier día. Resalta lo que se está viendo (día o semana).
export function MiniMes({ fecha, hoy, desde, hasta, onElegir }: { fecha: Fecha; hoy: Fecha; desde: Fecha; hasta: Fecha; onElegir: (f: Fecha) => void }) {
  const [mes, setMes] = useState(inicioMes(fecha));
  useEffect(() => setMes(inicioMes(fecha)), [fecha]);
  const filas = cuadriculaMes(mes);
  const titulo = `${MESES[+mes.slice(5, 7) - 1]} de ${mes.slice(0, 4)}`;
  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold capitalize text-white">{titulo}</span>
        <div className="flex">
          <button type="button" aria-label="Mes anterior" onClick={() => setMes(sumarMeses(mes, -1))} className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-800 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Mes siguiente" onClick={() => setMes(sumarMeses(mes, 1))} className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-800 hover:text-white">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-slate-500">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <div key={d} className="pb-1">
            {d}
          </div>
        ))}
      </div>
      {filas.map((semana) => (
        <div key={semana[0]} className="grid grid-cols-7">
          {semana.map((f) => {
            const enRango = f >= desde && f < hasta;
            const esHoy = f === hoy;
            return (
              <button
                key={f}
                type="button"
                onClick={() => onElegir(f)}
                className={cn(
                  "my-px grid h-7 place-items-center text-[11.5px] transition",
                  enRango && "bg-slate-800",
                  f === desde && "rounded-l-full",
                  f === (desde < hasta ? hasta : desde) && "rounded-r-full",
                  f.slice(0, 7) !== mes.slice(0, 7) ? "text-slate-600" : "text-slate-200",
                  esHoy && "font-bold",
                )}
              >
                <span className={cn("grid h-6 w-6 place-items-center rounded-full", esHoy ? "bg-emerald-500 text-white" : "hover:bg-slate-700")}>{+f.slice(8, 10)}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
