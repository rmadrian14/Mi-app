import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bell, MapPin, Repeat, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COLORES,
  COLOR_POR_PRIORIDAD,
  DIAS_CORTOS,
  diaSemana,
  fechaDe,
  fechaHoraADate,
  OPCIONES_RECORDATORIO,
  posicionEnMes,
  type FechaHora,
  type Repeticion,
} from "@/lib/calendar";
import { claveDeRepeticion, describirInterpretacion, opcionesRepeticion, type BorradorEvento } from "@/lib/calendar-form";
import { interpretarTexto } from "@/lib/calendar-quick";
import { FilaFechas, FraseEntendida, SelectorTipo } from "./campos";
import { btnPrimario, btnSecundario, btnIcono, COLOR_UI, inputCls } from "./estilos";

const etiquetaCampo = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500";
const ORDINAL: Record<number, string> = { 1: "primer", 2: "segundo", 3: "tercer", 4: "cuarto", [-1]: "último" };
const DIA_LARGO = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export function EventoDialogo({
  borrador, ahora, esNuevo, esSerie, error, ocupado, onCambiar, onGuardar, onBorrar, onCerrar,
}: {
  borrador: BorradorEvento;
  ahora: FechaHora;
  esNuevo: boolean;
  esSerie: boolean;
  error: string | null;
  ocupado: boolean;
  onCambiar: (b: BorradorEvento) => void;
  onGuardar: (interpretar: boolean) => void;
  onBorrar?: () => void;
  onCerrar: () => void;
}) {
  const b = borrador;
  const [interpretar, setInterpretar] = useState(true);
  const [personalizada, setPersonalizada] = useState(() => claveDeRepeticion(b.repeticion, b.fechaIni) === "personalizada");
  const titulo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (esNuevo) titulo.current?.focus();
  }, [esNuevo]);

  const interpretado = useMemo(() => (esNuevo ? interpretarTexto(b.titulo, fechaHoraADate(ahora)) : null), [esNuevo, b.titulo, ahora]);
  const piezas = interpretar && interpretado ? describirInterpretacion(interpretado, fechaDe(ahora)) : [];
  const opciones = opcionesRepeticion(b.fechaIni);
  const clave = personalizada ? "personalizada" : claveDeRepeticion(b.repeticion, b.fechaIni);

  // Si la repetición es de las "de siempre" y cambia el día de inicio, sigue al nuevo día.
  const cambiar = (nuevo: BorradorEvento) => {
    if (nuevo.fechaIni !== b.fechaIni && !personalizada && b.repeticion) {
      const c = claveDeRepeticion(b.repeticion, b.fechaIni);
      const op = opcionesRepeticion(nuevo.fechaIni).find((o) => o.clave === c);
      if (op && c !== "no") nuevo = { ...nuevo, repeticion: op.repeticion };
    }
    onCambiar(nuevo);
  };

  const elegirRepeticion = (valor: string) => {
    if (valor === "personalizada") {
      setPersonalizada(true);
      if (!b.repeticion) onCambiar({ ...b, repeticion: { frecuencia: "semanal", intervalo: 1, dias: [diaSemana(b.fechaIni)] } });
      return;
    }
    setPersonalizada(false);
    onCambiar({ ...b, repeticion: opciones.find((o) => o.clave === valor)?.repeticion ?? null });
  };

  return (
    <Dialog.Root open onOpenChange={(abre) => !abre && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            if (!esNuevo) e.preventDefault();
          }}
          className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-100 shadow-2xl outline-none"
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-white">
              {esNuevo ? (b.tipo === "tarea" ? "Nueva tarea" : "Nuevo evento") : b.tipo === "tarea" ? "Editar tarea" : "Editar evento"}
            </Dialog.Title>
            <Dialog.Close className={btnIcono} aria-label="Cerrar">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              onGuardar(interpretar);
            }}
          >
            <div>
              <input
                ref={titulo}
                value={b.titulo}
                onChange={(e) => cambiar({ ...b, titulo: e.target.value })}
                placeholder={esNuevo ? "Añade un título o escribe «Dentista mañana 10:30»" : "Título"}
                aria-label="Título"
                maxLength={200}
                className={inputCls + " border-0 border-b-2 border-slate-700 bg-transparent px-0 text-xl focus:ring-0"}
              />
              {esNuevo && (
                <div className="mt-2">
                  <FraseEntendida piezas={piezas} onIgnorar={() => setInterpretar(false)} />
                </div>
              )}
            </div>

            <SelectorTipo tipo={b.tipo} onCambiar={(tipo) => cambiar({ ...b, tipo, color: tipo === "tarea" && b.color === "azul" ? "esmeralda" : tipo === "evento" && b.color === "esmeralda" ? "azul" : b.color })} />
            <FilaFechas b={b} onCambiar={cambiar} />

            {/* Repetición */}
            <div>
              <label className={etiquetaCampo} htmlFor="rep">
                <Repeat className="mr-1 inline h-3 w-3" /> Repetir
              </label>
              <select id="rep" value={clave} onChange={(e) => elegirRepeticion(e.target.value)} className={inputCls}>
                {opciones.map((o) => (
                  <option key={o.clave} value={o.clave}>
                    {o.etiqueta}
                  </option>
                ))}
                <option value="personalizada">Personalizada…</option>
              </select>
              {esSerie && !esNuevo && <p className="mt-1 text-[11px] text-slate-500">Esto es parte de una serie: al guardar te preguntaré si el cambio es solo para este o para más.</p>}
              {personalizada && b.repeticion && <EditorRepeticion rep={b.repeticion} fechaIni={b.fechaIni} onCambiar={(repeticion) => onCambiar({ ...b, repeticion })} />}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={etiquetaCampo} htmlFor="aviso">
                  <Bell className="mr-1 inline h-3 w-3" /> Aviso
                </label>
                <select id="aviso" value={b.recordatorioMin === null ? "" : String(b.recordatorioMin)} onChange={(e) => onCambiar({ ...b, recordatorioMin: e.target.value === "" ? null : +e.target.value })} className={inputCls}>
                  {OPCIONES_RECORDATORIO.map((o) => (
                    <option key={String(o.valor)} value={o.valor === null ? "" : String(o.valor)}>
                      {o.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={etiquetaCampo} htmlFor="ubicacion">
                  <MapPin className="mr-1 inline h-3 w-3" /> Ubicación
                </label>
                <input id="ubicacion" value={b.ubicacion} onChange={(e) => onCambiar({ ...b, ubicacion: e.target.value })} maxLength={200} placeholder="Opcional" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={etiquetaCampo} htmlFor="descripcion">
                Descripción
              </label>
              <textarea id="descripcion" value={b.descripcion} onChange={(e) => onCambiar({ ...b, descripcion: e.target.value })} maxLength={4000} rows={3} placeholder="Notas, enlaces…" className={inputCls + " resize-y"} />
            </div>

            {b.tipo === "tarea" && (
              <div>
                <span className={etiquetaCampo}>Prioridad</span>
                <div className="flex flex-wrap gap-2">
                  {([null, "urgente", "importante", "rutinaria"] as const).map((p) => (
                    <button
                      key={String(p)}
                      type="button"
                      aria-pressed={b.prioridad === p}
                      onClick={() => onCambiar({ ...b, prioridad: p, color: p ? COLOR_POR_PRIORIDAD[p] : b.color })}
                      className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition", b.prioridad === p ? "border-emerald-500 bg-emerald-500/10 text-emerald-200" : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white")}
                    >
                      {p ?? "Sin prioridad"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className={etiquetaCampo}>Color</span>
              <div className="flex flex-wrap gap-2">
                {COLORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={COLOR_UI[c].etiqueta}
                    aria-pressed={b.color === c}
                    title={COLOR_UI[c].etiqueta}
                    onClick={() => onCambiar({ ...b, color: c })}
                    className={cn("h-7 w-7 rounded-full transition", COLOR_UI[c].punto, b.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900" : "opacity-80 hover:opacity-100")}
                  />
                ))}
              </div>
            </div>

            {b.tipo === "tarea" && !esNuevo && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={b.hecho} onChange={(e) => onCambiar({ ...b, hecho: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
                Tarea hecha
              </label>
            )}

            {error && (
              <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              {onBorrar && (
                <button type="button" onClick={onBorrar} className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/10">
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              )}
              <button type="button" onClick={onCerrar} className={cn(btnSecundario, !onBorrar && "ml-auto")}>
                Cancelar
              </button>
              <button type="submit" disabled={ocupado} className={btnPrimario}>
                {ocupado ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// "Repetir cada N [días|semanas|meses|años]", los días de la semana y cuándo termina.
function EditorRepeticion({ rep, fechaIni, onCambiar }: { rep: Repeticion; fechaIni: string; onCambiar: (r: Repeticion) => void }) {
  const dias = rep.dias ?? [diaSemana(fechaIni)];
  const termina = rep.hasta ? "hasta" : rep.veces ? "veces" : "nunca";
  const n = posicionEnMes(fechaIni);
  const campo = cn(inputCls, "py-1.5");
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-400">Repetir cada</span>
        <input type="number" min={1} max={99} value={rep.intervalo ?? 1} aria-label="Cada cuántos" onChange={(e) => onCambiar({ ...rep, intervalo: Math.min(99, Math.max(1, +e.target.value || 1)) })} className={cn(campo, "w-20 flex-none")} />
        <select
          aria-label="Unidad"
          value={rep.frecuencia}
          onChange={(e) => {
            const frecuencia = e.target.value as Repeticion["frecuencia"];
            onCambiar({ ...rep, frecuencia, dias: frecuencia === "semanal" ? dias : null, por: frecuencia === "mensual" ? (rep.por ?? "dia") : null });
          }}
          className={cn(campo, "w-32 flex-none")}
        >
          <option value="diaria">días</option>
          <option value="semanal">semanas</option>
          <option value="mensual">meses</option>
          <option value="anual">años</option>
        </select>
      </div>

      {rep.frecuencia === "semanal" && (
        <div>
          <span className="mb-1 block text-xs text-slate-500">Los días</span>
          <div className="flex flex-wrap gap-1.5">
            {DIAS_CORTOS.map((d, i) => {
              const activo = dias.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => {
                    const nuevos = activo ? dias.filter((x) => x !== i) : [...dias, i].sort((a, c) => a - c);
                    if (nuevos.length) onCambiar({ ...rep, dias: nuevos });
                  }}
                  className={cn("h-8 w-10 rounded-lg border text-xs font-semibold capitalize transition", activo ? "border-emerald-500 bg-emerald-500/20 text-emerald-100" : "border-slate-800 text-slate-400 hover:text-white")}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rep.frecuencia === "mensual" && (
        <div className="space-y-1.5 text-slate-300">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="por" checked={(rep.por ?? "dia") === "dia"} onChange={() => onCambiar({ ...rep, por: "dia" })} className="accent-emerald-500" />
            El día {+fechaIni.slice(8, 10)} de cada mes
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="por" checked={rep.por === "semana"} onChange={() => onCambiar({ ...rep, por: "semana" })} className="accent-emerald-500" />
            El {ORDINAL[n]} {DIA_LARGO[diaSemana(fechaIni)]} de cada mes
          </label>
        </div>
      )}

      <fieldset className="space-y-1.5 text-slate-300">
        <legend className="mb-1 text-xs text-slate-500">Termina</legend>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="radio" name="termina" checked={termina === "nunca"} onChange={() => onCambiar({ ...rep, hasta: null, veces: null })} className="accent-emerald-500" />
          Nunca
        </label>
        <label className="flex flex-wrap items-center gap-2">
          <input type="radio" name="termina" checked={termina === "hasta"} onChange={() => onCambiar({ ...rep, hasta: rep.hasta ?? fechaIni, veces: null })} className="accent-emerald-500" />
          <span className="cursor-pointer">El día</span>
          <input type="date" aria-label="Termina el día" disabled={termina !== "hasta"} value={rep.hasta ?? ""} min={fechaIni} onChange={(e) => onCambiar({ ...rep, hasta: e.target.value || null })} className={cn(campo, "w-44 flex-none disabled:opacity-40")} />
        </label>
        <label className="flex flex-wrap items-center gap-2">
          <input type="radio" name="termina" checked={termina === "veces"} onChange={() => onCambiar({ ...rep, hasta: null, veces: rep.veces ?? 10 })} className="accent-emerald-500" />
          <span className="cursor-pointer">Después de</span>
          <input type="number" min={1} max={999} aria-label="Número de veces" disabled={termina !== "veces"} value={rep.veces ?? ""} onChange={(e) => onCambiar({ ...rep, veces: Math.min(999, Math.max(1, +e.target.value || 1)) })} className={cn(campo, "w-20 flex-none disabled:opacity-40")} />
          <span>veces</span>
        </label>
      </fieldset>
    </div>
  );
}
