// Simulador para probar los estimadores del gasto con personas inventadas cuyo gasto real SÍ se
// conoce. Solo lo usan los tests y el estudio de gasto-estudio.test.ts, no la aplicación.
import { sumarDias, type Fecha } from "./calendar";
import { estimarGasto, type DiaGasto, type OpcionesGasto } from "./gasto-adaptativo";

// Los estimadores de comparación usan los 7.700 kcal/kg de siempre (los de la app actual).
const KCAL_POR_KG = 7700;

export function rng(semilla: number) {
  let a = semilla >>> 0;
  const unif = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - unif())) * Math.cos(2 * Math.PI * unif());
  return { unif, normal, entre: (lo: number, hi: number) => lo + (hi - lo) * unif() };
}
type Rng = ReturnType<typeof rng>;

export type Escenario = {
  nombre: string;
  errorEcuacion: number; // desviación (relativa) del gasto real respecto a la ecuación
  sesgoRegistro: [number, number]; // lo que apuntas / lo que comes (0,8 = apuntas un 20 % menos)
  ruidoRegistro: number; // error aleatorio de cada día apuntado (relativo)
  sinRegistrar: number; // probabilidad de que un día no se apunte
  aMedias: number; // probabilidad de que se apunte solo una parte del día
  ruidoPeso: number; // kg de ruido de agua en cada pesada
  frecuenciaPesada: number; // probabilidad de pesarse cada día
  adherencia: [number, number]; // lo que comes / lo que te marca el plan
  adherenciaVariable: boolean; // la adherencia cambia con las semanas y hay semanas libres
  deficit: number; // kcal/día por debajo de la ecuación que marca el plan (0 = mantener)
  cambiosDeAgua: boolean; // saltos de ±1 kg (viaje, dieta de carbohidratos, ciclo...)
  rhoReal: [number, number]; // kcal por kg que de verdad cambia
};

export const BASE: Escenario = {
  nombre: "típico",
  errorEcuacion: 0.1,
  sesgoRegistro: [0.9, 1.0],
  ruidoRegistro: 0.06,
  sinRegistrar: 0.1,
  aMedias: 0.03,
  ruidoPeso: 0.7,
  frecuenciaPesada: 0.8,
  adherencia: [0.92, 1.1],
  adherenciaVariable: true,
  deficit: 500,
  cambiosDeAgua: false,
  rhoReal: [7000, 7900],
};

export type Usuario = {
  prior: number; // gasto según la ecuación
  gasto0: number; // gasto real al empezar
  peso0: number;
  sesgo: number;
  rhoReal: number;
  adherencia: number;
  plan: number; // calorías que se planifican
  dias: DiaSim[];
};

export type DiaSim = {
  peso: number | null; // pesada con ruido
  registrada: number | null; // lo que se apunta en el diario (puede estar a medias)
  completa: boolean; // el diario de ese día está completo
  real: number; // lo que de verdad se comió
  gastoReal: number; // gasto real de ese día
  pesoReal: number; // peso real (sin ruido)
  planDia: number; // calorías que se marcaban ese día
};

// Cada semana decide las calorías a partir de lo que se ha visto hasta entonces (bucle cerrado).
export type Politica = (c: { t: number; prior: number; planActual: number; pesoReal0: number; dias: DiaGasto[] }) => number;

