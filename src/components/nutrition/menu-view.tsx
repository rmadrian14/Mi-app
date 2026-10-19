import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Trash2, Plus, Wand2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { FoodRow, NutritionProfile, useMenus } from "@/hooks/use-nutrition";
import {
  COMIDAS_ORDEN,
  COMIDA_LABEL,
  alimentoPermitido,
  comidasDelDia,
  equivalenteCocinado,
  macrosDe,
  sumarMacros,
  type Comida,
  type Macros,
} from "@/lib/nutrition";
import {
  actualizarMemoria,
  ajustarRaciones,
  generarDia,
  memoriaVacia,
  racionTipica,
  redondearRacion,
  type GenFood,
} from "@/lib/nutrition-generator";
import { Aviso, Card, MacroBar, MacroPills, btnGhost, btnPrimary, btnSecondary, fmt, inputCls } from "./common";
import { useDialogos } from "./dialogs";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];

export function aGenFood(f: FoodRow): GenFood {
  return {
    id: f.id,
    nombre: f.nombre,
    categoria: f.categoria,
    kcal_100: f.kcal_100,
    proteina_100: f.proteina_100,
    grasa_100: f.grasa_100,
    hidratos_100: f.hidratos_100,
    gramos_unidad: f.gramos_unidad,
    porcion_min_g: f.porcion_min_g,
    porcion_max_g: f.porcion_max_g,
    comidas: f.comidas,
    contiene: f.contiene,
    frecuencia: f.frecuencia,
  };
}

const semilla = () => Math.floor(Math.random() * 2 ** 31);
const nombreCorto = (n: string) => n.split("(")[0].trim();

function textoUnidades(f: FoodRow, gramos: number): string | null {
  if (!f.gramos_unidad || !f.unidad_nombre) return null;
  const u = gramos / f.gramos_unidad;
  const n = Math.round(u * 10) / 10;
  return `≈ ${fmt(n, n % 1 ? 1 : 0)} ${f.unidad_nombre}${n === 1 ? "" : "s"}`;
}

