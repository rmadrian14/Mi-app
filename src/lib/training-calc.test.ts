import { describe, expect, it } from "vitest";
import {
  MUSCLE_LANDMARKS,
  calcularCargaAC,
  calcularVolumenSemanal,
  construirHistorial,
  discomfortSemaforo,
  estimate1RM,
  evaluarDescarga,
  muscleVolumeZone,
  normalizeMuscleGroup,
  parseRepRangeObjetivo,
  pesoDeTrabajo,
  roundToStep,
  sugerirProgresion,
  toLocalISODate,
  zonaDeCarga,
  type DeloadExerciseRow,
  type DeloadSessionRow,
  type DeloadSetRow,
  type ProgSessionRow,
  type ProgSetRow,
} from "./training-calc";

/* ------------------------------ 1RM ------------------------------ */

describe("estimate1RM", () => {
  it("1 repetición: el peso levantado es el 1RM", () => {
    expect(estimate1RM(100, 1)).toEqual({ value: 100, precision: "alta" });
  });

  it("2-10 reps: media de Epley y Brzycki (100 kg × 5 ≈ 114,6)", () => {
    const r = estimate1RM(100, 5);
    expect(r.precision).toBe("alta");
    expect(r.value).toBeCloseTo((116.6667 + 112.5) / 2, 3);
  });

  it("10 reps sigue siendo preciso; 11-15 usa Mayhew y es aproximado", () => {
    expect(estimate1RM(100, 10).precision).toBe("alta");
    const r = estimate1RM(100, 12);
    expect(r.precision).toBe("aprox");
    expect(r.value).toBeCloseTo(135.4, 1);
  });

  it("más de 15 reps o datos inválidos: no se estima (mejor nada que un número falso)", () => {
    for (const [p, r] of [[100, 16], [100, 30], [0, 5], [-10, 5], [100, 0], [NaN, 5]] as const) {
      expect(estimate1RM(p, r)).toEqual({ value: null, precision: "no_estimable" });
    }
  });

  it("más repeticiones con el mismo peso implican más 1RM estimado", () => {
    expect(estimate1RM(80, 8).value!).toBeGreaterThan(estimate1RM(80, 4).value!);
  });
});

/* ------------------------------ Músculos y volumen ------------------------------ */

describe("grupos musculares", () => {
  it("normaliza variantes de texto libre (acentos, plurales, mayúsculas, sinónimos)", () => {
    expect(normalizeMuscleGroup("Bíceps")).toBe("Bíceps");
    expect(normalizeMuscleGroup("biceps")).toBe("Bíceps");
    expect(normalizeMuscleGroup("  HOMBRO ")).toBe("Hombros");
    expect(normalizeMuscleGroup("isquiotibiales")).toBe("Isquiosurales");
    expect(normalizeMuscleGroup("Glúteo")).toBe("Glúteos");
    expect(normalizeMuscleGroup("gemelo")).toBe("Gemelos");
  });

  it("lo que no tiene landmark se descarta en lugar de inventar uno", () => {
    expect(normalizeMuscleGroup("core")).toBeNull();
    expect(normalizeMuscleGroup("antebrazo")).toBeNull();
    expect(normalizeMuscleGroup("")).toBeNull();
    expect(normalizeMuscleGroup(null)).toBeNull();
    expect(normalizeMuscleGroup(undefined)).toBeNull();
  });

  it("los 9 músculos tienen puntos de referencia coherentes (MEV < MAV < MRV)", () => {
    expect(Object.keys(MUSCLE_LANDMARKS)).toHaveLength(9);
    for (const [m, l] of Object.entries(MUSCLE_LANDMARKS)) {
      expect(l.mev, m).toBeLessThan(l.mavLow);
      expect(l.mavLow, m).toBeLessThanOrEqual(l.mavHigh);
      expect(l.mavHigh, m).toBeLessThanOrEqual(l.mrv);
    }
  });

  it("Gemelos: MEV 6, MAV 10-16, MRV 20 (valores acordados)", () => {
    expect(MUSCLE_LANDMARKS.Gemelos).toEqual({ mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 });
  });

  it("zonas de volumen de Pecho (MEV 6 · MAV 12-20 · MRV 25)", () => {
    const z = (v: number) => muscleVolumeZone("Pecho", v);
    expect(z(5.9)).toBe("insuficiente");
    expect(z(6)).toBe("bajo");
    expect(z(11.9)).toBe("bajo");
    expect(z(12)).toBe("optimo");
    expect(z(20)).toBe("optimo");
    expect(z(20.5)).toBe("alto");
    expect(z(25)).toBe("alto");
    expect(z(25.5)).toBe("excesivo");
    expect(muscleVolumeZone("MusculoInexistente", 99)).toBe("optimo");
  });
});

