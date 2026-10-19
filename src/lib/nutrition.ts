// Núcleo de cálculo del módulo de Alimentación: objetivos (cuestionario),
// macros de alimentos y restricciones. Funciones puras, sin acceso a datos.

export type Sexo = "hombre" | "mujer";
export type NivelActividad = "sedentario" | "ligero" | "activo" | "muy_activo";
export type ObjetivoNutricional = "perder_grasa" | "mantener" | "ganar_musculo" | "recomposicion";
export type Ritmo = "suave" | "moderado";

export type Macros = { kcal: number; proteina: number; grasa: number; hidratos: number };

export const NIVELES_ACTIVIDAD: { id: NivelActividad; label: string; detalle: string }[] = [
  { id: "sedentario", label: "Sedentario", detalle: "Casi todo el día sentado (oficina, estudio)" },
  { id: "ligero", label: "Ligeramente activo", detalle: "Algo de pie o caminando (comercio, docencia)" },
  { id: "activo", label: "Activo", detalle: "Mucho tiempo de pie o caminando (hostelería, reparto)" },
  { id: "muy_activo", label: "Muy activo", detalle: "Trabajo físico intenso (obra, campo)" },
];

export const OBJETIVOS: { id: ObjetivoNutricional; label: string; detalle: string }[] = [
  { id: "perder_grasa", label: "Perder grasa", detalle: "Déficit calórico conservando músculo" },
  { id: "mantener", label: "Mantener", detalle: "Calorías de mantenimiento" },
  { id: "ganar_musculo", label: "Ganar músculo", detalle: "Superávit moderado" },
  { id: "recomposicion", label: "Recomposición", detalle: "Mantenimiento con proteína alta" },
];

// Estilo de vida base (sin contar el entrenamiento). 1,40 es el mínimo de la
// banda "sedentario" de FAO/OMS/UNU 2004; 1,55 es el ejemplo de estilo de vida
// sedentario de ese mismo informe.
const PAL_BASE: Record<NivelActividad, number> = {
  sedentario: 1.4,
  ligero: 1.55,
  activo: 1.7,
  muy_activo: 1.9,
};

// El informe FAO calcula que una hora diaria de ejercicio moderado-vigoroso
// (trotar, ciclismo, aeróbic) sube el PAL de 1,55 a 1,75 (+0,20). Las pesas
// gastan menos por hora por las pausas entre series, así que se aplica ~80 %
// de ese valor (estimación propia, no del informe): +0,16. Se reparte
// proporcionalmente a los días de entreno por semana (sesiones de ~1 h).
// Techo de 2,40 (límite sostenible).
const PAL_POR_HORA_DIARIA = 0.16;
const PAL_MAX = 2.4;

export function calcularPal(nivel: NivelActividad, diasEntreno: number): number {
  const dias = Math.min(7, Math.max(0, diasEntreno));
  const pal = PAL_BASE[nivel] + PAL_POR_HORA_DIARIA * (dias / 7);
  return Math.min(PAL_MAX, pal);
}

// Mifflin-St Jeor (1990): la ecuación predictiva con mejor acierto en la
// revisión sistemática de la Academia de Nutrición y Dietética.
export function mifflinStJeor(p: { sexo: Sexo; edad: number; pesoKg: number; alturaCm: number }): number {
  const base = 10 * p.pesoKg + 6.25 * p.alturaCm - 5 * p.edad;
  return base + (p.sexo === "hombre" ? 5 : -161);
}

// Aproximación habitual: ~7.700 kcal por kg de masa corporal perdida/ganada.
const KCAL_POR_KG = 7700;

// Ritmos semanales de pérdida (% del peso corporal) dentro del 0,5–1 % de
// Helms et al. 2014; y superávit (% sobre mantenimiento) dentro del 10–20 %
// de Iraki et al. 2019.
const RITMO_PERDIDA_PCT: Record<Ritmo, number> = { suave: 0.5, moderado: 0.75 };
const RITMO_SUPERAVIT_PCT: Record<Ritmo, number> = { suave: 10, moderado: 15 };