function ItemFila({
  nombre,
  food,
  gramos,
  fueraDeRestricciones,
  onGramos,
  onQuitar,
}: {
  nombre: string;
  food: FoodRow;
  gramos: number;
  fueraDeRestricciones: boolean;
  onGramos: (g: number) => void;
  onQuitar: () => void;
}) {
  const [valor, setValor] = useState(String(gramos));
  useEffect(() => setValor(String(gramos)), [gramos]);
  const m = macrosDe(food, gramos);
  const unidades = textoUnidades(food, gramos);
  const cocinado = equivalenteCocinado(food.factor_cocinado, gramos);

  function confirmar() {
    const g = parseFloat(valor.replace(",", "."));
    if (!(g > 0) || g > 5000) {
      setValor(String(gramos));
      return;
    }
    if (g !== gramos) onGramos(g);
  }

  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-100">
          {nombre}
          {fueraDeRestricciones && (
            <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-300">
              no encaja
            </span>
          )}
        </p>
        <p className="text-[11px] text-slate-500">
          {fmt(m.kcal)} kcal · P {fmt(m.proteina)} · G {fmt(m.grasa)} · H {fmt(m.hidratos)}
          {unidades ? ` · ${unidades}` : ""}
          {cocinado ? ` · ${cocinado}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <input
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-16 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-right text-sm text-slate-100 outline-none focus:border-emerald-500"
          aria-label={`Gramos de ${nombre}`}
        />
        <span className="text-xs text-slate-500">g</span>
      </div>
      <button type="button" onClick={onQuitar} className={btnGhost + " hover:text-rose-400"} aria-label="Quitar">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AnadirAlimento({
  comida,
  foods,
  onAnadir,
}: {
  comida: Comida;
  foods: FoodRow[];
  onAnadir: (food: FoodRow, gramos: number) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [foodId, setFoodId] = useState("");
  const [gramos, setGramos] = useState("");

  const ordenados = useMemo(
    () =>
      [...foods].sort((a, b) => {
        const ta = a.comidas.includes(comida) ? 0 : 1;
        const tb = b.comidas.includes(comida) ? 0 : 1;
        return ta - tb || a.nombre.localeCompare(b.nombre);
      }),
    [foods, comida],
  );

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={btnGhost + " mt-1"}>
        <Plus className="h-3.5 w-3.5" /> Añadir alimento
      </button>
    );
  }

  function elegir(id: string) {
    setFoodId(id);
    const f = foods.find((x) => x.id === id);
    if (f) setGramos(String(redondearRacion(aGenFood(f), racionTipica(aGenFood(f)))));
  }

  async function anadir() {
    const f = foods.find((x) => x.id === foodId);
    const g = parseFloat(gramos.replace(",", "."));
    if (!f || !(g > 0)) return;
    try {
      await onAnadir(f, g);
      setAbierto(false);
      setFoodId("");
      setGramos("");
    } catch (e) {
      toast.error((e as Error).message || "No se pudo añadir.");
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-2">
      <select value={foodId} onChange={(e) => elegir(e.target.value)} className={inputCls + " min-w-0 flex-1"}>
        <option value="">Elige un alimento…</option>
        {ordenados.map((f) => (
          <option key={f.id} value={f.id}>
            {f.comidas.includes(comida) ? "" : "· "}
            {f.nombre}
          </option>
        ))}
      </select>
      <input
        inputMode="decimal"
        value={gramos}
        onChange={(e) => setGramos(e.target.value)}
        placeholder="g"
        className={inputCls + " w-20"}
      />
      <button type="button" onClick={anadir} disabled={!foodId || !gramos} className={btnPrimary}>
        Añadir
      </button>
      <button type="button" onClick={() => setAbierto(false)} className={btnGhost}>
        Cancelar
      </button>
    </div>
  );
}

export function MenuView({
  profile,
  foods,
  menus,
}: {
  profile: NutritionProfile;
  foods: FoodRow[];
  menus: ReturnType<typeof useMenus>;
}) {
  const [dia, setDia] = useState((new Date().getDay() + 6) % 7);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const { pedirTexto, confirmar, dialogos } = useDialogos();

  const target: Macros = {
    kcal: profile.kcal_objetivo,
    proteina: profile.proteina_g,
    grasa: profile.grasa_g,
    hidratos: profile.hidratos_g,
  };
  const foodsPorId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const permitidos = useMemo(
    () => foods.filter((f) => alimentoPermitido(f, profile.restricciones, profile.alimentos_excluidos)),
    [foods, profile.restricciones, profile.alimentos_excluidos],
  );
  const genFoods = useMemo(() => permitidos.map(aGenFood), [permitidos]);
  const genPorId = useMemo(() => new Map(foods.map((f) => [f.id, aGenFood(f)])), [foods]);

  const itemsDia = menus.porDia.get(dia) ?? [];
  const comidasActivas = comidasDelDia(profile.comidas_por_dia);
  const comidasMostradas = COMIDAS_ORDEN.filter(
    (c) => comidasActivas.includes(c) || itemsDia.some((i) => i.comida === c),
  );

  const macrosItem = (food_id: string, gramos: number): Macros => {
    const f = foodsPorId.get(food_id);
    return f ? macrosDe(f, gramos) : { kcal: 0, proteina: 0, grasa: 0, hidratos: 0 };
  };
  const totalDia = (d: number): Macros =>
    sumarMacros((menus.porDia.get(d) ?? []).map((i) => macrosItem(i.food_id, i.gramos)));
  const totalActual = totalDia(dia);

  const resumenSemana = useMemo(() => {
    const dias = [0, 1, 2, 3, 4, 5, 6].filter((d) => (menus.porDia.get(d) ?? []).length > 0);
    const totales = dias.map((d) =>
      sumarMacros((menus.porDia.get(d) ?? []).map((i) => macrosItem(i.food_id, i.gramos))),
    );
    const n = Math.max(1, dias.length);
    const media = sumarMacros(totales);
    return {
      dias: dias.length,
      media: {
        kcal: media.kcal / n,
        proteina: media.proteina / n,
        grasa: media.grasa / n,
        hidratos: media.hidratos / n,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menus.porDia, foodsPorId]);

  async function ejecutar(clave: string, fn: () => Promise<void>) {
    setOcupado(clave);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message || "No se pudo completar la acción.");
    } finally {
      setOcupado(null);
    }
  }

  function memoriaDelDiaAnterior() {
    const previo = menus.porDia.get((dia + 6) % 7) ?? [];
    return previo.length
      ? actualizarMemoria(
          memoriaVacia(),
          previo.map((i) => ({ comida: i.comida, foodId: i.food_id, gramos: i.gramos })),
          genPorId,
        )
      : memoriaVacia();
  }

  async function generarDiaActual() {
    if (
      itemsDia.length &&
      !(await confirmar({
        titulo: "¿Sustituir este día?",
        descripcion: "Los alimentos de este día se cambiarán por un menú nuevo.",
        etiquetaOk: "Sustituir",
      }))
    )
      return;
    await ejecutar("dia", async () => {
      const r = generarDia({
        foods: genFoods,
        target,
        comidas: comidasActivas,
        memoria: memoriaDelDiaAnterior(),
        semilla: semilla(),
      });
      if (!r.items.length) {
        toast.error(r.aviso ?? "No se ha podido generar el día.");
        return;
      }
      await menus.reemplazar(
        dia,
        r.items.map((i) => ({ comida: i.comida, food_id: i.foodId, gramos: i.gramos })),
      );
      if (r.aviso) toast.warning(r.aviso);
      else toast.success("Día generado.");
    });
  }

  const generarSemana = () =>
    ejecutar("semana", async () => {
      let memoria = memoriaVacia();
      const todos: { dia_semana: number; comida: Comida; food_id: string; gramos: number }[] = [];
      const avisos: string[] = [];
      const base = semilla();
      for (let d = 0; d < 7; d++) {
        const r = generarDia({ foods: genFoods, target, comidas: comidasActivas, memoria, semilla: base + d });
        if (!r.items.length) {
          toast.error(r.aviso ?? "No se ha podido generar el menú.");
          return;
        }
        memoria = actualizarMemoria(memoria, r.items, genPorId);
        for (const i of r.items) todos.push({ dia_semana: d, comida: i.comida, food_id: i.foodId, gramos: i.gramos });
        if (r.aviso) avisos.push(DIAS[d]);
      }
      const fecha = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
      await menus.crearMenu(`Menú generado ${fecha}`, todos);
      if (avisos.length) toast.warning(`Menú creado. Revisa: ${avisos.join(", ")} (no cuadra del todo con tu objetivo).`);
      else toast.success("Menú semanal generado en un menú nuevo.");
    });

  const regenerarComida = (comida: Comida) =>
    ejecutar("comida-" + comida, async () => {
      const fijos = itemsDia
        .filter((i) => i.comida !== comida)
        .map((i) => ({ comida: i.comida, food: genPorId.get(i.food_id)!, gramos: i.gramos }))
        .filter((x) => x.food);
      const r = generarDia({
        foods: genFoods,
        target,
        comidas: [comida],
        fijos,
        memoria: memoriaDelDiaAnterior(),
        semilla: semilla(),
      });
      if (!r.items.length) {
        toast.error(r.aviso ?? "No se ha podido regenerar la comida.");
        return;
      }
      await menus.reemplazar(
        dia,
        r.items.map((i) => ({ comida: i.comida, food_id: i.foodId, gramos: i.gramos })),
        [comida],
      );
      if (r.aviso) toast.warning(r.aviso);
    });

  const ajustarDia = () =>
    ejecutar("ajuste", async () => {
      const lista = itemsDia
        .map((i) => ({ item: i, food: genPorId.get(i.food_id) }))
        .filter((x): x is { item: (typeof itemsDia)[number]; food: GenFood } => !!x.food);
      if (!lista.length) return;
      const r = ajustarRaciones(
        lista.map((x) => ({ comida: x.item.comida, food: x.food, gramos: x.item.gramos })),
        target,
      );
      const cambios = lista
        .map((x, k) => ({ id: x.item.id, gramos: r.gramos[k], antes: x.item.gramos }))
        .filter((c) => c.gramos !== c.antes);
      if (cambios.length) await menus.actualizarVarios(cambios.map(({ id, gramos }) => ({ id, gramos })));
      if (r.error > 0.1) toast.warning("Con estos alimentos no se llega del todo al objetivo. Añade alimentos o genera el día.");
      else toast.success(cambios.length ? "Raciones ajustadas al objetivo." : "Las raciones ya cuadran.");
    });

  async function vaciarDia() {
    if (!itemsDia.length) return;
    const si = await confirmar({
      titulo: "¿Vaciar este día?",
      descripcion: "Se quitarán todos los alimentos de " + DIAS[dia].toLowerCase() + ".",
      etiquetaOk: "Vaciar",
      destructivo: true,
    });
    if (!si) return;
    await ejecutar("vaciar", async () => {
      await menus.reemplazar(dia, []);
    });
  }

  async function nuevoMenu() {
    const nombre = await pedirTexto({ titulo: "Nuevo menú", descripcion: "Ponle un nombre.", valorInicial: "Mi menú", etiquetaOk: "Crear" });
    if (!nombre) return;
    await ejecutar("nuevo", async () => {
      await menus.crearMenu(nombre);
    });
  }

  async function renombrar() {
    const actual = menus.menus.find((m) => m.id === menus.selectedId);
    if (!actual) return;
    const nombre = await pedirTexto({ titulo: "Renombrar menú", valorInicial: actual.nombre, etiquetaOk: "Guardar" });
    if (!nombre || nombre === actual.nombre) return;
    await ejecutar("renombrar", () => menus.renombrar(actual.id, nombre));
  }

  async function duplicar() {
    const actual = menus.menus.find((m) => m.id === menus.selectedId);
    if (!actual) return;
    const nombre = await pedirTexto({ titulo: "Duplicar menú", descripcion: "Nombre de la copia.", valorInicial: `${actual.nombre} (copia)`, etiquetaOk: "Duplicar" });
    if (!nombre) return;
    await ejecutar("duplicar", async () => {
      await menus.duplicarMenu(actual.id, nombre);
    });
  }

  async function eliminarMenu() {
    const actual = menus.menus.find((m) => m.id === menus.selectedId);
    if (!actual) return;
    const si = await confirmar({
      titulo: `¿Eliminar «${actual.nombre}»?`,
      descripcion: "Se borra el menú entero con todos sus días.",
      etiquetaOk: "Eliminar",
      destructivo: true,
    });
    if (!si) return;
    await ejecutar("eliminar", () => menus.eliminarMenu(actual.id));
  }

  if (menus.loading) return <p className="text-sm text-slate-400">Cargando…</p>;

  if (foods.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-300">
          Para planificar menús necesitas alimentos en tu biblioteca. Ve a la pestaña «Alimentos» y carga los básicos.
        </p>
      </Card>
    );
  }

  if (!menus.selectedId) {
    return (
      <Card>
        {dialogos}
        <p className="mb-1 text-sm font-semibold text-white">Todavía no tienes ningún menú</p>
        <p className="mb-4 text-xs text-slate-400">
          Puedes generar un menú semanal que cuadre con tus {fmt(target.kcal)} kcal y tus macros, o empezar uno vacío
          y montarlo tú.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={generarSemana} disabled={!!ocupado} className={btnPrimary}>
            <Sparkles className="h-4 w-4" /> {ocupado === "semana" ? "Generando…" : "Generar menú semanal"}
          </button>
          <button type="button" onClick={nuevoMenu} disabled={!!ocupado} className={btnSecondary}>
            Empezar uno vacío
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {dialogos}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={menus.selectedId}
            onChange={(e) => menus.seleccionar(e.target.value)}
            className={inputCls + " min-w-0 flex-1"}
            aria-label="Menú"
          >
            {menus.menus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
          <button type="button" onClick={nuevoMenu} disabled={!!ocupado} className={btnGhost}>
            Nuevo
          </button>
          <button type="button" onClick={renombrar} disabled={!!ocupado} className={btnGhost}>
            Renombrar
          </button>
          <button type="button" onClick={duplicar} disabled={!!ocupado} className={btnGhost}>
            Duplicar
          </button>
          <button type="button" onClick={eliminarMenu} disabled={!!ocupado} className={btnGhost + " hover:text-rose-400"}>
            Eliminar
          </button>
        </div>
        <button type="button" onClick={generarSemana} disabled={!!ocupado} className={btnSecondary + " w-full"}>
          <Sparkles className="h-4 w-4" />
          {ocupado === "semana" ? "Generando…" : "Generar un menú semanal nuevo (se guarda aparte)"}
        </button>
      </Card>

      <div className="grid grid-cols-7 gap-1.5">
        {DIAS_CORTOS.map((l, d) => {
          const t = totalDia(d);
          const hay = (menus.porDia.get(d) ?? []).length > 0;
          const desv = hay ? Math.abs(t.kcal - target.kcal) / target.kcal : 0;
          return (
            <button
              key={l}
              type="button"
              onClick={() => setDia(d)}
              className={
                "rounded-lg border px-1 py-2 text-center transition " +
                (d === dia ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-900/60 hover:border-slate-600")
              }
              aria-label={DIAS[d]}
            >
              <span className="block text-xs font-bold text-white">{l}</span>
              <span
                className={
                  "block text-[10px] " +
                  (!hay ? "text-slate-600" : desv <= 0.05 ? "text-emerald-400" : desv <= 0.15 ? "text-amber-300" : "text-rose-400")
                }
              >
                {hay ? fmt(t.kcal) : "—"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-bold text-white">{DIAS[dia]}</h2>
        <button type="button" onClick={generarDiaActual} disabled={!!ocupado} className={btnSecondary}>
          <Wand2 className="h-4 w-4" /> {ocupado === "dia" ? "Generando…" : "Generar día"}
        </button>
        <button type="button" onClick={ajustarDia} disabled={!!ocupado || !itemsDia.length} className={btnSecondary}>
          {ocupado === "ajuste" ? "Ajustando…" : "Ajustar raciones"}
        </button>
        <button type="button" onClick={vaciarDia} disabled={!!ocupado || !itemsDia.length} className={btnGhost}>
          Vaciar
        </button>
      </div>

      {comidasMostradas.map((comida) => {
        const items = itemsDia.filter((i) => i.comida === comida);
        const m = sumarMacros(items.map((i) => macrosItem(i.food_id, i.gramos)));
        return (
          <Card key={comida} className="!p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-white">{COMIDA_LABEL[comida]}</p>
                {items.length > 0 && <MacroPills m={m} />}
              </div>
              <button
                type="button"
                onClick={() => regenerarComida(comida)}
                disabled={!!ocupado}
                className={btnGhost}
                title="Regenerar esta comida (el resto del día se mantiene)"
              >
                <RefreshCw className={"h-3.5 w-3.5 " + (ocupado === "comida-" + comida ? "animate-spin" : "")} />
                Regenerar
              </button>
            </div>
            <div className="divide-y divide-slate-800/70">
              {items.map((i) => {
                const f = foodsPorId.get(i.food_id);
                if (!f) return null;
                return (
                  <ItemFila
                    key={i.id}
                    nombre={nombreCorto(f.nombre)}
                    food={f}
                    gramos={i.gramos}
                    fueraDeRestricciones={!alimentoPermitido(f, profile.restricciones, profile.alimentos_excluidos)}
                    onGramos={(g) =>
                      menus.actualizarGramos(i.id, g).catch((e) => toast.error((e as Error).message || "No se pudo guardar."))
                    }
                    onQuitar={() =>
                      menus.quitarItem(i.id).catch((e) => toast.error((e as Error).message || "No se pudo quitar."))
                    }
                  />
                );
              })}
            </div>
            {items.length === 0 && <p className="py-1 text-xs text-slate-600">Sin alimentos todavía.</p>}
            <AnadirAlimento
              comida={comida}
              foods={permitidos.length ? permitidos : foods}
              onAnadir={async (food, gramos) => {
                await menus.anadirItem({ dia_semana: dia, comida, food_id: food.id, gramos });
              }}
            />
          </Card>
        );
      })}

      <Card>
        <p className="mb-3 text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
          Total de {DIAS[dia].toLowerCase()} frente a tu objetivo
        </p>
        <div className="space-y-2.5">
          <MacroBar label="Calorías" valor={totalActual.kcal} objetivo={target.kcal} unidad="kcal" />
          <MacroBar label="Proteína" valor={totalActual.proteina} objetivo={target.proteina} unidad="g" />
          <MacroBar label="Grasa" valor={totalActual.grasa} objetivo={target.grasa} unidad="g" />
          <MacroBar label="Hidratos" valor={totalActual.hidratos} objetivo={target.hidratos} unidad="g" />
        </div>
        {itemsDia.length > 0 && Math.abs(totalActual.kcal - target.kcal) / target.kcal > 0.1 && (
          <div className="mt-3">
            <Aviso tono="gris">
              Este día se aleja más de un 10 % de tu objetivo. Prueba «Ajustar raciones» o «Generar día».
            </Aviso>
          </div>
        )}
      </Card>

      {resumenSemana.dias > 0 && (
        <Card>
          <p className="mb-3 text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
            Media de la semana ({resumenSemana.dias} {resumenSemana.dias === 1 ? "día" : "días"} con menú)
          </p>
          <div className="space-y-2.5">
            <MacroBar label="Calorías" valor={resumenSemana.media.kcal} objetivo={target.kcal} unidad="kcal" />
            <MacroBar label="Proteína" valor={resumenSemana.media.proteina} objetivo={target.proteina} unidad="g" />
            <MacroBar label="Grasa" valor={resumenSemana.media.grasa} objetivo={target.grasa} unidad="g" />
            <MacroBar label="Hidratos" valor={resumenSemana.media.hidratos} objetivo={target.hidratos} unidad="g" />
          </div>
        </Card>
      )}
    </div>
  );
}
