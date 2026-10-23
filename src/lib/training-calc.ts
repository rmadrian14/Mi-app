// Cálculos puros de Entrenamiento (sin React ni acceso a datos): estimación de
// 1RM, volumen semanal por músculo, alerta de descarga, sugerencia de progresión
// de carga y semáforo de molestias. Vivían dentro de los hooks de
// src/hooks/use-training.ts; se han movido aquí sin cambiar su lógica para poder
// probarlos, y el hook los vuelve a exportar con los mismos nombres.

export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type SetPrecision = "alta" | "aprox" | "no_estimable";

// Estimación de 1RM por serie:
//  - 1 rep: exacto (el peso levantado ES el 1RM).
//  - 2-10 reps: media de Epley y Brzycki — el rango donde ambas fórmulas
//    están validadas con buena precisión (~2-10% de error).
//  - 11-15 reps: fórmula de Mayhew et al. (1992), un modelo exponencial que
//    la evidencia señala como más adecuado que Epley/Brzycki en este tramo
//    (que ya pierden fiabilidad a partir de 10 reps).
//  - Más de 15 reps: no se estima. La evidencia es clara en que ninguna
//    fórmula es fiable ahí (demasiado peso de la resistencia muscular) —
//    mostrar un número igualmente daría una falsa sensación de precisión.
export function estimate1RM(peso: number, reps: number): { value: number | null; precision: SetPrecision } {
  if (!peso || peso <= 0 || !reps || reps <= 0) return { value: null, precision: "no_estimable" };
  if (reps === 1) return { value: peso, precision: "alta" };
  if (reps <= 10) {
    const epley = peso * (1 + reps / 30);
    const brzycki = peso * 36 / (37 - reps);
    return { value: (epley + brzycki) / 2, precision: "alta" };
  }
  if (reps <= 15) {
    const mayhew = (100 * peso) / (52.2 + 41.9 * Math.exp(-0.055 * reps));
    return { value: mayhew, precision: "aprox" };
  }
  return { value: null, precision: "no_estimable" };
}

export type MuscleLandmark = { mev: number; mavLow: number; mavHigh: number; mrv: number };

// Puntos de referencia semanales (series por músculo) de la literatura de
// volumen de entrenamiento (Israetel/RP y trabajos relacionados sobre
// MEV/MAV/MRV). Son orientativos y generales, no individualizados: no tienen
// en cuenta experiencia de entrenamiento, recuperación individual, ni
// proximidad al fallo por serie.
export const MUSCLE_LANDMARKS: Record<string, MuscleLandmark> = {
  Pecho: { mev: 6, mavLow: 12, mavHigh: 20, mrv: 25 },
  Espalda: { mev: 8, mavLow: 14, mavHigh: 22, mrv: 25 },
  Hombros: { mev: 6, mavLow: 14, mavHigh: 22, mrv: 26 },
  Bíceps: { mev: 5, mavLow: 10, mavHigh: 18, mrv: 20 },
  Tríceps: { mev: 5, mavLow: 10, mavHigh: 18, mrv: 20 },
  Cuádriceps: { mev: 8, mavLow: 12, mavHigh: 18, mrv: 20 },
  Isquiosurales: { mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 },
  Glúteos: { mev: 4, mavLow: 10, mavHigh: 16, mrv: 16 },
  Gemelos: { mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 },
};

// Orden fijo de las barras en la gráfica de volumen semanal.
export const MUSCLE_ORDER: string[] = Object.keys(MUSCLE_LANDMARKS);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// grupo_muscular es texto libre (no hay integración con ExerciseDB ni un
// enum controlado), así que variantes triviales (singular/plural, con o sin
// acento) deben reconocerse como el mismo músculo. Lo que no aparece aquí no
// tiene landmark y se excluye del cálculo de volumen, en vez de inventarle un
// MEV/MAV/MRV.
const MUSCLE_ALIASES: Record<string, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  hombro: "Hombros",
  hombros: "Hombros",
  gemelo: "Gemelos",
  gemelos: "Gemelos",
  biceps: "Bíceps",
  triceps: "Tríceps",
  cuadriceps: "Cuádriceps",
  isquiosurales: "Isquiosurales",
  isquiotibiales: "Isquiosurales",
  femoral: "Isquiosurales",
  gluteo: "Glúteos",
  gluteos: "Glúteos",
};

