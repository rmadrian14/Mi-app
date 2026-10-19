import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { FoodInput, FoodRow } from "@/hooks/use-nutrition";
import {
  COMIDAS_ORDEN,
  COMIDA_LABEL,
  RESTRICCIONES,
  alimentoPermitido,
  equivalenteCocinado,
  macrosDe,
  type CategoriaAlimento,
} from "@/lib/nutrition";
import { buscarPorCodigo, buscarPorTexto, type ProductoOff } from "@/lib/openfoodfacts";
import { Aviso, Card, Field, MacroPills, SectionTitle, btnGhost, btnPrimary, btnSecondary, fmt, inputCls } from "./common";
import { useDialogos } from "./dialogs";

export const CATEGORIAS: { id: CategoriaAlimento; label: string }[] = [
  { id: "proteina", label: "Proteínas" },
  { id: "hidrato", label: "Hidratos" },
  { id: "legumbre", label: "Legumbres" },
  { id: "verdura", label: "Verduras" },
  { id: "fruta", label: "Frutas" },
  { id: "lacteo", label: "Lácteos y bebidas" },
  { id: "grasa", label: "Grasas" },
  { id: "otro", label: "Otros" },
];

const MARCAS_CONTIENE = [
  ...RESTRICCIONES.filter((r) => r.grupo === "alergeno").map((r) => ({ id: r.excluye[0], label: r.label })),
  { id: "carne", label: "Carne" },
  { id: "cerdo", label: "Cerdo" },
];

const num = (s: string) => parseFloat(s.replace(",", "."));

type FormState = {
  nombre: string;
  categoria: CategoriaAlimento;
  kcal: string;
  prot: string;
  gras: string;
  hidr: string;
  unidadNombre: string;
  unidadGramos: string;
  min: string;
  max: string;
  comidas: string[];
  contiene: string[];
  origen: FoodRow["origen"];
  codigo: string | null;
  factor: string; // peso cocinado / peso pesado ("" = sin dato)
  frecuencia: string; // cuánto aparece en los menús generados
};

const FRECUENCIAS = [
  { valor: "0.5", label: "Poco" },
  { valor: "1", label: "Normal" },
  { valor: "1.6", label: "Mucho" },
];

function estadoInicial(f?: FoodRow | null): FormState {
  return {
    nombre: f?.nombre ?? "",
    categoria: f?.categoria ?? "proteina",
    kcal: f ? String(f.kcal_100) : "",
    prot: f ? String(f.proteina_100) : "",
    gras: f ? String(f.grasa_100) : "",
    hidr: f ? String(f.hidratos_100) : "",
    unidadNombre: f?.unidad_nombre ?? "",
    unidadGramos: f?.gramos_unidad != null ? String(f.gramos_unidad) : "",
    min: f ? String(f.porcion_min_g) : "50",
    max: f ? String(f.porcion_max_g) : "250",
    comidas: f?.comidas ?? [],
    contiene: f?.contiene ?? [],
    origen: f?.origen ?? "manual",
    codigo: f?.codigo_barras ?? null,
    factor: f?.factor_cocinado != null ? String(f.factor_cocinado) : "",
    frecuencia: f ? String(f.frecuencia) : "1",
  };
}

