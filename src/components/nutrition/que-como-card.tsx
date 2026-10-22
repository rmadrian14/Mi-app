import { useMemo, useState } from "react";
import { Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import type { FoodRow, NutritionProfile } from "@/hooks/use-nutrition";
import { COMIDA_LABEL, alimentoPermitido, comidasDelDia, type Comida, type Macros } from "@/lib/nutrition";
import { entradaDesdeAlimento, type EntradaDiario, type NuevaEntrada } from "@/lib/food-log";
import { comidaProxima, comidasPendientes, objetivoDeLaComida, sugerirCombos, sugerirPlatos, type PlatoSug } from "@/lib/que-como";
import { Aviso, Card, MacroPills, SectionTitle, btnGhost, btnPrimary, btnSecondary, fmt } from "./common";
import { aGenFood } from "./menu-view";

const semilla = () => Math.floor(Math.random() * 2 ** 31);
const limpio = (n: string) => n.replace(/ \(receta casera\)/, "");

function textoUnidades(p: PlatoSug): string {
  const u = p.unidades;
  const nombre = p.food.unidad_nombre ?? "unidad";
  const plural = nombre === "ración" ? "raciones" : `${nombre}s`;
  return `${fmt(u, u % 1 ? 1 : 0)} ${u === 1 ? nombre : plural}`;
}

export function QueComoCard({
  fecha,
  profile,
  foods,
  restante,
  entradas,
  onAnadir,
}: {
  fecha: string;
  profile: NutritionProfile;
  foods: FoodRow[];
  restante: Macros;
  entradas: EntradaDiario[];
  onAnadir: (e: NuevaEntrada[]) => Promise<void>;
}) {
  const comidasActivas = useMemo(() => comidasDelDia(profile.comidas_por_dia), [profile.comidas_por_dia]);
  const [abierto, setAbierto] = useState(false);
  const [comida, setComida] = useState<Comida>("comida");
  const [semillaActual, setSemilla] = useState(semilla);
  const [guardando, setGuardando] = useState(false);

  function abrir() {
    const ahora = new Date();
    setComida(comidaProxima(ahora.getHours() + ahora.getMinutes() / 60, comidasActivas));
    setSemilla(semilla());
    setAbierto(true);
  }

  const datos = useMemo(() => {
    if (!abierto) return null;
    const objetivo = objetivoDeLaComida(restante, comida, comidasPendientes(comidasActivas, comida), { kcalDia: profile.kcal_objetivo, comidasDelDia: comidasActivas });
    if (!objetivo) return { objetivo: null, combos: [], platos: [] };
    const permitidos = foods.filter((f) => alimentoPermitido(f, profile.restricciones, profile.alimentos_excluidos));
    return {
      objetivo,
      combos: sugerirCombos({ foods: permitidos.filter((f) => f.comidas.length > 0).map(aGenFood), objetivo, comida, semilla: semillaActual }),
      platos: sugerirPlatos({ platos: permitidos.filter((f) => f.comidas.length === 0 && f.gramos_unidad), objetivo, comida }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, comida, semillaActual, foods, profile.restricciones, profile.alimentos_excluidos, profile.kcal_objetivo, comidasActivas, Math.round(restante.kcal), Math.round(restante.proteina), Math.round(restante.grasa), Math.round(restante.hidratos)]);

  async function anadir(items: { food: Parameters<typeof entradaDesdeAlimento>[0]; gramos: number }[]) {
    const orden0 = entradas.filter((e) => e.comida === comida).length;
    setGuardando(true);
    try {
      await onAnadir(items.map((it, i) => entradaDesdeAlimento(it.food, it.gramos, comida, fecha, orden0 + i)));
      toast.success(`Añadido a ${COMIDA_LABEL[comida].toLowerCase()}`);
      setAbierto(false);
    } catch (e) {
      toast.error((e as Error).message || "No se ha podido añadir.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>¿Qué como ahora?</SectionTitle>
        {!abierto && (
          <button type="button" onClick={abrir} className={btnSecondary}>
            <Sparkles className="h-4 w-4" /> Sugerir
          </button>
        )}
        {abierto && (
          <button type="button" onClick={() => setAbierto(false)} className={btnGhost} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {!abierto && <p className="-mt-1 text-xs text-slate-500">Te propongo qué comer para cuadrar lo que te falta del día.</p>}

      {abierto && datos && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {comidasActivas.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setComida(c)}
                aria-pressed={c === comida}
                className={
                  "rounded-full border px-3 py-1 text-xs transition " +
                  (c === comida ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "border-slate-800 text-slate-400 hover:border-emerald-500 hover:text-white")
                }
              >
                {COMIDA_LABEL[c]}
              </button>
            ))}
          </div>

          {!datos.objetivo ? (
            <Aviso tono="gris">
              {restante.kcal < 0
                ? `Ya te has pasado ${fmt(-restante.kcal)} kcal del objetivo de hoy: no hace falta comer más.`
                : "Con lo que llevas, el día está prácticamente cubierto. Si tienes hambre, una fruta o una verdura entran sin problema."}
            </Aviso>
          ) : (
            <>
              <p className="text-xs text-slate-400">
                Para {COMIDA_LABEL[comida].toLowerCase()}, lo que te falta del día repartido entre las comidas que quedan:{" "}
                <span className="font-semibold text-slate-200">
                  ≈ {fmt(datos.objetivo.kcal)} kcal · P {fmt(datos.objetivo.proteina)} g · G {fmt(datos.objetivo.grasa)} g · H {fmt(datos.objetivo.hidratos)} g
                </span>
              </p>

              {datos.objetivo.recortada && (
                <p className="text-xs text-amber-300/90">
                  Te faltan {fmt(restante.kcal)} kcal en total, más de lo que cabe en una sola comida. Esto es lo razonable para esta; el resto, en otra toma.
                </p>
              )}

              {datos.combos.length === 0 && datos.platos.length === 0 && (
                <Aviso tono="gris">No encuentro nada que cuadre bien para esta comida. Prueba con otra comida o añade más alimentos a tu biblioteca.</Aviso>
              )}

              {datos.combos.map((c, k) => (
                <div key={k} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Opción {k + 1}</p>
                  <ul className="mt-1 space-y-0.5">
                    {c.items.map((i) => (
                      <li key={i.food.id} className="flex justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-slate-100">{limpio(i.food.nombre)}</span>
                        <span className="shrink-0 text-slate-400">{fmt(i.gramos)} g</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <MacroPills m={c.total} />
                    <button type="button" disabled={guardando} onClick={() => anadir(c.items)} className={btnPrimary}>
                      <Plus className="h-4 w-4" /> Añadir al diario
                    </button>
                  </div>
                </div>
              ))}

              {datos.platos.length > 0 && (
                <>
                  <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Platos que encajan</p>
                  {datos.platos.map((p) => (
                    <div key={p.food.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <p className="text-sm text-slate-100">{limpio(p.food.nombre)}</p>
                      <p className="text-xs text-slate-400">
                        {textoUnidades(p)} · {fmt(p.gramos)} g
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <MacroPills m={p.total} />
                        <button type="button" disabled={guardando} onClick={() => anadir([{ food: p.food, gramos: p.gramos }])} className={btnPrimary}>
                          <Plus className="h-4 w-4" /> Añadir al diario
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              <button type="button" onClick={() => setSemilla(semilla())} className={btnSecondary + " w-full"}>
                <RefreshCw className="h-4 w-4" /> Otras opciones
              </button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