export function simularUsuario(r: Rng, e: Escenario, ndias: number, politica?: Politica): Usuario {
  const peso0 = r.entre(58, 110);
  const prior = 22 * peso0 + 1000 + r.normal() * 150;
  const gasto0 = prior * (1 + r.normal() * e.errorEcuacion);
  const sesgo = r.entre(...e.sesgoRegistro);
  const rhoReal = r.entre(...e.rhoReal);
  const adherencia = r.entre(...e.adherencia);
  const acople = r.entre(8, 30); // cuánto baja el gasto por cada kg que se pierde (varía mucho entre personas)
  let plan = prior - e.deficit;
  const planInicial = plan;
  let W = peso0;
  let deriva = 0;
  let adaptacion = 0;
  let agua = 0;
  let saltoAgua = 0;
  let sinRegistrarAyer = false;
  let derivaAdh = 0;
  let libres = 0;
  const dias: DiaSim[] = [];
  const parcial = { prior, gasto0, peso0, sesgo, rhoReal, adherencia, plan, dias } as Usuario;
  for (let t = 0; t < ndias; t++) {
    if (politica && t > 0 && t % 7 === 0) plan = politica({ t, prior, planActual: plan, pesoReal0: peso0, dias: diasHasta(parcial, t) });
    deriva += r.normal() * 4;
    const gasto = Math.max(1200, gasto0 + acople * (W - peso0) + deriva + adaptacion);
    const dow = t % 7;
    const finde = dow >= 5 ? 1.12 : dow === 4 ? 1.04 : 0.97;
    if (e.adherenciaVariable) {
      derivaAdh = 0.97 * derivaAdh + r.normal() * 0.02;
      if (libres > 0) libres--;
      else if (r.unif() < 0.02) libres = Math.round(r.entre(3, 8));
    }
    const factorAdh = e.adherenciaVariable ? Math.exp(derivaAdh) * (libres > 0 ? 1.25 : 1) : 1;
    // con política, el objetivo está en las unidades del diario: quien apunta de menos come de más
    const real = Math.max(900, (plan * adherencia * factorAdh * finde * (1 + r.normal() * 0.09)) / (politica ? sesgo : 1));
    const completa: boolean = !(sinRegistrarAyer ? r.unif() < Math.min(0.9, e.sinRegistrar * 3) : r.unif() < e.sinRegistrar);
    sinRegistrarAyer = !completa;
    let registrada: number | null = completa ? real * sesgo * (1 + r.normal() * e.ruidoRegistro) : null;
    let completaFinal = completa;
    if (registrada != null && r.unif() < e.aMedias) {
      registrada *= r.entre(0.25, 0.65);
      completaFinal = false;
    }
    agua = 0.5 * agua + r.normal() * e.ruidoPeso * Math.sqrt(1 - 0.25);
    if (e.cambiosDeAgua && r.unif() < 0.02) saltoAgua += (r.unif() < 0.5 ? -1 : 1) * r.entre(0.6, 1.3);
    saltoAgua *= 0.93;
    const pesa = r.unif() < e.frecuenciaPesada;
    dias.push({ peso: pesa ? W + agua + saltoAgua : null, registrada, completa: completaFinal, real, gastoReal: gasto, pesoReal: W, planDia: plan });
    W += (real - gasto) / rhoReal;
    adaptacion += (-0.0025 * (gasto - real) - adaptacion * 0.02) * 1; // adaptación lenta al déficit
  }
  return { prior, gasto0, peso0, sesgo, rhoReal, adherencia, plan: planInicial, dias };
}

/* ------------------------------ Estimadores ------------------------------ */

export type Contexto = { prior: number; plan: number; dias: DiaGasto[] };
export type Estimador = (c: Contexto) => number;

export const estimadorEcuacion: Estimador = (c) => c.prior;

// Lo que hace hoy la app: supone que se ha seguido el plan y mira solo la pendiente del peso.
export const estimadorPlan: Estimador = (c) => {
  const pts = c.dias.map((d, i) => ({ i, w: d.peso })).filter((x): x is { i: number; w: number } => x.w != null);
  if (pts.length < 4 || pts[pts.length - 1].i - pts[0].i < 10) return c.prior;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.i, 0) / n;
  const my = pts.reduce((s, p) => s + p.w, 0) / n;
  const pend = pts.reduce((s, p) => s + (p.i - mx) * (p.w - my), 0) / pts.reduce((s, p) => s + (p.i - mx) ** 2, 0);
  return c.plan - pend * 7 * (KCAL_POR_KG / 7);
};

// Ingenuo: media de lo apuntado menos lo que sube el peso, por regresión en las últimas 4 semanas.
export const estimadorRegresion: Estimador = (c) => {
  const v = c.dias.slice(-28);
  const pts = v.map((d, i) => ({ i, w: d.peso })).filter((x): x is { i: number; w: number } => x.w != null);
  const ks = v.map((d) => d.kcal).filter((k): k is number => k != null);
  if (pts.length < 6 || pts[pts.length - 1].i - pts[0].i < 10 || ks.length < 5) return c.prior;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.i, 0) / n;
  const my = pts.reduce((s, p) => s + p.w, 0) / n;
  const pend = pts.reduce((s, p) => s + (p.i - mx) * (p.w - my), 0) / pts.reduce((s, p) => s + (p.i - mx) ** 2, 0);
  return ks.reduce((a, b) => a + b, 0) / ks.length - pend * KCAL_POR_KG;
};

