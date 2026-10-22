// Gasto real estimado a partir de lo que comes y de cómo cambia tu peso. Funciones puras.
//
// La ecuación de Mifflin-St Jeor acierta de media, pero en una persona concreta se equivoca un
// ~10 %: son unas 300 kcal al día, más de la mitad de un déficit normal. Con unas semanas de peso y de
// diario se puede medir el gasto de verdad: lo que comes menos lo que tu peso dice que has
// «guardado» (~7.700 kcal por kg) es lo que gastas.
//
// Se hace con un filtro de Kalman de dos estados: el peso real (sin el ruido del agua y la
// digestión) y el gasto diario. Parte de la ecuación con una incertidumbre del 10 % y la va
// corrigiendo con cada pesada. Así no hay que esperar a «tener suficientes datos»: con pocos días
// casi no se mueve de la ecuación, y con semanas de datos manda lo medido. Además:
//   · los días sin registrar o a medias no suman nada: se tratan como ingesta desconocida;
//   · una pesada muy rara (un día de sal o de viaje) cuenta con menos peso;
//   · el gasto estimado va en las mismas «unidades» que tu diario: si apuntas siempre un poco
//     menos de lo que comes, el gasto sale un poco menor y el objetivo sigue siendo correcto.
import { diasEntre, sumarDias, type Fecha } from "./calendar";

// Energía por kg de peso que cambia. La grasa pura son 7.700, pero lo que se pierde (y se gana) lleva
// también agua y algo de músculo, y en conjunto sale más cerca de 7.000. Elegido con las simulaciones.
export const KCAL_POR_KG = 7000;

export type DiaGasto = {
  fecha: Fecha;
  peso: number | null; // kg de la pesada de ese día (null si no te pesaste)
  kcal: number | null; // ingesta registrada del día (null si no registraste o está a medias)
};

export type OpcionesGasto = {
  rho: number; // kcal por kg de peso que cambia
  sigmaPrior: number; // incertidumbre de la ecuación (kcal/día)
  sigmaPeso: number; // ruido de una pesada (kg): agua, digestión, ropa
  sigmaIngesta: number; // error de un día registrado (kcal)
  sigmaSinDato: number; // error de un día sin registrar (kcal)
  qGasto: number; // cuánto puede cambiar el gasto de un día para otro (kcal)
  qPeso: number; // cambio real del peso que el balance no explica (kg/día)
  gastoPorKg: number; // cuánto baja el gasto por cada kg de peso que se pierde (kcal)
  umbralAtipico: number; // pesadas a más de tantas desviaciones cuentan con menos fuerza
};

export const OPCIONES_GASTO: OpcionesGasto = {
  rho: KCAL_POR_KG,
  sigmaPrior: 320,
  sigmaPeso: 0.8,
  sigmaIngesta: 250,
  sigmaSinDato: 800,
  qGasto: 6,
  qPeso: 0.05,
  gastoPorKg: 20,
  umbralAtipico: 2.5,
};

export type Confianza = "ninguna" | "baja" | "media" | "alta";

export type EstimacionGasto = {
  gasto: number; // kcal/día de mantenimiento (en las unidades de tu diario)
  desviacion: number; // incertidumbre (1 desviación típica, kcal)
  intervalo: [number, number]; // ≈ 80 % de probabilidad
  confianza: Confianza;
  pesoTendencia: number | null; // peso sin ruido de hoy
  kgSemana: number | null; // ritmo de cambio del peso en las últimas 2 semanas
  diasConPeso: number;
  diasConIngesta: number;
  pesoDelPrior: number; // 0-1: cuánto de la estimación sigue siendo la ecuación
};

export function confianzaDe(desviacion: number, diasConPeso: number): Confianza {
  if (diasConPeso < 2) return "ninguna";
  if (desviacion <= 90) return "alta";
  if (desviacion <= 150) return "media";
  if (desviacion <= 220) return "baja";
  return "ninguna";
}

type Cov = { tt: number; te: number; ee: number };

