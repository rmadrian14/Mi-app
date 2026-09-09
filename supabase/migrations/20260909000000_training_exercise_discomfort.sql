
-- Módulo de Entrenamiento (7ª entrega): registro de molestias por ejercicio
-- (Sistema de Semáforo: 0-3 verde, 4-6 amarillo, 7-10 rojo). Es un dato por
-- ejercicio dentro de una sesión, no por serie individual, así que va en su
-- propia tabla en vez de session_sets. Sin fecha propia: se obtiene siempre
-- vía session_id -> training_sessions.fecha, igual que hace session_sets.
CREATE TABLE public.exercise_discomfort (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  zona_cuerpo text NOT NULL CHECK (zona_cuerpo IN
    ('rodilla', 'hombro', 'codo', 'muñeca', 'espalda baja', 'cadera', 'cuello', 'otro')),
  intensidad integer NOT NULL CHECK (intensidad BETWEEN 0 AND 10),
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_discomfort TO authenticated;
GRANT ALL ON public.exercise_discomfort TO service_role;
ALTER TABLE public.exercise_discomfort ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercise_discomfort_select_own" ON public.exercise_discomfort FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "exercise_discomfort_insert_own" ON public.exercise_discomfort FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exercise_discomfort_update_own" ON public.exercise_discomfort FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exercise_discomfort_delete_own" ON public.exercise_discomfort FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX exercise_discomfort_session_idx ON public.exercise_discomfort(session_id);
CREATE INDEX exercise_discomfort_exercise_idx ON public.exercise_discomfort(exercise_id);
CREATE INDEX exercise_discomfort_user_idx ON public.exercise_discomfort(user_id);
