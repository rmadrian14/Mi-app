// Lógica del diario de comidas (qué se come cada día): calcular una ración, cambiar
// gramos sin perder la proporción, totales del día, recientes, búsqueda y entradas
// a mano. Funciones puras, sin acceso a datos.
//
// Cada entrada guarda una "foto" de sus valores (nombre, gramos, kcal y macros) en
// el momento de añadirla: el historial no cambia si luego se edita o se borra el
// alimento de la biblioteca.
import { macrosDe, normalizarTexto, type Comida, type FoodNutri, type Macros } from "./nutrition";

export type EntradaDiario = {
  id: string;
  fecha: string; // AAAA-MM-DD
  comida: Comida;
  food_id: string | null; // null: entrada a mano o alimento ya borrado
  nombre: string;
  gramos: number | null; // null en las entradas a mano
  kcal: number;
  proteina_g: number;
  grasa_g: number;
  hidratos_g: number;
  orden: number;
  created_at?: string;
};

export type NuevaEntrada = Omit<EntradaDiario, "id" | "created_at">;

type AlimentoDiario = FoodNutri & {
  id: string;
  nombre: string;
  gramos_unidad?: number | null;
  comidas?: string[];
};

const r1 = (x: number) => Math.round(x * 10) / 10;

/* ------------------------------ Calcular raciones ------------------------------ */

// Lo que se rellena solo: kcal y macros de una cantidad de un alimento.
export function entradaDesdeAlimento(
  food: AlimentoDiario,
  gramos: number,
  comida: Comida,
  fecha: string,
  orden = 0,
): NuevaEntrada {
  const m = macrosDe(food, gramos);
  return {
    fecha,
    comida,
    food_id: food.id,
    nombre: food.nombre,
    gramos: r1(gramos),
    kcal: r1(m.kcal),
    proteina_g: r1(m.proteina),
    grasa_g: r1(m.grasa),
    hidratos_g: r1(m.hidratos),
    orden,
  };
}

export const gramosDesdeUnidades = (unidades: number, gramosUnidad: number) => r1(unidades * gramosUnidad);
export const unidadesDesdeGramos = (gramos: number, gramosUnidad: number) => Math.round((gramos / gramosUnidad) * 10) / 10;

// Cambia los gramos de una entrada manteniendo la proporción de sus valores.
// Sin gramos (entrada a mano) o con una cantidad no válida no se puede escalar.
export function escalarEntrada(e: EntradaDiario, nuevosGramos: number): EntradaDiario | null {
  if (!e.gramos || e.gramos <= 0 || !(nuevosGramos > 0) || !Number.isFinite(nuevosGramos)) return null;
  const f = nuevosGramos / e.gramos;
  return {
    ...e,
    gramos: r1(nuevosGramos),
    kcal: r1(e.kcal * f),
    proteina_g: r1(e.proteina_g * f),
    grasa_g: r1(e.grasa_g * f),
    hidratos_g: r1(e.hidratos_g * f),
  };
}

export const macrosDeEntrada = (e: EntradaDiario): Macros => ({
  kcal: e.kcal,
  proteina: e.proteina_g,
  grasa: e.grasa_g,
  hidratos: e.hidratos_g,
});

export function totalesDelDia(entradas: EntradaDiario[]): Macros {
  return entradas.reduce<Macros>(
    (a, e) => ({
      kcal: a.kcal + e.kcal,
      proteina: a.proteina + e.proteina_g,
      grasa: a.grasa + e.grasa_g,
      hidratos: a.hidratos + e.hidratos_g,
    }),
    { kcal: 0, proteina: 0, grasa: 0, hidratos: 0 },
  );
}

// Lo que falta (positivo) o lo que se ha pasado (negativo) respecto al objetivo.
export function restante(objetivo: Macros, total: Macros): Macros {
  return {
    kcal: objetivo.kcal - total.kcal,
    proteina: objetivo.proteina - total.proteina,
    grasa: objetivo.grasa - total.grasa,
    hidratos: objetivo.hidratos - total.hidratos,
  };
}

/* ------------------------------ Recientes y búsqueda ------------------------------ */

export type Reciente = { food_id: string; nombre: string; gramos: number };

// Alimentos usados últimamente (sin repetir), el más reciente primero, con la
// última cantidad que se puso: para repetirlos con un toque.
export function recientes(entradas: EntradaDiario[], max = 8): Reciente[] {
  const orden = [...entradas].sort(
    (a, b) =>
      b.fecha.localeCompare(a.fecha) ||
      (b.created_at ?? "").localeCompare(a.created_at ?? "") ||
      b.orden - a.orden,
  );
  const vistos = new Set<string>();
  const out: Reciente[] = [];
  for (const e of orden) {
    if (!e.food_id || !e.gramos || vistos.has(e.food_id)) continue;
    vistos.add(e.food_id);
    out.push({ food_id: e.food_id, nombre: e.nombre, gramos: e.gramos });
    if (out.length >= max) break;
  }
  return out;
}

