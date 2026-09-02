
CREATE TABLE public.fixed_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  period text NOT NULL CHECK (period IN ('mensual','anual')) DEFAULT 'mensual',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_costs TO authenticated;
GRANT ALL ON public.fixed_costs TO service_role;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fixed_costs_select_own" ON public.fixed_costs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "fixed_costs_insert_own" ON public.fixed_costs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fixed_costs_update_own" ON public.fixed_costs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fixed_costs_delete_own" ON public.fixed_costs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX fixed_costs_user_idx ON public.fixed_costs(user_id);

CREATE TABLE public.variable_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variable_costs TO authenticated;
GRANT ALL ON public.variable_costs TO service_role;
ALTER TABLE public.variable_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variable_costs_select_own" ON public.variable_costs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "variable_costs_insert_own" ON public.variable_costs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "variable_costs_update_own" ON public.variable_costs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "variable_costs_delete_own" ON public.variable_costs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX variable_costs_user_idx ON public.variable_costs(user_id);
CREATE INDEX variable_costs_date_idx ON public.variable_costs(user_id, date);
