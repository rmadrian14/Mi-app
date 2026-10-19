
-- Alimentación v2: seguimiento de peso, sincronización entre dispositivos,
-- datos de cocinado y escrituras atómicas. Se puede ejecutar más de una vez.

-- 1. Alimentos: equivalente cocinado y frecuencia de aparición en los menús.
ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS factor_cocinado numeric(4,2) CHECK (factor_cocinado IS NULL OR factor_cocinado > 0),
  ADD COLUMN IF NOT EXISTS frecuencia numeric(3,2) NOT NULL DEFAULT 1 CHECK (frecuencia BETWEEN 0.1 AND 3);

-- 2. Perfil nutricional: calorías de mantenimiento conocidas (opcional) y menú
-- activo, para que móvil y ordenador muestren lo mismo.
ALTER TABLE public.nutrition_profile
  ADD COLUMN IF NOT EXISTS kcal_mantenimiento integer CHECK (kcal_mantenimiento IS NULL OR kcal_mantenimiento BETWEEN 1000 AND 6000),
  ADD COLUMN IF NOT EXISTS menu_activo_id uuid REFERENCES public.menus(id) ON DELETE SET NULL;

-- 3. Menús: alimentos ya marcados en la lista de la compra (ids de alimentos).
ALTER TABLE public.menus
  ADD COLUMN IF NOT EXISTS compra_marcados text[] NOT NULL DEFAULT '{}';

-- 4. Registro de peso corporal (una medida por día).
CREATE TABLE IF NOT EXISTS public.weight_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  peso_kg numeric(5,1) NOT NULL CHECK (peso_kg BETWEEN 20 AND 400),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fecha)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_log TO authenticated;
GRANT ALL ON public.weight_log TO service_role;
ALTER TABLE public.weight_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "weight_log_select_own" ON public.weight_log;
DROP POLICY IF EXISTS "weight_log_insert_own" ON public.weight_log;
DROP POLICY IF EXISTS "weight_log_update_own" ON public.weight_log;
DROP POLICY IF EXISTS "weight_log_delete_own" ON public.weight_log;
CREATE POLICY "weight_log_select_own" ON public.weight_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "weight_log_insert_own" ON public.weight_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "weight_log_update_own" ON public.weight_log FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "weight_log_delete_own" ON public.weight_log FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Funciones para que cada operación sobre un menú sea una sola transacción:
-- si algo falla a mitad, no queda nada a medias. Son SECURITY INVOKER: se
-- aplican las mismas políticas RLS que a una consulta normal. El parámetro
-- p_user_id solo lo usa quien ya se salta RLS (service_role, pruebas); un
-- usuario normal siempre actúa como sí mismo.

-- 5.1 Crea un menú con sus alimentos: [{dia_semana, comida, food_id, gramos}, ...]
CREATE OR REPLACE FUNCTION public.crear_menu(
  p_nombre text,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS public.menus
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := COALESCE(p_user_id, auth.uid());
  v_menu public.menus;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;

  INSERT INTO public.menus (user_id, nombre)
  VALUES (v_user, p_nombre)
  RETURNING * INTO v_menu;

  INSERT INTO public.menu_items (user_id, menu_id, dia_semana, comida, food_id, gramos, orden)
  SELECT v_user, v_menu.id,
         (t.e ->> 'dia_semana')::integer,
         t.e ->> 'comida',
         (t.e ->> 'food_id')::uuid,
         (t.e ->> 'gramos')::numeric,
         (t.n - 1)::integer
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, n);

  RETURN v_menu;
END;
$$;

-- 5.2 Sustituye los alimentos de un día (o solo de algunas comidas; p_comidas
-- NULL = todo el día) por los nuevos. Devuelve las filas creadas.
CREATE OR REPLACE FUNCTION public.reemplazar_dia(
  p_menu_id uuid,
  p_dia integer,
  p_comidas text[],
  p_items jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS SETOF public.menu_items
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := COALESCE(p_user_id, auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.menus WHERE id = p_menu_id AND user_id = v_user) THEN
    RAISE EXCEPTION 'El menú no existe';
  END IF;

  DELETE FROM public.menu_items
  WHERE menu_id = p_menu_id
    AND user_id = v_user
    AND dia_semana = p_dia
    AND (p_comidas IS NULL OR comida = ANY (p_comidas));

  RETURN QUERY
  WITH nuevos AS (
    INSERT INTO public.menu_items (user_id, menu_id, dia_semana, comida, food_id, gramos, orden)
    SELECT v_user, p_menu_id, p_dia,
           t.e ->> 'comida',
           (t.e ->> 'food_id')::uuid,
           (t.e ->> 'gramos')::numeric,
           (t.n - 1)::integer
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, n)
    RETURNING *
  )
  SELECT * FROM nuevos ORDER BY orden;
END;
$$;

-- 5.3 Cambia los gramos de varios alimentos a la vez: [{id, gramos}, ...].
-- Devuelve cuántas filas se han actualizado.
CREATE OR REPLACE FUNCTION public.actualizar_gramos(p_cambios jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.menu_items AS m
  SET gramos = c.gramos
  FROM jsonb_to_recordset(p_cambios) AS c(id uuid, gramos numeric)
  WHERE m.id = c.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_menu(text, jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reemplazar_dia(uuid, integer, text[], jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.actualizar_gramos(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_menu(text, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reemplazar_dia(uuid, integer, text[], jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.actualizar_gramos(jsonb) TO authenticated, service_role;

-- Que la API de Supabase vea enseguida las columnas y funciones nuevas.
NOTIFY pgrst, 'reload schema';
