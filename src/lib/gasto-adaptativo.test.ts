import { describe, expect, it } from "vitest";
import { sumarDias } from "./calendar";
import { armarDias, confianzaDe, espaciadoDePesadas, estimarGasto, ingestasCompletas, OPCIONES_GASTO, ruidoDePesada, type DiaGasto } from "./gasto-adaptativo";
import { BASE, diasHasta, estimadorEcuacion, estimadorKalman, estimadorPlan, evaluar, gastoReferencia, rng, simularUsuario, type Escenario, type Politica } from "./gasto-sim";
import { calcularObjetivos } from "./nutrition";
import { sugerirAjuste } from "./weight-trend";

const INICIO = "2026-09-01";
const RHO = OPCIONES_GASTO.rho;

// Días sin ruido: la persona gasta `gasto` y come `ingesta`; el peso sigue el balance exacto.
function dias(n: number, p: { gasto: number; ingesta: number; peso0?: number; sinDiario?: (i: number) => boolean; sinPeso?: (i: number) => boolean }): DiaGasto[] {
  const out: DiaGasto[] = [];
  let w = p.peso0 ?? 80;
  for (let i = 0; i < n; i++) {
    out.push({ fecha: sumarDias(INICIO, i), peso: p.sinPeso?.(i) ? null : w, kcal: p.sinDiario?.(i) ? null : p.ingesta });
    w += (p.ingesta - p.gasto) / RHO;
  }
  return out;
}

describe("estimar el gasto real", () => {
  it("sin pesadas devuelve la ecuación, sin confianza", () => {
    const r = estimarGasto({ prior: 3000, dias: [] });
    expect(r).toMatchObject({ gasto: 3000, confianza: "ninguna", pesoDelPrior: 1, pesoTendencia: null });
    const solo = estimarGasto({ prior: 3000, dias: [{ fecha: INICIO, peso: null, kcal: 2500 }] });
    expect(solo.gasto).toBe(3000);
  });

  it("con una pesada y un par de días de diario (poco que contar) sigue con la ecuación", () => {
    const r = estimarGasto({ prior: 3065, dias: [{ fecha: INICIO, peso: 85, kcal: null }, { fecha: sumarDias(INICIO, 1), peso: null, kcal: 2452 }, { fecha: sumarDias(INICIO, 2), peso: null, kcal: null }] });
    expect(Math.abs(r.gasto - 3065)).toBeLessThanOrEqual(10);
    expect(r.confianza).toBe("ninguna");
    expect(r.diasConPeso).toBe(1);
    expect(r.intervalo[0]).toBeLessThan(2700);
    expect(r.intervalo[1]).toBeGreaterThan(3400);
  });

  it("peso estable comiendo 2.500: el gasto sale ≈ 2.500 aunque la ecuación diga 3.000", () => {
    const r = estimarGasto({ prior: 3000, dias: dias(28, { gasto: 2500, ingesta: 2500 }) });
    expect(Math.abs(r.gasto - 2500)).toBeLessThan(160);
    expect(r.gasto).toBeLessThan(2700);
    expect(Math.abs(r.kgSemana as number)).toBeLessThan(0.15);
  });

  it("perdiendo medio kilo por semana con 2.400: el gasto real es ≈ 2.900", () => {
    const real = 2400 + (0.5 * RHO) / 7; // 2.900
    const r = estimarGasto({ prior: 3300, dias: dias(42, { gasto: real, ingesta: 2400 }) });
    expect(Math.abs(r.gasto - real)).toBeLessThan(170);
    expect(r.pesoTendencia).toBeLessThan(80);
    expect(r.kgSemana).toBeLessThan(-0.3);
  });

  it("la incertidumbre baja con los días y nunca supera la de la ecuación", () => {
    const d = (n: number) => estimarGasto({ prior: 3000, dias: dias(n, { gasto: 2900, ingesta: 2900 }) }).desviacion;
    expect(d(3)).toBeLessThanOrEqual(OPCIONES_GASTO.sigmaPrior);
    expect(d(14)).toBeLessThan(d(3));
    expect(d(28)).toBeLessThan(d(14));
    expect(d(84)).toBeLessThan(d(28));
    expect(confianzaDe(d(84), 84)).not.toBe("ninguna");
  });

  it("los días sin diario no tiran el gasto hacia abajo", () => {
    const completo = estimarGasto({ prior: 3000, dias: dias(35, { gasto: 2600, ingesta: 2600 }) });
    const huecos = estimarGasto({ prior: 3000, dias: dias(35, { gasto: 2600, ingesta: 2600, sinDiario: (i) => i % 3 === 1 }) });
    expect(Math.abs(huecos.gasto - completo.gasto)).toBeLessThan(120);
    expect(huecos.gasto).toBeGreaterThan(2400);
  });

  it("sin diario ninguno, usa las calorías planificadas y no se inventa un gasto", () => {
    // Peso estable y plan de 2.600: el gasto debe quedar cerca de 2.600, no de 3.000
    const r = estimarGasto({ prior: 3000, objetivo: 2600, dias: dias(35, { gasto: 2600, ingesta: 2600, sinDiario: () => true }) });
    expect(Math.abs(r.gasto - 2600)).toBeLessThan(250);
    expect(r.diasConIngesta).toBe(0);
  });

  it("una pesada atípica (+4 kg un día) apenas cambia el resultado", () => {
    const base = dias(35, { gasto: 2700, ingesta: 2500 });
    const raro = base.map((d, i) => (i === 30 ? { ...d, peso: (d.peso as number) + 4 } : d));
    const a = estimarGasto({ prior: 3000, dias: base }).gasto;
    const b = estimarGasto({ prior: 3000, dias: raro }).gasto;
    expect(Math.abs(a - b)).toBeLessThan(90);
  });

  it("va en las unidades del diario: quien apunta un 10 % menos obtiene un gasto un 10 % menor", () => {
    const real = dias(42, { gasto: 2800, ingesta: 2800 });
    const apuntado = real.map((d) => ({ ...d, kcal: (d.kcal as number) * 0.9 }));
    const g = estimarGasto({ prior: 2800 * 0.9, dias: apuntado }).gasto;
    expect(Math.abs(g - 2520)).toBeLessThan(80);
  });

  it("pesar pocas veces funciona, solo con más incertidumbre", () => {
    const pocas = estimarGasto({ prior: 3000, dias: dias(42, { gasto: 2600, ingesta: 2600, sinPeso: (i) => i % 5 !== 0 }) });
    const todas = estimarGasto({ prior: 3000, dias: dias(42, { gasto: 2600, ingesta: 2600 }) });
    expect(pocas.desviacion).toBeGreaterThan(todas.desviacion);
    expect(Math.abs(pocas.gasto - 2600)).toBeLessThan(220);
  });
});