// Protección: el déficit nunca supera el 25 % del gasto ni baja del mínimo
// habitual de 1.200 kcal (mujer) / 1.500 kcal (hombre), ni de la TMB.
const DEFICIT_MAX_PCT = 25;
const KCAL_MIN: Record<Sexo, number> = { mujer: 1200, hombre: 1500 };

// Proteína (g/kg): ISSN 2017 (1,4–2,0) y Morton 2018 (sin mejora clara por
// encima de ~1,6; hasta 2,2). En déficit se sube (Helms 2014: 1,8–2,7).
// En recomposición se usa 2,0 (extremo alto del rango ISSN).
const PROTEINA_G_KG = { normal: 1.8, recomposicion: 2.0, deficit: 2.2 };
// Grasa: 30 % de las calorías sin déficit y 25 % en déficit (rango 15–30 %,
// Helms 2014; el 20–35 % de la OMS lo cubre), con suelo de 0,6 g/kg (rango
// 0,5–1,5 g/kg de Iraki 2019). Más grasa deja menos hidratos y raciones menos
// voluminosas; en déficit se priorizan los hidratos para entrenar.
const GRASA_PCT = { normal: 0.3, deficit: 0.25 };
const GRASA_MIN_G_KG = 0.6;

export type InputObjetivos = {
  sexo: Sexo;
  edad: number;
  pesoKg: number;
  alturaCm: number;
  nivelActividad: NivelActividad;
  diasEntreno: number;
  objetivo: ObjetivoNutricional;
  ritmo: Ritmo;
  // Calorías de mantenimiento que la persona ya conoce (peso estable comiendo
  // eso). Si se indican, sustituyen a la estimación por ecuación, que puede
  // fallar un ~10 % en una persona concreta.
  kcalMantenimiento?: number | null;
};

export type ResultadoObjetivos = {
  tmb: number;
  pal: number;
  tdee: number;
  gastoIndicado: boolean; // true si el gasto viene de kcalMantenimiento
  kcal: number;
  proteina_g: number;
  grasa_g: number;
  hidratos_g: number;
  ajustePct: number; // % sobre el gasto total (negativo = déficit)
  advertencias: string[];
};

export function calcularObjetivos(i: InputObjetivos): ResultadoObjetivos {
  const advertencias: string[] = [];
  const tmb = mifflinStJeor(i);
  const indicado = i.kcalMantenimiento && i.kcalMantenimiento > 0 ? i.kcalMantenimiento : null;
  const tdee = indicado ?? tmb * calcularPal(i.nivelActividad, i.diasEntreno);
  const pal = tdee / tmb;

  let kcal = tdee;
  if (i.objetivo === "perder_grasa") {
    const kgSemana = (i.pesoKg * RITMO_PERDIDA_PCT[i.ritmo]) / 100;
    let deficit = (kgSemana * KCAL_POR_KG) / 7;
    const deficitMax = (tdee * DEFICIT_MAX_PCT) / 100;
    if (deficit > deficitMax) {
      deficit = deficitMax;
      advertencias.push("El déficit se ha limitado al 25 % del gasto total por seguridad.");
    }
    kcal = tdee - deficit;
    const suelo = Math.max(tmb, KCAL_MIN[i.sexo]);
    if (kcal < suelo) {
      kcal = suelo;
      advertencias.push(
        `Las calorías se han mantenido en el mínimo de seguridad (${Math.round(suelo)} kcal). Con tus datos no conviene un déficit mayor.`,
      );
    }
  } else if (i.objetivo === "ganar_musculo") {
    kcal = tdee * (1 + RITMO_SUPERAVIT_PCT[i.ritmo] / 100);
  }
  kcal = Math.round(kcal / 10) * 10;

  const proteinaGKg =
    i.objetivo === "perder_grasa"
      ? PROTEINA_G_KG.deficit
      : i.objetivo === "recomposicion"
        ? PROTEINA_G_KG.recomposicion
        : PROTEINA_G_KG.normal;
  const proteina_g = Math.round(i.pesoKg * proteinaGKg);
  const grasaPct = i.objetivo === "perder_grasa" ? GRASA_PCT.deficit : GRASA_PCT.normal;
  const grasaPorPct = (kcal * grasaPct) / 9;
  let grasa_g = Math.round(Math.max(grasaPorPct, i.pesoKg * GRASA_MIN_G_KG));
  let hidratos_g = Math.round((kcal - proteina_g * 4 - grasa_g * 9) / 4);

  if (hidratos_g < 0) {
    // Calorías muy bajas para esa proteína: se reduce la grasa hacia su mínimo.
    grasa_g = Math.max(Math.round(i.pesoKg * 0.5), Math.round((kcal - proteina_g * 4) / 9));
    hidratos_g = Math.max(0, Math.round((kcal - proteina_g * 4 - grasa_g * 9) / 4));
    advertencias.push("Con tus calorías objetivo quedan muy pocos hidratos; conviene revisar el objetivo o el ritmo.");
  }

  return {
    tmb: Math.round(tmb),
    pal: Math.round(pal * 100) / 100,
    tdee: Math.round(tdee),
    gastoIndicado: indicado !== null,
    kcal,
    proteina_g,
    grasa_g,
    hidratos_g,
    ajustePct: Math.round(((kcal - tdee) / tdee) * 1000) / 10,
    advertencias,
  };
}