describe("calcularVolumenSemanal (1,0 por principal, 0,5 por secundario, semana de lunes a domingo)", () => {
  const ejercicios = {
    pecho: { principal: "Pecho", secundarios: ["Tríceps", "Hombros"] },
    curl: { principal: "Bíceps", secundarios: ["Bíceps", "Antebrazo"] },
  };

  it("suma fraccional por semana", () => {
    // 2026-10-19 es lunes
    const filas = [
      { fecha: "2026-10-19", exercise_id: "pecho" },
      { fecha: "2026-10-19", exercise_id: "pecho" },
      { fecha: "2026-10-21", exercise_id: "pecho" },
      { fecha: "2026-10-26", exercise_id: "pecho" },
    ];
    const v = calcularVolumenSemanal(filas, ejercicios);
    expect(v.get("2026-10-19")).toEqual({ Pecho: 3, Tríceps: 1.5, Hombros: 1.5 });
    expect(v.get("2026-10-26")).toEqual({ Pecho: 1, Tríceps: 0.5, Hombros: 0.5 });
  });

  it("el domingo cuenta en la semana que empezó el lunes anterior", () => {
    const v = calcularVolumenSemanal([{ fecha: "2026-10-25", exercise_id: "pecho" }], ejercicios);
    expect([...v.keys()]).toEqual(["2026-10-19"]);
  });

  it("un secundario igual al principal no se cuenta dos veces y los músculos sin landmark se ignoran", () => {
    const v = calcularVolumenSemanal([{ fecha: "2026-10-19", exercise_id: "curl" }], ejercicios);
    expect(v.get("2026-10-19")).toEqual({ Bíceps: 1 });
  });

  it("series de ejercicios desconocidos se ignoran", () => {
    expect(calcularVolumenSemanal([{ fecha: "2026-10-19", exercise_id: "borrado" }], ejercicios).size).toBe(0);
  });
});

/* ------------------------------ Alerta de descarga ------------------------------ */

function ses(id: string, fecha: string, extra: Partial<DeloadSessionRow> = {}): DeloadSessionRow {
  return { id, fecha, routine_day_id: "R1", es_extra: false, completado: true, esfuerzo_percibido: 7, duracion_min: 60, ...extra };
}
const serie = (session_id: string, exercise_id: string, kg: number, reps: number): DeloadSetRow => ({
  session_id, exercise_id, peso_realizado_kg: kg, reps_realizadas: reps,
});
const ejercicios: Record<string, DeloadExerciseRow> = {
  banca: { id: "banca", nombre: "Press banca", grupo_muscular: "Pecho", musculos_secundarios: [] },
  curl: { id: "curl", nombre: "Curl", grupo_muscular: "Bíceps", musculos_secundarios: [] },
};
const signal = (r: ReturnType<typeof evaluarDescarga>, id: string) => r.signals.find((s) => s.id === id)!;

