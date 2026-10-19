import { useMemo, useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import type { FoodRow, useMenus } from "@/hooks/use-nutrition";
import { Card, SectionTitle, btnGhost, btnSecondary, fmt } from "./common";
import { CATEGORIAS } from "./alimentos-view";

const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];

function textoCantidad(f: FoodRow, gramos: number): string {
  const base = gramos >= 1000 ? `${fmt(gramos / 1000, 2)} kg` : `${fmt(Math.round(gramos / 5) * 5)} g`;
  if (f.gramos_unidad && f.unidad_nombre) {
    const n = Math.ceil(gramos / f.gramos_unidad - 1e-9);
    return `${base} (${n} ${f.unidad_nombre}${n === 1 ? "" : "s"})`;
  }
  return base;
}

export function CompraView({ foods, menus }: { foods: FoodRow[]; menus: ReturnType<typeof useMenus> }) {
  const [diasSel, setDiasSel] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  // Lo marcado se guarda en la base de datos (por menú), así que es el mismo en
  // el móvil y en el ordenador.
  const marcados = menus.compraMarcados;

  function guardarMarcados(s: Set<string>) {
    menus.marcarCompra([...s]).catch(() => {
      toast.error("No se ha podido guardar la lista. Revisa tu conexión.");
      menus.refresh();
    });
  }

  const foodsPorId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const lista = useMemo(() => {
    const totales = new Map<string, number>();
    for (const it of menus.items) {
      if (!diasSel.includes(it.dia_semana)) continue;
      totales.set(it.food_id, (totales.get(it.food_id) ?? 0) + it.gramos);
    }
    return CATEGORIAS.map((c) => ({
      categoria: c,
      lineas: [...totales.entries()]
        .map(([id, gramos]) => ({ food: foodsPorId.get(id), gramos }))
        .filter((x): x is { food: FoodRow; gramos: number } => !!x.food && x.food.categoria === c.id)
        .sort((a, b) => a.food.nombre.localeCompare(b.food.nombre)),
    })).filter((g) => g.lineas.length > 0);
  }, [menus.items, diasSel, foodsPorId]);

  function alternarDia(d: number) {
    setDiasSel((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  function alternar(id: string) {
    const s = new Set(marcados);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    guardarMarcados(s);
  }

  async function copiar() {
    const texto = lista
      .map(
        (g) =>
          `${g.categoria.label}\n` +
          g.lineas.map((l) => `- ${l.food.nombre.split("(")[0].trim()}: ${textoCantidad(l.food, l.gramos)}`).join("\n"),
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Lista copiada al portapapeles.");
    } catch {
      toast.error("No se ha podido copiar.");
    }
  }

  if (!menus.selectedId || menus.items.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-300">
          Aún no hay alimentos en el menú. Monta o genera un menú en la pestaña «Menú» y aquí tendrás la lista de la
          compra.
        </p>
      </Card>
    );
  }

  const nombreMenu = menus.menus.find((m) => m.id === menus.selectedId)?.nombre ?? "";

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Días a comprar · {nombreMenu}</SectionTitle>
        <div className="flex gap-1.5">
          {DIAS_CORTOS.map((l, d) => (
            <button
              key={l}
              type="button"
              onClick={() => alternarDia(d)}
              className={
                "h-9 flex-1 rounded-lg border text-xs font-bold transition " +
                (diasSel.includes(d) ? "border-emerald-500 bg-emerald-500/15 text-emerald-200" : "border-slate-800 text-slate-500")
              }
            >
              {l}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-600">
          Cantidades en el estado en que aparecen en tu biblioteca (por ejemplo, arroz y pasta en crudo).
        </p>
      </Card>

      <div className="flex gap-2">
        <button type="button" onClick={copiar} className={btnSecondary}>
          <ClipboardCopy className="h-4 w-4" /> Copiar lista
        </button>
        <button type="button" onClick={() => guardarMarcados(new Set())} className={btnGhost}>
          Desmarcar todo
        </button>
      </div>

      {lista.length === 0 && <p className="text-sm text-slate-500">Ningún alimento en los días elegidos.</p>}

      {lista.map((g) => (
        <Card key={g.categoria.id} className="!p-4">
          <SectionTitle>{g.categoria.label}</SectionTitle>
          <div className="space-y-1">
            {g.lineas.map((l) => {
              const hecho = marcados.has(l.food.id);
              return (
                <button
                  key={l.food.id}
                  type="button"
                  onClick={() => alternar(l.food.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-slate-800/50"
                >
                  <span
                    className={
                      "grid h-5 w-5 shrink-0 place-items-center rounded border " +
                      (hecho ? "border-emerald-500 bg-emerald-500 text-slate-950" : "border-slate-700")
                    }
                  >
                    {hecho && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className={"flex-1 text-sm " + (hecho ? "text-slate-600 line-through" : "text-slate-100")}>
                    {l.food.nombre.split("(")[0].trim()}
                  </span>
                  <span className={"text-sm font-semibold " + (hecho ? "text-slate-600" : "text-emerald-300")}>
                    {textoCantidad(l.food, l.gramos)}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
