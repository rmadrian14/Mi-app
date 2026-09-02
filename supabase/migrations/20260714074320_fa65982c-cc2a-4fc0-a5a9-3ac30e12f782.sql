ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS tipo_actividad text NOT NULL DEFAULT 'profesional',
  ADD COLUMN IF NOT EXISTS categoria_irpf text NOT NULL DEFAULT 'profesional',
  ADD COLUMN IF NOT EXISTS fecha_alta date,
  ADD COLUMN IF NOT EXISTS renunciar_reducido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acogido_oss boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ventas_ue_acumuladas numeric NOT NULL DEFAULT 0;