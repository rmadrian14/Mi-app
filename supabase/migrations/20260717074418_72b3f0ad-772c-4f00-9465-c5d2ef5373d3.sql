
-- Fiscal deadlines: shared, read-only for all authenticated users
CREATE TABLE public.fiscal_deadlines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deadline_date DATE NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fiscal_deadlines TO authenticated;
GRANT ALL ON public.fiscal_deadlines TO service_role;

ALTER TABLE public.fiscal_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fiscal deadlines"
  ON public.fiscal_deadlines FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_fiscal_deadlines_date ON public.fiscal_deadlines(deadline_date);

-- Seed initial deadlines
INSERT INTO public.fiscal_deadlines (deadline_date, title) VALUES
  ('2026-07-20', 'Modelo 303 — IVA 2º trimestre'),
  ('2026-07-20', 'Modelo 130/131 — Pago fraccionado IRPF 2º trimestre'),
  ('2026-07-20', 'Modelo 111 — Retenciones trabajadores/profesionales 2º trimestre'),
  ('2026-07-20', 'Modelo 349 — Operaciones intracomunitarias 2º trimestre'),
  ('2026-07-27', 'Modelo 200 — Impuesto de Sociedades (ejercicio natural)'),
  ('2026-10-20', 'Modelo 303 — IVA 3er trimestre'),
  ('2026-10-20', 'Modelo 130/131 — Pago fraccionado IRPF 3er trimestre'),
  ('2026-10-20', 'Modelo 111 — Retenciones trabajadores/profesionales 3er trimestre'),
  ('2026-10-20', 'Modelo 349 — Operaciones intracomunitarias 3er trimestre'),
  ('2027-01-30', 'Modelo 303 — IVA 4º trimestre'),
  ('2027-01-30', 'Modelo 130/131 — Pago fraccionado IRPF 4º trimestre'),
  ('2027-01-30', 'Modelo 349 — Operaciones intracomunitarias 4º trimestre');

-- User tasks: private per user
CREATE TYPE public.task_priority AS ENUM ('urgente', 'importante', 'rutinaria');

CREATE TABLE public.user_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  task_date DATE NOT NULL,
  priority public.task_priority NOT NULL DEFAULT 'rutinaria',
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tasks TO authenticated;
GRANT ALL ON public.user_tasks TO service_role;

ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tasks"
  ON public.user_tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks"
  ON public.user_tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.user_tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.user_tasks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_tasks_user_date ON public.user_tasks(user_id, task_date);

CREATE TRIGGER trg_user_tasks_updated_at
  BEFORE UPDATE ON public.user_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