describe("evaluarDescarga", () => {
  it("sin datos no hay ninguna señal", () => {
    const r = evaluarDescarga([], [], {});
    expect(r.activeCount).toBe(0);
    expect(r.shouldDeload).toBe(false);
    expect(r.signals.map((s) => s.id)).toEqual(["e1rm_drop", "stagnation", "mrv_volume", "load_trend"]);
  });

  describe("señal 1: caída de e1RM ≥ 5 % con esfuerzo igual o mayor", () => {
    const sesiones = (rpeUlt: number) => [ses("a", "2026-09-01", { routine_day_id: null, es_extra: true, esfuerzo_percibido: 7 }), ses("b", "2026-09-08", { routine_day_id: null, es_extra: true, esfuerzo_percibido: rpeUlt })];
    it("activa con -10 % y el mismo esfuerzo", () => {
      const r = evaluarDescarga(sesiones(7), [serie("a", "banca", 100, 5), serie("b", "banca", 90, 5)], ejercicios);
      expect(signal(r, "e1rm_drop").active).toBe(true);
      expect(signal(r, "e1rm_drop").detail).toContain("Press banca");
    });
    it("no se activa si la caída es de solo ~4 %", () => {
      const r = evaluarDescarga(sesiones(7), [serie("a", "banca", 100, 5), serie("b", "banca", 96, 5)], ejercicios);
      expect(signal(r, "e1rm_drop").active).toBe(false);
    });
    it("no se activa si el esfuerzo percibido fue menor (cayó por descanso, no por fatiga)", () => {
      const r = evaluarDescarga(sesiones(5), [serie("a", "banca", 100, 5), serie("b", "banca", 90, 5)], ejercicios);
      expect(signal(r, "e1rm_drop").active).toBe(false);
    });
    it("no se activa si falta el esfuerzo percibido", () => {
      const s = [ses("a", "2026-09-01", { esfuerzo_percibido: null }), ses("b", "2026-09-08")];
      const r = evaluarDescarga(s, [serie("a", "banca", 100, 5), serie("b", "banca", 90, 5)], ejercicios);
      expect(signal(r, "e1rm_drop").active).toBe(false);
    });
  });

  describe("señal 2: mismo día de rutina estancado 2 semanas seguidas", () => {
    const tres = [ses("a", "2026-09-01"), ses("b", "2026-09-08"), ses("c", "2026-09-15")];
    it("activa si el rendimiento no mejora en 3 apariciones", () => {
      const sets = [serie("a", "banca", 100, 5), serie("b", "banca", 100, 5), serie("c", "banca", 100, 5)];
      expect(signal(evaluarDescarga(tres, sets, ejercicios), "stagnation").active).toBe(true);
    });
    it("no se activa si en alguna semana mejora", () => {
      const sets = [serie("a", "banca", 100, 5), serie("b", "banca", 105, 5), serie("c", "banca", 100, 5)];
      expect(signal(evaluarDescarga(tres, sets, ejercicios), "stagnation").active).toBe(false);
    });
    it("necesita al menos 3 apariciones", () => {
      const sets = [serie("a", "banca", 100, 5), serie("b", "banca", 100, 5)];
      expect(signal(evaluarDescarga(tres.slice(0, 2), sets, ejercicios), "stagnation").active).toBe(false);
    });
    it("las sesiones extra no cuentan como día de rutina", () => {
      const extra = tres.map((s) => ({ ...s, es_extra: true, routine_day_id: null }));
      const sets = [serie("a", "banca", 100, 5), serie("b", "banca", 100, 5), serie("c", "banca", 100, 5)];
      expect(signal(evaluarDescarga(extra, sets, ejercicios), "stagnation").active).toBe(false);
    });
  });

  describe("señal 3: un músculo en o sobre su MRV dos semanas seguidas", () => {
    // Bíceps: MRV 20. Se crean n series de curl en cada una de las dos semanas.
    const dosSemanas = (n: number) => {
      const sesiones = [ses("w1", "2026-10-12", { routine_day_id: null, es_extra: true }), ses("w2", "2026-10-19", { routine_day_id: null, es_extra: true })];
      const sets = [...Array.from({ length: n }, () => serie("w1", "curl", 20, 10)), ...Array.from({ length: n }, () => serie("w2", "curl", 20, 10))];
      return evaluarDescarga(sesiones, sets, ejercicios);
    };
    it("activa con 20 series (= MRV) en cada una de las dos semanas", () => {
      const r = dosSemanas(20);
      expect(signal(r, "mrv_volume").active).toBe(true);
      expect(signal(r, "mrv_volume").detail).toContain("Bíceps");
    });
    it("no se activa con 19 series", () => {
      expect(signal(dosSemanas(19), "mrv_volume").active).toBe(false);
    });
    it("no se activa con una sola semana de datos", () => {
      const r = evaluarDescarga([ses("w1", "2026-10-12")], Array.from({ length: 25 }, () => serie("w1", "curl", 20, 10)), ejercicios);
      expect(signal(r, "mrv_volume").active).toBe(false);
    });
  });

  describe("señal 4: carga de sesión al alza sin récords", () => {
    const sesionesCarga = (cargas: [number, number][]) =>
      cargas.map(([rpe, min], i) => ses(`s${i}`, `2026-10-0${i + 1}`, { esfuerzo_percibido: rpe, duracion_min: min, routine_day_id: null, es_extra: true }));
    it("activa con 4 sesiones de carga creciente y sin ningún récord de fuerza", () => {
      const r = evaluarDescarga(sesionesCarga([[7, 60], [7, 65], [8, 65], [8, 70]]), [], ejercicios);
      expect(signal(r, "load_trend").active).toBe(true);
    });
    it("no se activa si la carga baja en algún tramo", () => {
      const r = evaluarDescarga(sesionesCarga([[7, 60], [8, 70], [6, 60], [8, 70]]), [], ejercicios);
      expect(signal(r, "load_trend").active).toBe(false);
    });
    it("no se activa si en ese periodo hubo un récord nuevo de e1RM (la carga sube porque progresa)", () => {
      const sesiones = sesionesCarga([[7, 60], [7, 65], [8, 65], [8, 70]]);
      const sets = [serie("s0", "banca", 100, 5), serie("s1", "banca", 100, 5), serie("s2", "banca", 105, 5), serie("s3", "banca", 105, 5)];
      expect(signal(evaluarDescarga(sesiones, sets, ejercicios), "load_trend").active).toBe(false);
    });
    it("comportamiento actual: la PRIMERA marca de un ejercicio cuenta como récord, así que si cae dentro del tramo la señal se suprime", () => {
      const sesiones = sesionesCarga([[7, 60], [7, 65], [8, 65], [8, 70]]);
      const r = evaluarDescarga(sesiones, [serie("s0", "banca", 100, 5)], ejercicios);
      expect(signal(r, "load_trend").active).toBe(false);
    });
    it("necesita al menos 3 sesiones con esfuerzo y duración", () => {
      const r = evaluarDescarga(sesionesCarga([[7, 60], [8, 70]]), [], ejercicios);
      expect(signal(r, "load_trend").active).toBe(false);
    });
  });

  it("con 2 o más señales activas recomienda descarga; con una sola, no", () => {
    // Caída de e1RM (señal 1) + carga al alza sin récords (señal 4). Hay una sesión
    // previa con la marca de referencia, para que las del tramo no sean récord.
    const sesiones = [
      ses("p", "2026-09-01", { routine_day_id: null, es_extra: true, esfuerzo_percibido: 7, duracion_min: 60 }),
      ses("a", "2026-10-01", { routine_day_id: null, es_extra: true, esfuerzo_percibido: 7, duracion_min: 60 }),
      ses("b", "2026-10-02", { routine_day_id: null, es_extra: true, esfuerzo_percibido: 7, duracion_min: 65 }),
      ses("c", "2026-10-03", { routine_day_id: null, es_extra: true, esfuerzo_percibido: 8, duracion_min: 65 }),
      ses("d", "2026-10-04", { routine_day_id: null, es_extra: true, esfuerzo_percibido: 8, duracion_min: 70 }),
    ];
    const conCaida = [serie("p", "banca", 100, 5), serie("d", "banca", 90, 5)];
    const dos = evaluarDescarga(sesiones, conCaida, ejercicios);
    expect(dos.activeCount).toBe(2);
    expect(dos.shouldDeload).toBe(true);

    const una = evaluarDescarga(sesiones, [], ejercicios); // solo señal 4
    expect(una.activeCount).toBe(1);
    expect(una.shouldDeload).toBe(false);
  });
});

