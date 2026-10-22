import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useFoodLog, type FoodRow, type NutritionProfile, type useMenus } from "@/hooks/use-nutrition";
import {
  COMIDAS_ORDEN,
  COMIDA_LABEL,
  comidasDelDia,
  equivalenteCocinado,
  macrosDe,
  type Comida,
  type Macros,
} from "@/lib/nutrition";
import { racionTipica, redondearRacion } from "@/lib/nutrition-generator";
import {
  buscarAlimentos,
  diaSemanaLunes,
  entradaDesdeAlimento,
  entradaManual,
  entradasDesdeMenu,
  etiquetaDia,
  gramosDesdeUnidades,
  parseNumero,
  recientes as calcularRecientes,
  restante,
  sumarDias,
  TAMANOS,
  totalesDelDia,
  unidadesDesdeGramos,
  validarEntradaManual,
  type EntradaDiario,
  type NuevaEntrada,
} from "@/lib/food-log";
import { PLATOS_CON_TAMANO } from "@/lib/food-recetas";
import { hoyISO } from "@/lib/weight-trend";
import { Aviso, Card, Field, MacroBar, MacroPills, SectionTitle, btnGhost, btnPrimary, btnSecondary, fmt, inputCls } from "./common";
import { useDialogos } from "./dialogs";
import { QueComoCard } from "./que-como-card";
import { aGenFood } from "./menu-view";

type Log = ReturnType<typeof useFoodLog>;

function textoUnidades(food: FoodRow | undefined, gramos: number | null): string | null {
  if (!food?.gramos_unidad || !food.unidad_nombre || !gramos) return null;
  const n = Math.round((gramos / food.gramos_unidad) * 10) / 10;
  return `≈ ${fmt(n, n % 1 ? 1 : 0)} ${food.unidad_nombre}${n === 1 ? "" : "s"}`;
}

/* ------------------------------ Una entrada del día ------------------------------ */

