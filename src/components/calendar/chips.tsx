import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { horaDe, type Ocurrencia } from "@/lib/calendar";
import { COLOR_UI } from "./estilos";

export type Anclaje = { left: number; top: number; right: number; bottom: number };
export const anclajeDe = (el: Element): Anclaje => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

// Casilla de una tarea (redonda, como en Google Tasks).
export function CasillaTarea({ hecho, color, onClick, className }: { hecho: boolean; color: Ocurrencia["color"]; onClick?: (e: React.MouseEvent) => void; className?: string }) {
  return (
    <span
      role={onClick ? "checkbox" : undefined}
      aria-checked={onClick ? hecho : undefined}
      onClick={onClick}
      className={cn(
        "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border-[1.5px] transition",
        hecho ? cn("border-transparent text-white", COLOR_UI[color].punto) : "border-slate-400 hover:border-white",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {hecho ? <Check className="h-2.5 w-2.5" strokeWidth={4} /> : <Circle className="h-0 w-0" />}
    </span>
  );
}

// Una aparición dibujada en una fila (mes, franja de todo el día, agenda).
//  · "barra": relleno de color (todo el día y varios días)
//  · "linea": punto + hora + título (eventos con hora en el mes)
export function ChipFila({
  oc,
  modo,
  contIzq = false,
  contDer = false,
  seleccionada,
  onClick,
  onAlternarHecho,
  arrastrable,
  onDragStart,
}: {
  oc: Ocurrencia;
  modo: "barra" | "linea";
  contIzq?: boolean;
  contDer?: boolean;
  seleccionada?: boolean;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
  onAlternarHecho?: (oc: Ocurrencia) => void;
  arrastrable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLElement>) => void;
}) {
  const esTarea = oc.tipo === "tarea";
  const ui = COLOR_UI[oc.color];
  const tachado = esTarea && oc.hecho;
  const casilla = esTarea ? (
    <CasillaTarea
      hecho={oc.hecho}
      color={oc.color}
      onClick={
        onAlternarHecho && !oc.soloLectura
          ? (e) => {
              e.stopPropagation();
              onAlternarHecho(oc);
            }
          : undefined
      }
    />
  ) : null;

  if (modo === "barra") {
    return (
      <button
        type="button"
        onClick={onClick}
        draggable={arrastrable}
        onDragStart={onDragStart}
        title={oc.titulo}
        className={cn(
          "flex h-[22px] w-full min-w-0 items-center gap-1 truncate px-1.5 text-left text-[11.5px] font-semibold transition",
          esTarea ? ui.suave : ui.solido,
          !contIzq && "rounded-l-md",
          !contDer && "rounded-r-md",
          tachado && "opacity-60",
          seleccionada && cn("ring-2", ui.anillo),
        )}
      >
        {contIzq && <span aria-hidden>◂</span>}
        {casilla}
        <span className={cn("truncate", tachado && "line-through")}>{oc.titulo}</span>
        {contDer && <span aria-hidden className="ml-auto">▸</span>}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      draggable={arrastrable}
      onDragStart={onDragStart}
      title={oc.titulo}
      className={cn(
        "flex h-[22px] w-full min-w-0 items-center gap-1.5 rounded-md px-1 text-left text-[11.5px] text-slate-200 transition hover:bg-slate-800",
        tachado && "opacity-60",
        seleccionada && cn("bg-slate-800 ring-2", ui.anillo),
      )}
    >
      {casilla ?? <span className={cn("h-2 w-2 shrink-0 rounded-full", ui.punto)} />}
      <span className="shrink-0 text-slate-400">{horaDe(oc.inicio)}</span>
      <span className={cn("truncate font-medium", tachado && "line-through")}>{oc.titulo}</span>
    </button>
  );
}