/* ------------------------------ Progresión de carga ------------------------------ */

const ps = (id: string, fecha: string, rpe: number | null = 7): ProgSessionRow => ({ id, fecha, esfuerzo_percibido: rpe });
const pset = (session_id: string, exercise_id: string, kg: number | null, reps: number): ProgSetRow => ({
  session_id, exercise_id, peso_realizado_kg: kg, reps_realizadas: reps,
});
const sugerir = (sesiones: ProgSessionRow[], sets: ProgSetRow[], objetivo: string) =>
  sugerirProgresion(construirHistorial(sesiones, sets), "E", objetivo);

describe("auxiliares de progresión", () => {
  it("roundToStep: múltiplos de 2 kg (las mancuernas del usuario ajustan de 2 en 2)", () => {
    expect(roundToStep(21, 2)).toBe(22);
    expect(roundToStep(20.9, 2)).toBe(20);
    expect(roundToStep(24.2, 2)).toBe(24);
  });

  it("parseRepRangeObjetivo: rangos, número único y aclaraciones entre paréntesis", () => {
    expect(parseRepRangeObjetivo("12-15")).toEqual({ min: 12, max: 15 });
    expect(parseRepRangeObjetivo("10 por pierna")).toEqual({ min: 10, max: 10 });
    expect(parseRepRangeObjetivo("12-15 (rango parcial 30-40°, muy ligero)")).toEqual({ min: 12, max: 15 });
    expect(parseRepRangeObjetivo("al gusto")).toBeNull();
  });
});

