import { supabase } from "@/integrations/supabase/client";

type SeedExercise = {
  nombre: string;
  grupo_muscular: string;
  tipo: "fuerza" | "movilidad" | "cardio";
  notas?: string;
};

// Biblioteca inicial de ejercicios. Los de Jueves ("Brazo") reutilizan estos
// mismos ejercicios de Push/Pull — no hay duplicados en la tabla exercises.
const SEED_EXERCISES: SeedExercise[] = [
  { nombre: "Press banca mancuernas (plano)", grupo_muscular: "pecho", tipo: "fuerza" },
  { nombre: "Press inclinado mancuernas", grupo_muscular: "pecho", tipo: "fuerza" },
  { nombre: "Press declinado mancuernas (banco en negativa)", grupo_muscular: "pecho", tipo: "fuerza" },
  { nombre: "Press militar", grupo_muscular: "hombro", tipo: "fuerza" },
  { nombre: "Elevaciones laterales", grupo_muscular: "hombro", tipo: "fuerza" },
  { nombre: "Extensión tríceps sobre cabeza", grupo_muscular: "tríceps", tipo: "fuerza" },
  { nombre: "Remo a una mano apoyado en banco", grupo_muscular: "espalda", tipo: "fuerza" },
  { nombre: "Remo renegado", grupo_muscular: "espalda", tipo: "fuerza" },
  { nombre: "Curl bíceps banco inclinado", grupo_muscular: "bíceps", tipo: "fuerza" },
  { nombre: "Curl martillo", grupo_muscular: "bíceps", tipo: "fuerza" },
  { nombre: "Peso muerto rumano con mancuernas", grupo_muscular: "pierna", tipo: "fuerza" },
  { nombre: "Hip thrust con mancuerna", grupo_muscular: "glúteo", tipo: "fuerza" },
  { nombre: "Elevación de cadera a una pierna", grupo_muscular: "glúteo", tipo: "fuerza" },
  { nombre: "Step-up bajo (rango corto)", grupo_muscular: "pierna", tipo: "fuerza" },
  {
    nombre: "Extensión de rodilla en banco (rango parcial)",
    grupo_muscular: "pierna",
    tipo: "fuerza",
    notas: "Rango parcial, solo últimos 30-40°. Evitar flexión profunda de rodilla.",
  },
  { nombre: "Elevación de gemelo de pie", grupo_muscular: "gemelo", tipo: "fuerza" },
  { nombre: "Press francés", grupo_muscular: "tríceps", tipo: "fuerza" },
];

type SeedDayExercise = {
  nombre: string;
  series_objetivo: string;
  reps_objetivo: string;
  peso_objetivo_kg?: number;
};

type SeedDay = {
  dia_semana: number;
  nombre_dia: string;
  es_dia_entreno: boolean;
  movilidad: boolean;
  ejercicios: SeedDayExercise[];
};

// Lunes=0 ... Domingo=6. Rutina orientada a recomposición corporal, sin
// sentadilla ni flexión profunda de rodilla (dolor de rodilla del usuario).
const SEED_DAYS: SeedDay[] = [
  {
    dia_semana: 0,
    nombre_dia: "Push",
    es_dia_entreno: true,
    movilidad: true,
    ejercicios: [
      { nombre: "Press banca mancuernas (plano)", series_objetivo: "3-4", reps_objetivo: "casi al fallo" },
      { nombre: "Press inclinado mancuernas", series_objetivo: "3-4", reps_objetivo: "casi al fallo" },
      { nombre: "Press declinado mancuernas (banco en negativa)", series_objetivo: "3-4", reps_objetivo: "casi al fallo" },
      { nombre: "Press militar", series_objetivo: "4", reps_objetivo: "al fallo" },
      { nombre: "Elevaciones laterales", series_objetivo: "4", reps_objetivo: "al fallo" },
      { nombre: "Extensión tríceps sobre cabeza", series_objetivo: "3-4", reps_objetivo: "casi al fallo" },
    ],
  },
  {
    dia_semana: 1,
    nombre_dia: "Pull",
    es_dia_entreno: true,
    movilidad: true,
    ejercicios: [
      { nombre: "Remo a una mano apoyado en banco", series_objetivo: "3-4", reps_objetivo: "al fallo" },
      { nombre: "Remo renegado", series_objetivo: "3-4", reps_objetivo: "al fallo" },
      { nombre: "Curl bíceps banco inclinado", series_objetivo: "3-4", reps_objetivo: "al fallo" },
      { nombre: "Curl martillo", series_objetivo: "3-4", reps_objetivo: "al fallo" },
    ],
  },
  {
    dia_semana: 2,
    nombre_dia: "Legs",
    es_dia_entreno: true,
    movilidad: true,
    ejercicios: [
      { nombre: "Peso muerto rumano con mancuernas", series_objetivo: "4", reps_objetivo: "12 (peso ligero)" },
      { nombre: "Hip thrust con mancuerna", series_objetivo: "4", reps_objetivo: "12-15" },
      { nombre: "Elevación de cadera a una pierna", series_objetivo: "3", reps_objetivo: "10 por lado (sin peso al inicio)" },
      { nombre: "Step-up bajo (rango corto)", series_objetivo: "3", reps_objetivo: "10 por pierna" },
      { nombre: "Extensión de rodilla en banco (rango parcial)", series_objetivo: "3", reps_objetivo: "15 (rango parcial 30-40°, muy ligero)" },
      { nombre: "Elevación de gemelo de pie", series_objetivo: "4", reps_objetivo: "15-20" },
    ],
  },
  {
    dia_semana: 3,
    nombre_dia: "Brazo",
    es_dia_entreno: true,
    movilidad: true,
    ejercicios: [
      { nombre: "Press banca mancuernas (plano)", series_objetivo: "3-4", reps_objetivo: "casi al fallo" },
      { nombre: "Press inclinado mancuernas", series_objetivo: "3-4", reps_objetivo: "casi al fallo" },
      { nombre: "Press declinado mancuernas (banco en negativa)", series_objetivo: "3-4", reps_objetivo: "casi al fallo" },
      { nombre: "Press militar", series_objetivo: "4", reps_objetivo: "al fallo" },
      { nombre: "Elevaciones laterales", series_objetivo: "4", reps_objetivo: "al fallo" },
      { nombre: "Extensión tríceps sobre cabeza", series_objetivo: "3-4", reps_objetivo: "casi al fallo" },
      { nombre: "Remo a una mano apoyado en banco", series_objetivo: "3-4", reps_objetivo: "al fallo" },
      { nombre: "Remo renegado", series_objetivo: "3-4", reps_objetivo: "al fallo" },
      { nombre: "Curl bíceps banco inclinado", series_objetivo: "3-4", reps_objetivo: "al fallo" },
      { nombre: "Curl martillo", series_objetivo: "3-4", reps_objetivo: "al fallo" },
      { nombre: "Press francés", series_objetivo: "3", reps_objetivo: "10-12" },
    ],
  },
  { dia_semana: 4, nombre_dia: "Descanso", es_dia_entreno: false, movilidad: true, ejercicios: [] },
  { dia_semana: 5, nombre_dia: "Descanso", es_dia_entreno: false, movilidad: false, ejercicios: [] },
  { dia_semana: 6, nombre_dia: "Descanso", es_dia_entreno: false, movilidad: false, ejercicios: [] },
];

