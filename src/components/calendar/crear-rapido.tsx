import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { describirInterpretacion, type BorradorEvento } from "@/lib/calendar-form";
import { interpretarTexto } from "@/lib/calendar-quick";
import { fechaDe, fechaHoraADate, type FechaHora } from "@/lib/calendar";
import type { Anclaje } from "./chips";
import { FilaFechas, FraseEntendida, SelectorTipo } from "./campos";
import { btnIcono, btnPrimario, inputCls } from "./estilos";
import { Flotante } from "./flotante";

// Ventanita para crear algo al pulsar o arrastrar un hueco: título (se entienden frases como
// «Dentista mañana a las 10:30»), evento o tarea, día y hora. «Más opciones» abre el editor completo.
export function CrearRapido({
  borrador, anclaje, ahora, error, ocupado, onCambiar, onGuardar, onMasOpciones, onCerrar,
}: {
  borrador: BorradorEvento;
  anclaje: Anclaje;
  ahora: FechaHora;
  error: string | null;
  ocupado: boolean;
  onCambiar: (b: BorradorEvento) => void;
  onGuardar: (interpretar: boolean) => void;
  onMasOpciones: (interpretar: boolean) => void;
  onCerrar: () => void;
}) {
  const [interpretar, setInterpretar] = useState(true);
  const titulo = useRef<HTMLInputElement>(null);
  useEffect(() => titulo.current?.focus(), []);
  const interpretado = useMemo(() => interpretarTexto(borrador.titulo, fechaHoraADate(ahora)), [borrador.titulo, ahora]);
  const piezas = interpretar ? describirInterpretacion(interpretado, fechaDe(ahora)) : [];

  return (
    <Flotante anclaje={anclaje} ancho={460} etiqueta="Crear" onCerrar={onCerrar}>
      <div className="mb-2 flex justify-end">
        <button type="button" aria-label="Cerrar" onClick={onCerrar} className={btnIcono}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onGuardar(interpretar);
        }}
        className="space-y-3"
      >
        <input
          ref={titulo}
          value={borrador.titulo}
          onChange={(e) => onCambiar({ ...borrador, titulo: e.target.value })}
          placeholder="Añade un título o escribe «Dentista mañana 10:30»"
          aria-label="Título"
          maxLength={200}
          className={inputCls + " border-0 border-b-2 border-slate-700 bg-transparent px-0 text-lg focus:ring-0"}
        />
        <FraseEntendida piezas={piezas} onIgnorar={() => setInterpretar(false)} />
        <SelectorTipo tipo={borrador.tipo} onCambiar={(tipo) => onCambiar({ ...borrador, tipo, color: tipo === "tarea" && borrador.color === "azul" ? "esmeralda" : tipo === "evento" && borrador.color === "esmeralda" ? "azul" : borrador.color })} />
        <FilaFechas b={borrador} onCambiar={onCambiar} compacta />
        {error && (
          <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={() => onMasOpciones(interpretar)} className="rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white">
            Más opciones
          </button>
          <button type="submit" disabled={ocupado} className={btnPrimario}>
            {ocupado ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Flotante>
  );
}