export function normalizeMuscleGroup(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = stripAccents(raw.trim().toLowerCase());
  return MUSCLE_ALIASES[key] ?? null;
}

export function muscleVolumeZone(
  muscle: string,
  volumen: number,
): "insuficiente" | "bajo" | "optimo" | "alto" | "excesivo" {
  const lm = MUSCLE_LANDMARKS[muscle];
  if (!lm) return "optimo";
  if (volumen < lm.mev) return "insuficiente";
  if (volumen < lm.mavLow) return "bajo";
  if (volumen <= lm.mavHigh) return "optimo";
  if (volumen <= lm.mrv) return "alto";
  return "excesivo";
}

function mondayOf(d: Date): Date {
  const dow = (d.getDay() + 6) % 7; // 0=lunes ... 6=domingo
  const s = new Date(d);
  s.setDate(d.getDate() - dow);
  return s;
}

export type MuscleExerciseInfo = { principal: string; secundarios: string[] };
export type MuscleSetRow = { fecha: string; exercise_id: string };

// Volumen semanal (lunes-domingo) por grupo muscular con conteo fraccional:
// cada serie completada suma 1.0 al músculo principal del ejercicio y 0.5 a
// cada músculo secundario. weekStart (ISO, lunes) -> músculo canónico -> series.
export function calcularVolumenSemanal(
  rows: MuscleSetRow[],
  exerciseMuscles: Record<string, MuscleExerciseInfo>,
): Map<string, Record<string, number>> {
  const weeks = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const info = exerciseMuscles[r.exercise_id];
    if (!info) continue;
    const key = toLocalISODate(mondayOf(new Date(`${r.fecha}T00:00:00`)));
    const bucket = weeks.get(key) ?? {};

    const principal = normalizeMuscleGroup(info.principal);
    if (principal) bucket[principal] = (bucket[principal] ?? 0) + 1;

    for (const sec of info.secundarios) {
      const secNorm = normalizeMuscleGroup(sec);
      if (secNorm && secNorm !== principal) bucket[secNorm] = (bucket[secNorm] ?? 0) + 0.5;
    }

    weeks.set(key, bucket);
  }
  return weeks;
}

/* ------------------------------ Alerta de descarga (deload) ------------------------------ */

export type DeloadSignalId = "e1rm_drop" | "stagnation" | "mrv_volume" | "load_trend";

export type DeloadSignal = {
  id: DeloadSignalId;
  label: string;
  active: boolean;
  detail: string;
};

export type DeloadSessionRow = {
  id: string;
  fecha: string;
  routine_day_id: string | null;
  es_extra: boolean;
  completado: boolean;
  esfuerzo_percibido: number | null;
  duracion_min: number | null;
};
export type DeloadSetRow = {
  session_id: string;
  exercise_id: string;
  reps_realizadas: number | null;
  peso_realizado_kg: number | null;
};
export type DeloadExerciseRow = {
  id: string;
  nombre: string;
  grupo_muscular: string;
  musculos_secundarios: string[];
};

const DELOAD_SIGNAL_LABELS: Record<DeloadSignalId, string> = {
  e1rm_drop: "Caída de rendimiento",
  stagnation: "Estancamiento por día de rutina",
  mrv_volume: "Volumen sobre el máximo recuperable",
  load_trend: "Carga de sesión al alza",
};