describe("construirHistorial", () => {
  it("agrupa por ejercicio y sesión, ordena por fecha e ignora series sin reps o de sesiones desconocidas", () => {
    const h = construirHistorial(
      [ps("s2", "2026-10-08"), ps("s1", "2026-10-01")],
      [pset("s2", "E", 22, 10), pset("s1", "E", 20, 10), pset("s1", "E", 20, 9), pset("zz", "E", 50, 5), { session_id: "s1", exercise_id: "E", peso_realizado_kg: 20, reps_realizadas: null }],
    );
    const e = h.get("E")!;
    expect(e.map((o) => o.fecha)).toEqual(["2026-10-01", "2026-10-08"]);
    expect(e[0].sets).toHaveLength(2);
    expect(e[1].sets).toHaveLength(1);
  });
});

describe("sugerirProgresion · objetivo «al fallo» (autorregulado por e1RM)", () => {
  const dosSesiones = (kgAnt: number, repsAnt: number, kgAct: number, repsAct: number, rpeAnt = 7, rpeAct = 7) => ({
    sesiones: [ps("s1", "2026-10-01", rpeAnt), ps("s2", "2026-10-08", rpeAct)],
    sets: [pset("s1", "E", kgAnt, repsAnt), pset("s2", "E", kgAct, repsAct)],
  });

  it("sube si el e1RM mejora ≥ 2,5 % con esfuerzo igual o mayor (20×10 → 22×10 = +10 %: 24 kg)", () => {
    const { sesiones, sets } = dosSesiones(20, 10, 22, 10);
    const s = sugerir(sesiones, sets, "Al fallo");
    expect(s?.kind).toBe("sube_fallo_e1rm");
    if (s?.kind === "sube_fallo_e1rm") {
      expect(s.suggestedWeightKg).toBe(24);
      expect(s.changePct).toBeCloseTo(0.1, 3);
      expect(s.previousFecha).toBe("2026-10-01");
    }
  });

  it("nunca sugiere menos de +2 kg al subir", () => {
    // +2,6 % de e1RM: 78 kg × 5 → 80 kg × 5 → 80 × 1,026 = 82,1 → 82 (= +2 kg mínimo)
    const { sesiones, sets } = dosSesiones(78, 5, 80, 5);
    const s = sugerir(sesiones, sets, "al fallo");
    expect(s?.kind).toBe("sube_fallo_e1rm");
    if (s?.kind === "sube_fallo_e1rm") expect(s.suggestedWeightKg).toBeGreaterThanOrEqual(82);
  });

  it("mantiene si la mejora es menor de 2,5 %", () => {
    const { sesiones, sets } = dosSesiones(100, 5, 101, 5); // +1 %
    expect(sugerir(sesiones, sets, "casi al fallo")?.kind).toBe("mantener_fallo");
  });

  it("mantiene si el esfuerzo percibido bajó, aunque el e1RM suba", () => {
    const { sesiones, sets } = dosSesiones(20, 10, 22, 10, 8, 6);
    expect(sugerir(sesiones, sets, "Al fallo")?.kind).toBe("mantener_fallo");
  });

  it("mantiene si falta el esfuerzo percibido", () => {
    const sesiones = [ps("s1", "2026-10-01", null), ps("s2", "2026-10-08", null)];
    const sets = [pset("s1", "E", 20, 10), pset("s2", "E", 22, 10)];
    expect(sugerir(sesiones, sets, "Al fallo")?.kind).toBe("mantener_fallo");
  });

  it("con 15 o más reps en alguna serie sube directamente (+5 %, mínimo +2 kg)", () => {
    const { sesiones, sets } = dosSesiones(10, 12, 10, 16);
    const s = sugerir(sesiones, sets, "Al fallo");
    expect(s?.kind).toBe("sube_fallo_reps");
    if (s?.kind === "sube_fallo_reps") {
      expect(s.suggestedWeightKg).toBe(12); // 10,5 → 10, pero mínimo 10+2
      expect(s.lastReps).toBe(16);
    }
  });

  it("necesita al menos dos sesiones; sin peso registrado no sugiere nada", () => {
    expect(sugerir([ps("s1", "2026-10-01")], [pset("s1", "E", 20, 10)], "Al fallo")).toBeNull();
    const sesiones = [ps("s1", "2026-10-01"), ps("s2", "2026-10-08")];
    expect(sugerir(sesiones, [pset("s1", "E", null, 10), pset("s2", "E", null, 10)], "Al fallo")).toBeNull();
  });
});

