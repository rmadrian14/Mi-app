
-- Diario de comidas: lo que se come cada día, con sus calorías y macros ya
-- calculados. Se puede ejecutar más de una vez y no toca ninguna tabla existente.
--
-- Cada entrada guarda una "foto" de los valores en el momento de añadirla (nombre,
-- gramos, kcal y macros). Así el historial no cambia si luego editas o borras el
-- alimento de la biblioteca: food_id pasa a NULL pero la entrada se conserva.
-- Las entradas "a mano" (algo suelto, un plato de restaurante) no tienen alimento
-- ni gramos.

CREATE TABLE IF NOT EXISTS public.food_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  comida text NOT NULL CHECK (comida IN ('desayuno', 'media_manana', 'comida', 'merienda', 'cena')),
  food_id uuid REFERENCES public.foods(id) ON DELETE SET NULL,
  nombre text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 120),
  gramos numeric(7,1) CHECK (gramos IS NULL OR gramos > 0),
  kcal numeric(7,1) NOT NULL CHECK (kcal >= 0 AND kcal <= 20000),
  proteina_g numeric(6,1) NOT NULL DEFAULT 0 CHECK (proteina_g >= 0 AND proteina_g <= 2000),
  grasa_g numeric(6,1) NOT NULL DEFAULT 0 CHECK (grasa_g >= 0 AND grasa_g <= 2000),
  hidratos_g numeric(6,1) NOT NULL DEFAULT 0 CHECK (hidratos_g >= 0 AND hidratos_g <= 2000),
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Una entrada ligada a un alimento siempre lleva gramos.
  CHECK (food_id IS NULL OR gramos IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS food_log_user_fecha_idx ON public.food_log (user_id, fecha);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_log TO authenticated;
GRANT ALL ON public.food_log TO service_role;
ALTER TABLE public.food_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "food_log_select_own" ON public.food_log;
DROP POLICY IF EXISTS "food_log_insert_own" ON public.food_log;
DROP POLICY IF EXISTS "food_log_update_own" ON public.food_log;
DROP POLICY IF EXISTS "food_log_delete_own" ON public.food_log;
CREATE POLICY "food_log_select_own" ON public.food_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "food_log_insert_own" ON public.food_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "food_log_update_own" ON public.food_log FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "food_log_delete_own" ON public.food_log FOR DELETE TO authenticated USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