export function estimarGasto(p: {
  prior: number; // gasto que da la ecuación
  dias: DiaGasto[]; // seguidos y en orden, hasta ayer o hoy
  objetivo?: number | null; // calorías planificadas, para los días sin registrar
  opciones?: Partial<OpcionesGasto>;
}): EstimacionGasto {
  const o = { ...OPCIONES_GASTO, ...p.opciones };
  const dias = p.dias;
  const diasConPeso = dias.filter((d) => d.peso != null).length;
  const diasConIngesta = dias.filter((d) => d.kcal != null).length;
  const i0 = dias.findIndex((d) => d.peso != null);
  const vacio: EstimacionGasto = {
    gasto: Math.round(p.prior),
    desviacion: o.sigmaPrior,
    intervalo: [Math.round(p.prior - 1.28 * o.sigmaPrior), Math.round(p.prior + 1.28 * o.sigmaPrior)],
    confianza: "ninguna",
    pesoTendencia: null,
    kgSemana: null,
    diasConPeso,
    diasConIngesta,
    pesoDelPrior: 1,
  };
  if (i0 < 0) return vacio;

  let T = dias[i0].peso as number;
  let E = p.prior;
  let P: Cov = { tt: o.sigmaPeso ** 2, te: 0, ee: o.sigmaPrior ** 2 };
  const recientes: number[] = []; // ingestas registradas, para rellenar los huecos
  const r2 = o.rho * o.rho;
  const a = o.gastoPorKg / o.rho;

  for (let i = i0; i < dias.length; i++) {
    if (i > i0) {
      // El peso de la mañana de este día refleja la ingesta del día anterior.
      const ayer = dias[i - 1].kcal;
      let u: number;
      let rI: number;
      if (ayer != null) {
        u = ayer;
        rI = o.sigmaIngesta ** 2;
        recientes.push(ayer);
        if (recientes.length > 14) recientes.shift();
      } else {
        u = recientes.length >= 3 ? recientes.reduce((a, b) => a + b, 0) / recientes.length : (p.objetivo ?? E);
        rI = o.sigmaSinDato ** 2;
      }
      const dT = (u - E) / o.rho;
      T += dT;
      E += o.gastoPorKg * dT; // al perder peso el gasto baja un poco
      P = {
        tt: P.tt - (2 * P.te) / o.rho + P.ee / r2 + o.qPeso ** 2 + rI / r2,
        te: (1 - a) * (P.te - P.ee / o.rho) + (a * rI) / o.rho,
        ee: (1 - a) ** 2 * P.ee + o.qGasto ** 2 + a * a * rI,
      };
    }
    const w = dias[i].peso;
    if (w != null) {
      let R = o.sigmaPeso ** 2;
      const y = w - T;
      const z = Math.abs(y) / Math.sqrt(P.tt + R);
      if (z > o.umbralAtipico) R *= (z / o.umbralAtipico) ** 2;
      const S = P.tt + R;
      const k0 = P.tt / S;
      const k1 = P.te / S;
      T += k0 * y;
      E += k1 * y;
      P = { tt: (1 - k0) * P.tt, te: (1 - k0) * P.te, ee: P.ee - k1 * P.te };
    }
  }

  const desviacion = Math.sqrt(Math.max(0, P.ee));
  const ultimas = dias.slice(-14).filter((d) => d.kcal != null).map((d) => d.kcal as number);
  const kgSemana = ultimas.length >= 4 ? Math.round(((ultimas.reduce((a, b) => a + b, 0) / ultimas.length - E) / o.rho) * 7 * 100) / 100 : null;
  return {
    gasto: Math.round(E),
    desviacion: Math.round(desviacion),
    intervalo: [Math.round(E - 1.28 * desviacion), Math.round(E + 1.28 * desviacion)],
    confianza: confianzaDe(desviacion, diasConPeso),
    pesoTendencia: Math.round(T * 100) / 100,
    kgSemana,
    diasConPeso,
    diasConIngesta,
    pesoDelPrior: Math.min(1, (desviacion / o.sigmaPrior) ** 2),
  };
}

/* ------------------------------ Datos de la base de datos ------------------------------ */

// Un día de diario cuenta como completo si no es hoy y se parece a un día normal de esa persona:
// el diario a medias (apuntaste solo el desayuno) falsearía el gasto hacia abajo.
export function ingestasCompletas(porDia: Map<Fecha, number>, hoy: Fecha): Map<Fecha, number> {
  const previos = [...porDia.entries()].filter(([f]) => f < hoy).map(([, k]) => k).sort((a, b) => a - b);
  if (previos.length === 0) return new Map();
  const mediana = previos[Math.floor(previos.length / 2)];
  const suelo = Math.max(900, 0.55 * mediana);
  return new Map([...porDia.entries()].filter(([f, k]) => f < hoy && k >= suelo));
}

// Une pesadas y diario en días seguidos, desde la primera pesada hasta ayer.
export function armarDias(pesos: { fecha: Fecha; peso_kg: number }[], porDia: Map<Fecha, number>, hoy: Fecha): DiaGasto[] {
  if (pesos.length === 0) return [];
  const ordenados = [...pesos].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const inicio = ordenados[0].fecha;
  const fin = sumarDias(hoy, 0);
  const completas = ingestasCompletas(porDia, hoy);
  const peso = new Map(ordenados.map((x) => [x.fecha, x.peso_kg]));
  const n = Math.max(0, diasEntre(inicio, fin)) + 1;
  const out: DiaGasto[] = [];
  for (let i = 0; i < n; i++) {
    const f = sumarDias(inicio, i);
    out.push({ fecha: f, peso: peso.get(f) ?? null, kcal: completas.get(f) ?? null });
  }
  return out;
}