describe("sugerirProgresion · rango de reps fijo (progresión doble)", () => {
  const sesiones = [ps("s1", "2026-10-01"), ps("s2", "2026-10-08")];

  it("sube solo si TODAS las series de la última sesión llegaron al tope del rango", () => {
    const sets = [pset("s1", "E", 20, 12), pset("s2", "E", 20, 15), pset("s2", "E", 20, 15), pset("s2", "E", 20, 16)];
    const s = sugerir(sesiones, sets, "12-15");
    expect(s?.kind).toBe("sube_rango");
    if (s?.kind === "sube_rango") {
      expect(s.suggestedWeightKg).toBe(22); // 21 → 22 (múltiplo de 2), y mínimo +2
      expect(s.repMax).toBe(15);
    }
  });

  it("mantiene si una sola serie se queda por debajo del tope", () => {
    const sets = [pset("s1", "E", 20, 12), pset("s2", "E", 20, 15), pset("s2", "E", 20, 14)];
    const s = sugerir(sesiones, sets, "12-15");
    expect(s?.kind).toBe("mantener_rango");
    if (s?.kind === "mantener_rango") expect(s.lastReps).toEqual([15, 14]);
  });

  it("ignora las aclaraciones entre paréntesis al leer el rango", () => {
    const sets = [pset("s1", "E", 10, 12), pset("s2", "E", 10, 15), pset("s2", "E", 10, 15)];
    const s = sugerir(sesiones, sets, "12-15 (rango parcial 30-40°, muy ligero)");
    expect(s?.kind).toBe("sube_rango");
    if (s?.kind === "sube_rango") expect(s.repMax).toBe(15);
  });

  it("un objetivo que no se entiende no genera sugerencia", () => {
    const sets = [pset("s1", "E", 20, 12), pset("s2", "E", 20, 15)];
    expect(sugerir(sesiones, sets, "al gusto")).toBeNull();
  });
});

