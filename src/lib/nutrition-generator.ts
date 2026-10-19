// Cálculo de raciones y generación de menús. Determinista (PRNG con semilla),
// sin IA y sin dependencias: programación por metas resuelta por descenso por
// coordenadas con límites por alimento.
import {
  type CategoriaAlimento,
  type Comida,
  type Macros,
  COMIDAS_ORDEN,
  macrosDe,
  repartoCalorias,
  sumarMacros,
} from "./nutrition";

export type GenFood = {
  id: string;
  nombre: string;
  categoria: CategoriaAlimento;
  kcal_100: number;
  proteina_100: number;
  grasa_100: number;
  hidratos_100: number;
  gramos_unidad: number | null;
  porcion_min_g: number;
  porcion_max_g: number;
  comidas: string[];
  contiene: string[];
  // Cuánto aparece respecto a lo normal (1). Los básicos (pollo, arroz, huevos)
  // pesan más y los alimentos poco habituales (pulpo, tempeh) menos.
  frecuencia?: number;
};

export type GenItem = { comida: Comida; foodId: string; gramos: number };

export type SolverItem = {
  food: GenFood;
  comida: Comida;
  x0: number;
  min: number;
  max: number;
  fijo?: boolean;
};

type Reparto = Partial<Record<Comida, number>>;

// Importancia relativa de cada macro en el ajuste (la proteína pesa más).
const PESO = { kcal: 1, proteina: 1.5, grasa: 0.7, hidratos: 0.7, comida: 0.25 };

function paso(food: GenFood): number {
  return food.gramos_unidad && food.gramos_unidad > 0 ? food.gramos_unidad : 5;
}

export function redondearRacion(food: GenFood, gramos: number): number {
  const p = paso(food);
  const r = Math.round(gramos / p) * p;
  return Math.max(p, r);
}

type Termino = { coef: Map<number, number>; objetivo: number; peso: number };

// Cada término es un error relativo: coeficientes y objetivo se dividen por la
// escala del objetivo, de modo que todos los macros pesan de forma comparable.
function construirTerminos(items: SolverItem[], target: Macros, reparto: Reparto | null): Termino[] {
  const terminos: Termino[] = [];
  const base: [keyof Macros, number][] = [
    ["kcal", PESO.kcal],
    ["proteina", PESO.proteina],
    ["grasa", PESO.grasa],
    ["hidratos", PESO.hidratos],
  ];
  for (const [key, peso] of base) {
    const escala = Math.max(target[key], 1);
    const coef = new Map<number, number>();
    items.forEach((it, i) => {
      const c = macrosDe(it.food, 1)[key] / escala;
      if (c) coef.set(i, c);
    });
    terminos.push({ coef, objetivo: target[key] / escala, peso });
  }
  if (reparto) {
    for (const [comida, share] of Object.entries(reparto) as [Comida, number][]) {
      if (!share) continue;
      const escala = Math.max(share * target.kcal, 1);
      const coef = new Map<number, number>();
      items.forEach((it, i) => {
        if (it.comida === comida && !it.fijo) coef.set(i, macrosDe(it.food, 1).kcal / escala);
      });
      if (coef.size) terminos.push({ coef, objetivo: (share * target.kcal) / escala, peso: PESO.comida });
    }
  }
  return terminos;
}

// Descenso por coordenadas sobre una función cuadrática con límites. Cada
// término es un error relativo al objetivo; la regularización mantiene las
// raciones cerca de x0 (ración típica o la ya elegida por el usuario).
export function resolverGramos(
  items: SolverItem[],
  target: Macros,
  reparto: Reparto | null,
  opciones: { reg?: number } = {},
): number[] {
  const reg = opciones.reg ?? 0.01;
  const terminos = construirTerminos(items, target, reparto);
  const x = items.map((it) => Math.min(it.max, Math.max(it.min, it.x0)));
  const residuos = terminos.map((t) => {
    let s = -t.objetivo;
    t.coef.forEach((c, i) => (s += c * x[i]));
    return s;
  });

  for (let sweep = 0; sweep < 400; sweep++) {
    let maxCambio = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.fijo) continue;
      let num = 0;
      let den = 0;
      terminos.forEach((t, k) => {
        const c = t.coef.get(i);
        if (!c) return;
        num += -t.peso * c * (residuos[k] - c * x[i]);
        den += t.peso * c * c;
      });
      const escalaReg = Math.max(it.x0, 20);
      const r = reg / (escalaReg * escalaReg);
      num += r * it.x0;
      den += r;
      const nuevo = Math.min(it.max, Math.max(it.min, num / den));
      const delta = nuevo - x[i];
      if (delta !== 0) {
        terminos.forEach((t, k) => {
          const c = t.coef.get(i);
          if (c) residuos[k] += c * delta;
        });
        x[i] = nuevo;
        maxCambio = Math.max(maxCambio, Math.abs(delta));
      }
    }
    if (maxCambio < 0.01) break;
  }
  return x;
}