// Evalúa 4 señales de fatiga acumulada sobre datos ya existentes: caída de e1RM
// con esfuerzo igual o mayor, estancamiento del mismo día de rutina 2 semanas
// seguidas, algún músculo en/sobre su MRV 2 semanas seguidas, y carga de sesión
// al alza sin mejora de rendimiento en paralelo. Con 2 o más señales activas a
// la vez se recomienda una semana de descarga.
export function evaluarDescarga(
  sessions: DeloadSessionRow[],
  sets: DeloadSetRow[],
  exercises: Record<string, DeloadExerciseRow>,
): { shouldDeload: boolean; activeCount: number; signals: DeloadSignal[] } {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  // Mejor e1RM por ejercicio y por sesión (solo series estimables), y la
  // misma lista ordenada cronológicamente por ejercicio: sirve tanto para
  // la señal 1 (caída) como para detectar PRs en la señal 4.
  const bestPerExercisePerSession = new Map<string, Map<string, number>>();
  for (const set of sets) {
    if (set.reps_realizadas == null || set.peso_realizado_kg == null) continue;
    const { value } = estimate1RM(set.peso_realizado_kg, set.reps_realizadas);
    if (value == null) continue;
    if (!sessionById.has(set.session_id)) continue;
    if (!bestPerExercisePerSession.has(set.exercise_id)) bestPerExercisePerSession.set(set.exercise_id, new Map());
    const perSession = bestPerExercisePerSession.get(set.exercise_id)!;
    const prevBest = perSession.get(set.session_id);
    if (prevBest == null || value > prevBest) perSession.set(set.session_id, value);
  }

  type SessionE1RM = { sessionId: string; fecha: string; e1rm: number };
  const byExercise = new Map<string, SessionE1RM[]>();
  for (const [exerciseId, perSession] of bestPerExercisePerSession) {
    const list: SessionE1RM[] = [];
    for (const [sessionId, e1rm] of perSession) {
      const session = sessionById.get(sessionId);
      if (!session) continue;
      list.push({ sessionId, fecha: session.fecha, e1rm });
    }
    list.sort((a, b) => a.fecha.localeCompare(b.fecha));
    byExercise.set(exerciseId, list);
  }

  // Señal 1: caída de e1RM ≥5% en la última sesión de un ejercicio frente
  // a la anterior, con esfuerzo percibido igual o mayor en la más reciente.
  let signal1Active = false;
  let signal1Detail = "Sin caídas de rendimiento recientes.";
  for (const [exerciseId, list] of byExercise) {
    if (list.length < 2) continue;
    const curr = list[list.length - 1];
    const prev = list[list.length - 2];
    const currRpe = sessionById.get(curr.sessionId)?.esfuerzo_percibido ?? null;
    const prevRpe = sessionById.get(prev.sessionId)?.esfuerzo_percibido ?? null;
    if (currRpe == null || prevRpe == null || currRpe < prevRpe) continue;
    const drop = (prev.e1rm - curr.e1rm) / prev.e1rm;
    if (drop >= 0.05) {
      signal1Active = true;
      const nombre = exercises[exerciseId]?.nombre ?? "un ejercicio";
      signal1Detail = `${nombre}: -${Math.round(drop * 100)}% de e1RM respecto a la sesión anterior, con esfuerzo percibido igual o mayor.`;
      break;
    }
  }

  // Señal 2: e1RM medio de un mismo día de rutina sin mejorar durante 2
  // semanas consecutivas (necesita al menos 3 apariciones de ese día).
  const byRoutineDay = new Map<string, { fecha: string; avgE1rm: number }[]>();
  for (const session of sessions) {
    if (session.es_extra || !session.routine_day_id) continue;
    const values: number[] = [];
    for (const perSession of bestPerExercisePerSession.values()) {
      const best = perSession.get(session.id);
      if (best != null) values.push(best);
    }
    if (values.length === 0) continue;
    const avgE1rm = values.reduce((a, b) => a + b, 0) / values.length;
    if (!byRoutineDay.has(session.routine_day_id)) byRoutineDay.set(session.routine_day_id, []);
    byRoutineDay.get(session.routine_day_id)!.push({ fecha: session.fecha, avgE1rm });
  }

  let signal2Active = false;
  let signal2Detail = "Rendimiento estable o en mejora en todos los días de rutina.";
  for (const occurrences of byRoutineDay.values()) {
    occurrences.sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (occurrences.length < 3) continue;
    const last3 = occurrences.slice(-3);
    const delta1 = last3[1].avgE1rm - last3[0].avgE1rm;
    const delta2 = last3[2].avgE1rm - last3[1].avgE1rm;
    if (delta1 <= 0 && delta2 <= 0) {
      signal2Active = true;
      signal2Detail = `Rendimiento medio estancado o en descenso 2 semanas seguidas en el mismo día de rutina (última sesión: ${last3[2].fecha}).`;
      break;
    }
  }

  // Señal 3: algún músculo en o por encima de su MRV en las 2 semanas más
  // recientes (misma cuenta fraccional que la Entrega F).
  const weeklyVolume = new Map<string, Record<string, number>>();
  for (const set of sets) {
    const session = sessionById.get(set.session_id);
    const exercise = exercises[set.exercise_id];
    if (!session || !exercise) continue;
    const weekKey = toLocalISODate(mondayOf(new Date(`${session.fecha}T00:00:00`)));
    const bucket = weeklyVolume.get(weekKey) ?? {};
    const principal = normalizeMuscleGroup(exercise.grupo_muscular);
    if (principal) bucket[principal] = (bucket[principal] ?? 0) + 1;
    for (const sec of exercise.musculos_secundarios ?? []) {
      const secNorm = normalizeMuscleGroup(sec);
      if (secNorm && secNorm !== principal) bucket[secNorm] = (bucket[secNorm] ?? 0) + 0.5;
    }
    weeklyVolume.set(weekKey, bucket);
  }
  const weekKeysSorted = Array.from(weeklyVolume.keys()).sort();

  let signal3Active = false;
  let signal3Detail = "Ningún músculo por encima de su volumen máximo recuperable.";
  if (weekKeysSorted.length >= 2) {
    const lastTwoWeeks = weekKeysSorted.slice(-2);
    for (const muscle of Object.keys(MUSCLE_LANDMARKS)) {
      const mrv = MUSCLE_LANDMARKS[muscle].mrv;
      const values = lastTwoWeeks.map((wk) => weeklyVolume.get(wk)?.[muscle] ?? 0);
      if (values.every((v) => v >= mrv)) {
        signal3Active = true;
        signal3Detail = `${muscle}: ${values.map((v) => v.toFixed(1)).join(" y ")} series en las últimas 2 semanas, por encima de su MRV (${mrv}).`;
        break;
      }
    }
  }

  // Señal 4: carga de sesión (esfuerzo × duración) sin bajar en ningún
  // tramo de las últimas sesiones, con subida neta, y sin ningún récord de
  // e1RM nuevo en ese mismo rango de fechas.
  const loadSessions = sessions
    .filter((s) => s.completado && s.esfuerzo_percibido != null && s.duracion_min != null)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(-4)
    .map((s) => ({ fecha: s.fecha, carga: (s.esfuerzo_percibido as number) * (s.duracion_min as number) }));

  let signal4Active = false;
  let signal4Detail = "Sin tendencia sostenida de carga de sesión al alza.";
  if (loadSessions.length >= 3) {
    const nonDecreasing = loadSessions.every((s, i) => i === 0 || s.carga >= loadSessions[i - 1].carga);
    const netIncrease = loadSessions[loadSessions.length - 1].carga > loadSessions[0].carga;
    if (nonDecreasing && netIncrease) {
      const rangeStart = loadSessions[0].fecha;
      const rangeEnd = loadSessions[loadSessions.length - 1].fecha;
      let anyPR = false;
      for (const list of byExercise.values()) {
        let runningMax = -Infinity;
        for (const point of list) {
          const isNewPR = point.e1rm > runningMax;
          if (isNewPR) runningMax = point.e1rm;
          if (isNewPR && point.fecha >= rangeStart && point.fecha <= rangeEnd) {
            anyPR = true;
            break;
          }
        }
        if (anyPR) break;
      }
      if (!anyPR) {
        signal4Active = true;
        signal4Detail = `Carga de sesión en aumento sostenido entre ${rangeStart} y ${rangeEnd}, sin ningún récord de fuerza nuevo en ese periodo.`;
      }
    }
  }

  const signals: DeloadSignal[] = [
    { id: "e1rm_drop", label: DELOAD_SIGNAL_LABELS.e1rm_drop, active: signal1Active, detail: signal1Detail },
    { id: "stagnation", label: DELOAD_SIGNAL_LABELS.stagnation, active: signal2Active, detail: signal2Detail },
    { id: "mrv_volume", label: DELOAD_SIGNAL_LABELS.mrv_volume, active: signal3Active, detail: signal3Detail },
    { id: "load_trend", label: DELOAD_SIGNAL_LABELS.load_trend, active: signal4Active, detail: signal4Detail },
  ];
  const activeCount = signals.filter((s) => s.active).length;

  return { shouldDeload: activeCount >= 2, activeCount, signals };
}