function FormularioAlimento({
  inicial,
  onCancelar,
  onGuardar,
}: {
  inicial: FoodRow | null;
  onCancelar: () => void;
  onGuardar: (input: FoodInput) => Promise<void>;
}) {
  const [s, setS] = useState<FormState>(estadoInicial(inicial));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ProductoOff[]>([]);
  const set = (patch: Partial<FormState>) => setS((p) => ({ ...p, ...patch }));
  const toggle = (campo: "comidas" | "contiene", v: string) =>
    set({ [campo]: s[campo].includes(v) ? s[campo].filter((x) => x !== v) : [...s[campo], v] } as Partial<FormState>);

  function aplicarProducto(p: ProductoOff) {
    set({
      nombre: p.marca ? `${p.nombre} (${p.marca})` : p.nombre,
      categoria: "otro",
      kcal: String(p.kcal_100),
      prot: String(p.proteina_100),
      gras: String(p.grasa_100),
      hidr: String(p.hidratos_100),
      contiene: p.contiene,
      origen: "openfoodfacts",
      codigo: p.codigo || null,
    });
    setResultados([]);
    toast.success("Producto cargado. Revisa los datos y elige categoría y comidas antes de guardar.");
  }

  async function importar(modo: "codigo" | "texto") {
    setBuscando(true);
    setError(null);
    setResultados([]);
    try {
      if (modo === "codigo") aplicarProducto(await buscarPorCodigo(codigo));
      else {
        const lista = await buscarPorTexto(texto);
        if (lista.length === 1) aplicarProducto(lista[0]);
        else setResultados(lista);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  const kcalMacros = 4 * (num(s.prot) || 0) + 9 * (num(s.gras) || 0) + 4 * (num(s.hidr) || 0);
  const kcalNum = num(s.kcal) || 0;
  const incoherente = kcalNum > 0 && Math.abs(kcalMacros - kcalNum) > Math.max(30, kcalNum * 0.2);

  async function guardar() {
    const nombre = s.nombre.trim();
    const kcal = num(s.kcal);
    const p = num(s.prot);
    const g = num(s.gras);
    const h = num(s.hidr);
    const min = num(s.min);
    const max = num(s.max);
    if (!nombre) return setError("Pon un nombre.");
    if (![kcal, p, g, h].every((v) => Number.isFinite(v) && v >= 0)) return setError("Rellena calorías y macros por 100 g.");
    if (kcal > 900) return setError("Las calorías por 100 g no pueden superar 900.");
    if (p + g + h > 100.5) return setError("Proteína + grasa + hidratos no pueden superar 100 g por cada 100 g.");
    if (!(min > 0 && max >= min)) return setError("La ración mínima debe ser mayor que 0 y no superar la máxima.");
    const unidadG = s.unidadGramos.trim() ? num(s.unidadGramos) : null;
    if (unidadG != null && !(unidadG > 0)) return setError("Los gramos por unidad deben ser mayores que 0.");
    const factor = s.factor.trim() ? num(s.factor) : null;
    if (factor != null && !(factor > 0 && factor <= 10)) return setError("El factor de cocinado debe estar entre 0 y 10 (o déjalo vacío).");
    setGuardando(true);
    setError(null);
    try {
      await onGuardar({
        nombre,
        categoria: s.categoria,
        kcal_100: Math.round(kcal * 10) / 10,
        proteina_100: Math.round(p * 10) / 10,
        grasa_100: Math.round(g * 10) / 10,
        hidratos_100: Math.round(h * 10) / 10,
        gramos_unidad: unidadG,
        unidad_nombre: unidadG != null ? s.unidadNombre.trim() || "unidad" : null,
        porcion_min_g: min,
        porcion_max_g: max,
        comidas: s.comidas,
        contiene: s.contiene,
        origen: s.origen,
        codigo_barras: s.codigo,
        factor_cocinado: factor,
        frecuencia: Number(s.frecuencia) || 1,
      });
    } catch (e) {
      const msg = (e as { message?: string }).message ?? "";
      setError(/duplicate|unique/i.test(msg) ? "Ya existe un alimento con ese nombre." : msg || "No se ha podido guardar.");
      setGuardando(false);
    }
  }

  return (
    <Card className="border-emerald-500/30">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>{inicial ? "Editar alimento" : "Nuevo alimento"}</SectionTitle>
        <button type="button" onClick={onCancelar} className={btnGhost + " mb-3"} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!inicial && (
        <div className="mb-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] font-semibold text-slate-400">Importar producto envasado (Open Food Facts)</p>
          <div className="flex gap-2">
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Código de barras"
              inputMode="numeric"
              className={inputCls}
            />
            <button type="button" onClick={() => importar("codigo")} disabled={buscando || !codigo.trim()} className={btnSecondary}>
              {buscando ? "…" : "Buscar"}
            </button>
          </div>
          <div className="flex gap-2">
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="o buscar por nombre" className={inputCls} />
            <button type="button" onClick={() => importar("texto")} disabled={buscando || texto.trim().length < 3} className={btnSecondary}>
              {buscando ? "…" : "Buscar"}
            </button>
          </div>
          {resultados.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {resultados.map((r, i) => (
                <button
                  key={`${r.codigo}-${i}`}
                  type="button"
                  onClick={() => aplicarProducto(r)}
                  className="block w-full rounded-lg border border-slate-800 px-2.5 py-1.5 text-left text-xs text-slate-300 hover:border-emerald-500"
                >
                  <span className="font-semibold text-white">{r.nombre}</span>
                  {r.marca ? ` · ${r.marca}` : ""} — {fmt(r.kcal_100)} kcal · P {fmt(r.proteina_100, 1)} · G{" "}
                  {fmt(r.grasa_100, 1)} · H {fmt(r.hidratos_100, 1)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nombre">
            <input value={s.nombre} onChange={(e) => set({ nombre: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Categoría">
            <select value={s.categoria} onChange={(e) => set({ categoria: e.target.value as CategoriaAlimento })} className={inputCls}>
              {CATEGORIAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Valores por 100 g</p>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                ["kcal", "Kcal"],
                ["prot", "Prot. (g)"],
                ["gras", "Grasa (g)"],
                ["hidr", "Hidr. (g)"],
              ] as const
            ).map(([k, etiqueta]) => (
              <Field key={k} label={etiqueta}>
                <input inputMode="decimal" value={s[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<FormState>)} className={inputCls} />
              </Field>
            ))}
          </div>
          {incoherente && (
            <div className="mt-2">
              <Aviso>
                Los macros suman {fmt(kcalMacros)} kcal por 100 g, bastante distinto de {fmt(kcalNum)}. Revisa que no
                haya un error al copiar la etiqueta.
              </Aviso>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Ración mín. (g)">
            <input inputMode="decimal" value={s.min} onChange={(e) => set({ min: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Ración máx. (g)">
            <input inputMode="decimal" value={s.max} onChange={(e) => set({ max: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Unidad (opcional)" hint="p. ej. huevo">
            <input value={s.unidadNombre} onChange={(e) => set({ unidadNombre: e.target.value })} className={inputCls} />
          </Field>
          <Field label="g por unidad" hint="p. ej. 50">
            <input inputMode="decimal" value={s.unidadGramos} onChange={(e) => set({ unidadGramos: e.target.value })} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Cocinado ≈ × (opcional)"
            hint="Cuánto pesa cocinado respecto a como lo pesas. Arroz crudo ≈ 2,8; pollo crudo ≈ 0,75."
          >
            <input inputMode="decimal" value={s.factor} onChange={(e) => set({ factor: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Aparece en menús" hint="Con qué frecuencia lo elige el generador.">
            <select value={s.frecuencia} onChange={(e) => set({ frecuencia: e.target.value })} className={inputCls}>
              {FRECUENCIAS.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.label}
                </option>
              ))}
              {!FRECUENCIAS.some((f) => f.valor === s.frecuencia) && (
                <option value={s.frecuencia}>Ajustado ({s.frecuencia})</option>
              )}
            </select>
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            ¿En qué comidas encaja? (para generar menús)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COMIDAS_ORDEN.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggle("comidas", c)}
                className={
                  "rounded-full border px-2.5 py-1 text-[11.5px] transition " +
                  (s.comidas.includes(c) ? "border-emerald-500 bg-emerald-500/15 text-emerald-200" : "border-slate-800 text-slate-400 hover:text-white")
                }
              >
                {COMIDA_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Contiene (alérgenos y dieta; se usa para filtrar)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MARCAS_CONTIENE.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle("contiene", m.id)}
                className={
                  "rounded-full border px-2.5 py-1 text-[11.5px] transition " +
                  (s.contiene.includes(m.id) ? "border-rose-500 bg-rose-500/15 text-rose-200" : "border-slate-800 text-slate-400 hover:text-white")
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {error && <Aviso tono="rojo">{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className={btnSecondary}>
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando} className={btnPrimary}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </Card>
  );
}

export function AlimentosView({
  foods,
  loading,
  restricciones,
  excluidos,
  onCrear,
  onActualizar,
  onEliminar,
  onCargarBasicos,
}: {
  foods: FoodRow[];
  loading: boolean;
  restricciones: string[];
  excluidos: string | null;
  onCrear: (input: FoodInput) => Promise<unknown>;
  onActualizar: (id: string, patch: Partial<FoodInput>) => Promise<unknown>;
  onEliminar: (id: string) => Promise<void>;
  onCargarBasicos: () => Promise<void>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<CategoriaAlimento | "todas">("todas");
  const [editando, setEditando] = useState<FoodRow | "nuevo" | null>(null);
  const [calcId, setCalcId] = useState("");
  const [calcGramos, setCalcGramos] = useState("100");
  const { confirmar, dialogos } = useDialogos();

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return foods.filter(
      (f) => (categoria === "todas" || f.categoria === categoria) && (!q || f.nombre.toLowerCase().includes(q)),
    );
  }, [foods, busqueda, categoria]);

  const calcFood = foods.find((f) => f.id === calcId) ?? null;
  const calcMacros = calcFood ? macrosDe(calcFood, num(calcGramos) || 0) : null;

  async function eliminar(f: FoodRow) {
    const si = await confirmar({
      titulo: `¿Eliminar «${f.nombre}»?`,
      descripcion: "También desaparecerá de los menús donde se use.",
      etiquetaOk: "Eliminar",
      destructivo: true,
    });
    if (!si) return;
    try {
      await onEliminar(f.id);
      toast.success("Alimento eliminado.");
    } catch (e) {
      toast.error((e as Error).message || "No se pudo eliminar.");
    }
  }

  if (editando) {
    return (
      <FormularioAlimento
        inicial={editando === "nuevo" ? null : editando}
        onCancelar={() => setEditando(null)}
        onGuardar={async (input) => {
          if (editando === "nuevo") await onCrear(input);
          else await onActualizar(editando.id, input);
          toast.success("Alimento guardado.");
          setEditando(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {dialogos}
      <Card>
        <SectionTitle>Calculadora de raciones</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <select value={calcId} onChange={(e) => setCalcId(e.target.value)} className={inputCls}>
              <option value="">Elige un alimento…</option>
              {foods.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
          <input inputMode="decimal" value={calcGramos} onChange={(e) => setCalcGramos(e.target.value)} className={inputCls} placeholder="gramos" />
        </div>
        {calcMacros && (
          <p className="mt-2 text-sm text-slate-300">
            {calcGramos || 0} g de {calcFood!.nombre.split("(")[0].trim()}: <MacroPills m={calcMacros} />
            {equivalenteCocinado(calcFood!.factor_cocinado, num(calcGramos) || 0) && (
              <span className="ml-1 text-xs text-slate-500">
                ({equivalenteCocinado(calcFood!.factor_cocinado, num(calcGramos) || 0)})
              </span>
            )}
          </p>
        )}
      </Card>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar alimento…" className={inputCls + " pl-9"} />
        </div>
        <button type="button" onClick={() => setEditando("nuevo")} className={btnPrimary}>
          <Plus className="h-4 w-4" /> Añadir
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[{ id: "todas" as const, label: "Todos" }, ...CATEGORIAS].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoria(c.id)}
            className={
              "rounded-full border px-2.5 py-1 text-[11.5px] transition " +
              (categoria === c.id ? "border-emerald-500 bg-emerald-500/15 text-emerald-200" : "border-slate-800 text-slate-400 hover:text-white")
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : foods.length === 0 ? (
        <Card>
          <p className="mb-3 text-sm text-slate-300">Tu biblioteca está vacía.</p>
          <button type="button" onClick={() => onCargarBasicos().then(() => toast.success("Alimentos básicos cargados."))} className={btnPrimary}>
            Cargar alimentos básicos
          </button>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtrados.map((f) => {
            const permitido = alimentoPermitido(f, restricciones, excluidos);
            return (
              <div
                key={f.id}
                className={
                  "flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 " +
                  (permitido ? "" : "opacity-50")
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{f.nombre}</p>
                  <p className="text-[11px] text-slate-500">
                    por 100 g: {fmt(f.kcal_100)} kcal · P {fmt(f.proteina_100, 1)} · G {fmt(f.grasa_100, 1)} · H{" "}
                    {fmt(f.hidratos_100, 1)}
                    {!permitido && " · no encaja con tus restricciones"}
                  </p>
                </div>
                <button type="button" onClick={() => setEditando(f)} className={btnGhost} aria-label="Editar">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => eliminar(f)} className={btnGhost + " hover:text-rose-400"} aria-label="Eliminar">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          {filtrados.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Sin resultados.</p>}
        </div>
      )}

      {foods.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-800 px-3 py-2.5">
          <p className="text-[11px] text-slate-500">
            Valores de la base de datos USDA FoodData Central. Revisa la etiqueta de los productos envasados.
          </p>
          <button
            type="button"
            onClick={() => onCargarBasicos().then(() => toast.success("Alimentos básicos restaurados (sin tocar los que ya tienes)."))}
            className={btnGhost + " shrink-0"}
          >
            Restaurar básicos
          </button>
        </div>
      )}
    </div>
  );
}
