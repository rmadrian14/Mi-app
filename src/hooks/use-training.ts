import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { seedDefaultRoutine } from "@/lib/training-seed";

export type PersonalProfile = {
  id: string;
  user_id: string;
  edad: number | null;
  peso_kg: number | null;
  altura_cm: number | null;
  objetivo: string | null;
  limitaciones: string | null;
  updated_at: string;
  created_at: string;
};

export type PersonalProfileInput = {
  edad: number | null;
  peso_kg: number | null;
  altura_cm: number | null;
  objetivo: string | null;
  limitaciones: string | null;
};

export function usePersonalProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("personal_profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error) setProfile((data as PersonalProfile) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Crea el perfil y siembra la rutina inicial en un único paso. Solo debe
  // llamarse cuando todavía no existe personal_profile para este usuario.
  const createProfileAndSeedRoutine = useCallback(
    async (input: PersonalProfileInput) => {
      if (!user) throw new Error("No hay sesión activa.");
      const { data, error } = await supabase
        .from("personal_profile")
        .insert({ user_id: user.id, ...input })
        .select("*")
        .single();
      if (error) throw error;
      await seedDefaultRoutine(user.id);
      const row = data as PersonalProfile;
      setProfile(row);
      return row;
    },
    [user],
  );

  return { profile, loading, createProfileAndSeedRoutine, refresh };
}

export type ExerciseRow = {
  id: string;
  nombre: string;
  grupo_muscular: string;
  musculos_secundarios: string[];
  tipo: "fuerza" | "movilidad" | "cardio";
  notas: string | null;
};

export type RoutineExerciseItem = {
  id: string;
  exercise_id: string;
  nombre: string;
  grupo_muscular: string;
  orden: number;
  series_objetivo: string;
  reps_objetivo: string;
  peso_objetivo_kg: number | null;
};

export type RoutineHabit = {
  id: string;
  tipo: "movilidad" | "caminata";
  duracion_min_objetivo: number | null;
};

export type RoutineDayWithDetails = {
  id: string;
  dia_semana: number;
  nombre_dia: string;
  es_dia_entreno: boolean;
  ejercicios: RoutineExerciseItem[];
  habitos: RoutineHabit[];
};

