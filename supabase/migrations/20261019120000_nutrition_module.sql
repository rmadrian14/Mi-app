
-- Módulo de Alimentación: perfil nutricional (objetivos calculados y editables),
-- biblioteca de alimentos y menús semanales. Mismo patrón "por usuario" que el
-- módulo de Entrenamiento (RLS auth.uid() = user_id).

-- 1. El sexo se necesita para la ecuación de Mifflin-St Jeor. Va en el perfil
-- compartido con Entrenamiento (que ya guarda edad, peso y altura).
ALTER TABLE public.personal_profile
  ADD COLUMN sexo text CHECK (sexo IN ('hombre', 'mujer'));

-- 2. Perfil nutricional: respuestas del cuestionario y objetivos resultantes.
-- Los objetivos se pueden editar a mano (editado_manual = true).
CREATE TABLE public.nutrition_profile (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nivel_actividad text NOT NULL CHECK (nivel_actividad IN ('sedentario', 'ligero', 'activo', 'muy_activo')),
  dias_entreno integer NOT NULL DEFAULT 4 CHECK (dias_entreno BETWEEN 0 AND 7),
  objetivo text NOT NULL CHECK (objetivo IN ('perder_grasa', 'mantener', 'ganar_musculo', 'recomposicion')),
  ritmo text NOT NULL DEFAULT 'moderado' CHECK (ritmo IN ('suave', 'moderado')),
  comidas_por_dia integer NOT NULL DEFAULT 4 CHECK (comidas_por_dia BETWEEN 3 AND 5),
  restricciones text[] NOT NULL DEFAULT '{}',
  alimentos_excluidos text,
  kcal_objetivo integer NOT NULL CHECK (kcal_objetivo > 0),
  proteina_g integer NOT NULL CHECK (proteina_g >= 0),
  grasa_g integer NOT NULL CHECK (grasa_g >= 0),
  hidratos_g integer NOT NULL CHECK (hidratos_g >= 0),
  editado_manual boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_profile TO authenticated;
GRANT ALL ON public.nutrition_profile TO service_role;
ALTER TABLE public.nutrition_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrition_profile_select_own" ON public.nutrition_profile FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "nutrition_profile_insert_own" ON public.nutrition_profile FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nutrition_profile_update_own" ON public.nutrition_profile FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nutrition_profile_delete_own" ON public.nutrition_profile FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_nutrition_profile_updated_at
  BEFORE UPDATE ON public.nutrition_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Biblioteca de alimentos (valores por 100 g). "contiene" lleva los
-- alérgenos (los 14 de la UE) y marcas de dieta (carne, cerdo) para filtrar
-- según las restricciones del usuario.
CREATE TABLE public.foods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN
    ('proteina', 'hidrato', 'verdura', 'fruta', 'lacteo', 'grasa', 'legumbre', 'otro')),
  kcal_100 numeric(6,1) NOT NULL CHECK (kcal_100 >= 0 AND kcal_100 <= 900),
  proteina_100 numeric(5,1) NOT NULL CHECK (proteina_100 >= 0 AND proteina_100 <= 100),
  grasa_100 numeric(5,1) NOT NULL CHECK (grasa_100 >= 0 AND grasa_100 <= 100),
  hidratos_100 numeric(5,1) NOT NULL CHECK (hidratos_100 >= 0 AND hidratos_100 <= 100),
  gramos_unidad numeric(6,1) CHECK (gramos_unidad > 0),
  unidad_nombre text,
  porcion_min_g numeric(6,1) NOT NULL DEFAULT 10 CHECK (porcion_min_g > 0),
  porcion_max_g numeric(6,1) NOT NULL DEFAULT 300 CHECK (porcion_max_g > 0),
  comidas text[] NOT NULL DEFAULT '{}',
  contiene text[] NOT NULL DEFAULT '{}',
  origen text NOT NULL DEFAULT 'manual' CHECK (origen IN ('semilla', 'manual', 'openfoodfacts')),
  codigo_barras text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, nombre),
  CHECK (porcion_max_g >= porcion_min_g)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.foods TO authenticated;
GRANT ALL ON public.foods TO service_role;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "foods_select_own" ON public.foods FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "foods_insert_own" ON public.foods FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "foods_update_own" ON public.foods FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "foods_delete_own" ON public.foods FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX foods_user_idx ON public.foods(user_id);
CREATE TRIGGER trg_foods_updated_at
  BEFORE UPDATE ON public.foods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Menús (puede haber varios por usuario) y sus alimentos por día y comida.
-- dia_semana: 0 = lunes ... 6 = domingo (igual que routine_days).
CREATE TABLE public.menus (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menus TO authenticated;
GRANT ALL ON public.menus TO service_role;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menus_select_own" ON public.menus FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "menus_insert_own" ON public.menus FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "menus_update_own" ON public.menus FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "menus_delete_own" ON public.menus FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX menus_user_idx ON public.menus(user_id);
CREATE TRIGGER trg_menus_updated_at
  BEFORE UPDATE ON public.menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.menu_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  dia_semana integer NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  comida text NOT NULL CHECK (comida IN ('desayuno', 'media_manana', 'comida', 'merienda', 'cena')),
  food_id uuid NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  gramos numeric(7,1) NOT NULL CHECK (gramos > 0),
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_items_select_own" ON public.menu_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "menu_items_insert_own" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "menu_items_update_own" ON public.menu_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "menu_items_delete_own" ON public.menu_items FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX menu_items_menu_idx ON public.menu_items(menu_id, dia_semana);
CREATE INDEX menu_items_user_idx ON public.menu_items(user_id);
