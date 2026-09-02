import { useCallback, useEffect, useState } from "react";
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
        .select("id, nombre, grupo_muscular, tipo, notas")
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
    async (input: { nombre: string; grupo_muscular: string; tipo: "fuerza" | "movilidad" | "cardio"; notas?: string | null }) => {
      if (!user) throw new Error("No hay sesión activa.");
      const { data, error } = await supabase
        .from("exercises")
        .insert({ user_id: user.id, ...input, notas: input.notas ?? null })
        .select("id, nombre, grupo_muscular, tipo, notas")
        .single();
      if (error) throw error;
      await refresh();
      return data as ExerciseRow;
    },
    [user, refresh],
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
  };
}
