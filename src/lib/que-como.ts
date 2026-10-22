// «¿Qué como ahora?»: con lo que te falta del día, propone qué comer en la próxima comida. Dos tipos
// de propuesta: combinaciones de alimentos con sus gramos (las arma el mismo generador de menús, así
// cuadran con calorías y macros) y platos típicos ya calculados (lentejas, berenjenas rellenas…) en
// la ración que encaja. Funciones puras.
import { COMIDAS_ORDEN, repartoCalorias, sumarMacros, macrosDe, type Comida, type Macros } from "./nutrition";
import { errorPonderado, generarDia, memoriaVacia, type GenFood } from "./nutrition-generator";

export type PlatoQ = GenFood & { unidad_nombre: string | null };

// Por debajo de esto, la comida «no hace falta»: el día está prácticamente cubierto.
export const KCAL_MINIMAS_COMIDA = 120;

// Hasta qué hora (decimal) se considera «la siguiente» cada comida.
const HASTA_HORA: Record<Comida, number> = { desayuno: 10.5, media_manana: 13, comida: 16, merienda: 19, cena: 24 };

export function comidaProxima(hora: number, comidasDelDia: Comida[]): Comida {
  const orden = COMIDAS_ORDEN.filter((c) => comidasDelDia.includes(c));
  return orden.find((c) => hora < HASTA_HORA[c]) ?? orden[orden.length - 1] ?? "cena";
}

// Las comidas del día desde esta en adelante (incluida): entre ellas se reparte lo que falta.
export function comidasPendientes(comidasDelDia: Comida[], comida: Comida): Comida[] {
  const desde = COMIDAS_ORDEN.indexOf(comida);
  const lista = COMIDAS_ORDEN.filter((c) => comidasDelDia.includes(c) && COMIDAS_ORDEN.indexOf(c) >= desde);
  return lista.includes(comida) ? lista : [comida, ...lista];
}

// Lo que le toca a esta comida: lo que falta del día repartido entre las que quedan, con unos macros
// que suman sus calorías (si ya te has pasado de grasa, por ejemplo, no se pide «grasa negativa»).
// Una sola comida no debería llevar mucho más de lo normal: si llegas tarde con medio día por comer, se pide
// como máximo 1,4 veces lo que le tocaría en un día normal (y se avisa de que queda más por cubrir).
export const TOPE_COMIDA = 1.4;

export type ObjetivoComida = Macros & { recortada: boolean };

export function objetivoDeLaComida(
  restante: Macros,
  comida: Comida,
  pendientes: Comida[],
  normal?: { kcalDia: number; comidasDelDia: Comida[] },
): ObjetivoComida | null {
  const reparto = repartoCalorias(pendientes.includes(comida) ? pendientes : [comida, ...pendientes]);
  const parte = reparto[comida];
  let kcal = restante.kcal * parte;
  if (!(kcal >= KCAL_MINIMAS_COMIDA)) return null;
  let escala = 1;
  if (normal) {
    const tope = TOPE_COMIDA * repartoCalorias(normal.comidasDelDia.includes(comida) ? normal.comidasDelDia : [comida, ...normal.comidasDelDia])[comida] * normal.kcalDia;
    if (kcal > tope) {
      escala = tope / kcal;
      kcal = tope;
    }
  }
  const proteina = Math.min(Math.max(0, restante.proteina * parte * escala), (0.5 * kcal) / 4);
  let grasa = Math.min(Math.max(0, restante.grasa * parte * escala), (0.6 * kcal) / 9);
  let hidratos = (kcal - 4 * proteina - 9 * grasa) / 4;
  const minimoHidratos = (0.1 * kcal) / 4;
  if (hidratos < minimoHidratos) {
    hidratos = minimoHidratos;
    grasa = Math.max(0, (kcal - 4 * proteina - 4 * hidratos) / 9);
  }
  return { kcal, proteina, grasa, hidratos, recortada: escala < 1 };
}

/* ------------------------------ Combinaciones de alimentos ------------------------------ */

export type Combo = { items: { food: GenFood; gramos: number }[]; total: Macros; error: number };