export function errorPonderado(total: Macros, target: Macros): number {
  const e = (a: number, t: number) => (t > 0 ? (a - t) / t : 0);
  return Math.sqrt(
    PESO.kcal * e(total.kcal, target.kcal) ** 2 +
      PESO.proteina * e(total.proteina, target.proteina) ** 2 +
      PESO.grasa * e(total.grasa, target.grasa) ** 2 +
      PESO.hidratos * e(total.hidratos, target.hidratos) ** 2,
  );
}

function totalDe(items: SolverItem[], xs: number[]): Macros {
  return sumarMacros(items.map((it, i) => macrosDe(it.food, xs[i])));
}

function perdidaDiscreta(items: SolverItem[], xs: number[], target: Macros, reparto: Reparto | null): number {
  const total = totalDe(items, xs);
  let p = errorPonderado(total, target) ** 2;
  if (reparto) {
    for (const [comida, share] of Object.entries(reparto) as [Comida, number][]) {
      if (!share) continue;
      const kc = sumarMacros(
        items.map((it, i) => (it.comida === comida && !it.fijo ? macrosDe(it.food, xs[i]) : macrosDe(it.food, 0))),
      ).kcal;
      const objetivo = share * target.kcal;
      if (objetivo > 0) p += PESO.comida * ((kc - objetivo) / objetivo) ** 2;
    }
  }
  return p;
}

// Redondea a raciones prácticas (5 g o unidades enteras) y corrige con una
// búsqueda local: prueba ±1 paso en cada alimento y se queda con lo que mejore.
export function redondearConRefinado(
  items: SolverItem[],
  continuo: number[],
  target: Macros,
  reparto: Reparto | null,
): number[] {
  const xs = items.map((it, i) =>
    it.fijo ? it.x0 : Math.min(it.max, Math.max(it.min, redondearRacion(it.food, continuo[i]))),
  );
  let mejor = perdidaDiscreta(items, xs, target, reparto);
  for (let pasada = 0; pasada < 12; pasada++) {
    let mejoro = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].fijo) continue;
      const p = paso(items[i].food);
      for (const d of [-p, p]) {
        const nuevo = xs[i] + d;
        if (nuevo < Math.max(p, items[i].min) - 1e-9 || nuevo > items[i].max + 1e-9) continue;
        const prev = xs[i];
        xs[i] = nuevo;
        const perdida = perdidaDiscreta(items, xs, target, reparto);
        if (perdida < mejor - 1e-9) {
          mejor = perdida;
          mejoro = true;
        } else {
          xs[i] = prev;
        }
      }
    }
    if (!mejoro) break;
  }
  return xs;
}

export function racionTipica(food: GenFood): number {
  const t = Math.sqrt(food.porcion_min_g * food.porcion_max_g);
  return Math.min(food.porcion_max_g, Math.max(food.porcion_min_g, t));
}

/* ------------------------------ Ajuste de un día manual ------------------------------ */

export function ajustarRaciones(
  items: { comida: Comida; food: GenFood; gramos: number }[],
  target: Macros,
): { gramos: number[]; total: Macros; error: number } {
  if (!items.length) return { gramos: [], total: { kcal: 0, proteina: 0, grasa: 0, hidratos: 0 }, error: 0 };
  const solverItems: SolverItem[] = items.map((it) => ({
    food: it.food,
    comida: it.comida,
    x0: it.gramos,
    // Se permite moverse dentro de los límites del alimento, ampliados para
    // incluir lo que el usuario ya había puesto.
    min: Math.min(it.food.porcion_min_g, it.gramos),
    max: Math.max(it.food.porcion_max_g, it.gramos),
  }));
  const continuo = resolverGramos(solverItems, target, null, { reg: 0.03 });
  const gramos = redondearConRefinado(solverItems, continuo, target, null);
  const total = totalDe(solverItems, gramos);
  return { gramos, total, error: errorPonderado(total, target) };
}

/* ------------------------------ Generador de menús ------------------------------ */

