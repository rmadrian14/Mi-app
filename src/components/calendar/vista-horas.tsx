import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ajustarMinutos,
  barrasDeSemana,
  colocarSolapes,
  DIAS_CORTOS,
  diasQueOcupa,
  minutosDelDia,
  rangoHoras,
  segmentoDelDia,
  sumarMinutos,
  vaEnFranjaDelDia,
  type Fecha,
  type FechaHora,
  type Ocurrencia,
} from "@/lib/calendar";
import { anclajeDe, CasillaTarea, ChipFila, type Anclaje } from "./chips";
import { COLOR_UI, HORA_PX, PASO_MIN } from "./estilos";

type Props = {
  dias: Fecha[]; // 1 (día) o 7 (semana)
  hoy: Fecha;
  ahora: FechaHora;
  ocs: Ocurrencia[];
  seleccionClave: string | null;
  onCrearRango: (fecha: Fecha, iniMin: number, finMin: number, anclaje: Anclaje) => void;
  onCrearTodoElDia: (fecha: Fecha, anclaje: Anclaje) => void;
  onAbrir: (oc: Ocurrencia, anclaje: Anclaje) => void;
  onMover: (oc: Ocurrencia, nuevoInicio: FechaHora, nuevoFin: FechaHora) => void;
  onIrADia: (f: Fecha) => void;
  onAlternarHecho: (oc: Ocurrencia) => void;
};

const limitar = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const horasDelDia = Array.from({ length: 24 }, (_, h) => h);

type Arrastre = { clave: string; modo: "mover" | "cambiar"; dDias: number; dMin: number };
type Seleccion = { fecha: Fecha; ini: number; fin: number };