/* ------------------------------ Alimentos y macros ------------------------------ */

export type CategoriaAlimento =
  | "proteina"
  | "hidrato"
  | "verdura"
  | "fruta"
  | "lacteo"
  | "grasa"
  | "legumbre"
  | "otro";

export type Comida = "desayuno" | "media_manana" | "comida" | "merienda" | "cena";

export const COMIDAS_ORDEN: Comida[] = ["desayuno", "media_manana", "comida", "merienda", "cena"];

export const COMIDA_LABEL: Record<Comida, string> = {
  desayuno: "Desayuno",
  media_manana: "Media mañana",
  comida: "Comida",
  merienda: "Merienda",
  cena: "Cena",
};

// Comidas del día según cuántas se hacen (3 a 5).
export function comidasDelDia(n: number): Comida[] {
  if (n <= 3) return ["desayuno", "comida", "cena"];
  if (n === 4) return ["desayuno", "comida", "merienda", "cena"];
  return ["desayuno", "media_manana", "comida", "merienda", "cena"];
}

// Reparto aproximado de las calorías del día entre comidas.
export function repartoCalorias(comidas: Comida[]): Record<Comida, number> {
  const base: Record<Comida, number> = { desayuno: 0.25, media_manana: 0.1, comida: 0.35, merienda: 0.1, cena: 0.3 };
  const total = comidas.reduce((s, c) => s + base[c], 0);
  const out = {} as Record<Comida, number>;
  for (const c of COMIDAS_ORDEN) out[c] = comidas.includes(c) ? base[c] / total : 0;
  return out;
}

export type FoodNutri = {
  kcal_100: number;
  proteina_100: number;
  grasa_100: number;
  hidratos_100: number;
};

export function macrosDe(food: FoodNutri, gramos: number): Macros {
  const f = gramos / 100;
  return {
    kcal: food.kcal_100 * f,
    proteina: food.proteina_100 * f,
    grasa: food.grasa_100 * f,
    hidratos: food.hidratos_100 * f,
  };
}

// Equivalente en cocinado de una cantidad pesada en crudo/seco ("≈ 480 g
// cocido"). El factor es orientativo, así que se redondea a 5 o 10 g.
export function equivalenteCocinado(factor: number | null | undefined, gramos: number): string | null {
  if (!factor || factor <= 0 || Math.abs(factor - 1) < 0.01 || !(gramos > 0)) return null;
  const g = gramos * factor;
  const r = g >= 100 ? Math.round(g / 10) * 10 : Math.round(g / 5) * 5;
  return `≈ ${r} g ${factor > 1 ? "cocido" : "cocinado"}`;
}

