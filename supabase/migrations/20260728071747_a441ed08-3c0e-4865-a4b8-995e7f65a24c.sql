ALTER TABLE public.variable_costs
  ADD COLUMN IF NOT EXISTS pct_deducible numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS es_bien_inversion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS archivo_url text,
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'completo'
    CHECK (estado IN ('completo','incompleto'));

ALTER TABLE public.fixed_costs
  ADD COLUMN IF NOT EXISTS iva_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pct_deducible numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS date date NOT NULL DEFAULT CURRENT_DATE;