export function crearPrng(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Hueco = { categorias: CategoriaAlimento[]; prob: number };

// Estructura de cada comida: huecos que se rellenan con alimentos de esas
// categorías (los alimentos llevan las comidas en las que encajan).
const PLANTILLAS: Record<Comida, Hueco[]> = {
  desayuno: [
    { categorias: ["lacteo", "proteina"], prob: 1 },
    { categorias: ["hidrato"], prob: 1 },
    { categorias: ["fruta"], prob: 0.85 },
    { categorias: ["grasa"], prob: 0.35 },
    { categorias: ["otro"], prob: 0.2 },
  ],
  media_manana: [
    { categorias: ["fruta"], prob: 0.9 },
    { categorias: ["lacteo", "proteina", "grasa"], prob: 0.9 },
  ],
  comida: [
    { categorias: ["proteina"], prob: 1 },
    { categorias: ["hidrato", "legumbre"], prob: 1 },
    { categorias: ["verdura"], prob: 1 },
    { categorias: ["grasa"], prob: 0.9 },
  ],
  merienda: [
    { categorias: ["fruta"], prob: 0.7 },
    { categorias: ["lacteo", "proteina"], prob: 0.9 },
    { categorias: ["grasa", "hidrato"], prob: 0.4 },
    { categorias: ["otro"], prob: 0.15 },
  ],
  cena: [
    { categorias: ["proteina"], prob: 1 },
    { categorias: ["verdura"], prob: 1 },
    { categorias: ["hidrato", "legumbre"], prob: 0.6 },
    { categorias: ["grasa"], prob: 0.8 },
  ],
};

export type MemoriaVariedad = {
  // foodId -> días desde que se usó por última vez en esa comida (1 = ayer).
  porComida: Partial<Record<Comida, Map<string, number>>>;
  // proteínas principales de ayer (comida y cena) para no repetirlas.
  proteinasAyer: Set<string>;
};

export function memoriaVacia(): MemoriaVariedad {
  return { porComida: {}, proteinasAyer: new Set() };
}

function elegirPonderado<T>(candidatos: { item: T; peso: number }[], rng: () => number): T | null {
  const total = candidatos.reduce((s, c) => s + c.peso, 0);
  if (total <= 0 || !candidatos.length) return null;
  let r = rng() * total;
  for (const c of candidatos) {
    r -= c.peso;
    if (r <= 0) return c.item;
  }
  return candidatos[candidatos.length - 1].item;
}

// Los aceites se pueden repetir en el día (comida y cena); el resto de grasas
// (aguacate, frutos secos), las frutas y los extras dulces, no.
function esAceite(food: GenFood): boolean {
  return food.categoria === "grasa" && food.kcal_100 >= 800;
}

function noRepetibleEnElDia(food: GenFood): boolean {
  return food.categoria === "fruta" || food.categoria === "otro" || (food.categoria === "grasa" && !esAceite(food));
}

// Peso de un alimento para elegirlo en un hueco: frecuencia propia, recencia
// (ayer o anteayer) y repetición dentro del mismo día.
function pesoDeSeleccion(
  food: GenFood,
  diasDesdeUso: number | undefined,
  vecesHoy: number,
  aceiteDelDia: string | null = null,
): number {
  // Un solo tipo de aceite al día (se puede repetir el mismo en comida y cena).
  if (esAceite(food) && aceiteDelDia && aceiteDelDia !== food.id) return 0;
  let peso = food.frecuencia ?? 1;
  if (diasDesdeUso === 1) peso *= 0.15;
  else if (diasDesdeUso === 2) peso *= 0.4;
  if (vecesHoy > 0) peso *= noRepetibleEnElDia(food) ? 0 : 0.2;
  return peso;
}

// Reglas para que cada comida sea coherente al completar: en comida y cena un
// solo hidrato o legumbre y una sola proteína base; en media mañana y merienda
// una sola fruta; como máximo dos frutas (desayuno), dos verduras y dos grasas
// por comida, y un solo extra.
function cabeEnComida(
  seleccion: { comida: Comida; food: GenFood }[],
  comida: Comida,
  food: GenFood,
  comidaGrande = false,
): boolean {
  const enComida = seleccion.filter((s) => s.comida === comida).map((s) => s.food.categoria);
  const cuenta = (...cats: CategoriaAlimento[]) => enComida.filter((c) => cats.includes(c)).length;
  const principal = comida === "comida" || comida === "cena";
  const tentempie = comida === "media_manana" || comida === "merienda";
  switch (food.categoria) {
    case "hidrato":
    case "legumbre":
      // Con calorías muy altas por comida (más de ~1.100 kcal) caben dos fuentes de hidrato.
      return principal ? cuenta("hidrato", "legumbre") < (comidaGrande ? 2 : 1) : cuenta("hidrato", "legumbre") < 2;
    case "proteina":
    case "lacteo":
      return principal ? cuenta("proteina") < 1 : cuenta("proteina", "lacteo") < 2;
    case "fruta":
      return cuenta("fruta") < (tentempie ? 1 : 2);
    case "verdura":
      return cuenta("verdura") < 2;
    case "grasa":
      return cuenta("grasa") < 2;
    case "otro":
      return cuenta("otro") < 1;
    default:
      return true;
  }
}

function quedaCorto(total: Macros, target: Macros): boolean {
  return (
    total.kcal < target.kcal * 0.95 ||
    total.proteina < target.proteina * 0.92 ||
    total.hidratos < target.hidratos * 0.9
  );
}

export type DiaGenerado = {
  items: GenItem[];
  total: Macros;
  error: number;
  aviso?: string;
};

export function generarDia(opts: {
  foods: GenFood[];
  target: Macros;
  comidas: Comida[]; // comidas a generar
  fijos?: { comida: Comida; food: GenFood; gramos: number }[]; // se respetan tal cual
  memoria?: MemoriaVariedad;
  semilla: number;
  intentos?: number;
}): DiaGenerado {
  const { foods, target, comidas } = opts;
  const fijos = opts.fijos ?? [];
  const memoria = opts.memoria ?? memoriaVacia();
  const intentos = opts.intentos ?? 40;
  // Con comidas fijas solo cuenta el total del día (lo que falta por cubrir);
  // sin ellas, además se reparten las calorías entre las comidas.
  const reparto = fijos.length ? null : repartoCalorias(comidas);
  const rng = crearPrng(opts.semilla);
  const nComidasDia = new Set<Comida>([...comidas, ...fijos.map((f) => f.comida)]).size;
  const comidaGrande = target.kcal / Math.max(1, nComidasDia) > 1100;

  const vacio: DiaGenerado = {
    items: [],
    total: sumarMacros(fijos.map((f) => macrosDe(f.food, f.gramos))),
    error: 1,
    aviso: "No hay alimentos suficientes en tu biblioteca para generar este menú.",
  };

  let mejor: (DiaGenerado & { puntuacion: number }) | null = null;

  // Si tras los intentos normales sigue lejos del objetivo, se prueban más
  // combinaciones antes de darse por vencido (casos exigentes: dietas
  // restringidas o calorías muy altas/bajas).
  let totalIntentos = intentos;
  for (let intento = 0; intento < totalIntentos; intento++) {
    if (intento === intentos - 1 && mejor && mejor.error > 0.08 && totalIntentos === intentos) {
      totalIntentos = intentos * 4;
    }
    const seleccion: { comida: Comida; food: GenFood }[] = [];
    const usadosHoy = new Map<string, number>(fijos.map((f) => [f.food.id, 1]));
    let aceiteDelDia: string | null = fijos.find((x) => esAceite(x.food))?.food.id ?? null;

    for (const comida of comidas) {
      const hist = memoria.porComida[comida];
      for (const hueco of PLANTILLAS[comida]) {
        if (hueco.prob < 1 && rng() > hueco.prob) continue;
        const candidatos = foods
          .filter((f) => hueco.categorias.includes(f.categoria) && f.comidas.includes(comida))
          .map((f) => {
            let peso = pesoDeSeleccion(f, hist?.get(f.id), usadosHoy.get(f.id) ?? 0, aceiteDelDia);
            if (
              (comida === "comida" || comida === "cena") &&
              f.categoria === "proteina" &&
              memoria.proteinasAyer.has(f.id)
            ) {
              peso *= 0.1;
            }
            return { item: f, peso };
          });
        const elegido = elegirPonderado(candidatos, rng);
        if (!elegido) continue;
        seleccion.push({ comida, food: elegido });
        usadosHoy.set(elegido.id, (usadosHoy.get(elegido.id) ?? 0) + 1);
        if (esAceite(elegido)) aceiteDelDia = elegido.id;
      }
    }
    if (!seleccion.length) continue;

    const resolver = () => {
      const solverItems: SolverItem[] = [
        ...fijos.map((f) => ({
          food: f.food,
          comida: f.comida,
          x0: f.gramos,
          min: f.gramos,
          max: f.gramos,
          fijo: true,
        })),
        ...seleccion.map((s) => ({
          food: s.food,
          comida: s.comida,
          x0: racionTipica(s.food),
          min: s.food.porcion_min_g,
          max: s.food.porcion_max_g,
        })),
      ];
      const continuo = resolverGramos(solverItems, target, reparto);
      const gramos = redondearConRefinado(solverItems, continuo, target, reparto);
      const total = totalDe(solverItems, gramos);
      return { solverItems, gramos, total, error: errorPonderado(total, target) };
    };

    let res = resolver();

    // Si con esos alimentos no se llega (raciones máximas), se añade otro de
    // lo que más falte y se vuelve a resolver (hasta 4 veces).
    for (let extra = 0; extra < (comidaGrande ? 7 : 4) && quedaCorto(res.total, target); extra++) {
      const falta = (k: keyof Macros) => (target[k] > 0 ? (target[k] - res.total[k]) / target[k] : 0);
      let categorias: CategoriaAlimento[];
      if (falta("proteina") > 0.08) categorias = ["proteina", "lacteo"];
      else if (falta("grasa") > falta("hidratos")) categorias = ["grasa"];
      else categorias = ["hidrato", "fruta", "legumbre"];

      const opciones: { comida: Comida; food: GenFood; peso: number }[] = [];
      for (const comida of comidas) {
        for (const f of foods) {
          if (!categorias.includes(f.categoria) || !f.comidas.includes(comida)) continue;
          if (seleccion.some((s) => s.comida === comida && s.food.id === f.id)) continue;
          if (!cabeEnComida(seleccion, comida, f, comidaGrande)) continue;
          const hoy = seleccion.filter((s) => s.food.id === f.id).length;
          const peso = pesoDeSeleccion(f, memoria.porComida[comida]?.get(f.id), hoy, aceiteDelDia);
          if (peso > 0) opciones.push({ comida, food: f, peso });
        }
      }
      const elegido = elegirPonderado(
        opciones.map((o) => ({ item: o, peso: o.peso })),
        rng,
      );
      if (!elegido) break;
      seleccion.push({ comida: elegido.comida, food: elegido.food });
      if (esAceite(elegido.food)) aceiteDelDia = elegido.food.id;
      res = resolver();
    }

    const { solverItems, gramos, total, error } = res;
    const enLimite = solverItems.filter(
      (it, i) => !it.fijo && (gramos[i] <= it.min + 1e-9 || gramos[i] >= it.max - 1e-9),
    ).length;
    const puntuacion = error + 0.05 * (enLimite / Math.max(1, solverItems.length));

    if (!mejor || puntuacion < mejor.puntuacion) {
      const items: GenItem[] = solverItems
        .map((it, i) => ({ comida: it.comida, foodId: it.food.id, gramos: gramos[i], fijo: it.fijo }))
        .filter((x) => !x.fijo)
        .map(({ comida, foodId, gramos: g }) => ({ comida, foodId, gramos: g }));
      mejor = { items, total, error, puntuacion };
    }
  }

  if (!mejor) return vacio;
  const resultado: DiaGenerado = { items: mejor.items, total: mejor.total, error: mejor.error };
  if (mejor.error > 0.1) {
    const falta: string[] = [];
    if (mejor.total.proteina < target.proteina * 0.9) falta.push("proteína");
    if (mejor.total.kcal < target.kcal * 0.9) falta.push("calorías");
    if (mejor.total.kcal > target.kcal * 1.1) falta.push("(calorías por encima)");
    resultado.aviso = falta.length
      ? `No se ha podido cuadrar del todo (${falta.join(", ")}). Añade más variedad a tu biblioteca o ajusta las raciones.`
      : "El menú se aleja algo del objetivo; prueba a regenerarlo o a ajustar raciones.";
  }
  return resultado;
}

// Actualiza la memoria de variedad con los alimentos de un día ya generado.
export function actualizarMemoria(
  memoria: MemoriaVariedad,
  items: GenItem[],
  foodsPorId: Map<string, GenFood>,
): MemoriaVariedad {
  const nueva: MemoriaVariedad = { porComida: {}, proteinasAyer: new Set() };
  for (const comida of COMIDAS_ORDEN) {
    const m = new Map<string, number>();
    memoria.porComida[comida]?.forEach((dias, id) => {
      if (dias + 1 <= 2) m.set(id, dias + 1);
    });
    nueva.porComida[comida] = m;
  }
  for (const it of items) {
    nueva.porComida[it.comida]?.set(it.foodId, 1);
    const f = foodsPorId.get(it.foodId);
    if (f?.categoria === "proteina" && (it.comida === "comida" || it.comida === "cena")) {
      nueva.proteinasAyer.add(it.foodId);
    }
  }
  return nueva;
}
