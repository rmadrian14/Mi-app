-- Calendario: eventos y tareas con hora, todo el día, repeticiones y recordatorios (como Google
-- Calendar). Se puede ejecutar más de una vez. No modifica ni borra ninguna tabla existente;
-- la tabla antigua de tareas (user_tasks) se deja como está.
--
-- · Las horas son LOCALES, sin zona horaria (timestamp): un evento a las 10:00 sigue a las 10:00
--   aunque cambie la hora de verano. En los eventos de todo el día "fin" es el día siguiente a
--   las 00:00 (fin exclusivo, igual que Google Calendar).
-- · Una serie repetida es una sola fila con "repeticion". Cada ocurrencia que se cambia o se
--   borra se anota en "omitidas"; si se cambia, se guarda como una fila aparte (excepción) con
--   "serie_id" y "serie_original" (el día de la ocurrencia a la que sustituye).

-- Valida el contenido de "repeticion". Ejemplo:
--   {"frecuencia":"semanal","intervalo":2,"dias":[0,2],"hasta":"2027-06-30"}
--   frecuencia: diaria | semanal | mensual | anual · intervalo: 1-99 · veces: 1-999
--   dias: días de la semana (0 = lunes ... 6 = domingo) · por: dia | semana (solo mensual)
CREATE OR REPLACE FUNCTION public.calendario_repeticion_valida(r jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v jsonb;
BEGIN
  IF r IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(r) <> 'object' THEN RETURN false; END IF;
  IF coalesce(r->>'frecuencia', '') NOT IN ('diaria', 'semanal', 'mensual', 'anual') THEN RETURN false; END IF;

  v := r->'intervalo';
  IF v IS NOT NULL AND v <> 'null'::jsonb THEN
    IF jsonb_typeof(v) <> 'number' THEN RETURN false; END IF;
    IF (v #>> '{}')::numeric NOT BETWEEN 1 AND 99 OR (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) THEN RETURN false; END IF;
  END IF;

  v := r->'veces';
  IF v IS NOT NULL AND v <> 'null'::jsonb THEN
    IF jsonb_typeof(v) <> 'number' THEN RETURN false; END IF;
    IF (v #>> '{}')::numeric NOT BETWEEN 1 AND 999 OR (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) THEN RETURN false; END IF;
  END IF;

  v := r->'hasta';
  IF v IS NOT NULL AND v <> 'null'::jsonb THEN
    IF jsonb_typeof(v) <> 'string' OR (v #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN false; END IF;
  END IF;

  v := r->'dias';
  IF v IS NOT NULL AND v <> 'null'::jsonb THEN
    IF jsonb_typeof(v) <> 'array' OR jsonb_array_length(v) NOT BETWEEN 1 AND 7 THEN RETURN false; END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v) e
      WHERE jsonb_typeof(e) <> 'number' OR (e #>> '{}')::numeric NOT BETWEEN 0 AND 6 OR (e #>> '{}')::numeric <> trunc((e #>> '{}')::numeric)
    ) THEN RETURN false; END IF;
  END IF;

  v := r->'por';
  IF v IS NOT NULL AND v <> 'null'::jsonb THEN
    IF jsonb_typeof(v) <> 'string' OR (v #>> '{}') NOT IN ('dia', 'semana') THEN RETURN false; END IF;
  END IF;

  RETURN true;
END;
$$;

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'evento' CHECK (tipo IN ('evento', 'tarea')),
  titulo text NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 200),
  descripcion text CHECK (descripcion IS NULL OR char_length(descripcion) <= 4000),
  ubicacion text CHECK (ubicacion IS NULL OR char_length(ubicacion) <= 200),
  todo_el_dia boolean NOT NULL DEFAULT false,
  inicio timestamp NOT NULL,
  fin timestamp NOT NULL,
  color text NOT NULL DEFAULT 'azul' CHECK (color IN ('azul', 'esmeralda', 'rojo', 'ambar', 'violeta', 'rosa', 'cian', 'gris')),
  prioridad text CHECK (prioridad IS NULL OR prioridad IN ('urgente', 'importante', 'rutinaria')),
  hecho boolean NOT NULL DEFAULT false,
  repeticion jsonb CHECK (public.calendario_repeticion_valida(repeticion)),
  omitidas date[] NOT NULL DEFAULT '{}',
  serie_id uuid REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  serie_original date,
  recordatorio_min integer CHECK (recordatorio_min IS NULL OR recordatorio_min BETWEEN 0 AND 40320),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_fin_valido CHECK (fin >= inicio),
  CONSTRAINT calendar_events_excepcion_completa CHECK ((serie_id IS NULL) = (serie_original IS NULL)),
  CONSTRAINT calendar_events_excepcion_no_repite CHECK (serie_id IS NULL OR repeticion IS NULL),
  CONSTRAINT calendar_events_no_es_su_serie CHECK (serie_id IS NULL OR serie_id <> id)
);

CREATE INDEX IF NOT EXISTS calendar_events_user_inicio_idx ON public.calendar_events (user_id, inicio);
CREATE INDEX IF NOT EXISTS calendar_events_series_idx ON public.calendar_events (user_id) WHERE repeticion IS NOT NULL;
CREATE INDEX IF NOT EXISTS calendar_events_serie_idx ON public.calendar_events (serie_id);
-- Una sola excepción por ocurrencia de una serie.
CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_excepcion_unica ON public.calendar_events (serie_id, serie_original) WHERE serie_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendar_events_select_own" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events_insert_own" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events_update_own" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events_delete_own" ON public.calendar_events;
CREATE POLICY "calendar_events_select_own" ON public.calendar_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- Una excepción solo puede colgar de una serie del propio usuario (ojo: dentro de la subconsulta
-- "serie_id" sin calificar sería el de la fila p, por eso se escribe calendar_events.serie_id).
CREATE POLICY "calendar_events_insert_own" ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (serie_id IS NULL OR EXISTS (SELECT 1 FROM public.calendar_events p WHERE p.id = calendar_events.serie_id AND p.user_id = auth.uid()))
  );
CREATE POLICY "calendar_events_update_own" ON public.calendar_events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (serie_id IS NULL OR EXISTS (SELECT 1 FROM public.calendar_events p WHERE p.id = calendar_events.serie_id AND p.user_id = auth.uid()))
  );
CREATE POLICY "calendar_events_delete_own" ON public.calendar_events FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