// Hasta `cuantas` combinaciones distintas (se distinguen por sus alimentos principales).
export function sugerirCombos(p: { foods: GenFood[]; objetivo: Macros; comida: Comida; semilla: number; cuantas?: number }): Combo[] {
  const cuantas = p.cuantas ?? 3;
  const porId = new Map(p.foods.map((f) => [f.id, f]));
  const vistos = new Set<string>();
  const out: Combo[] = [];
  for (let k = 0; k < cuantas * 6 && out.length < cuantas; k++) {
    const r = generarDia({ foods: p.foods, target: p.objetivo, comidas: [p.comida], memoria: memoriaVacia(), semilla: p.semilla + k * 7919, intentos: 25 });
    if (!r.items.length || r.error > 0.2) continue;
    const items = r.items.map((i) => ({ food: porId.get(i.foodId) as GenFood, gramos: i.gramos })).filter((i) => i.food);
    // Dos combinaciones con la misma proteína y el mismo hidrato son la misma idea
    const clave = items
      .filter((i) => i.food.categoria === "proteina" || i.food.categoria === "legumbre" || i.food.categoria === "hidrato" || i.food.categoria === "lacteo")
      .map((i) => i.food.id)
      .sort()
      .join("|");
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push({ items, total: r.total, error: r.error });
  }
  return out.sort((a, b) => a.error - b.error);
}

/* ------------------------------ Platos ya calculados ------------------------------ */

export type PlatoSug = { food: PlatoQ; unidades: number; gramos: number; total: Macros; error: number };

const LIGERO = /tostada|bocadillo|sándwich|sandwich|torrija|tarta|arroz con leche|pan con chocolate|café|capuchino|cortado|leche con cacao|melón|queso manchego/i;
const SOLO_LIGERO = /café|capuchino|cortado|cacao|bombón|torrija|tarta|arroz con leche|pan con chocolate/i;
const ALCOHOL = /gin-tonic|whisky|cubata|calimocho|tinto de verano|^clara \(/i;

// Un plato típico encaja según la hora: cafés y dulces a media mañana, lentejas a la comida.
export function platoEncaja(nombre: string, comida: Comida): boolean {
  if (ALCOHOL.test(nombre)) return false;
  const ligera = comida === "desayuno" || comida === "media_manana" || comida === "merienda";
  return ligera ? LIGERO.test(nombre) : !SOLO_LIGERO.test(nombre);
}

// Un plato típico rara vez clava los macros (las lentejas llevan menos proteína de la que pide un plan alto en proteína):
// se enseñan los que se acerquen razonablemente, con sus macros a la vista, para que decidas tú.
const ERROR_MAX_PLATO = 0.55;

export function sugerirPlatos(p: { platos: PlatoQ[]; objetivo: Macros; comida: Comida; cuantas?: number }): PlatoSug[] {
  const out: PlatoSug[] = [];
  for (const f of p.platos) {
    if (!f.gramos_unidad || f.gramos_unidad <= 0 || !platoEncaja(f.nombre, p.comida)) continue;
    const kcalUnidad = (f.kcal_100 * f.gramos_unidad) / 100;
    if (!(kcalUnidad > 0)) continue;
    const paso = f.unidad_nombre === "ración" ? 0.5 : 1;
    const unidades = Math.max(paso, Math.round(p.objetivo.kcal / kcalUnidad / paso) * paso);
    const gramos = unidades * f.gramos_unidad;
    if (gramos < f.porcion_min_g - 1e-9 || gramos > f.porcion_max_g + 1e-9) continue;
    const total = macrosDe(f, gramos);
    const error = errorPonderado(total, p.objetivo);
    if (error <= ERROR_MAX_PLATO) out.push({ food: f, unidades, gramos, total, error });
  }
  return out.sort((a, b) => a.error - b.error).slice(0, p.cuantas ?? 3);
}

export function totalDeCombo(items: { food: GenFood; gramos: number }[]): Macros {
  return sumarMacros(items.map((i) => macrosDe(i.food, i.gramos)));
}
