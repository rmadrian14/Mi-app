import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { barrasDeSemana, cuadriculaMes, DIAS_CORTOS, diasEntre, vaEnFranjaDelDia, type Fecha, type Ocurrencia } from "@/lib/calendar";
import { anclajeDe, ChipFila, type Anclaje } from "./chips";

type Props = {
  fecha: Fecha;
  hoy: Fecha;
  ocs: Ocurrencia[];
  seleccionClave: string | null;
  onCrear: (fecha: Fecha, anclaje: Anclaje) => void;
  onAbrir: (oc: Ocurrencia, anclaje: Anclaje) => void;
  onIrADia: (f: Fecha) => void;
  onMoverDias: (oc: Ocurrencia, dias: number) => void;
  onAlternarHecho: (oc: Ocurrencia) => void;
  maxFilas?: number;
};

export function VistaMes({ fecha, hoy, ocs, seleccionClave, onCrear, onAbrir, onIrADia, onMoverDias, onAlternarHecho, maxFilas = 3 }: Props) {
  const semanas = useMemo(() => cuadriculaMes(fecha), [fecha]);
  const porClave = useMemo(() => new Map(ocs.map((o) => [o.clave, o])), [ocs]);
  const mes = fecha.slice(0, 7);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-slate-800 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {DIAS_CORTOS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 overflow-y-auto" style={{ gridTemplateRows: `repeat(${semanas.length}, minmax(${(maxFilas + 2) * 24 + 6}px, 1fr))` }}>
        {semanas.map((dias) => (
          <SemanaMes
            key={dias[0]}
            dias={dias}
            mes={mes}
            hoy={hoy}
            ocs={ocs}
            porClave={porClave}
            maxFilas={maxFilas}
            seleccionClave={seleccionClave}
            onCrear={onCrear}
            onAbrir={onAbrir}
            onIrADia={onIrADia}
            onMoverDias={onMoverDias}
            onAlternarHecho={onAlternarHecho}
          />
        ))}
      </div>
    </div>
  );
}

function SemanaMes({
  dias, mes, hoy, ocs, porClave, maxFilas, seleccionClave, onCrear, onAbrir, onIrADia, onMoverDias, onAlternarHecho,
}: {
  dias: Fecha[]; mes: string; hoy: Fecha; ocs: Ocurrencia[]; porClave: Map<string, Ocurrencia>; maxFilas: number; seleccionClave: string | null;
  onCrear: Props["onCrear"]; onAbrir: Props["onAbrir"]; onIrADia: Props["onIrADia"]; onMoverDias: Props["onMoverDias"]; onAlternarHecho: Props["onAlternarHecho"];
}) {
  const { barras, ocultas } = useMemo(() => barrasDeSemana(ocs, dias, maxFilas), [ocs, dias, maxFilas]);

  return (
    <div className="relative border-b border-slate-800">
      <div className="absolute inset-0 grid grid-cols-7">
        {dias.map((f) => (
          <div
            key={f}
            data-dia={f}
            className={cn("cursor-pointer border-l border-slate-800 first:border-l-0 hover:bg-slate-900/60", f.slice(0, 7) !== mes && "bg-slate-950/70")}
            onClick={(e) => onCrear(f, anclajeDe(e.currentTarget))}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const [clave, origen] = e.dataTransfer.getData("text/plain").split("|");
              const oc = porClave.get(clave);
              if (oc && origen) {
                const delta = diasEntre(origen, f);
                if (delta !== 0) onMoverDias(oc, delta);
              }
            }}
          />
        ))}
      </div>
      <div className="pointer-events-none relative grid grid-cols-7 gap-y-0.5 px-0.5 pb-1" style={{ gridAutoRows: "22px" }}>
        {dias.map((f, i) => {
          const esHoy = f === hoy;
          const n = +f.slice(8, 10);
          return (
            <div key={f} className="flex items-center justify-center" style={{ gridColumn: i + 1, gridRow: 1 }}>
              <button
                type="button"
                onClick={() => onIrADia(f)}
                className={cn(
                  "pointer-events-auto grid h-[20px] min-w-[20px] place-items-center rounded-full px-1 text-[11px] font-semibold",
                  esHoy ? "bg-emerald-500 text-white" : f.slice(0, 7) !== mes ? "text-slate-600 hover:bg-slate-800" : "text-slate-300 hover:bg-slate-800",
                )}
              >
                {n === 1 ? `${n} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][+f.slice(5, 7) - 1]}` : n}
              </button>
            </div>
          );
        })}
        {barras.map((b) => (
          <div key={`${b.oc.clave}-${b.col}`} className="pointer-events-auto min-w-0" style={{ gridColumn: `${b.col + 1} / span ${b.span}`, gridRow: b.fila + 2 }}>
            <ChipFila
              oc={b.oc}
              modo={vaEnFranjaDelDia(b.oc) ? "barra" : "linea"}
              contIzq={b.contIzq}
              contDer={b.contDer}
              seleccionada={seleccionClave === b.oc.clave}
              onClick={(e) => {
                e.stopPropagation();
                onAbrir(b.oc, anclajeDe(e.currentTarget));
              }}
              onAlternarHecho={onAlternarHecho}
              arrastrable={!b.oc.soloLectura}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", `${b.oc.clave}|${dias[b.col]}`);
                e.dataTransfer.effectAllowed = "move";
              }}
            />
          </div>
        ))}
        {ocultas.map(
          (n, i) =>
            n > 0 && (
              <button
                key={`mas-${i}`}
                type="button"
                onClick={() => onIrADia(dias[i])}
                className="pointer-events-auto truncate rounded px-1.5 text-left text-[11px] font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
                style={{ gridColumn: i + 1, gridRow: maxFilas + 2 }}
              >
                +{n} más
              </button>
            ),
        )}
      </div>
    </div>
  );
}