// Media móvil exponencial del peso (como las básculas con «peso suavizado»).
export const estimadorEMA: Estimador = (c) => {
  const v = c.dias;
  let ema: number | null = null;
  const serie: (number | null)[] = [];
  for (const d of v) {
    if (d.peso != null) ema = ema == null ? d.peso : ema + 0.1 * (d.peso - ema);
    serie.push(ema);
  }
  const fin = serie.length - 1;
  const ini = Math.max(0, fin - 21);
  const ks = v.slice(ini).map((d) => d.kcal).filter((k): k is number => k != null);
  if (serie[fin] == null || serie[ini] == null || fin - ini < 14 || ks.length < 5) return c.prior;
  const pend = ((serie[fin] as number) - (serie[ini] as number)) / (fin - ini);
  return ks.reduce((a, b) => a + b, 0) / ks.length - pend * KCAL_POR_KG;
};

export const estimadorKalman = (opciones?: Partial<OpcionesGasto>): Estimador => (c) =>
  estimarGasto({ prior: c.prior, dias: c.dias, objetivo: c.plan, opciones }).gasto;

/* ------------------------------ Evaluación ------------------------------ */

// Datos que ve el estimador hasta el día `hasta` (exclusive), con el diario a medias detectado como lo haría la app.
export function diasHasta(u: Usuario, hasta: number, fechaInicio: Fecha = "2026-01-05"): DiaGasto[] {
  const out: DiaGasto[] = [];
  const registrados = u.dias.slice(0, hasta).map((d) => d.registrada).filter((k): k is number => k != null).sort((a, b) => a - b);
  const mediana = registrados.length ? registrados[Math.floor(registrados.length / 2)] : 0;
  const suelo = Math.max(900, 0.55 * mediana);
  for (let i = 0; i < hasta; i++) {
    const d = u.dias[i];
    const k = d.registrada != null && d.registrada >= suelo ? d.registrada : null;
    out.push({ fecha: sumarDias(fechaInicio, i), peso: d.peso, kcal: k });
  }
  return out;
}

// El gasto «de referencia» en las unidades de lo que se le da al estimador: lo apuntado (sesgo) o lo planificado.
export function gastoReferencia(u: Usuario, hasta: number, tipo: "diario" | "plan"): number {
  const v = u.dias.slice(Math.max(0, hasta - 7), hasta);
  const g = v.reduce((s, d) => s + d.gastoReal, 0) / v.length;
  if (tipo === "diario") return g * u.sesgo;
  // en «unidades del plan»: el plan dividido entre lo que de verdad se comió en las últimas 4 semanas
  const m = u.dias.slice(Math.max(0, hasta - 28), hasta);
  return (g * u.plan) / (m.reduce((s, d) => s + d.real, 0) / m.length);
}

export type Resumen = { mae: number; rmse: number; p90: number; sesgo: number; dentro150: number; n: number };

export function resumir(errores: number[]): Resumen {
  const abs = errores.map(Math.abs).sort((a, b) => a - b);
  const n = errores.length;
  return {
    mae: abs.reduce((a, b) => a + b, 0) / n,
    rmse: Math.sqrt(errores.reduce((a, b) => a + b * b, 0) / n),
    p90: abs[Math.floor(n * 0.9)],
    sesgo: errores.reduce((a, b) => a + b, 0) / n,
    dentro150: abs.filter((x) => x <= 150).length / n,
    n,
  };
}

export function evaluar(
  estimador: Estimador,
  e: Escenario,
  opciones: { usuarios: number; semilla: number; checkpoints: number[]; tipo?: "diario" | "plan" },
): Map<number, Resumen> {
  const r = rng(opciones.semilla);
  const ndias = Math.max(...opciones.checkpoints);
  const porPunto = new Map<number, number[]>(opciones.checkpoints.map((c) => [c, []]));
  for (let k = 0; k < opciones.usuarios; k++) {
    const u = simularUsuario(r, e, ndias);
    for (const c of opciones.checkpoints) {
      const est = estimador({ prior: u.prior, plan: u.plan, dias: diasHasta(u, c) });
      porPunto.get(c)!.push(est - gastoReferencia(u, c, opciones.tipo ?? "diario"));
    }
  }
  return new Map([...porPunto].map(([c, errs]) => [c, resumir(errs)]));
}