export function sumarMacros(list: Macros[]): Macros {
  return list.reduce(
    (a, m) => ({
      kcal: a.kcal + m.kcal,
      proteina: a.proteina + m.proteina,
      grasa: a.grasa + m.grasa,
      hidratos: a.hidratos + m.hidratos,
    }),
    { kcal: 0, proteina: 0, grasa: 0, hidratos: 0 },
  );
}

/* ------------------------------ Restricciones ------------------------------ */

// Cada restricción excluye los alimentos cuya lista "contiene" incluya alguna
// de estas marcas. Los 14 alérgenos de declaración obligatoria de la UE se
// excluyen por su propia marca; las dietas, por conjuntos de marcas.
export const RESTRICCIONES: { id: string; label: string; grupo: "alergeno" | "dieta"; excluye: string[] }[] = [
  { id: "gluten", label: "Gluten (cereales)", grupo: "alergeno", excluye: ["gluten"] },
  { id: "crustaceos", label: "Crustáceos", grupo: "alergeno", excluye: ["crustaceos"] },
  { id: "huevo", label: "Huevo", grupo: "alergeno", excluye: ["huevo"] },
  { id: "pescado", label: "Pescado", grupo: "alergeno", excluye: ["pescado"] },
  { id: "cacahuetes", label: "Cacahuetes", grupo: "alergeno", excluye: ["cacahuetes"] },
  { id: "soja", label: "Soja", grupo: "alergeno", excluye: ["soja"] },
  { id: "lacteos", label: "Leche y lácteos (lactosa)", grupo: "alergeno", excluye: ["lacteos"] },
  { id: "frutos_secos", label: "Frutos de cáscara", grupo: "alergeno", excluye: ["frutos_secos"] },
  { id: "apio", label: "Apio", grupo: "alergeno", excluye: ["apio"] },
  { id: "mostaza", label: "Mostaza", grupo: "alergeno", excluye: ["mostaza"] },
  { id: "sesamo", label: "Sésamo", grupo: "alergeno", excluye: ["sesamo"] },
  { id: "sulfitos", label: "Sulfitos", grupo: "alergeno", excluye: ["sulfitos"] },
  { id: "altramuces", label: "Altramuces", grupo: "alergeno", excluye: ["altramuces"] },
  { id: "moluscos", label: "Moluscos", grupo: "alergeno", excluye: ["moluscos"] },
  {
    id: "vegetariana",
    label: "Vegetariana (sin carne ni pescado)",
    grupo: "dieta",
    excluye: ["carne", "cerdo", "pescado", "crustaceos", "moluscos"],
  },
  {
    id: "vegana",
    label: "Vegana",
    grupo: "dieta",
    excluye: ["carne", "cerdo", "pescado", "crustaceos", "moluscos", "huevo", "lacteos", "miel"],
  },
  { id: "sin_cerdo", label: "Sin cerdo", grupo: "dieta", excluye: ["cerdo"] },
];

export function marcasExcluidas(restricciones: string[]): Set<string> {
  const out = new Set<string>();
  for (const r of RESTRICCIONES) if (restricciones.includes(r.id)) for (const m of r.excluye) out.add(m);
  return out;
}

export function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function parseExcluidos(texto: string | null | undefined): string[] {
  if (!texto) return [];
  return texto
    .split(",")
    .map((t) => normalizarTexto(t))
    .filter(Boolean);
}

export function alimentoPermitido(
  food: { nombre: string; contiene: string[] },
  restricciones: string[],
  excluidosTexto: string | null | undefined,
): boolean {
  const marcas = marcasExcluidas(restricciones);
  if (food.contiene.some((m) => marcas.has(m))) return false;
  const nombre = normalizarTexto(food.nombre);
  return !parseExcluidos(excluidosTexto).some((e) => nombre.includes(e));
}
