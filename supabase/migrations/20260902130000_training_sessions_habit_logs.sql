
-- =========================================================
-- Módulo de Entrenamiento (2ª entrega): registro de sesiones,
-- series realizadas y hábitos diarios. Mismo patrón "por usuario"
-- que personal_profile / exercises / routine_*.
-- =========================================================

-- 1. Sesiones de entrenamiento: la de un día planificado (routine_day_id NOT
-- NULL, es_extra=false) o un entrenamiento fuera de plan (routine_day_id
-- NULL, es_extra=true).
CREATE TABLE public.training_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  routine_day_id uuid REFERENCES public.routine_days(id) ON DELETE SET NULL,
  es_extra boolean NOT NULL DEFAULT false,
  completado boolean NOT NULL DEFAULT false,
  notas text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  -- Evita duplicar la sesión planificada de un mismo día de rutina en la
  -- misma fecha. Al ser NULL en los entrenamientos extra, no limita cuántos
  -- entrenamientos extra puede haber el mismo día (NULL nunca es igual a NULL).
  UNIQUE (user_id, fecha, routine_day_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_sessions TO authenticated;
GRANT ALL ON public.training_sessions TO service_role;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_sessions_select_own" ON public.training_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "training_sessions_insert_own" ON public.training_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "training_sessions_update_own" ON public.training_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "training_sessions_delete_own" ON public.training_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX training_sessions_user_idx ON public.training_sessions(user_id);
CREATE INDEX training_sessions_fecha_idx ON public.training_sessions(user_id, fecha);

-- 2. Series realizadas dentro de una sesión.
CREATE TABLE public.session_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  numero_serie integer NOT NULL,
  reps_realizadas integer,
  peso_realizado_kg numeric(6,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_sets TO authenticated;
GRANT ALL ON public.session_sets TO service_role;
ALTER TABLE public.session_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_sets_select_own" ON public.session_sets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "session_sets_insert_own" ON public.session_sets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "session_sets_update_own" ON public.session_sets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "session_sets_delete_own" ON public.session_sets FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX session_sets_session_idx ON public.session_sets(session_id);
CREATE INDEX session_sets_user_idx ON public.session_sets(user_id);

-- 3. Registro diario de hábitos (movilidad, caminata) — una fila por
-- usuario+fecha+tipo.
CREATE TABLE public.daily_habit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('movilidad','caminata')),
  completado boolean NOT NULL DEFAULT false,
  duracion_min integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fecha, tipo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_habit_logs TO authenticated;
GRANT ALL ON public.daily_habit_logs TO service_role;
ALTER TABLE public.daily_habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_habit_logs_select_own" ON public.daily_habit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "daily_habit_logs_insert_own" ON public.daily_habit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "daily_habit_logs_update_own" ON public.daily_habit_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "daily_habit_logs_delete_own" ON public.daily_habit_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX daily_habit_logs_user_idx ON public.daily_habit_logs(user_id);
CREATE INDEX daily_habit_logs_fecha_idx ON public.daily_habit_logs(user_id, fecha);