describe("sugerirProgresion · mejoras (primera sesión, peso de trabajo, bajar peso)", () => {
  it("con una sola sesión ya sugiere en rangos fijos (antes hacían falta dos)", () => {
    const una = [ps("s1", "2026-10-01")];
    const arriba = sugerir(una, [pset("s1", "E", 20, 15), pset("s1", "E", 20, 15), pset("s1", "E", 20, 15)], "12-15");
    expect(arriba?.kind).toBe("sube_rango");
    const dentro = sugerir(una, [pset("s1", "E", 20, 13), pset("s1", "E", 20, 12), pset("s1", "E", 20, 12)], "12-15");
    expect(dentro).toMatchObject({ kind: "mantener_rango", currentWeightKg: 20, bajoMinimo: false });
    // pero «al fallo» sigue necesitando una sesión anterior con la que comparar el e1RM
    expect(sugerir(una, [pset("s1", "E", 20, 10)], "al fallo")).toBeNull();
    expect(sugerir([], [], "12-15")).toBeNull();
  });

  it("el peso de trabajo es el más repetido: un calentamiento ligero no impide subir", () => {
    const sesiones = [ps("s1", "2026-10-01")];
    const sets = [pset("s1", "E", 10, 15), pset("s1", "E", 20, 15), pset("s1", "E", 20, 15), pset("s1", "E", 20, 16)];
    expect(pesoDeTrabajo([{ reps: 15, peso: 10 }, { reps: 15, peso: 20 }, { reps: 15, peso: 20 }])).toBe(20);
    expect(pesoDeTrabajo([{ reps: 8, peso: 40 }, { reps: 8, peso: 50 }])).toBe(50); // empate: el mayor
    expect(pesoDeTrabajo([{ reps: 8, peso: null }])).toBeNull();
    const s = sugerir(sesiones, sets, "12-15");
    expect(s?.kind).toBe("sube_rango");
    if (s?.kind === "sube_rango") expect(s.currentWeightKg).toBe(20);
  });

  it("una sesión por debajo del mínimo solo avisa; dos seguidas bajan el peso un 10 %", () => {
    const uno = sugerir(
      [ps("s1", "2026-10-01"), ps("s2", "2026-10-08")],
      [pset("s1", "E", 30, 11), pset("s1", "E", 30, 12), pset("s2", "E", 30, 9), pset("s2", "E", 30, 10), pset("s2", "E", 30, 8)],
      "12-15",
    );
    expect(uno).toMatchObject({ kind: "mantener_rango", bajoMinimo: true, repMin: 12, lastReps: [9, 10, 8] });

    const dos = sugerir(
      [ps("s1", "2026-10-01"), ps("s2", "2026-10-08"), ps("s3", "2026-10-15")],
      [
        pset("s1", "E", 30, 12), pset("s1", "E", 30, 12), pset("s1", "E", 30, 12),
        pset("s2", "E", 30, 9), pset("s2", "E", 30, 10), pset("s2", "E", 30, 8),
        pset("s3", "E", 30, 10), pset("s3", "E", 30, 9), pset("s3", "E", 30, 9),
      ],
      "12-15",
    );
    // la sesión anterior (s2) también estaba por debajo; 30 × 0,9 = 27 → 28 con múltiplos de 2, pero siempre al menos 2 kg menos: 28
    expect(dos).toMatchObject({ kind: "baja_rango", currentWeightKg: 30, repMin: 12 });
    if (dos?.kind === "baja_rango") {
      expect(dos.suggestedWeightKg).toBeLessThanOrEqual(28);
      expect(dos.suggestedWeightKg).toBeGreaterThanOrEqual(26);
      expect(dos.suggestedWeightKg % 2).toBe(0);
    }
  });

  it("no baja si en la sesión anterior sí llegaba al rango, ni si ya había bajado de peso", () => {
    const buena = sugerir(
      [ps("s1", "2026-10-01"), ps("s2", "2026-10-08")],
      [pset("s1", "E", 30, 12), pset("s1", "E", 30, 13), pset("s2", "E", 30, 9), pset("s2", "E", 30, 9)],
      "12-15",
    );
    expect(buena?.kind).toBe("mantener_rango");
    // antes pesaba menos (26) y ahora 30 se queda corto: no es una racha con el mismo peso
    const subio = sugerir(
      [ps("s1", "2026-10-01"), ps("s2", "2026-10-08")],
      [pset("s1", "E", 26, 9), pset("s1", "E", 26, 9), pset("s2", "E", 30, 9), pset("s2", "E", 30, 9)],
      "12-15",
    );
    expect(subio?.kind).toBe("mantener_rango");
  });

  it("la bajada nunca es menor de 2 kg ni deja el peso en cero", () => {
    const s = sugerir(
      [ps("s1", "2026-10-01"), ps("s2", "2026-10-08")],
      [pset("s1", "E", 4, 5), pset("s1", "E", 4, 5), pset("s2", "E", 4, 5), pset("s2", "E", 4, 4)],
      "8-10",
    );
    expect(s?.kind).toBe("baja_rango");
    if (s?.kind === "baja_rango") {
      expect(s.suggestedWeightKg).toBeGreaterThanOrEqual(2);
      expect(s.suggestedWeightKg).toBeLessThan(4);
    }
  });
});

/* ------------------------------ Carga reciente frente a la habitual ------------------------------ */