/* ------------------------------ Sugerencia de progresión de carga ------------------------------ */

// Redondea al múltiplo de `step` más cercano (las mancuernas del usuario
// ajustan en incrementos de 2 kg).
export function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

// "12-15" -> {min:12,max:15}. "10 por pierna" -> {min:10,max:10} (un solo
// número = objetivo fijo). Se descarta todo lo que va entre paréntesis antes
// de buscar números, para no confundir aclaraciones como "(rango parcial
// 30-40°, muy ligero)" con el rango de reps objetivo.
export function parseRepRangeObjetivo(text: string): { min: number; max: number } | null {
  const core = text.split("(")[0];
  const found = core.match(/\d+(\.\d+)?/g);
  if (!found || found.length === 0) return null;
  const nums = found.map(Number);
  return nums.length === 1 ? { min: nums[0], max: nums[0] } : { min: nums[0], max: nums[1] };
}

export type ProgressionSuggestion =
  | { kind: "sube_fallo_reps"; currentWeightKg: number; suggestedWeightKg: number; lastReps: number }
  | {
      kind: "sube_fallo_e1rm";
      currentWeightKg: number;
      suggestedWeightKg: number;
      changePct: number;
      previousFecha: string;
    }
  | { kind: "mantener_fallo"; currentWeightKg: number; previousFecha: string }
  | { kind: "sube_rango"; currentWeightKg: number; suggestedWeightKg: number; repMax: number }
  | { kind: "baja_rango"; currentWeightKg: number; suggestedWeightKg: number; repMin: number; lastReps: number[] }
  | {
      kind: "mantener_rango";
      currentWeightKg: number;
      lastReps: number[];
      repMax: number;
      repMin: number;
      bajoMinimo: boolean; // la mayoría de las series se quedó por debajo del mínimo del rango
    };