function FilaEntrada({
  entrada,
  food,
  onGramos,
  onQuitar,
}: {
  entrada: EntradaDiario;
  food: FoodRow | undefined;
  onGramos: (g: number) => void;
  onQuitar: () => void;
}) {
  const [valor, setValor] = useState(entrada.gramos != null ? String(entrada.gramos) : "");
  useEffect(() => setValor(entrada.gramos != null ? String(entrada.gramos) : ""), [entrada.gramos]);

  function confirmar() {
    const g = parseNumero(valor);
    if (g == null || !(g > 0) || g > 5000) {
      setValor(entrada.gramos != null ? String(entrada.gramos) : "");
      return;
    }
    if (g !== entrada.gramos) onGramos(g);
  }

  const unidades = textoUnidades(food, entrada.gramos);
  const cocinado = food && entrada.gramos ? equivalenteCocinado(food.factor_cocinado, entrada.gramos) : null;

  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-100">{entrada.nombre}</p>
        <p className="text-[11px] text-slate-500">
          {fmt(entrada.kcal)} kcal · P {fmt(entrada.proteina_g)} · G {fmt(entrada.grasa_g)} · H {fmt(entrada.hidratos_g)}
          {unidades ? ` · ${unidades}` : ""}
          {cocinado ? ` · ${cocinado}` : ""}
        </p>
      </div>
      {entrada.gramos != null ? (
        <div className="flex shrink-0 items-center gap-1">
          <input
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="w-16 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-right text-sm text-slate-100 outline-none focus:border-emerald-500"
            aria-label={`Gramos de ${entrada.nombre}`}
          />
          <span className="text-xs text-slate-500">g</span>
        </div>
      ) : (
        <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">a mano</span>
      )}
      <button type="button" onClick={onQuitar} className={btnGhost + " hover:text-rose-400"} aria-label={`Quitar ${entrada.nombre}`}>
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ------------------------------ Añadir a una comida ------------------------------ */

function PanelAnadir({
  comida,
  foods,
  foodsPorId,
  historial,
  onAnadir,
  onCerrar,
  onIrAAlimentos,
}: {
  comida: Comida;
  foods: FoodRow[];
  foodsPorId: Map<string, FoodRow>;
  historial: EntradaDiario[];
  onAnadir: (e: NuevaEntrada) => Promise<void>;
  onCerrar: () => void;
  onIrAAlimentos: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [elegido, setElegido] = useState<FoodRow | null>(null);
  const [modo, setModo] = useState<"g" | "u">("g");
  const [cantidad, setCantidad] = useState("");
  const [manual, setManual] = useState(false);
  const [m, setM] = useState({ nombre: "", kcal: "", proteina: "", grasa: "", hidratos: "" });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const resultados = useMemo(() => buscarAlimentos(foods, texto, comida), [foods, texto, comida]);
  const sugeridos = useMemo(
    () => calcularRecientes(historial, 12).filter((r) => foodsPorId.has(r.food_id)).slice(0, 8),
    [historial, foodsPorId],
  );

  function elegir(f: FoodRow) {
    const gr = redondearRacion(aGenFood(f), racionTipica(aGenFood(f)));
    setElegido(f);
    setError(null);
    if (f.gramos_unidad && f.unidad_nombre) {
      setModo("u");
      // Los platos con tamaño empiezan en «mediana»: 1 unidad
      setCantidad(PLATOS_CON_TAMANO.has(f.nombre) ? "1" : String(unidadesDesdeGramos(gr, f.gramos_unidad)));
    } else {
      setModo("g");
      setCantidad(String(gr));
    }
  }

  const cantidadNum = parseNumero(cantidad);
  const gramos =
    elegido && cantidadNum != null && cantidadNum > 0
      ? modo === "u" && elegido.gramos_unidad
        ? gramosDesdeUnidades(cantidadNum, elegido.gramos_unidad)
        : cantidadNum
      : null;
  const vista = elegido && gramos ? macrosDe(elegido, gramos) : null;
  const tieneUnidad = !!(elegido?.gramos_unidad && elegido.unidad_nombre);
  const conTamano = tieneUnidad && !!elegido && PLATOS_CON_TAMANO.has(elegido.nombre);

  async function guardar(entrada: NuevaEntrada, aviso?: string) {
    setGuardando(true);
    setError(null);
    try {
      await onAnadir(entrada);
      toast.success(`Añadido · ${fmt(entrada.kcal)} kcal`);
      if (aviso) toast.warning(aviso);
      return true;
    } catch (e) {
      setError((e as Error).message || "No se ha podido añadir.");
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function anadirElegido() {
    if (!elegido) return;
    if (!gramos || gramos > 5000) {
      setError("Pon una cantidad válida (mayor que 0).");
      return;
    }
    if (await guardar(entradaDesdeAlimento(elegido, gramos, comida, "", 0))) {
      setElegido(null);
      setTexto("");
      setCantidad("");
    }
  }

  async function repetirReciente(foodId: string, gramosReciente: number) {
    const f = foodsPorId.get(foodId);
    if (!f) return;
    await guardar(entradaDesdeAlimento(f, gramosReciente, comida, "", 0));
  }

  async function anadirManual() {
    const v = validarEntradaManual(m);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (await guardar(entradaManual(v.valor, comida, "", 0), v.aviso)) setM({ nombre: "", kcal: "", proteina: "", grasa: "", hidratos: "" });
  }

  const presets = modo === "u" ? [1, 2, 3, 4] : [50, 100, 150, 200];

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
          {manual ? "Añadir a mano" : `Añadir a ${COMIDA_LABEL[comida].toLowerCase()}`}
        </p>
        <button type="button" onClick={onCerrar} className={btnGhost} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>

      {manual ? (
        <div className="space-y-3">
          <Field label="Qué has comido">
            <input value={m.nombre} onChange={(e) => setM({ ...m, nombre: e.target.value })} placeholder="Menú del restaurante" className={inputCls} />
          </Field>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                ["kcal", "Kcal"],
                ["proteina", "Prot. (g)"],
                ["grasa", "Grasa (g)"],
                ["hidratos", "Hidr. (g)"],
              ] as const
            ).map(([k, etiqueta]) => (
              <Field key={k} label={etiqueta}>
                <input inputMode="decimal" value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} className={inputCls} />
              </Field>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={anadirManual} disabled={guardando} className={btnPrimary}>
              Añadir
            </button>
            <button type="button" onClick={() => { setManual(false); setError(null); }} className={btnSecondary}>
              Volver a buscar
            </button>
          </div>
        </div>
      ) : elegido ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{elegido.nombre}</p>
              <p className="text-[11px] text-slate-500">
                por 100 g: {fmt(elegido.kcal_100)} kcal · P {fmt(elegido.proteina_100, 1)} · G {fmt(elegido.grasa_100, 1)} · H{" "}
                {fmt(elegido.hidratos_100, 1)}
              </p>
            </div>
            <button type="button" onClick={() => setElegido(null)} className={btnGhost}>
              Cambiar
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              inputMode="decimal"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && anadirElegido()}
              className={inputCls + " w-24"}
              aria-label="Cantidad"
              autoFocus
            />
            {tieneUnidad ? (
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-800 text-xs font-semibold">
                {(["g", "u"] as const).map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => {
                      if (x === modo) return;
                      const n = parseNumero(cantidad);
                      if (n != null && elegido.gramos_unidad) {
                        setCantidad(String(x === "u" ? unidadesDesdeGramos(n, elegido.gramos_unidad) : gramosDesdeUnidades(n, elegido.gramos_unidad)));
                      }
                      setModo(x);
                    }}
                    className={"px-3 py-2 transition " + (modo === x ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400 hover:text-white")}
                  >
                    {x === "g" ? "gramos" : `${elegido.unidad_nombre}s`}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-sm text-slate-500">gramos</span>
            )}
          </div>

          {conTamano && elegido.gramos_unidad && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Tamaño:</span>
              {TAMANOS.map((t) => {
                const activo = modo === "u" && cantidadNum === t.factor;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setModo("u");
                      setCantidad(String(t.factor));
                    }}
                    aria-pressed={activo}
                    className={
                      "rounded-full border px-2.5 py-1 text-[11.5px] transition " +
                      (activo ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "border-slate-800 text-slate-400 hover:border-emerald-500 hover:text-white")
                    }
                  >
                    {t.id} · ~{fmt(Math.round(elegido.gramos_unidad! * t.factor))} g
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setCantidad(String(p))}
                className="rounded-full border border-slate-800 px-2.5 py-1 text-[11.5px] text-slate-400 transition hover:border-emerald-500 hover:text-white"
              >
                {p} {modo === "u" ? "" : "g"}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
            {vista ? (
              <>
                <p className="text-xs text-slate-400">
                  {fmt(gramos!)} g{textoUnidades(elegido, gramos) ? ` (${textoUnidades(elegido, gramos)})` : ""}
                  {equivalenteCocinado(elegido.factor_cocinado, gramos!) ? ` · ${equivalenteCocinado(elegido.factor_cocinado, gramos!)}` : ""}
                </p>
                <MacroPills m={vista} />
              </>
            ) : (
              <p className="text-xs text-slate-500">Escribe una cantidad para ver las calorías y los macros.</p>
            )}
          </div>

          <button type="button" onClick={anadirElegido} disabled={guardando || !vista} className={btnPrimary + " w-full"}>
            <Plus className="h-4 w-4" /> Añadir
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Busca un alimento… (pollo, arroz, plátano)"
              className={inputCls + " pl-9"}
              autoFocus
            />
          </div>

          {texto.trim() === "" && sugeridos.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recientes · un toque para repetir</p>
              <div className="flex flex-wrap gap-1.5">
                {sugeridos.map((r) => (
                  <button
                    key={r.food_id}
                    type="button"
                    disabled={guardando}
                    onClick={() => repetirReciente(r.food_id, r.gramos)}
                    className="rounded-full border border-slate-800 px-2.5 py-1 text-[11.5px] text-slate-300 transition hover:border-emerald-500 hover:text-white disabled:opacity-50"
                  >
                    {r.nombre.split("(")[0].trim()} · {fmt(r.gramos)} g
                  </button>
                ))}
              </div>
            </div>
          )}

          {resultados.length > 0 && (
            <div className="space-y-1">
              {resultados.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => elegir(f)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-left transition hover:border-emerald-500"
                >
                  <span className="truncate text-sm text-slate-100">{f.nombre}</span>
                  <span className="shrink-0 text-[11px] text-slate-500">{fmt(f.kcal_100)} kcal/100 g</span>
                </button>
              ))}
            </div>
          )}

          {texto.trim() !== "" && resultados.length === 0 && (
            <Aviso tono="gris">
              No hay «{texto.trim()}» en tu biblioteca. Puedes añadirlo en la pestaña Alimentos (también importándolo por código de barras)
              o apuntarlo a mano aquí.
            </Aviso>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setManual(true); setError(null); setM({ ...m, nombre: texto.trim() }); }} className={btnSecondary}>
              Añadir a mano
            </button>
            {texto.trim() !== "" && resultados.length === 0 && (
              <button type="button" onClick={onIrAAlimentos} className={btnSecondary}>
                Ir a Alimentos
              </button>
            )}
          </div>
        </div>
      )}

      {error && <Aviso tono="rojo">{error}</Aviso>}
    </div>
  );
}