describe("calcularCargaAC (esfuerzo × minutos, medias móviles de 7 y 28 días)", () => {
  const sesion = (fecha: string, rpe: number | null = 7, min: number | null = 60): DeloadSessionRow => ({
    id: fecha, fecha, routine_day_id: null, es_extra: false, completado: true, esfuerzo_percibido: rpe, duracion_min: min,
  });
  const dia = (base: string, n: number) => {
    const d = new Date(`${base}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  // Entrena lunes, miércoles y viernes durante `semanas`
  const habitual = (inicio: string, semanas: number, rpe = 7, min = 60) => {
    const out: DeloadSessionRow[] = [];
    for (let w = 0; w < semanas; w++) for (const d of [0, 2, 4]) out.push(sesion(dia(inicio, w * 7 + d), rpe, min));
    return out;
  };
  const INICIO = "2026-08-03"; // lunes

  it("entrenando siempre igual, el cociente es ≈ 1 (zona óptima) y ya es fiable tras 4 semanas", () => {
    const c = calcularCargaAC(habitual(INICIO, 8), dia(INICIO, 8 * 7 - 1));
    expect(c.ratio).not.toBeNull();
    expect(c.ratio as number).toBeGreaterThan(0.85);
    expect(c.ratio as number).toBeLessThan(1.2);
    expect(c.zona).toBe("optima");
    expect(c.fiable).toBe(true);
    expect(c.sesiones).toBe(24);
  });

  it("entrenando siempre igual da lo mismo cualquier día de la semana (no sale «baja» un domingo)", () => {
    const sesiones = habitual(INICIO, 8);
    for (let k = 0; k < 7; k++) {
      const c = calcularCargaAC(sesiones, dia(INICIO, 7 * 7 + k)); // la última semana, de lunes a domingo
      expect(c.ratio as number, `día ${k}`).toBeGreaterThan(0.9);
      expect(c.ratio as number, `día ${k}`).toBeLessThan(1.12);
    }
  });

  it("subir la carga de golpe la última semana sale por encima de lo habitual", () => {
    const base = habitual(INICIO, 6);
    const pico = habitual(dia(INICIO, 6 * 7), 1, 9, 100); // la última semana, mucho más duro y largo
    const c = calcularCargaAC([...base, ...pico], dia(INICIO, 7 * 7 - 1));
    expect(c.ratio as number).toBeGreaterThan(1.3);
    expect(["alta", "muy_alta"]).toContain(c.zona);
  });

  it("dos semanas sin entrenar la dejan por debajo de lo habitual", () => {
    const c = calcularCargaAC(habitual(INICIO, 6), dia(INICIO, 8 * 7 - 1));
    expect(c.ratio as number).toBeLessThan(0.8);
    expect(c.zona).toBe("baja");
  });

  it("con pocos datos no es fiable, y sin esfuerzo o duración no cuenta ninguna sesión", () => {
    const poco = calcularCargaAC(habitual(INICIO, 1), dia(INICIO, 6));
    expect(poco.fiable).toBe(false);
    const sin = calcularCargaAC([sesion("2026-10-01", null, 60), sesion("2026-10-03", 7, null)], "2026-10-10");
    expect(sin).toMatchObject({ ratio: null, zona: null, sesiones: 0, fiable: false });
    expect(calcularCargaAC([], "2026-10-10").ratio).toBeNull();
  });

  it("las sesiones no completadas o futuras no cuentan", () => {
    const s = [{ ...sesion("2026-10-01"), completado: false }, sesion("2026-10-20")];
    expect(calcularCargaAC(s, "2026-10-10").sesiones).toBe(0);
  });

  it("las zonas: <0,8 baja · 0,8-1,3 óptima · 1,3-1,5 alta · >1,5 muy alta", () => {
    expect([0.5, 0.79].map(zonaDeCarga)).toEqual(["baja", "baja"]);
    expect([0.8, 1, 1.3].map(zonaDeCarga)).toEqual(["optima", "optima", "optima"]);
    expect([1.31, 1.5].map(zonaDeCarga)).toEqual(["alta", "alta"]);
    expect([1.51, 2].map(zonaDeCarga)).toEqual(["muy_alta", "muy_alta"]);
  });
});

/* ------------------------------ Molestias y fechas ------------------------------ */

describe("discomfortSemaforo: 0-3 verde · 4-6 amarillo · 7-10 rojo", () => {
  it("fronteras", () => {
    expect([0, 3].map(discomfortSemaforo)).toEqual(["verde", "verde"]);
    expect([4, 6].map(discomfortSemaforo)).toEqual(["amarillo", "amarillo"]);
    expect([7, 10].map(discomfortSemaforo)).toEqual(["rojo", "rojo"]);
  });
});

describe("toLocalISODate", () => {
  it("formatea con ceros y en hora local", () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toLocalISODate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});