describe("pesadas espaciadas (sin báscula en casa)", () => {
  it("mide cada cuántos días te pesas", () => {
    expect(espaciadoDePesadas(dias(30, { gasto: 2500, ingesta: 2500 }))).toBe(1);
    expect(espaciadoDePesadas(dias(29, { gasto: 2500, ingesta: 2500, sinPeso: (i) => i % 7 !== 0 }))).toBe(7);
    expect(espaciadoDePesadas(dias(1, { gasto: 2500, ingesta: 2500 }))).toBeNull();
  });

  it("cuanto más espaciadas, más ruido se le supone a cada pesada", () => {
    expect(ruidoDePesada(OPCIONES_GASTO, null)).toBe(OPCIONES_GASTO.sigmaPeso);
    expect(ruidoDePesada(OPCIONES_GASTO, 1)).toBe(OPCIONES_GASTO.sigmaPeso);
    expect(ruidoDePesada(OPCIONES_GASTO, 3)).toBe(OPCIONES_GASTO.sigmaPeso);
    expect(ruidoDePesada(OPCIONES_GASTO, 7)).toBe(OPCIONES_GASTO.sigmaPesoEspaciado);
    expect(ruidoDePesada(OPCIONES_GASTO, 14)).toBe(OPCIONES_GASTO.sigmaPesoEspaciado);
    const medio = ruidoDePesada(OPCIONES_GASTO, 4.5);
    expect(medio).toBeGreaterThan(OPCIONES_GASTO.sigmaPeso);
    expect(medio).toBeLessThan(OPCIONES_GASTO.sigmaPesoEspaciado);
  });

  it("pesándote una vez por semana también se llega al gasto real, solo que más despacio", () => {
    const semanal = (n: number) => estimarGasto({ prior: 3000, dias: dias(n, { gasto: 2500, ingesta: 2500, sinPeso: (i) => i % 7 !== 0 }) });
    const diaria = estimarGasto({ prior: 3000, dias: dias(56, { gasto: 2500, ingesta: 2500 }) });
    expect(semanal(84).espaciadoPesadas).toBe(7);
    expect(semanal(84).desviacion).toBeLessThan(semanal(28).desviacion);
    expect(semanal(56).desviacion).toBeGreaterThan(diaria.desviacion);
    expect(Math.abs(semanal(84).gasto - 2500)).toBeLessThan(180);
    expect(semanal(84).gasto).toBeLessThan(2750);
  });
});

