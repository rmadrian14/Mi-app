import { useCallback, useRef, useState, type FormEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { btnPrimary, btnSecondary, inputCls } from "./common";

// Sustituye a window.prompt / window.confirm (que en el móvil, y sobre todo en
// una app instalada, quedan feos o directamente no funcionan). Uso:
//
//   const { pedirTexto, confirmar, dialogos } = useDialogos();
//   const nombre = await pedirTexto({ titulo: "Nombre del menú", valorInicial: "Mi menú" });
//   if (await confirmar({ titulo: "¿Eliminar?", destructivo: true })) { ... }
//   return <>{...}{dialogos}</>;

type OpcionesTexto = {
  titulo: string;
  descripcion?: string;
  valorInicial?: string;
  etiquetaOk?: string;
};

type OpcionesConfirmar = {
  titulo: string;
  descripcion?: string;
  etiquetaOk?: string;
  destructivo?: boolean;
};

type Estado =
  | { tipo: "texto"; opciones: OpcionesTexto; resolver: (v: string | null) => void }
  | { tipo: "confirmar"; opciones: OpcionesConfirmar; resolver: (v: boolean) => void };

export function useDialogos() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [valor, setValor] = useState("");
  // Evita resolver dos veces (cerrar tras aceptar dispara también onOpenChange).
  const resuelto = useRef(false);

  const pedirTexto = useCallback(
    (opciones: OpcionesTexto) =>
      new Promise<string | null>((resolver) => {
        resuelto.current = false;
        setValor(opciones.valorInicial ?? "");
        setEstado({ tipo: "texto", opciones, resolver });
      }),
    [],
  );

  const confirmar = useCallback(
    (opciones: OpcionesConfirmar) =>
      new Promise<boolean>((resolver) => {
        resuelto.current = false;
        setEstado({ tipo: "confirmar", opciones, resolver });
      }),
    [],
  );

  function cerrar(resultado: string | boolean | null) {
    if (!estado || resuelto.current) return;
    resuelto.current = true;
    if (estado.tipo === "texto") estado.resolver(typeof resultado === "string" ? resultado : null);
    else estado.resolver(resultado === true);
    setEstado(null);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    const limpio = valor.trim();
    if (!limpio) return;
    cerrar(limpio);
  }

  const abierto = estado !== null;
  const o = estado?.opciones;

  const dialogos: ReactNode = (
    <Dialog.Root open={abierto} onOpenChange={(abre) => !abre && cerrar(estado?.tipo === "texto" ? null : false)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-100 shadow-xl outline-none"
          onOpenAutoFocus={(e) => {
            // En los diálogos de texto el foco va al campo; en los de confirmar, al botón por defecto.
            if (estado?.tipo === "texto") return;
            e.preventDefault();
          }}
        >
          <Dialog.Title className="text-base font-semibold text-white">{o?.titulo}</Dialog.Title>
          <Dialog.Description className={o?.descripcion ? "mt-1.5 text-sm text-slate-400" : "sr-only"}>
            {o?.descripcion ?? o?.titulo}
          </Dialog.Description>

          {estado?.tipo === "texto" ? (
            <form onSubmit={enviar} className="mt-4 space-y-4">
              <input
                autoFocus
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                maxLength={80}
                className={inputCls}
                aria-label={o?.titulo}
              />
              <div className="flex justify-end gap-2">
                <button type="button" className={btnSecondary} onClick={() => cerrar(null)}>
                  Cancelar
                </button>
                <button type="submit" className={btnPrimary} disabled={!valor.trim()}>
                  {estado.opciones.etiquetaOk ?? "Aceptar"}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => cerrar(false)}>
                Cancelar
              </button>
              <button
                type="button"
                autoFocus
                className={
                  estado?.tipo === "confirmar" && estado.opciones.destructivo
                    ? "inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
                    : btnPrimary
                }
                onClick={() => cerrar(true)}
              >
                {estado?.tipo === "confirmar" ? (estado.opciones.etiquetaOk ?? "Aceptar") : "Aceptar"}
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  return { pedirTexto, confirmar, dialogos };
}