/**
 * Crea (si faltan) los ejercicios de la biblioteca del usuario y siembra los
 * 7 días de la plantilla de rutina, sus ejercicios y sus hábitos diarios.
 * Se invoca una única vez, justo después de guardar personal_profile.
 */
export async function seedDefaultRoutine(userId: string): Promise<void> {
  const { data: existing, error: exErr } = await supabase
    .from("exercises")
    .select("id, nombre")
    .eq("user_id", userId);
  if (exErr) throw exErr;

  const idByName = new Map<string, string>((existing ?? []).map((e) => [e.nombre, e.id]));
  const toCreate = SEED_EXERCISES.filter((e) => !idByName.has(e.nombre));
  if (toCreate.length) {
    const { data: created, error } = await supabase
      .from("exercises")
      .insert(
        toCreate.map((e) => ({
          user_id: userId,
          nombre: e.nombre,
          grupo_muscular: e.grupo_muscular,
          tipo: e.tipo,
          notas: e.notas ?? null,
        })),
      )
      .select("id, nombre");
    if (error) throw error;
    for (const row of created ?? []) idByName.set(row.nombre, row.id);
  }

  const { data: days, error: daysErr } = await supabase
    .from("routine_days")
    .insert(
      SEED_DAYS.map((d) => ({
        user_id: userId,
        dia_semana: d.dia_semana,
        nombre_dia: d.nombre_dia,
        es_dia_entreno: d.es_dia_entreno,
      })),
    )
    .select("id, dia_semana");
  if (daysErr) throw daysErr;

  const dayIdByDow = new Map<number, string>((days ?? []).map((d) => [d.dia_semana, d.id]));

  const routineExerciseRows = SEED_DAYS.flatMap((d) =>
    d.ejercicios.map((ej, i) => ({
      user_id: userId,
      routine_day_id: dayIdByDow.get(d.dia_semana)!,
      exercise_id: idByName.get(ej.nombre)!,
      orden: i + 1,
      series_objetivo: ej.series_objetivo,
      reps_objetivo: ej.reps_objetivo,
      peso_objetivo_kg: ej.peso_objetivo_kg ?? null,
    })),
  );
  if (routineExerciseRows.length) {
    const { error } = await supabase.from("routine_exercises").insert(routineExerciseRows);
    if (error) throw error;
  }

  const habitRows = SEED_DAYS.flatMap((d) => {
    const dayId = dayIdByDow.get(d.dia_semana)!;
    const rows: { user_id: string; routine_day_id: string; tipo: "movilidad" | "caminata"; duracion_min_objetivo: number | null }[] = [];
    if (d.movilidad) {
      rows.push({ user_id: userId, routine_day_id: dayId, tipo: "movilidad", duracion_min_objetivo: 15 });
    }
    // Caminata nocturna después de cenar: todos los días, sin duración fija.
    rows.push({ user_id: userId, routine_day_id: dayId, tipo: "caminata", duracion_min_objetivo: null });
    return rows;
  });
  const { error: habitsErr } = await supabase.from("routine_daily_habits").insert(habitRows);
  if (habitsErr) throw habitsErr;
}
