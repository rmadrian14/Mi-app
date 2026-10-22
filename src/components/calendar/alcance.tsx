import { useCallback, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { Alcance } from "@/lib/calendar";
import { btnPrimario, btnSecundario } from "./estilos";

type Opciones = { titulo: string; accion: string; esTarea: boolean };

// Al cambiar, mover o borrar algo que se repite: ¿solo este, este y los siguientes, o todos?
// Uso:  const { preguntarAlcance, dialogoAlcance } = useAlcance();
//       const alcance = await preguntarAlcance({ titulo: "Mover", accion: "Guardar", esTarea: false });  // null si cancela
export function useAlcance() {
  const [estado, setEstado] = useState<{ opciones: Opciones; resolver: (a: Alcance | null) => void } | null>(null);
  const [valor, setValor] = useState<Alcance>("esta");
  const resuelto = useRef(false);

  const preguntarAlcance = useCallback(
    (opciones: Opciones) =>
      new Promise<Alcance | null>((resolver) => {
        resuelto.current = false;
        setValor("esta");
        setEstado({ opciones, resolver });
      }),
    [],
  );

  function cerrar(r: Alcance | null) {
    if (!estado || resuelto.current) return;
    resuelto.current = true;
    estado.resolver(r);
    setEstado(null);
  }

  const o = estado?.opciones;
  const cosa = o?.esTarea ? "tarea" : "evento";
  const etiquetas: [Alcance, string][] = [
    ["esta", `Solo este ${cosa}`],
    ["siguientes", `Este y los siguientes`],
    ["todas", `Todos los ${cosa === "tarea" ? "tareas" : "eventos"}`],
  ];

  const dialogoAlcance: ReactNode = (
    <Dialog.Root open={estado !== null} onOpenChange={(abre) => !abre && cerrar(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-100 shadow-xl outline-none">
          <Dialog.Title className="text-base font-semibold text-white">{o?.titulo}</Dialog.Title>
          <p className="mt-1 text-xs text-slate-400">Esto se repite. ¿A cuáles afecta?</p>
          <div role="radiogroup" className="mt-4 space-y-2">
            {etiquetas.map(([clave, texto]) => (
              <label key={clave} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800">
                <input type="radio" name="alcance" checked={valor === clave} onChange={() => setValor(clave)} className="h-4 w-4 accent-emerald-500" />
                {texto}
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => cerrar(null)} className={btnSecundario}>
              Cancelar
            </button>
            <button type="button" onClick={() => cerrar(valor)} className={btnPrimario}>
              {o?.accion ?? "Aceptar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  return { preguntarAlcance, dialogoAlcance };
}