// Busca por todas las palabras escritas (sin importar tildes ni mayúsculas). Cada
// palabra debe EMPEZAR una palabra del nombre ("pollo" encuentra "Pechuga de pollo"
// pero no "Repollo"); si así no sale nada, se admite que aparezca en cualquier parte
// ("rroz" encuentra "Arroz"). Primero los que empiezan por lo escrito y luego los que
// encajan en esa comida.
export function buscarAlimentos<T extends AlimentoDiario>(foods: T[], texto: string, comida: Comida, max = 8): T[] {
  const palabras = normalizarTexto(texto).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];
  const clasificar = (encaja: (nombre: string, tokens: string[], w: string) => boolean) => {
    const puntuados: { f: T; p: number }[] = [];
    for (const f of foods) {
      const n = normalizarTexto(f.nombre);
      const tokens = n.split(/[^a-z0-9]+/).filter(Boolean);
      if (!palabras.every((w) => encaja(n, tokens, w))) continue;
      let p = 0;
      if (n.startsWith(palabras[0])) p -= 4;
      if (tokens.some((tok) => tok.startsWith(palabras[0]))) p -= 2;
      if (f.comidas?.includes(comida)) p -= 1;
      p += n.length / 1000; // a igualdad, los nombres más cortos primero
      puntuados.push({ f, p });
    }
    return puntuados;
  };
  let encontrados = clasificar((_n, tokens, w) => tokens.some((tok) => tok.startsWith(w)));
  if (!encontrados.length) encontrados = clasificar((n, _t, w) => n.includes(w));
  return encontrados.sort((a, b) => a.p - b.p || a.f.nombre.localeCompare(b.f.nombre)).slice(0, max).map((x) => x.f);
}

/* ------------------------------ Copiar desde el menú ------------------------------ */

// Convierte los alimentos de un día del menú en entradas del diario de una fecha.
export function entradasDesdeMenu(
  items: { comida: Comida; food_id: string; gramos: number; orden: number }[],
  foodsPorId: Map<string, AlimentoDiario>,
  fecha: string,
): NuevaEntrada[] {
  const out: NuevaEntrada[] = [];
  for (const it of items) {
    const food = foodsPorId.get(it.food_id);
    if (!food) continue;
    out.push(entradaDesdeAlimento(food, it.gramos, it.comida, fecha, it.orden));
  }
  return out;
}

/* ------------------------------ Entradas a mano ------------------------------ */

export function parseNumero(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type EntradaManual = { nombre: string; kcal: number; proteina: number; grasa: number; hidratos: number };

export function validarEntradaManual(
  e: { nombre: string; kcal: string; proteina: string; grasa: string; hidratos: string },
): { ok: true; valor: EntradaManual; aviso?: string } | { ok: false; error: string } {
  const nombre = e.nombre.trim();
  if (!nombre) return { ok: false, error: "Ponle un nombre." };
  if (nombre.length > 120) return { ok: false, error: "El nombre es demasiado largo (máximo 120 caracteres)." };
  const kcal = parseNumero(e.kcal);
  if (kcal === null || kcal < 0 || kcal > 20000) return { ok: false, error: "Las calorías deben estar entre 0 y 20.000." };
  const macro = (t: string) => (t.trim() === "" ? 0 : parseNumero(t));
  const [proteina, grasa, hidratos] = [macro(e.proteina), macro(e.grasa), macro(e.hidratos)];
  for (const [n, v] of [["proteína", proteina], ["grasa", grasa], ["hidratos", hidratos]] as const) {
    if (v === null || v < 0 || v > 2000) return { ok: false, error: `La ${n} debe estar entre 0 y 2.000 g.` };
  }
  const valor = { nombre, kcal: r1(kcal), proteina: r1(proteina!), grasa: r1(grasa!), hidratos: r1(hidratos!) };
  const deMacros = 4 * valor.proteina + 9 * valor.grasa + 4 * valor.hidratos;
  const hayMacros = valor.proteina + valor.grasa + valor.hidratos > 0;
  const aviso =
    hayMacros && Math.abs(deMacros - valor.kcal) > Math.max(50, valor.kcal * 0.2)
      ? `Los macros suman ${Math.round(deMacros)} kcal, bastante distinto de ${Math.round(valor.kcal)}. Revisa que estén bien.`
      : undefined;
  return { ok: true, valor, aviso };
}

export function entradaManual(v: EntradaManual, comida: Comida, fecha: string, orden = 0): NuevaEntrada {
  return {
    fecha,
    comida,
    food_id: null,
    nombre: v.nombre,
    gramos: null,
    kcal: v.kcal,
    proteina_g: v.proteina,
    grasa_g: v.grasa,
    hidratos_g: v.hidratos,
    orden,
  };
}

/* ------------------------------ Fechas (AAAA-MM-DD) ------------------------------ */

const partes = (f: string) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
const DIA_MS = 86_400_000;

export function sumarDias(fecha: string, n: number): string {
  return new Date(partes(fecha) + n * DIA_MS).toISOString().slice(0, 10);
}

// 0 = lunes … 6 = domingo (igual que dia_semana en los menús).
export function diaSemanaLunes(fecha: string): number {
  return (new Date(partes(fecha)).getUTCDay() + 6) % 7;
}

export function etiquetaDia(fecha: string, hoy: string): string {
  const dif = Math.round((partes(fecha) - partes(hoy)) / DIA_MS);
  if (dif === 0) return "Hoy";
  if (dif === -1) return "Ayer";
  if (dif === 1) return "Mañana";
  const t = new Date(partes(fecha)).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