describe("datos del diario", () => {
  const hoy = "2026-10-22";
  it("el día de hoy y los días a medias no cuentan", () => {
    const porDia = new Map([
      ["2026-10-17", 2500],
      ["2026-10-18", 2400],
      ["2026-10-19", 2600],
      ["2026-10-20", 700], // solo apuntó el desayuno
      ["2026-10-21", 2450],
      [hoy, 1500], // el día aún no ha terminado
    ]);
    const c = ingestasCompletas(porDia, hoy);
    expect([...c.keys()]).toEqual(["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-21"]);
  });

  it("sin diario devuelve vacío", () => {
    expect(ingestasCompletas(new Map(), hoy).size).toBe(0);
  });

  it("une pesadas y diario en días seguidos hasta hoy", () => {
    const d = armarDias([{ fecha: "2026-10-19", peso_kg: 85 }, { fecha: "2026-10-21", peso_kg: 84.6 }], new Map([["2026-10-19", 2500], ["2026-10-20", 2400], ["2026-10-21", 2450]]), hoy);
    expect(d.map((x) => x.fecha)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]);
    expect(d.map((x) => x.peso)).toEqual([85, null, 84.6, null]);
    expect(d.map((x) => x.kcal)).toEqual([2500, 2400, 2450, null]);
    expect(armarDias([], new Map(), hoy)).toEqual([]);
  });

  it("la confianza sale de la incertidumbre", () => {
    expect(confianzaDe(300, 20)).toBe("ninguna");
    expect(confianzaDe(200, 20)).toBe("baja");
    expect(confianzaDe(120, 30)).toBe("media");
    expect(confianzaDe(70, 60)).toBe("alta");
    expect(confianzaDe(70, 1)).toBe("ninguna");
  });
});

