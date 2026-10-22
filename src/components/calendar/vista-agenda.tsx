import { CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { diasDeRango, diasQueOcupa, etiquetaDia, fechaConDia, fechaDe, horaDe, rangoHoras, type Fecha, type Ocurrencia } from "@/lib/calendar";
import { anclajeDe, CasillaTarea, type Anclaje } from "./chips";
import { COLOR_UI } from "./estilos";

// Lista de lo que viene, día a día (solo los días con algo).
export function VistaAgenda({
  desde, hasta, hoy, ocs, seleccionClave, onAbrir, onAlternarHecho, onMas, onCrear,
}: {
  desde: Fecha;
  hasta: Fecha;
  hoy: Fecha;
  ocs: Ocurrencia[];
  seleccionClave: string | null;
  onAbrir: (oc: Ocurrencia, anclaje: Anclaje) => void;
  onAlternarHecho: (oc: Ocurrencia) => void;
  onMas: () => void;
  onCrear: () => void;
}) {
  const grupos = diasDeRango(desde, hasta)
    .map((f) => ({ f, items: ocs.filter((o) => diasQueOcupa(o).includes(f)) }))
    .filter((g) => g.items.length > 0);

  if (grupos.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <CalendarOff className="h-10 w-10 text-slate-600" />
        <p className="text-sm text-slate-400">No hay nada en los próximos {Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000)} días.</p>
        <div className="flex gap-2">
          <button type="button" onClick={onCrear} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-400">
            Crear un evento
          </button>
          <button type="button" onClick={onMas} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:text-white">
            Buscar más adelante
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-2 pb-8 sm:px-4">
      {grupos.map(({ f, items }) => (
        <section key={f} className="flex gap-3 border-b border-slate-800/70 py-3 sm:gap-6">
          <div className="w-14 shrink-0 text-center sm:w-24 sm:text-left">
            <div className={cn("text-2xl font-semibold leading-none sm:text-3xl", f === hoy ? "text-emerald-400" : "text-slate-200")}>{+f.slice(8, 10)}</div>
            <div className={cn("mt-1 text-[11px] font-semibold uppercase tracking-wider", f === hoy ? "text-emerald-400" : "text-slate-500")}>{etiquetaDia(f, hoy)}</div>
            <div className="hidden text-[11px] text-slate-600 sm:block">{fechaConDia(f).split(",")[1]?.trim()}</div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1">
            {items.map((o) => {
              const ui = COLOR_UI[o.color];
              const esTarea = o.tipo === "tarea";
              return (
                <li key={o.clave + f}>
                  <button
                    type="button"
                    onClick={(e) => onAbrir(o, anclajeDe(e.currentTarget))}
                    className={cn("flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-800/70", seleccionClave === o.clave && "bg-slate-800")}
                  >
                    {esTarea ? (
                      <CasillaTarea
                        hecho={o.hecho}
                        color={o.color}
                        onClick={
                          o.soloLectura
                            ? undefined
                            : (e) => {
                                e.stopPropagation();
                                onAlternarHecho(o);
                              }
                        }
                      />
                    ) : (
                      <span className={cn("h-3 w-3 shrink-0 rounded-full", ui.punto)} />
                    )}
                    <span className="w-24 shrink-0 text-xs text-slate-400 sm:w-32">
                      {o.todoElDia ? "Todo el día" : fechaDe(o.inicio) !== f ? `hasta ${horaDe(o.fin)}` : rangoHoras(o)}
                    </span>
                    <span className={cn("truncate text-sm font-medium text-slate-100", esTarea && o.hecho && "text-slate-500 line-through")}>{o.titulo}</span>
                    {o.evento.ubicacion && <span className="ml-auto hidden truncate text-xs text-slate-500 md:block">{o.evento.ubicacion}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className="pt-4 text-center">
        <button type="button" onClick={onMas} className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white">
          Ver 30 días más
        </button>
      </div>
    </div>
  );
}