export function VistaHoras({ dias, hoy, ahora, ocs, seleccionClave, onCrearRango, onCrearTodoElDia, onAbrir, onMover, onIrADia, onAlternarHecho }: Props) {
  const desplazamiento = useRef<HTMLDivElement>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [sel, setSel] = useState<Seleccion | null>(null);
  const ultimoPuntero = useRef<string>("mouse");
  const n = dias.length;

  // Al abrir o cambiar de semana, se baja a las horas con actividad (o a las 7 si no es hoy).
  useEffect(() => {
    const el = desplazamiento.current;
    if (!el) return;
    const h = dias.includes(hoy) ? Math.max(0, +ahora.slice(11, 13) - 2) : 7;
    el.scrollTop = h * HORA_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias[0], n]);

  const franja = useMemo(() => ocs.filter(vaEnFranjaDelDia), [ocs]);
  const conHora = useMemo(() => ocs.filter((o) => !vaEnFranjaDelDia(o)), [ocs]);
  const { barras } = useMemo(() => barrasDeSemana(franja, dias), [franja, dias]);
  const filasFranja = barras.reduce((m, b) => Math.max(m, b.fila + 1), 0);

  const columnas = useMemo(
    () =>
      dias.map((f) => {
        const items = conHora
          .filter((o) => diasQueOcupa(o).includes(f))
          .map((oc) => ({ oc, ...segmentoDelDia(oc, f) }));
        return colocarSolapes(items);
      }),
    [conHora, dias],
  );

  /* ---- Crear arrastrando sobre un hueco ---- */
  function bajarColumna(e: React.PointerEvent<HTMLDivElement>, f: Fecha) {
    ultimoPuntero.current = e.pointerType;
    if (e.button !== 0 || e.pointerType === "touch") return;
    if ((e.target as HTMLElement).closest("[data-evento]")) return;
    const col = e.currentTarget;
    const rect = col.getBoundingClientRect();
    const cuarto = (y: number) => limitar(Math.floor(((y - rect.top) / HORA_PX) * (60 / PASO_MIN)) * PASO_MIN, 0, 1440 - PASO_MIN);
    const m0 = cuarto(e.clientY);
    col.setPointerCapture(e.pointerId);
    setSel({ fecha: f, ini: m0, fin: m0 + PASO_MIN });
    let ini = m0;
    let fin = m0 + PASO_MIN;
    let movido = false;
    const mover = (ev: PointerEvent) => {
      const m = cuarto(ev.clientY);
      if (m !== m0) movido = true;
      ini = Math.min(m0, m);
      fin = Math.max(m0, m) + PASO_MIN;
      setSel({ fecha: f, ini, fin });
    };
    const soltar = (ev: PointerEvent) => {
      col.removeEventListener("pointermove", mover);
      col.removeEventListener("pointerup", soltar);
      col.removeEventListener("pointercancel", cancelar);
      setSel(null);
      if (!movido) {
        ini = m0;
        fin = Math.min(m0 + 60, 1440);
      }
      void ev;
      onCrearRango(f, ini, fin, { left: rect.left, right: rect.right, top: rect.top + (ini / 60) * HORA_PX, bottom: rect.top + (fin / 60) * HORA_PX });
    };
    const cancelar = () => {
      col.removeEventListener("pointermove", mover);
      col.removeEventListener("pointerup", soltar);
      col.removeEventListener("pointercancel", cancelar);
      setSel(null);
    };
    col.addEventListener("pointermove", mover);
    col.addEventListener("pointerup", soltar);
    col.addEventListener("pointercancel", cancelar);
  }

  // En pantallas táctiles basta tocar un hueco: evento de una hora a esa hora.
  function tocarColumna(e: React.MouseEvent<HTMLDivElement>, f: Fecha) {
    if (ultimoPuntero.current !== "touch") return;
    if ((e.target as HTMLElement).closest("[data-evento]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const m = limitar(Math.floor(((e.clientY - rect.top) / HORA_PX) * 2) * 30, 0, 1440 - 30);
    onCrearRango(f, m, Math.min(m + 60, 1440), { left: rect.left, right: rect.right, top: e.clientY, bottom: e.clientY });
  }

  /* ---- Mover y cambiar la duración arrastrando un evento ---- */
  function bajarEvento(e: React.PointerEvent<HTMLElement>, oc: Ocurrencia, modo: "mover" | "cambiar") {
    ultimoPuntero.current = e.pointerType;
    if (e.button !== 0 || e.pointerType === "touch" || oc.soloLectura) return;
    e.stopPropagation();
    const el = e.currentTarget;
    const colW = (el.closest("[data-col]") as HTMLElement | null)?.getBoundingClientRect().width ?? 1;
    el.setPointerCapture(e.pointerId);
    const [x0, y0] = [e.clientX, e.clientY];
    let movido = false;
    let dMin = 0;
    let dDias = 0;
    const mover = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!movido && Math.hypot(dx, dy) < 5) return;
      movido = true;
      dMin = ajustarMinutos((dy / HORA_PX) * 60, PASO_MIN);
      dDias = modo === "mover" && n > 1 ? Math.round(dx / colW) : 0;
      setArrastre({ clave: oc.clave, modo, dDias, dMin });
    };
    const limpiar = () => {
      el.removeEventListener("pointermove", mover);
      el.removeEventListener("pointerup", soltar);
      el.removeEventListener("pointercancel", cancelar);
      setArrastre(null);
    };
    const soltar = () => {
      limpiar();
      if (!movido) {
        onAbrir(oc, anclajeDe(el));
        return;
      }
      if (dMin === 0 && dDias === 0) return;
      if (modo === "mover") onMover(oc, sumarMinutos(oc.inicio, dMin + dDias * 1440), sumarMinutos(oc.fin, dMin + dDias * 1440));
      else {
        const fin = sumarMinutos(oc.fin, dMin);
        onMover(oc, oc.inicio, fin <= sumarMinutos(oc.inicio, PASO_MIN - 1) ? sumarMinutos(oc.inicio, PASO_MIN) : fin);
      }
    };
    const cancelar = () => limpiar();
    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", cancelar);
  }

  const minutosAhora = minutosDelDia(ahora);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Cabecera con los días */}
      <div className="flex shrink-0 border-b border-slate-800">
        <div className="w-12 shrink-0 sm:w-14" />
        <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {dias.map((f) => {
            const esHoy = f === hoy;
            const dow = (new Date(f + "T12:00:00Z").getUTCDay() + 6) % 7;
            return (
              <div key={f} className="flex flex-col items-center gap-0.5 border-l border-slate-800 py-1.5 first:border-l-0">
                <span className={cn("text-[10.5px] font-semibold uppercase tracking-wider", esHoy ? "text-emerald-400" : "text-slate-500")}>{DIAS_CORTOS[dow]}</span>
                <button
                  type="button"
                  onClick={() => onIrADia(f)}
                  className={cn("grid h-8 w-8 place-items-center rounded-full text-base font-semibold transition", esHoy ? "bg-emerald-500 text-white" : "text-slate-200 hover:bg-slate-800")}
                >
                  {+f.slice(8, 10)}
                </button>
              </div>
            );
          })}
        </div>
        <div className="w-2 shrink-0" />
      </div>

      {/* Franja de "todo el día" */}
      <div className="flex shrink-0 border-b border-slate-800">
        <div className="flex w-12 shrink-0 items-end justify-end pb-1 pr-1.5 text-[9px] font-semibold uppercase leading-none text-slate-600 sm:w-14">todo el día</div>
        <div className="relative min-w-0 flex-1" style={{ minHeight: Math.max(1, filasFranja) * 24 + 6 }}>
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {dias.map((f) => (
              <div key={f} className="cursor-pointer border-l border-slate-800 first:border-l-0 hover:bg-slate-900/60" onClick={(e) => onCrearTodoElDia(f, anclajeDe(e.currentTarget))} />
            ))}
          </div>
          <div className="pointer-events-none relative grid gap-y-0.5 px-0.5 py-0.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridAutoRows: "22px" }}>
            {barras.map((b) => (
              <div key={`${b.oc.clave}-${b.col}`} className="pointer-events-auto min-w-0" style={{ gridColumn: `${b.col + 1} / span ${b.span}`, gridRow: b.fila + 1 }}>
                <ChipFila oc={b.oc} modo="barra" contIzq={b.contIzq} contDer={b.contDer} seleccionada={seleccionClave === b.oc.clave} onClick={(e) => onAbrir(b.oc, anclajeDe(e.currentTarget))} onAlternarHecho={onAlternarHecho} />
              </div>
            ))}
          </div>
        </div>
        <div className="w-2 shrink-0" />
      </div>

      {/* Horas */}
      <div ref={desplazamiento} className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
        <div className="relative flex" style={{ height: 24 * HORA_PX }}>
          <div className="relative w-12 shrink-0 sm:w-14">
            {horasDelDia.slice(1).map((h) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-slate-500" style={{ top: h * HORA_PX }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          <div className="relative grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {horasDelDia.map((h) => (
              <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-slate-800/80" style={{ top: h * HORA_PX }} />
            ))}
            {dias.map((f, i) => (
              <div
                key={f}
                data-col
                className="relative touch-pan-y border-l border-slate-800 first:border-l-0"
                onPointerDown={(e) => bajarColumna(e, f)}
                onClick={(e) => tocarColumna(e, f)}
              >
                {f === hoy && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: (minutosAhora / 60) * HORA_PX }}>
                    <div className="relative h-0.5 bg-rose-500">
                      <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-rose-500" />
                    </div>
                  </div>
                )}
                {sel && sel.fecha === f && (
                  <div className="pointer-events-none absolute inset-x-0.5 z-10 rounded-md border border-emerald-400 bg-emerald-500/25" style={{ top: (sel.ini / 60) * HORA_PX, height: ((sel.fin - sel.ini) / 60) * HORA_PX }}>
                    <span className="px-1.5 text-[10.5px] font-semibold text-emerald-100">
                      {String(Math.floor(sel.ini / 60)).padStart(2, "0")}:{String(sel.ini % 60).padStart(2, "0")} – {String(Math.floor(sel.fin / 60) % 24).padStart(2, "0")}:{String(sel.fin % 60).padStart(2, "0")}
                    </span>
                  </div>
                )}
                {columnas[i].map((it) => {
                  const oc = it.oc;
                  const ui = COLOR_UI[oc.color];
                  const esTarea = oc.tipo === "tarea";
                  const mov = arrastre && arrastre.clave === oc.clave ? arrastre : null;
                  const alto = Math.max(((it.fin - it.ini) / 60) * HORA_PX - 2, 16);
                  const extraAlto = mov?.modo === "cambiar" ? (mov.dMin / 60) * HORA_PX : 0;
                  const desplazarY = mov?.modo === "mover" ? (mov.dMin / 60) * HORA_PX : 0;
                  const desplazarX = mov?.modo === "mover" ? mov.dDias * 100 : 0;
                  const tachado = esTarea && oc.hecho;
                  return (
                    <div
                      key={oc.clave}
                      data-evento
                      onPointerDown={(e) => bajarEvento(e, oc, "mover")}
                      className={cn(
                        "absolute z-10 select-none overflow-hidden rounded-md border border-slate-950/60 px-1.5 py-0.5 text-left text-[11.5px] leading-tight transition-colors",
                        oc.soloLectura ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
                        esTarea ? ui.suave : ui.solido,
                        tachado && "opacity-60",
                        mov && "z-30 opacity-80 shadow-lg",
                        seleccionClave === oc.clave && cn("ring-2", ui.anillo),
                      )}
                      style={{
                        top: (it.ini / 60) * HORA_PX + 1,
                        height: Math.max(alto + extraAlto, 16),
                        left: `${(it.columna / it.columnas) * 100}%`,
                        width: `calc(${100 / it.columnas}% - 3px)`,
                        transform: `translate(${desplazarX}%, ${desplazarY}px)`,
                      }}
                      title={`${oc.titulo} · ${rangoHoras(oc)}`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onAbrir(oc, anclajeDe(e.currentTarget));
                      }}
                    >
                      <div className="flex items-start gap-1">
                        {esTarea && (
                          <CasillaTarea
                            hecho={oc.hecho}
                            color={oc.color}
                            className="mt-px"
                            onClick={
                              oc.soloLectura
                                ? undefined
                                : (e) => {
                                    e.stopPropagation();
                                    onAlternarHecho(oc);
                                  }
                            }
                          />
                        )}
                        <div className="min-w-0">
                          <div className={cn("truncate font-semibold", tachado && "line-through")}>{oc.titulo}</div>
                          {alto + extraAlto >= 34 && <div className="truncate text-[10.5px] opacity-90">{rangoHoras(oc)}</div>}
                        </div>
                      </div>
                      {!esTarea && !oc.soloLectura && (
                        <div
                          onPointerDown={(e) => bajarEvento(e, oc, "cambiar")}
                          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                          aria-hidden
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