export type ProgSessionRow = { id: string; fecha: string; esfuerzo_percibido: number | null };
export type ProgSetRow = {
  session_id: string;
  exercise_id: string;
  reps_realizadas: number | null;
  peso_realizado_kg: number | null;
};
export type ProgOccurrence = {
  sessionId: string;
  fecha: string;
  esfuerzoPercibido: number | null;
  sets: { reps: number; peso: number | null }[];
};

// Agrupa las series por ejercicio y sesión: ejercicio -> apariciones ordenadas por fecha.
export function construirHistorial(
  sessions: ProgSessionRow[],
  sets: ProgSetRow[],
): Map<string, ProgOccurrence[]> {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const bySessionExercise = new Map<string, { reps: number; peso: number | null }[]>();
  for (const s of sets) {
    if (s.reps_realizadas == null || !sessionById.has(s.session_id)) continue;
    const key = `${s.exercise_id}|${s.session_id}`;
    if (!bySessionExercise.has(key)) bySessionExercise.set(key, []);
    bySessionExercise.get(key)!.push({ reps: s.reps_realizadas, peso: s.peso_realizado_kg });
  }

  const map = new Map<string, ProgOccurrence[]>();
  for (const [key, list] of bySessionExercise) {
    const [exerciseId, sessionId] = key.split("|");
    const session = sessionById.get(sessionId)!;
    if (!map.has(exerciseId)) map.set(exerciseId, []);
    map
      .get(exerciseId)!
      .push({ sessionId, fecha: session.fecha, esfuerzoPercibido: session.esfuerzo_percibido, sets: list });
  }
  for (const list of map.values()) list.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return map;
}

// Peso con el que se hizo la mayor parte de las series (si empatan, el mayor): las series más ligeras
// (calentamiento, o una serie de bajada) no deciden si toca subir.
export function pesoDeTrabajo(sets: { reps: number; peso: number | null }[]): number | null {
  const cuenta = new Map<number, number>();
  for (const s of sets) if (s.peso != null && s.peso > 0) cuenta.set(s.peso, (cuenta.get(s.peso) ?? 0) + 1);
  let mejor: number | null = null;
  for (const [peso, n] of cuenta) {
    if (mejor == null || n > (cuenta.get(mejor) ?? 0) || (n === cuenta.get(mejor) && peso > mejor)) mejor = peso;
  }
  return mejor;
}