export function useRoutine() {
  const { user } = useAuth();
  const [days, setDays] = useState<RoutineDayWithDetails[]>([]);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setDays([]);
      setExercises([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [daysRes, routineExRes, habitsRes, exercisesRes] = await Promise.all([
      supabase
        .from("routine_days")
        .select("id, dia_semana, nombre_dia, es_dia_entreno")
        .order("dia_semana"),
      supabase
        .from("routine_exercises")
        .select("id, routine_day_id, exercise_id, orden, series_objetivo, reps_objetivo, peso_objetivo_kg, exercise:exercise_id ( nombre, grupo_muscular )")
        .order("orden"),
      supabase
        .from("routine_daily_habits")
        .select("id, routine_day_id, tipo, duracion_min_objetivo"),
      supabase
        .from("exercises")
        .select("id, nombre, grupo_muscular, musculos_secundarios, tipo, notas")
        .order("nombre"),
    ]);

    const routineExData = (routineExRes.data ?? []) as any[];
    const habitsData = (habitsRes.data ?? []) as any[];
    const merged: RoutineDayWithDetails[] = ((daysRes.data ?? []) as any[]).map((d) => ({
      id: d.id,
      dia_semana: d.dia_semana,
      nombre_dia: d.nombre_dia,
      es_dia_entreno: d.es_dia_entreno,
      ejercicios: routineExData
        .filter((r) => r.routine_day_id === d.id)
        .map((r) => ({
          id: r.id,
          exercise_id: r.exercise_id,
          orden: r.orden,
          series_objetivo: r.series_objetivo,
          reps_objetivo: r.reps_objetivo,
          peso_objetivo_kg: r.peso_objetivo_kg,
          nombre: r.exercise?.nombre ?? "Ejercicio eliminado",
          grupo_muscular: r.exercise?.grupo_muscular ?? "",
        })),
      habitos: habitsData
        .filter((h) => h.routine_day_id === d.id)
        .map((h) => ({ id: h.id, tipo: h.tipo, duracion_min_objetivo: h.duracion_min_objetivo })),
    }));

    setDays(merged);
    setExercises((exercisesRes.data ?? []) as ExerciseRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addExerciseToDay = useCallback(
    async (
      routineDayId: string,
      exerciseId: string,
      opts: { series_objetivo: string; reps_objetivo: string; peso_objetivo_kg?: number | null },
    ) => {
      if (!user) throw new Error("No hay sesión activa.");
      const day = days.find((d) => d.id === routineDayId);
      const orden = (day?.ejercicios.length ?? 0) + 1;
      const { error } = await supabase.from("routine_exercises").insert({
        user_id: user.id,
        routine_day_id: routineDayId,
        exercise_id: exerciseId,
        orden,
        series_objetivo: opts.series_objetivo,
        reps_objetivo: opts.reps_objetivo,
        peso_objetivo_kg: opts.peso_objetivo_kg ?? null,
      });
      if (error) throw error;
      await refresh();
    },
    [user, days, refresh],
  );

  const removeExerciseFromDay = useCallback(
    async (routineExerciseId: string) => {
      const { error } = await supabase.from("routine_exercises").delete().eq("id", routineExerciseId);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const updateRoutineExercise = useCallback(
    async (
      id: string,
      patch: Partial<{ series_objetivo: string; reps_objetivo: string; peso_objetivo_kg: number | null }>,
    ) => {
      const { error } = await supabase.from("routine_exercises").update(patch).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const createExercise = useCallback(
    async (input: {
      nombre: string;
      grupo_muscular: string;
      tipo: "fuerza" | "movilidad" | "cardio";
      notas?: string | null;
      musculos_secundarios?: string[];
    }) => {
      if (!user) throw new Error("No hay sesión activa.");
      const { data, error } = await supabase
        .from("exercises")
        .insert({
          user_id: user.id,
          ...input,
          notas: input.notas ?? null,
          musculos_secundarios: input.musculos_secundarios ?? [],
        })
        .select("id, nombre, grupo_muscular, musculos_secundarios, tipo, notas")
        .single();
      if (error) throw error;
      await refresh();
      return data as ExerciseRow;
    },
    [user, refresh],
  );

  const updateExercise = useCallback(
    async (id: string, patch: Partial<{ grupo_muscular: string; musculos_secundarios: string[] }>) => {
      const { error } = await supabase.from("exercises").update(patch).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return {
    days,
    exercises,
    loading,
    refresh,
    addExerciseToDay,
    removeExerciseFromDay,
    updateRoutineExercise,
    createExercise,
    updateExercise,
  };
}

/* ------------------------------ Registro diario ------------------------------ */

export type SessionSetDraft = {
  id?: string | null;
  numero_serie: number;
  reps_realizadas: number | null;
  peso_realizado_kg: number | null;
};

export type HabitLog = {
  tipo: "movilidad" | "caminata";
  completado: boolean;
  duracion_min: number | null;
};

export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayISODate(): string {
  return toLocalISODate(new Date());
}

// Sesión de hoy (si la hay) para el día de rutina indicado, sus series ya
// guardadas, y los hábitos diarios de hoy. `routineDayId` es null en días de
// descanso (no hay sesión planificada que buscar).
//
// Cada serie se guarda en su propia fila EN CUANTO se registra (saveSet), en
// vez de acumular todo en estado local y volcarlo de golpe al final: así una
// recarga, una navegación a otra pantalla o varias pulsaciones del botón de
// completar nunca pueden perder series ya registradas.
export function useTodayEntry(routineDayId: string | null) {
  const { user } = useAuth();
  const fecha = todayISODate();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [completado, setCompletado] = useState(false);
  const [esfuerzoPercibido, setEsfuerzoPercibido] = useState<number | null>(null);
  const [duracionMin, setDuracionMin] = useState<number | null>(null);
  const [setsByExercise, setSetsByExercise] = useState<Record<string, SessionSetDraft[]>>({});
  const [habits, setHabits] = useState<Partial<Record<"movilidad" | "caminata", HabitLog>>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSessionId(null);
      setCompletado(false);
      setEsfuerzoPercibido(null);
      setDuracionMin(null);
      setSetsByExercise({});
      setHabits({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const [sessionRes, habitsRes] = await Promise.all([
      // Cualquier sesión de hoy sirve (planificada o extra): si ya existe una,
      // se reutiliza en vez de crear otra al guardar. Si hay más de una
      // (edge case de pruebas), nos quedamos con la más antigua.
      supabase
        .from("training_sessions")
        .select("id, completado, esfuerzo_percibido, duracion_min")
        .eq("user_id", user.id)
        .eq("fecha", fecha)
        .order("creado_en", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("daily_habit_logs")
        .select("tipo, completado, duracion_min")
        .eq("user_id", user.id)
        .eq("fecha", fecha),
    ]);

    const session = sessionRes.data as {
      id: string;
      completado: boolean;
      esfuerzo_percibido: number | null;
      duracion_min: number | null;
    } | null;
    setSessionId(session?.id ?? null);
    setCompletado(session?.completado ?? false);
    setEsfuerzoPercibido(session?.esfuerzo_percibido ?? null);
    setDuracionMin(session?.duracion_min ?? null);

    if (session) {
      const { data: sets } = await supabase
        .from("session_sets")
        .select("id, exercise_id, numero_serie, reps_realizadas, peso_realizado_kg")
        .eq("session_id", session.id)
        .order("numero_serie");
      const grouped: Record<string, SessionSetDraft[]> = {};
      for (const s of (sets ?? []) as any[]) {
        (grouped[s.exercise_id] ??= []).push({
          id: s.id,
          numero_serie: s.numero_serie,
          reps_realizadas: s.reps_realizadas,
          peso_realizado_kg: s.peso_realizado_kg,
        });
      }
      setSetsByExercise(grouped);
    } else {
      setSetsByExercise({});
    }

    const habitMap: Partial<Record<"movilidad" | "caminata", HabitLog>> = {};
    for (const h of (habitsRes.data ?? []) as any[]) {
      habitMap[h.tipo as "movilidad" | "caminata"] = {
        tipo: h.tipo,
        completado: h.completado,
        duracion_min: h.duracion_min,
      };
    }
    setHabits(habitMap);
    setLoading(false);
  }, [user, routineDayId, fecha]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleHabit = useCallback(
    async (tipo: "movilidad" | "caminata", nextCompletado: boolean) => {
      if (!user) throw new Error("No hay sesión activa.");
      const { data: existing } = await supabase
        .from("daily_habit_logs")
        .select("id")
        .eq("user_id", user.id)
        .eq("fecha", fecha)
        .eq("tipo", tipo)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("daily_habit_logs")
          .update({ completado: nextCompletado })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("daily_habit_logs")
          .insert({ user_id: user.id, fecha, tipo, completado: nextCompletado });
        if (error) throw error;
      }
      setHabits((prev) => ({
        ...prev,
        [tipo]: { tipo, completado: nextCompletado, duracion_min: prev[tipo]?.duracion_min ?? null },
      }));
    },
    [user, fecha],
  );

  // Crea la sesión de hoy si todavía no existe (completado=false) y devuelve
  // su id. Idempotente: si ya existe, la reutiliza.
  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId;
    if (!user) throw new Error("No hay sesión activa.");
    if (!routineDayId) throw new Error("Hoy es día de descanso.");
    const { data, error } = await supabase
      .from("training_sessions")
      .insert({ user_id: user.id, fecha, routine_day_id: routineDayId, es_extra: false, completado: false })
      .select("id")
      .single();
    if (error) throw error;
    setSessionId(data.id);
    return data.id as string;
  }, [sessionId, user, routineDayId, fecha]);

  // Guarda UNA serie. Si la fila ya tiene id (ya se había guardado antes) se
  // actualiza directamente por id; si no, se inserta y se recuerda el id
  // devuelto para que la siguiente edición de esa misma fila actualice en
  // vez de insertar otra. Se llama al momento, por cada serie.
  const saveSet = useCallback(
    async (exerciseId: string, row: SessionSetDraft): Promise<SessionSetDraft> => {
      if (!user) throw new Error("No hay sesión activa.");
      const sid = await ensureSession();
      let rowId = row.id ?? null;
      if (rowId) {
        const { error } = await supabase
          .from("session_sets")
          .update({ reps_realizadas: row.reps_realizadas, peso_realizado_kg: row.peso_realizado_kg })
          .eq("id", rowId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("session_sets")
          .insert({
            user_id: user.id,
            session_id: sid,
            exercise_id: exerciseId,
            numero_serie: row.numero_serie,
            reps_realizadas: row.reps_realizadas,
            peso_realizado_kg: row.peso_realizado_kg,
          })
          .select("id")
          .single();
        if (error) throw error;
        rowId = data.id;
      }
      const saved: SessionSetDraft = { ...row, id: rowId };
      setSetsByExercise((prev) => {
        const rows = prev[exerciseId] ?? [];
        const idx = rows.findIndex((r) => r.numero_serie === row.numero_serie);
        const next =
          idx >= 0
            ? rows.map((r, i) => (i === idx ? saved : r))
            : [...rows, saved].sort((a, b) => a.numero_serie - b.numero_serie);
        return { ...prev, [exerciseId]: next };
      });
      return saved;
    },
    [user, ensureSession],
  );

  // Quita una serie: si tenía id (ya guardada en BD) borra esa fila por id;
  // si nunca llegó a guardarse, es un no-op de servidor, solo se quita del
  // estado local.
  const removeSet = useCallback(async (exerciseId: string, row: SessionSetDraft) => {
    if (row.id) {
      const { error } = await supabase.from("session_sets").delete().eq("id", row.id);
      if (error) throw error;
    }
    setSetsByExercise((prev) => ({
      ...prev,
      [exerciseId]: (prev[exerciseId] ?? []).filter((r) => r.numero_serie !== row.numero_serie),
    }));
  }, []);

  // Marca la sesión de hoy como completada (creándola primero si aún no
  // existe, p.ej. si el usuario no ha registrado ninguna serie), guardando
  // de paso el esfuerzo percibido (RPE 0-10) y la duración (minutos) si se
  // han indicado. Ambos son opcionales: se puede completar sin valorarlos.
  const markCompleted = useCallback(
    async (payload?: { esfuerzo_percibido: number | null; duracion_min: number | null }) => {
      const sid = await ensureSession();
      const esfuerzo_percibido = payload?.esfuerzo_percibido ?? null;
      const duracion_min = payload?.duracion_min ?? null;
      const { error } = await supabase
        .from("training_sessions")
        .update({ completado: true, esfuerzo_percibido, duracion_min })
        .eq("id", sid);
      if (error) throw error;
      setCompletado(true);
      setEsfuerzoPercibido(esfuerzo_percibido);
      setDuracionMin(duracion_min);
    },
    [ensureSession],
  );

  return {
    fecha,
    sessionId,
    completado,
    esfuerzoPercibido,
    duracionMin,
    setsByExercise,
    habits,
    loading,
    toggleHabit,
    saveSet,
    removeSet,
    markCompleted,
    refresh,
  };
}

// Crea un entrenamiento fuera de plan (es_extra=true) con sus series, para
// cualquier fecha, con el mismo esfuerzo percibido y duración opcionales que
// en la sesión planificada. No es un hook: se invoca puntualmente desde el
// formulario.
export async function createExtraSession(
  userId: string,
  fecha: string,
  setsByExercise: Record<string, SessionSetDraft[]>,
  esfuerzoDuracion?: { esfuerzo_percibido: number | null; duracion_min: number | null },
): Promise<void> {
  const { data: session, error } = await supabase
    .from("training_sessions")
    .insert({
      user_id: userId,
      fecha,
      routine_day_id: null,
      es_extra: true,
      completado: true,
      esfuerzo_percibido: esfuerzoDuracion?.esfuerzo_percibido ?? null,
      duracion_min: esfuerzoDuracion?.duracion_min ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  const rows = Object.entries(setsByExercise).flatMap(([exerciseId, sets]) =>
    sets
      .filter((s) => s.reps_realizadas != null || s.peso_realizado_kg != null)
      .map((s) => ({
        user_id: userId,
        session_id: session.id as string,
        exercise_id: exerciseId,
        numero_serie: s.numero_serie,
        reps_realizadas: s.reps_realizadas,
        peso_realizado_kg: s.peso_realizado_kg,
      })),
  );
  if (rows.length) {
    const { error: setsErr } = await supabase.from("session_sets").insert(rows);
    if (setsErr) throw setsErr;
  }
}

/* ------------------------------ Rachas y calendario ------------------------------ */

export type DayStatus = "cumplido" | "incumplido" | "pendiente" | "descanso";

export type CalendarDayInfo = {
  fecha: string;
  status: DayStatus;
  extra: boolean;
  // Suma de esfuerzo_percibido × duracion_min de las sesiones completadas de
  // ese día (null si ninguna tiene ambos valores registrados).
  carga: number | null;
};

export type SessionSummaryRow = {
  fecha: string;
  routine_day_id: string | null;
  es_extra: boolean;
  completado: boolean;
  esfuerzo_percibido: number | null;
  duracion_min: number | null;
};

export type WeeklyLoadPoint = {
  weekStart: string;
  carga: number;
};

// Racha actual y mejor racha histórica, más el estado de cada día (para
// pintar el calendario) desde que se creó el perfil (cuando se sembró la
// rutina) hasta hoy. Un solo recorrido cronológico calcula ambas rachas:
// los días de descanso no cuentan ni cortan; un día de plan pasado sin
// completar corta la racha; hoy, si todavía no se ha completado, no la
// corta (queda "pendiente") pero tampoco la alarga.
export function useTrainingProgress() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = usePersonalProfile();
  const { days: routineDays, loading: routineLoading } = useRoutine();
  const [sessions, setSessions] = useState<SessionSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || !profile) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("training_sessions")
      .select("fecha, routine_day_id, es_extra, completado, esfuerzo_percibido, duracion_min")
      .eq("user_id", user.id)
      .lte("fecha", todayISODate())
      .order("fecha");
    setSessions((data ?? []) as SessionSummaryRow[]);
    setLoading(false);
  }, [user, profile]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const ready = !profileLoading && !routineLoading && !loading && !!profile;

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionSummaryRow[]>();
    for (const s of sessions) {
      if (!map.has(s.fecha)) map.set(s.fecha, []);
      map.get(s.fecha)!.push(s);
    }
    return map;
  }, [sessions]);

  const weeklyLoad = useMemo<WeeklyLoadPoint[]>(() => {
    const buckets = new Map<string, number>();
    for (const s of sessions) {
      if (!s.completado || s.esfuerzo_percibido == null || s.duracion_min == null) continue;
      const d = new Date(`${s.fecha}T00:00:00`);
      const dow = (d.getDay() + 6) % 7; // 0=lunes ... 6=domingo
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - dow);
      const key = toLocalISODate(weekStart);
      buckets.set(key, (buckets.get(key) ?? 0) + s.esfuerzo_percibido * s.duracion_min);
    }
    return Array.from(buckets.entries())
      .map(([weekStart, carga]) => ({ weekStart, carga }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [sessions]);

  const { currentStreak, bestStreak, statusByDate } = useMemo(() => {
    const statusByDate = new Map<string, CalendarDayInfo>();
    if (!ready || !profile) {
      return { currentStreak: 0, bestStreak: 0, statusByDate };
    }

    const dowToDay = new Map(routineDays.map((d) => [d.dia_semana, d]));
    const completedDates = new Set(
      sessions.filter((s) => s.completado && !s.es_extra).map((s) => s.fecha),
    );
    const extraDates = new Set(sessions.filter((s) => s.es_extra).map((s) => s.fecha));

    const createdAt = new Date(profile.created_at);
    const cursor = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = todayISODate();

    let running = 0;
    let best = 0;

    while (cursor <= todayMidnight) {
      const iso = toLocalISODate(cursor);
      const dow = (cursor.getDay() + 6) % 7; // 0=lunes ... 6=domingo
      const routineDay = dowToDay.get(dow);
      const hasExtra = extraDates.has(iso);

      let status: DayStatus;
      if (!routineDay || !routineDay.es_dia_entreno) {
        status = "descanso";
      } else if (completedDates.has(iso)) {
        status = "cumplido";
        running += 1;
        best = Math.max(best, running);
      } else if (iso === todayStr) {
        status = "pendiente";
      } else {
        status = "incumplido";
        running = 0;
      }

      const daySessions = sessionsByDate.get(iso) ?? [];
      const cargaSessions = daySessions.filter(
        (s) => s.completado && s.esfuerzo_percibido != null && s.duracion_min != null,
      );
      const carga = cargaSessions.length
        ? cargaSessions.reduce((sum, s) => sum + s.esfuerzo_percibido! * s.duracion_min!, 0)
        : null;

      statusByDate.set(iso, { fecha: iso, status, extra: hasExtra, carga });
      cursor.setDate(cursor.getDate() + 1);
    }

    return { currentStreak: running, bestStreak: best, statusByDate };
  }, [ready, profile, routineDays, sessions, sessionsByDate]);

  return {
    loading: !ready,
    currentStreak,
    bestStreak,
    statusByDate,
    sessionsByDate,
    weeklyLoad,
    refresh,
  };
}

/* ------------------------------ Progresión y récords (e1RM) ------------------------------ */

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

export type ProgressPoint = {
  fecha: string;
  numero_serie: number;
  reps: number;
  peso: number;
  e1rm: number | null;
  precision: SetPrecision;
  isPR: boolean;
};

export type ExerciseProgress = {
  exerciseId: string;
  nombre: string;
  points: ProgressPoint[];
  currentPR: { e1rm: number; fecha: string; peso: number; reps: number } | null;
};

type RawSetRow = {
  exercise_id: string;
  numero_serie: number;
  reps_realizadas: number | null;
  peso_realizado_kg: number | null;
  fecha: string;
};

// Progresión de e1RM y récords personales por ejercicio, a partir de TODAS
// las series ya registradas en session_sets (planificadas o extra, marcada
// o no la sesión como completada: una serie real cuenta igual). No hay tabla
// ni campo nuevo — es cálculo determinista en el cliente sobre datos ya
// existentes, sin IA ni llamadas externas.
export function useExerciseProgress() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RawSetRow[]>([]);
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRows([]);
      setExerciseNames({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const [setsRes, exercisesRes] = await Promise.all([
      supabase
        .from("session_sets")
        .select("exercise_id, numero_serie, reps_realizadas, peso_realizado_kg, session:session_id ( fecha )")
        .eq("user_id", user.id),
      supabase.from("exercises").select("id, nombre").eq("user_id", user.id),
    ]);

    const flat: RawSetRow[] = ((setsRes.data ?? []) as any[])
      .filter((r) => r.session?.fecha)
      .map((r) => ({
        exercise_id: r.exercise_id,
        numero_serie: r.numero_serie,
        reps_realizadas: r.reps_realizadas,
        peso_realizado_kg: r.peso_realizado_kg,
        fecha: r.session.fecha as string,
      }));
    setRows(flat);

    const names: Record<string, string> = {};
    for (const e of (exercisesRes.data ?? []) as any[]) names[e.id] = e.nombre;
    setExerciseNames(names);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const exercises = useMemo<ExerciseProgress[]>(() => {
    const byExercise = new Map<string, RawSetRow[]>();
    for (const r of rows) {
      if (r.reps_realizadas == null || r.peso_realizado_kg == null) continue;
      if (!byExercise.has(r.exercise_id)) byExercise.set(r.exercise_id, []);
      byExercise.get(r.exercise_id)!.push(r);
    }

    const result: ExerciseProgress[] = [];
    for (const [exerciseId, list] of byExercise) {
      const sorted = [...list].sort(
        (a, b) => a.fecha.localeCompare(b.fecha) || a.numero_serie - b.numero_serie,
      );
      let runningMax = -Infinity;
      let currentPR: ExerciseProgress["currentPR"] = null;
      const points: ProgressPoint[] = sorted.map((r) => {
        const reps = r.reps_realizadas as number;
        const peso = r.peso_realizado_kg as number;
        const { value, precision } = estimate1RM(peso, reps);
        let isPR = false;
        if (value != null && value > runningMax) {
          runningMax = value;
          isPR = true;
          currentPR = { e1rm: value, fecha: r.fecha, peso, reps };
        }
        return { fecha: r.fecha, numero_serie: r.numero_serie, reps, peso, e1rm: value, precision, isPR };
      });

      result.push({
        exerciseId,
        nombre: exerciseNames[exerciseId] ?? "Ejercicio",
        points,
        currentPR,
      });
    }
    return result;
  }, [rows, exerciseNames]);

  return { loading, exercises, refresh };
}

/* ------------------------------ Volumen semanal por grupo muscular ------------------------------ */

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

type MuscleExerciseInfo = { principal: string; secundarios: string[] };
type MuscleSetRow = { fecha: string; exercise_id: string };

// Volumen semanal (lunes-domingo) por grupo muscular con conteo fraccional:
// cada serie completada suma 1.0 al músculo principal del ejercicio y 0.5 a
// cada músculo secundario. Se calcula en el cliente sobre session_sets +
// exercises ya existentes, sin tabla nueva de agregados.
export function useMuscleVolume() {
  const { user } = useAuth();
  const [rows, setRows] = useState<MuscleSetRow[]>([]);
  const [exerciseMuscles, setExerciseMuscles] = useState<Record<string, MuscleExerciseInfo>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRows([]);
      setExerciseMuscles({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const [setsRes, exercisesRes] = await Promise.all([
      supabase
        .from("session_sets")
        .select("exercise_id, session:session_id ( fecha )")
        .eq("user_id", user.id),
      supabase.from("exercises").select("id, grupo_muscular, musculos_secundarios").eq("user_id", user.id),
    ]);

    const flat: MuscleSetRow[] = ((setsRes.data ?? []) as any[])
      .filter((r) => r.session?.fecha)
      .map((r) => ({ fecha: r.session.fecha as string, exercise_id: r.exercise_id as string }));
    setRows(flat);

    const map: Record<string, MuscleExerciseInfo> = {};
    for (const e of (exercisesRes.data ?? []) as any[]) {
      map[e.id] = { principal: e.grupo_muscular, secundarios: e.musculos_secundarios ?? [] };
    }
    setExerciseMuscles(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // weekStart (ISO, lunes) -> músculo canónico -> series (fraccionales)
  const volumeByWeek = useMemo(() => {
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
  }, [rows, exerciseMuscles]);

  return { loading, volumeByWeek, refresh };
}

/* ------------------------------ Alerta de descarga (deload) ------------------------------ */

export type DeloadSignalId = "e1rm_drop" | "stagnation" | "mrv_volume" | "load_trend";

export type DeloadSignal = {
  id: DeloadSignalId;
  label: string;
  active: boolean;
  detail: string;
};

type DeloadSessionRow = {
  id: string;
  fecha: string;
  routine_day_id: string | null;
  es_extra: boolean;
  completado: boolean;
  esfuerzo_percibido: number | null;
  duracion_min: number | null;
};
type DeloadSetRow = {
  session_id: string;
  exercise_id: string;
  reps_realizadas: number | null;
  peso_realizado_kg: number | null;
};
type DeloadExerciseRow = {
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

// Evalúa 4 señales de fatiga acumulada sobre datos ya existentes (sin tabla
// ni campo nuevo): caída de e1RM con esfuerzo igual o mayor, estancamiento
// del mismo día de rutina 2 semanas seguidas, algún músculo en/sobre su MRV
// 2 semanas seguidas, y carga de sesión al alza sin mejora de rendimiento en
// paralelo. Con 2 o más señales activas a la vez se recomienda una semana de
// descarga.
export function useDeloadCheck() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<DeloadSessionRow[]>([]);
  const [sets, setSets] = useState<DeloadSetRow[]>([]);
  const [exercises, setExercises] = useState<Record<string, DeloadExerciseRow>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSessions([]);
      setSets([]);
      setExercises({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const [sessionsRes, setsRes, exercisesRes] = await Promise.all([
      supabase
        .from("training_sessions")
        .select("id, fecha, routine_day_id, es_extra, completado, esfuerzo_percibido, duracion_min")
        .eq("user_id", user.id)
        .order("fecha"),
      supabase
        .from("session_sets")
        .select("session_id, exercise_id, reps_realizadas, peso_realizado_kg")
        .eq("user_id", user.id),
      supabase.from("exercises").select("id, nombre, grupo_muscular, musculos_secundarios").eq("user_id", user.id),
    ]);

    setSessions((sessionsRes.data ?? []) as DeloadSessionRow[]);
    setSets((setsRes.data ?? []) as DeloadSetRow[]);
    const exMap: Record<string, DeloadExerciseRow> = {};
    for (const e of (exercisesRes.data ?? []) as DeloadExerciseRow[]) exMap[e.id] = e;
    setExercises(exMap);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const result = useMemo(() => {
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
  }, [sessions, sets, exercises]);

  return { loading, ...result, refresh };
}
