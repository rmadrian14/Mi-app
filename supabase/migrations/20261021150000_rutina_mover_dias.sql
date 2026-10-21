-- Rutina: cambiar un entrenamiento de día y poner otro en su lugar.
-- Se puede ejecutar más de una vez. No borra ni modifica datos existentes.
--
-- Cada día de la rutina es una fila (routine_days) a la que están ligados sus ejercicios,
-- sus hábitos y el historial de sesiones. Mover un entrenamiento a otro día de la semana
-- significa cambiar el "dia_semana" de esa fila (y de la que ocupaba el hueco), de modo que
-- el historial de «Push» sigue siendo de «Push» aunque ahora toque otro día.

-- 1. La unicidad (usuario + día de la semana) pasa a poder comprobarse al final de la
--    transacción; así dos días pueden intercambiar su posición en una sola operación.
DO $$
DECLARE
  v_nombre text;
  v_diferible boolean;
BEGIN
  SELECT c.conname, c.condeferrable INTO v_nombre, v_diferible
  FROM pg_constraint c
  WHERE c.conrelid = 'public.routine_days'::regclass
    AND c.contype = 'u'
    AND (
      SELECT array_agg(a.attname::text ORDER BY a.attname)
      FROM pg_attribute a
      WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    ) = ARRAY['dia_semana', 'user_id'];

  IF v_nombre IS NULL OR NOT v_diferible OR v_nombre <> 'routine_days_user_id_dia_semana_key' THEN
    IF v_nombre IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.routine_days DROP CONSTRAINT %I', v_nombre);
    END IF;
    ALTER TABLE public.routine_days
      ADD CONSTRAINT routine_days_user_id_dia_semana_key UNIQUE (user_id, dia_semana) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

-- 2. Intercambia de sitio los días de la semana p_dia_a y p_dia_b (0 = lunes ... 6 = domingo).
--    Se mueve el día completo (ejercicios, hábitos e historial). Si uno de los dos es de
--    descanso, el entrenamiento simplemente pasa a ese día y el descanso al otro.
CREATE OR REPLACE FUNCTION public.intercambiar_dias_rutina(p_dia_a smallint, p_dia_b smallint)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_a uuid;
  v_b uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa';
  END IF;
  IF p_dia_a = p_dia_b THEN
    RETURN;
  END IF;

  SELECT id INTO v_a FROM public.routine_days WHERE user_id = auth.uid() AND dia_semana = p_dia_a;
  SELECT id INTO v_b FROM public.routine_days WHERE user_id = auth.uid() AND dia_semana = p_dia_b;
  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE EXCEPTION 'No se encuentra uno de los días de la rutina';
  END IF;

  SET CONSTRAINTS public.routine_days_user_id_dia_semana_key DEFERRED;
  UPDATE public.routine_days SET dia_semana = p_dia_b WHERE id = v_a AND user_id = auth.uid();
  UPDATE public.routine_days SET dia_semana = p_dia_a WHERE id = v_b AND user_id = auth.uid();
END;
$$;

-- 3. Pone en el día p_dia_destino una copia del entrenamiento del día p_dia_origen: sustituye
--    sus ejercicios (con series, repeticiones y peso objetivo), su nombre y si es día de
--    entreno o descanso. Los hábitos del día destino y el historial de series ya registradas
--    no se tocan (las series dependen del ejercicio, no de la rutina).
CREATE OR REPLACE FUNCTION public.sustituir_entrenamiento_dia(p_dia_destino smallint, p_dia_origen smallint)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_destino uuid;
  v_origen uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa';
  END IF;
  IF p_dia_destino = p_dia_origen THEN
    RAISE EXCEPTION 'Elige un día distinto';
  END IF;

  SELECT id INTO v_destino FROM public.routine_days WHERE user_id = auth.uid() AND dia_semana = p_dia_destino;
  SELECT id INTO v_origen FROM public.routine_days WHERE user_id = auth.uid() AND dia_semana = p_dia_origen;
  IF v_destino IS NULL OR v_origen IS NULL THEN
    RAISE EXCEPTION 'No se encuentra uno de los días de la rutina';
  END IF;

  DELETE FROM public.routine_exercises WHERE routine_day_id = v_destino AND user_id = auth.uid();

  INSERT INTO public.routine_exercises (user_id, routine_day_id, exercise_id, orden, series_objetivo, reps_objetivo, peso_objetivo_kg)
  SELECT user_id, v_destino, exercise_id, orden, series_objetivo, reps_objetivo, peso_objetivo_kg
  FROM public.routine_exercises
  WHERE routine_day_id = v_origen AND user_id = auth.uid()
  ORDER BY orden;

  UPDATE public.routine_days d
  SET nombre_dia = o.nombre_dia, es_dia_entreno = o.es_dia_entreno
  FROM public.routine_days o
  WHERE d.id = v_destino AND o.id = v_origen AND d.user_id = auth.uid();
END;
$$;

-- Solo usuarios con sesión pueden llamarlas.
REVOKE ALL ON FUNCTION public.intercambiar_dias_rutina(smallint, smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sustituir_entrenamiento_dia(smallint, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.intercambiar_dias_rutina(smallint, smallint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sustituir_entrenamiento_dia(smallint, smallint) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