/* ------------------------------ Pantalla ------------------------------ */

export function DiarioContenido({
  fecha,
  onFecha,
  profile,
  foods,
  menus,
  log,
  onIrAAlimentos,
}: {
  fecha: string;
  onFecha: (f: string) => void;
  profile: NutritionProfile;
  foods: FoodRow[];
  menus: ReturnType<typeof useMenus>;
  log: Log;
  onIrAAlimentos: () => void;
}) {
  const hoy = hoyISO();
  const [anadirEn, setAnadirEn] = useState<Comida | null>(null);
  const { confirmar, dialogos } = useDialogos();

  const target: Macros = {
    kcal: profile.kcal_objetivo,
    proteina: profile.proteina_g,
    grasa: profile.grasa_g,
    hidratos: profile.hidratos_g,
  };
  const foodsPorId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const total = totalesDelDia(log.entradas);
  const falta = restante(target, total);

  const comidasActivas = comidasDelDia(profile.comidas_por_dia);
  const comidasMostradas = COMIDAS_ORDEN.filter(
    (c) => comidasActivas.includes(c) || log.entradas.some((e) => e.comida === c) || anadirEn === c,
  );

  const itemsMenu = menus.selectedId ? (menus.porDia.get(diaSemanaLunes(fecha)) ?? []) : [];
  const nombreMenu = menus.menus.find((x) => x.id === menus.selectedId)?.nombre ?? "";

  async function anadirEnComida(comida: Comida, e: NuevaEntrada) {
    const orden = log.entradas.filter((x) => x.comida === comida).length;
    await log.anadir([{ ...e, fecha, comida, orden }]);
  }

  async function copiarMenu() {
    if (log.entradas.length > 0) {
      const si = await confirmar({
        titulo: "¿Añadir también los alimentos del menú?",
        descripcion: "Este día ya tiene alimentos. Se sumarán los del menú sin quitar los que ya hay.",
        etiquetaOk: "Añadir",
      });
      if (!si) return;
    }
    try {
      const nuevas = entradasDesdeMenu(itemsMenu, foodsPorId, fecha);
      if (!nuevas.length) {
        toast.error("Los alimentos de ese día del menú ya no están en tu biblioteca.");
        return;
      }
      await log.anadir(nuevas);
      toast.success(`Menú copiado: ${nuevas.length} alimentos.`);
    } catch (e) {
      toast.error((e as Error).message || "No se ha podido copiar el menú.");
    }
  }

  if (log.error) {
    return (
      <Card>
        <Aviso>
          El diario todavía no está preparado (falta aplicar la migración «diario_de_comidas» en Supabase).
        </Aviso>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {dialogos}

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onFecha(sumarDias(fecha, -1))} className={btnSecondary} aria-label="Día anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-base font-bold text-white">{etiquetaDia(fecha, hoy)}</p>
          <p className="text-[11px] text-slate-500">{fecha.split("-").reverse().join("/")}</p>
        </div>
        <button type="button" onClick={() => onFecha(sumarDias(fecha, 1))} className={btnSecondary} aria-label="Día siguiente">
          <ChevronRight className="h-4 w-4" />
        </button>
        {fecha !== hoy && (
          <button type="button" onClick={() => onFecha(hoy)} className={btnGhost}>
            Hoy
          </button>
        )}
      </div>

      <Card>
        <SectionTitle>Total del día frente a tu objetivo</SectionTitle>
        <div className="space-y-2.5">
          <MacroBar label="Calorías" valor={total.kcal} objetivo={target.kcal} unidad="kcal" />
          <MacroBar label="Proteína" valor={total.proteina} objetivo={target.proteina} unidad="g" />
          <MacroBar label="Grasa" valor={total.grasa} objetivo={target.grasa} unidad="g" />
          <MacroBar label="Hidratos" valor={total.hidratos} objetivo={target.hidratos} unidad="g" />
        </div>
        <p className={"mt-3 text-xs " + (falta.kcal >= 0 ? "text-slate-400" : "text-amber-300")}>
          {log.entradas.length === 0
            ? "Todavía no has añadido nada a este día."
            : falta.kcal >= 0
              ? `Te quedan ${fmt(falta.kcal)} kcal${falta.proteina > 0 ? ` y ${fmt(falta.proteina)} g de proteína` : ""}.`
              : `Te has pasado ${fmt(-falta.kcal)} kcal del objetivo.`}
        </p>
      </Card>

      {fecha >= hoy && (
        <QueComoCard fecha={fecha} profile={profile} foods={foods} restante={falta} entradas={log.entradas} onAnadir={async (es) => { await log.anadir(es); }} />
      )}

      {comidasMostradas.map((comida) => {
        const entradas = log.entradas.filter((e) => e.comida === comida);
        const m = totalesDelDia(entradas);
        return (
          <Card key={comida} className="!p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-white">{COMIDA_LABEL[comida]}</p>
                {entradas.length > 0 && <MacroPills m={m} />}
              </div>
              {anadirEn !== comida && (
                <button type="button" onClick={() => setAnadirEn(comida)} className={btnSecondary}>
                  <Plus className="h-4 w-4" /> Añadir
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-800/70">
              {entradas.map((e) => (
                <FilaEntrada
                  key={e.id}
                  entrada={e}
                  food={e.food_id ? foodsPorId.get(e.food_id) : undefined}
                  onGramos={(g) => log.cambiarGramos(e.id, g).catch((err) => toast.error((err as Error).message || "No se pudo guardar."))}
                  onQuitar={() => log.quitar(e.id).catch((err) => toast.error((err as Error).message || "No se pudo quitar."))}
                />
              ))}
            </div>
            {entradas.length === 0 && anadirEn !== comida && <p className="py-1 text-xs text-slate-600">Sin alimentos todavía.</p>}
            {anadirEn === comida && (
              <PanelAnadir
                comida={comida}
                foods={foods}
                foodsPorId={foodsPorId}
                historial={log.historial}
                onAnadir={(e) => anadirEnComida(comida, e)}
                onCerrar={() => setAnadirEn(null)}
                onIrAAlimentos={onIrAAlimentos}
              />
            )}
          </Card>
        );
      })}

      {itemsMenu.length > 0 && (
        <button type="button" onClick={copiarMenu} className={btnSecondary + " w-full"}>
          <Copy className="h-4 w-4" /> Copiar el menú de {etiquetaDia(fecha, hoy).toLowerCase()} ({nombreMenu})
        </button>
      )}
    </div>
  );
}

export function DiarioView({
  profile,
  foods,
  menus,
  onIrAAlimentos,
}: {
  profile: NutritionProfile;
  foods: FoodRow[];
  menus: ReturnType<typeof useMenus>;
  onIrAAlimentos: () => void;
}) {
  const [fecha, setFecha] = useState(hoyISO());
  const log = useFoodLog(fecha);
  return (
    <DiarioContenido
      fecha={fecha}
      onFecha={setFecha}
      profile={profile}
      foods={foods}
      menus={menus}
      log={log}
      onIrAAlimentos={onIrAAlimentos}
    />
  );
}