// Sugerencia de peso para la próxima vez que se haga un ejercicio, a partir de
// las dos últimas sesiones en las que se registró. Dos ramas según cómo esté
// redactado el objetivo de reps de ese ejercicio en su día de rutina:
//  - "al fallo" / "casi al fallo": se autorregula sobre el e1RM de la mejor
//    serie estimable (sube si el e1RM mejora ≥ 2,5 % con esfuerzo igual o
//    mayor; con 15+ reps en alguna serie sube directamente, porque por encima
//    de 15 el e1RM deja de ser fiable).
//  - rango de reps fijo: progresión doble clásica; sube peso solo si TODAS las
//    series de la última sesión llegaron al tope del rango.
// Todo peso sugerido se redondea al múltiplo de 2 kg más cercano.
export function sugerirProgresion(
  historyByExercise: Map<string, ProgOccurrence[]>,
  exerciseId: string,
  repsObjetivo: string,
): ProgressionSuggestion | null {
  const history = historyByExercise.get(exerciseId);
  if (!history || history.length < 1) return null;
  const curr = history[history.length - 1];
  const prev = history.length >= 2 ? history[history.length - 2] : null;

  if (/fallo/i.test(repsObjetivo)) {
    if (!prev) return null; // sin una sesión anterior con la que comparar el e1RM
    const bestOf = (occ: ProgOccurrence) => {
      let best: { e1rm: number; peso: number } | null = null;
      for (const s of occ.sets) {
        if (s.peso == null) continue;
        const { value } = estimate1RM(s.peso, s.reps);
        if (value != null && (best == null || value > best.e1rm)) best = { e1rm: value, peso: s.peso };
      }
      return best;
    };
    const currBest = bestOf(curr);
    const prevBest = bestOf(prev);
    const currentWeightKg = currBest?.peso ?? curr.sets.find((s) => s.peso != null)?.peso ?? null;
    if (currentWeightKg == null) return null;

    const maxReps = Math.max(...curr.sets.map((s) => s.reps));
    if (maxReps >= 15) {
      return {
        kind: "sube_fallo_reps",
        currentWeightKg,
        suggestedWeightKg: Math.max(roundToStep(currentWeightKg * 1.05, 2), currentWeightKg + 2),
        lastReps: maxReps,
      };
    }

    if (currBest && prevBest) {
      const currRpe = curr.esfuerzoPercibido;
      const prevRpe = prev.esfuerzoPercibido;
      const rpeOk = currRpe != null && prevRpe != null && currRpe >= prevRpe;
      const changePct = (currBest.e1rm - prevBest.e1rm) / prevBest.e1rm;
      if (rpeOk && changePct >= 0.025) {
        return {
          kind: "sube_fallo_e1rm",
          currentWeightKg,
          suggestedWeightKg: Math.max(
            roundToStep(currentWeightKg * (1 + changePct), 2),
            currentWeightKg + 2,
          ),
          changePct,
          previousFecha: prev.fecha,
        };
      }
    }

    return { kind: "mantener_fallo", currentWeightKg, previousFecha: prev.fecha };
  }

  const range = parseRepRangeObjetivo(repsObjetivo);
  if (!range) return null;
  const currentWeightKg = pesoDeTrabajo(curr.sets);
  if (currentWeightKg == null) return null;

  const deTrabajo = curr.sets.filter((s) => s.peso === currentWeightKg);
  const reps = deTrabajo.map((s) => s.reps);
  const allAtTop = reps.every((r) => r >= range.max);
  if (allAtTop) {
    return {
      kind: "sube_rango",
      currentWeightKg,
      suggestedWeightKg: Math.max(roundToStep(currentWeightKg * 1.05, 2), currentWeightKg + 2),
      repMax: range.max,
    };
  }

  // Por debajo del mínimo del rango en la mayoría de las series: una sesión mala puede ser cansancio, pero
  // dos seguidas con ese peso (o más) dicen que el peso es demasiado alto: se baja un 10 %.
  const bajoMinimo = reps.filter((r) => r < range.min).length > reps.length / 2;
  if (bajoMinimo && prev) {
    const pesoPrev = pesoDeTrabajo(prev.sets);
    const repsPrev = pesoPrev == null ? [] : prev.sets.filter((s) => s.peso === pesoPrev).map((s) => s.reps);
    const prevBajo = repsPrev.length > 0 && repsPrev.filter((r) => r < range.min).length > repsPrev.length / 2;
    if (prevBajo && pesoPrev != null && pesoPrev >= currentWeightKg) {
      return {
        kind: "baja_rango",
        currentWeightKg,
        suggestedWeightKg: Math.max(2, Math.min(currentWeightKg - 2, roundToStep(currentWeightKg * 0.9, 2))),
        repMin: range.min,
        lastReps: reps,
      };
    }
  }
  return {
    kind: "mantener_rango",
    currentWeightKg,
    lastReps: reps,
    repMax: range.max,
    repMin: range.min,
    bajoMinimo,
  };
}