/* ------------------------------ Estudio con personas simuladas ------------------------------ */
// Personas inventadas con gasto real conocido, peso con ruido de agua, diario con huecos, a medias y con
// sesgo, y adherencia que cambia con las semanas. Se compara el estimador con la ecuación, con lo que
// hacía la app (solo la pendiente del peso, suponiendo que se sigue el plan) y con la ecuación corregida
// «a mano». Resultado de la búsqueda de parámetros: ver OPCIONES_GASTO.
describe("estudio con personas simuladas", () => {
  const usuarios = 150;
  const kalman = estimadorKalman();
  const MAE = (e: Escenario, est: Parameters<typeof evaluar>[0], cps: number[], tipo: "diario" | "plan" = "diario") => evaluar(est, e, { usuarios, semilla: 31, checkpoints: cps, tipo });

  it("a las 4 semanas el error baja y a las 8-12 se reduce a menos de la mitad que la ecuación", () => {
    const k = MAE(BASE, kalman, [28, 56, 84]);
    const q = MAE(BASE, estimadorEcuacion, [28, 56, 84]);
    expect(k.get(28)!.mae).toBeLessThan(q.get(28)!.mae * 0.75);
    expect(k.get(56)!.mae).toBeLessThan(q.get(56)!.mae * 0.5);
    expect(k.get(84)!.mae).toBeLessThan(q.get(84)!.mae * 0.45);
    expect(k.get(84)!.mae).toBeLessThan(130);
  });

  it("supera a lo que hacía la app, sobre todo con pocas semanas de datos", () => {
    const k = MAE(BASE, kalman, [14, 28]);
    const app = MAE(BASE, estimadorPlan, [14, 28], "plan");
    expect(k.get(14)!.mae).toBeLessThan(app.get(14)!.mae * 0.65);
    expect(k.get(28)!.mae).toBeLessThan(app.get(28)!.mae);
  });

  it("con pocos datos no empeora a la ecuación en ningún escenario", () => {
    const ESC: Escenario[] = [
      BASE,
      { ...BASE, nombre: "sin diario", sinRegistrar: 1, aMedias: 0 },
      { ...BASE, nombre: "apunta de menos", sesgoRegistro: [0.7, 0.9] },
      { ...BASE, nombre: "peso ruidoso", ruidoPeso: 1.2, cambiosDeAgua: true },
      { ...BASE, nombre: "pesadas escasas", frecuenciaPesada: 0.2 },
    ];
    for (const e of ESC) {
      const k = MAE(e, kalman, [7, 14]);
      const q = MAE(e, estimadorEcuacion, [7, 14]);
      expect(k.get(7)!.mae, `${e.nombre} día 7`).toBeLessThanOrEqual(q.get(7)!.mae * 1.05);
      expect(k.get(14)!.mae, `${e.nombre} día 14`).toBeLessThanOrEqual(q.get(14)!.mae * 1.1);
    }
  });

  it("mejora a la ecuación en situaciones difíciles tras 8 semanas", () => {
    const ESC: Escenario[] = [
      { ...BASE, nombre: "sin diario", sinRegistrar: 1, aMedias: 0 },
      { ...BASE, nombre: "apunta de menos", sesgoRegistro: [0.7, 0.9] },
      { ...BASE, nombre: "peso ruidoso", ruidoPeso: 1.2, cambiosDeAgua: true },
      { ...BASE, nombre: "pesadas escasas", frecuenciaPesada: 0.2 },
      { ...BASE, nombre: "diario flojo", sinRegistrar: 0.3, aMedias: 0.08 },
      { ...BASE, nombre: "ecuación mala", errorEcuacion: 0.18 },
    ];
    for (const e of ESC) {
      const k = MAE(e, kalman, [56]).get(56)!.mae;
      const q = MAE(e, estimadorEcuacion, [56]).get(56)!.mae;
      expect(k, e.nombre).toBeLessThan(q * 0.85);
    }
  });

  it("pesándote una vez por semana (misma báscula) a las 8-12 semanas ya mejora mucho a la fórmula", () => {
    const e: Escenario = { ...BASE, nombre: "semanal", pesadaCada: 7, ruidoPeso: 0.6 };
    const k = MAE(e, kalman, [56, 84]);
    const q = MAE(e, estimadorEcuacion, [56, 84]);
    expect(k.get(56)!.mae).toBeLessThan(q.get(56)!.mae * 0.5);
    expect(k.get(84)!.mae).toBeLessThan(q.get(84)!.mae * 0.35);
  });

  it("con una pesada cada 2 semanas y básculas distintas no hace daño y a las 12 semanas ya ayuda", () => {
    const e: Escenario = { ...BASE, nombre: "quincenal", pesadaCada: 14, ruidoPeso: 1.0, sesgoBascula: 0.8 };
    const k = MAE(e, kalman, [28, 84]);
    const q = MAE(e, estimadorEcuacion, [28, 84]);
    expect(k.get(28)!.mae).toBeLessThanOrEqual(q.get(28)!.mae * 1.05);
    expect(k.get(84)!.mae).toBeLessThan(q.get(84)!.mae * 0.6);
  });

  it("y el intervalo no engaña ni con pesadas escasas y básculas distintas", () => {
    const e: Escenario = { ...BASE, nombre: "quincenal", pesadaCada: 14, ruidoPeso: 1.0, sesgoBascula: 0.8 };
    const r = rng(8);
    let dentro = 0;
    const n = 250;
    for (let i = 0; i < n; i++) {
      const u = simularUsuario(r, e, 84);
      const est = estimarGasto({ prior: u.prior, dias: diasHasta(u, 84), objetivo: u.plan });
      const ref = gastoReferencia(u, 84, "diario");
      if (ref >= est.intervalo[0] && ref <= est.intervalo[1]) dentro++;
    }
    expect(dentro / n).toBeGreaterThan(0.68);
    expect(dentro / n).toBeLessThan(0.97);
  });

  it("la incertidumbre está bien calibrada: el intervalo del 80 % acierta entre el 60 y el 95 %", () => {
    const r = rng(77);
    let dentro = 0;
    const n = 250;
    for (let i = 0; i < n; i++) {
      const u = simularUsuario(r, BASE, 56);
      const est = estimarGasto({ prior: u.prior, dias: diasHasta(u, 56), objetivo: u.plan });
      const ref = gastoReferencia(u, 56, "diario");
      if (ref >= est.intervalo[0] && ref <= est.intervalo[1]) dentro++;
    }
    expect(dentro / n).toBeGreaterThan(0.6);
    expect(dentro / n).toBeLessThan(0.95);
  });

  describe("recalculando las calorías cada semana (bucle cerrado)", () => {
    const persona = (prior: number, peso: number) => ({ sexo: "hombre" as const, edad: 28, pesoKg: peso, alturaCm: 178, nivelActividad: "ligero" as const, diasEntreno: 3, objetivo: "perder_grasa" as const, ritmo: "suave" as const, kcalMantenimiento: prior });
    const ecuacion: Politica = ({ prior, pesoReal0 }) => calcularObjetivos(persona(prior, pesoReal0)).kcal;
    const adaptativa: Politica = ({ prior, planActual, pesoReal0, dias: d }) => {
      const est = estimarGasto({ prior, dias: d, objetivo: planActual });
      const nuevo = calcularObjetivos(persona(est.gasto, est.pesoTendencia ?? pesoReal0)).kcal;
      return Math.round((planActual + Math.max(-200, Math.min(200, nuevo - planActual))) / 10) * 10; // nunca más de 200 kcal de golpe
    };
    const appAntigua: Politica = ({ prior, planActual, pesoReal0, dias: d }) => {
      const regs = d.filter((x) => x.peso != null).map((x) => ({ fecha: x.fecha, peso_kg: x.peso as number }));
      const s = sugerirAjuste({ registros: regs, kcalObjetivo: planActual, gastoEstimado: prior, kcalMinimas: 1500, pesoKg: pesoReal0 });
      return s.estado === "ajustar" ? s.kcalNueva : planActual;
    };

    function correr(e: Escenario, politica: Politica) {
      const r = rng(5);
      let error = 0;
      let n = 0;
      let cambios = 0;
      let m = 0;
      for (let k = 0; k < 100; k++) {
        const u = simularUsuario(r, e, 91, politica);
        for (let s = 5; s <= 12; s++) {
          const w0 = u.dias[s * 7 - 7].pesoReal;
          error += Math.abs(w0 - u.dias[s * 7].pesoReal - 0.005 * w0); // kg/semana reales − previstos (0,5 %)
          n++;
        }
        for (let s = 3; s <= 12; s++) {
          cambios += Math.abs(u.dias[s * 7].planDia - u.dias[s * 7 - 7].planDia);
          m++;
        }
      }
      return { error: error / n, cambios: cambios / m };
    }

    it("el ritmo real se acerca mucho más al previsto que con la ecuación o con la app antigua", () => {
      const a = correr(BASE, adaptativa);
      const q = correr(BASE, ecuacion);
      const v = correr(BASE, appAntigua);
      expect(a.error).toBeLessThan(q.error * 0.85);
      expect(a.error).toBeLessThan(v.error * 0.6);
    });

    it("y sin dar bandazos: cambios de objetivo pequeños de una semana a otra", () => {
      const a = correr(BASE, adaptativa);
      const v = correr(BASE, appAntigua);
      expect(a.cambios).toBeLessThan(90);
      expect(a.cambios).toBeLessThan(v.cambios * 0.7);
    });

    it("también cuando apuntas de menos o el diario está flojo", () => {
      for (const e of [{ ...BASE, nombre: "apunta de menos", sesgoRegistro: [0.7, 0.9] as [number, number] }, { ...BASE, nombre: "flojo", sinRegistrar: 0.3, aMedias: 0.08 }]) {
        expect(correr(e, adaptativa).error, e.nombre).toBeLessThan(correr(e, ecuacion).error);
      }
    });
  });
});
