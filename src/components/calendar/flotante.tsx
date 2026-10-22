import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Anclaje } from "./chips";

const limitar = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

// Tarjeta que aparece junto a lo que se ha pulsado (en el móvil, como una hoja desde abajo).
// Se cierra con Escape o pulsando fuera.
export function Flotante({ anclaje, ancho = 360, etiqueta, onCerrar, children }: { anclaje: Anclaje; ancho?: number; etiqueta: string; onCerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const movil = typeof window !== "undefined" && window.innerWidth < 640;

  // Se coloca junto al ancla y se vuelve a colocar si la tarjeta cambia de alto (aparece un aviso, un error...).
  useLayoutEffect(() => {
    if (movil) return;
    const colocar = () => {
      const alto = ref.current?.offsetHeight ?? 320;
      const W = window.innerWidth;
      const H = window.innerHeight;
      let left = anclaje.right + 10;
      if (left + ancho > W - 8) left = anclaje.left - ancho - 10;
      if (left < 8) left = limitar((anclaje.left + anclaje.right) / 2 - ancho / 2, 8, W - ancho - 8);
      const top = limitar(anclaje.top - 8, 8, Math.max(8, H - alto - 8));
      setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }));
    };
    colocar();
    const obs = typeof ResizeObserver === "undefined" || !ref.current ? null : new ResizeObserver(colocar);
    if (obs && ref.current) obs.observe(ref.current);
    return () => obs?.disconnect();
  }, [anclaje, ancho, movil]);

  useEffect(() => {
    const abajo = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (ref.current && t && !ref.current.contains(t) && !t.closest("[data-no-cerrar]")) onCerrar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCerrar();
      }
    };
    const t = setTimeout(() => document.addEventListener("pointerdown", abajo), 0); // no cerrar con el mismo clic que la abrió
    document.addEventListener("keydown", tecla, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", abajo);
      document.removeEventListener("keydown", tecla, true);
    };
  }, [onCerrar]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={etiqueta}
      data-flotante
      className={cn(
        "fixed z-50 border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl shadow-black/50",
        movil ? "inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl p-4 pb-6" : "rounded-2xl p-4",
      )}
      style={movil ? undefined : { left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: ancho }}
    >
      {children}
    </div>
  );
}
