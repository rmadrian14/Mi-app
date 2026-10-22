import { AlignLeft, Bell, Check, Clock, MapPin, Pencil, Repeat, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { OPCIONES_RECORDATORIO, textoCuando, textoRepeticion, type EventoRow, type Ocurrencia } from "@/lib/calendar";
import type { Anclaje } from "./chips";
import { CasillaTarea } from "./chips";
import { btnIcono, COLOR_UI } from "./estilos";
import { Flotante } from "./flotante";

// Ficha de un evento o tarea al pulsarlo: cuándo, repetición, sitio, notas y acciones.
export function DetallePopover({
  oc, maestro, anclaje, onCerrar, onEditar, onBorrar, onAlternarHecho,
}: {
  oc: Ocurrencia;
  maestro: EventoRow | null;
  anclaje: Anclaje;
  onCerrar: () => void;
  onEditar: () => void;
  onBorrar: () => void;
  onAlternarHecho: () => void;
}) {
  const ui = COLOR_UI[oc.color];
  const esTarea = oc.tipo === "tarea";
  const repeticion = maestro?.repeticion ?? oc.evento.repeticion;
  const aviso = OPCIONES_RECORDATORIO.find((o) => o.valor === oc.evento.recordatorio_min);
  return (
    <Flotante anclaje={anclaje} etiqueta={oc.titulo} onCerrar={onCerrar}>
      <div className="mb-3 flex items-start gap-2">
        <span className={cn("mt-1.5 h-3.5 w-3.5 shrink-0 rounded-sm", ui.punto)} />
        <div className="min-w-0 flex-1">
          <h3 className={cn("break-words text-lg font-semibold leading-snug text-white", esTarea && oc.hecho && "text-slate-400 line-through")}>{oc.titulo}</h3>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {oc.soloLectura ? "Solo lectura" : esTarea ? "Tarea" : "Evento"}
            {esTarea && oc.prioridad ? ` · ${oc.prioridad}` : ""}
          </p>
        </div>
        {!oc.soloLectura && (
          <>
            <button type="button" aria-label="Editar" title="Editar" onClick={onEditar} className={btnIcono}>
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Borrar" title="Borrar" onClick={onBorrar} className={cn(btnIcono, "hover:text-rose-400")}>
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
        <button type="button" aria-label="Cerrar" onClick={onCerrar} className={btnIcono}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="space-y-2 text-sm text-slate-300">
        <li className="flex gap-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <span>{textoCuando(oc)}</span>
        </li>
        {repeticion && (
          <li className="flex gap-3">
            <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span>{textoRepeticion(repeticion, maestro?.inicio ?? oc.evento.inicio)}</span>
          </li>
        )}
        {oc.evento.ubicacion && (
          <li className="flex gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span className="break-words">{oc.evento.ubicacion}</span>
          </li>
        )}
        {oc.evento.descripcion && (
          <li className="flex gap-3">
            <AlignLeft className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words">{oc.evento.descripcion}</span>
          </li>
        )}
        {aviso && aviso.valor !== null && (
          <li className="flex gap-3">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span>{aviso.etiqueta}</span>
          </li>
        )}
      </ul>

      {esTarea && !oc.soloLectura && (
        <button
          type="button"
          onClick={onAlternarHecho}
          className={cn(
            "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition",
            oc.hecho ? "border-slate-700 text-slate-300 hover:text-white" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
          )}
        >
          {oc.hecho ? <CasillaTarea hecho color={oc.color} /> : <Check className="h-4 w-4" />}
          {oc.hecho ? "Marcar como pendiente" : "Marcar como hecha"}
        </button>
      )}
    </Flotante>
  );
}