/* ------------------------------ Carga reciente frente a la habitual (aguda:crónica) ------------------------------ */

export type ZonaCarga = "baja" | "optima" | "alta" | "muy_alta";

export type CargaAC = {
  aguda: number; // carga diaria media de los últimos 7 días
  cronica: number; // carga diaria media de los últimos 28 días (lo habitual)
  ratio: number | null;
  zona: ZonaCarga | null;
  fiable: boolean;
  sesiones: number;
  dias: number; // días desde la primera sesión con carga
};

const VENTANA_AGUDA = 7;
const VENTANA_CRONICA = 28;
export const MIN_DIAS_CARGA = 28;
export const MIN_SESIONES_CARGA = 8;

export function zonaDeCarga(ratio: number): ZonaCarga {
  if (ratio < 0.8) return "baja";
  if (ratio <= 1.3) return "optima";
  if (ratio <= 1.5) return "alta";
  return "muy_alta";
}

const diaNum = (fecha: string) => Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)) / 86_400_000;

// Carga de cada sesión = esfuerzo percibido (1-10) × minutos (la «sRPE» de Foster). Se compara la carga diaria
// media de los últimos 7 días (aguda) con la de los últimos 28 (crónica). Se usan medias móviles simples y no
// exponenciales porque se entrena unos 3 días a la semana: con las exponenciales el resultado cambia según el día
// de la semana en que lo mires (sale «baja» un domingo aunque entrenes siempre igual). Es una referencia
// orientativa: sirve para ver si has subido la carga de golpe o si llevas días sin entrenar; no predice lesiones.
export function calcularCargaAC(sessions: DeloadSessionRow[], hoy: string): CargaAC {
  const porDia = new Map<number, number>();
  let n = 0;
  for (const s of sessions) {
    if (!s.completado || s.esfuerzo_percibido == null || s.duracion_min == null || s.fecha > hoy) continue;
    const d = diaNum(s.fecha);
    porDia.set(d, (porDia.get(d) ?? 0) + s.esfuerzo_percibido * s.duracion_min);
    n++;
  }
  if (n === 0) return { aguda: 0, cronica: 0, ratio: null, zona: null, fiable: false, sesiones: 0, dias: 0 };
  const inicio = Math.min(...porDia.keys());
  const fin = diaNum(hoy);
  const dias = Math.max(0, fin - inicio) + 1;
  const media = (ventana: number) => {
    const largo = Math.min(ventana, dias);
    let suma = 0;
    for (let d = fin - largo + 1; d <= fin; d++) suma += porDia.get(d) ?? 0;
    return suma / largo;
  };
  const aguda = media(VENTANA_AGUDA);
  const cronica = media(VENTANA_CRONICA);
  const ratio = cronica > 0 ? aguda / cronica : null;
  return {
    aguda: Math.round(aguda),
    cronica: Math.round(cronica),
    ratio: ratio == null ? null : Math.round(ratio * 100) / 100,
    zona: ratio == null ? null : zonaDeCarga(ratio),
    fiable: dias >= MIN_DIAS_CARGA && n >= MIN_SESIONES_CARGA,
    sesiones: n,
    dias,
  };
}

/* ------------------------------ Molestias (Sistema de Semáforo) ------------------------------ */

export type DiscomfortSemaforo = "verde" | "amarillo" | "rojo";

// Sistema de Semáforo de dolor: 0-3 verde, 4-6 amarillo, 7-10 rojo.
export function discomfortSemaforo(intensidad: number): DiscomfortSemaforo {
  if (intensidad >= 7) return "rojo";
  if (intensidad >= 4) return "amarillo";
  return "verde";
}
