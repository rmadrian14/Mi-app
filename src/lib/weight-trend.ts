// Seguimiento de peso: media móvil, tendencia (kg/semana) y sugerencia de ajuste
// de calorías comparando el ritmo real con el previsto. Funciones puras.
//
// El modelo es el mismo que usa el cálculo de objetivos: ~7.700 kcal por kg de
// masa corporal, es decir ~1.100 kcal/día por cada kg/semana. Es una
// aproximación: el peso diario fluctúa por agua y digestión, por eso solo se
// opina con varias semanas de datos y con una banda de tolerancia.

export type PesoRegistro = { fecha: string; peso_kg: number }; // fecha: AAAA-MM-DD

const DIA_MS = 86_400_000;
export const KCAL_DIA_POR_KG_SEMANA = 7700 / 7; // 1.100

// Mínimos para fiarse de la tendencia.
const MIN_REGISTROS = 4;
const MIN_DIAS = 10;
// Por debajo de esta diferencia (kg/semana) entre lo real y lo previsto no se
// toca nada: es ruido.
const BANDA_TOLERANCIA = 0.15;
// Un ajuste nunca mueve más de esto de golpe (kcal/día).
const AJUSTE_MAX_KCAL = 300;

export function hoyISO(): string {
  return new Date().toLocaleDateString("sv-SE");
}

function dia(fecha: string): number {
  return Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)) / DIA_MS;
}

export function ordenar(registros: PesoRegistro[]): PesoRegistro[] {
  return [...registros].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

// Media de los registros de los últimos `dias` días hasta cada fecha (incluida).
export function mediaMovil(registros: PesoRegistro[], dias = 7): { fecha: string; peso: number; media: number }[] {
  const r = ordenar(registros);
  return r.map((x, i) => {
    const limite = dia(x.fecha) - (dias - 1);
    const ventana = r.slice(0, i + 1).filter((y) => dia(y.fecha) >= limite);
    const media = ventana.reduce((s, y) => s + y.peso_kg, 0) / ventana.length;
    return { fecha: x.fecha, peso: x.peso_kg, media: Math.round(media * 100) / 100 };
  });
}

export type Tendencia = {
  kgSemana: number; // pendiente por mínimos cuadrados
  registros: number;
  dias: number; // amplitud de la ventana usada
  fiable: boolean;
};

// Regresión lineal del peso frente al día, sobre la ventana final de datos.
export function tendencia(registros: PesoRegistro[], ventanaDias = 28): Tendencia {
  const r = ordenar(registros);
  if (r.length === 0) return { kgSemana: 0, registros: 0, dias: 0, fiable: false };
  const ultimo = dia(r[r.length - 1].fecha);
  const v = r.filter((x) => dia(x.fecha) >= ultimo - ventanaDias);
  const n = v.length;
  const dias = n > 1 ? dia(v[n - 1].fecha) - dia(v[0].fecha) : 0;
  if (n < 2 || dias === 0) return { kgSemana: 0, registros: n, dias, fiable: false };
  const xs = v.map((x) => dia(x.fecha) - dia(v[0].fecha));
  const ys = v.map((x) => x.peso_kg);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const pendienteDia = den === 0 ? 0 : num / den;
  return {
    kgSemana: Math.round(pendienteDia * 7 * 100) / 100,
    registros: n,
    dias,
    fiable: n >= MIN_REGISTROS && dias >= MIN_DIAS,
  };
}

// Ritmo previsto (kg/semana) con el balance energético que se ha planificado.
export function ritmoPrevisto(kcalObjetivo: number, gastoEstimado: number): number {
  return Math.round(((kcalObjetivo - gastoEstimado) / KCAL_DIA_POR_KG_SEMANA) * 100) / 100;
}

export type Sugerencia =
  | { estado: "pocos_datos"; mensaje: string }
  | {
      estado: "en_linea";
      mensaje: string;
      observado: number;
      previsto: number;
      mantenimientoReal: number;
    }
  | {
      estado: "ajustar";
      mensaje: string;
      observado: number;
      previsto: number;
      deltaKcal: number;
      kcalNueva: number;
      mantenimientoReal: number;
      aviso?: string;
    };

export function sugerirAjuste(p: {
  registros: PesoRegistro[];
  kcalObjetivo: number;
  gastoEstimado: number; // mantenimiento estimado con el que se calcularon los objetivos
  kcalMinimas: number; // suelo de seguridad
  pesoKg: number;
}): Sugerencia {
  const t = tendencia(p.registros);
  if (!t.fiable) {
    return {
      estado: "pocos_datos",
      mensaje: `Hacen falta al menos ${MIN_REGISTROS} registros repartidos en ${MIN_DIAS} días o más para valorar la tendencia (ahora: ${t.registros} registros en ${Math.round(t.dias)} días). Pésate en las mismas condiciones, por ejemplo por la mañana en ayunas.`,
    };
  }
  const previsto = ritmoPrevisto(p.kcalObjetivo, p.gastoEstimado);
  const diferencia = t.kgSemana - previsto;
  // Mantenimiento que implica lo observado, suponiendo que se ha seguido el plan.
  const mantenimientoReal = Math.round(p.kcalObjetivo - t.kgSemana * KCAL_DIA_POR_KG_SEMANA);

  if (Math.abs(diferencia) < BANDA_TOLERANCIA) {
    return {
      estado: "en_linea",
      mensaje: "Tu peso evoluciona como estaba previsto. No hace falta cambiar nada.",
      observado: t.kgSemana,
      previsto,
      mantenimientoReal,
    };
  }

  const bruto = -diferencia * KCAL_DIA_POR_KG_SEMANA;
  let delta = Math.max(-AJUSTE_MAX_KCAL, Math.min(AJUSTE_MAX_KCAL, bruto));
  delta = Math.round(delta / 10) * 10;
  let kcalNueva = p.kcalObjetivo + delta;
  let aviso: string | undefined;
  if (kcalNueva < p.kcalMinimas) {
    kcalNueva = p.kcalMinimas;
    delta = kcalNueva - p.kcalObjetivo;
    aviso = `No se baja de ${p.kcalMinimas} kcal por seguridad.`;
  }
  if (p.pesoKg > 0 && t.kgSemana < 0 && Math.abs(t.kgSemana) > p.pesoKg * 0.01) {
    aviso = "Estás perdiendo más de un 1 % del peso por semana: es rápido y puede costar músculo.";
  }
  if (delta === 0) {
    return {
      estado: "en_linea",
      mensaje: aviso ?? "Tu peso evoluciona como estaba previsto. No hace falta cambiar nada.",
      observado: t.kgSemana,
      previsto,
      mantenimientoReal,
    };
  }
  const sentido = diferencia > 0 ? "más" : "menos";
  return {
    estado: "ajustar",
    mensaje: `Tu peso cambia ${sentido} de lo previsto (${t.kgSemana.toLocaleString("es-ES")} kg/semana frente a ${previsto.toLocaleString("es-ES")}).`,
    observado: t.kgSemana,
    previsto,
    deltaKcal: delta,
    kcalNueva,
    mantenimientoReal,
    aviso,
  };
}
