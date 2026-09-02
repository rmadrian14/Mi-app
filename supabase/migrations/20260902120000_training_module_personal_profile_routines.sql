
-- =========================================================
-- Módulo de Entrenamiento (y futuros módulos personales, ej.
-- Alimentación): datos por usuario, no ligados a ningún workspace
-- de Negocio.
-- =========================================================

-- 1. Perfil personal, reutilizable por otros módulos personales.
CREATE TABLE public.personal_profile (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  edad integer,
  peso_kg numeric(5,2),
  altura_cm numeric(5,1),
  objetivo text,
  limitaciones text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_profile TO authenticated;
GRANT ALL ON public.personal_profile TO service_role;
ALTER TABLE public.personal_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personal_profile_select_own" ON public.personal_profile FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "personal_profile_insert_own" ON public.personal_profile FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "personal_profile_update_own" ON public.personal_profile FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "personal_profile_delete_own" ON public.personal_profile FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_personal_profile_updated_at
  BEFORE UPDATE ON public.personal_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Biblioteca de ejercicios (cada usuario construye la suya).
CREATE TABLE public.exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  grupo_muscular text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('fuerza','movilidad','cardio')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercises_select_own" ON public.exercises FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "exercises_insert_own" ON public.exercises FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exercises_update_own" ON public.exercises FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exercises_delete_own" ON public.exercises FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX exercises_user_idx ON public.exercises(user_id);

-- 3. Días de la plantilla de rutina semanal (0=lunes ... 6=domingo).
CREATE TABLE public.routine_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  nombre_dia text NOT NULL,
  es_dia_entreno boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dia_semana)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_days TO authenticated;
GRANT ALL ON public.routine_days TO service_role;
ALTER TABLE public.routine_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routine_days_select_own" ON public.routine_days FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "routine_days_insert_own" ON public.routine_days FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_days_update_own" ON public.routine_days FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_days_delete_own" ON public.routine_days FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX routine_days_user_idx ON public.routine_days(user_id);

-- 4. Ejercicios dentro de cada día de rutina.
CREATE TABLE public.routine_exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_day_id uuid NOT NULL REFERENCES public.routine_days(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  orden integer NOT NULL DEFAULT 0,
  series_objetivo text NOT NULL,
  reps_objetivo text NOT NULL,
  peso_objetivo_kg numeric(6,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_exercises TO authenticated;
GRANT ALL ON public.routine_exercises TO service_role;
ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routine_exercises_select_own" ON public.routine_exercises FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "routine_exercises_insert_own" ON public.routine_exercises FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_exercises_update_own" ON public.routine_exercises FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_exercises_delete_own" ON public.routine_exercises FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX routine_exercises_day_idx ON public.routine_exercises(routine_day_id);
CREATE INDEX routine_exercises_user_idx ON public.routine_exercises(user_id);

-- 5. Hábitos diarios asociados a un día de rutina (movilidad, caminata).
CREATE TABLE public.routine_daily_habits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_day_id uuid NOT NULL REFERENCES public.routine_days(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('movilidad','caminata')),
  duracion_min_objetivo integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_daily_habits TO authenticated;
GRANT ALL ON public.routine_daily_habits TO service_role;
ALTER TABLE public.routine_daily_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routine_daily_habits_select_own" ON public.routine_daily_habits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "routine_daily_habits_insert_own" ON public.routine_daily_habits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_daily_habits_update_own" ON public.routine_daily_habits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_daily_habits_delete_own" ON public.routine_daily_habits FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX routine_daily_habits_day_idx ON public.routine_daily_habits(routine_day_id);
CREATE INDEX routine_daily_habits_user_idx ON public.routine_daily_habits(user_id);
