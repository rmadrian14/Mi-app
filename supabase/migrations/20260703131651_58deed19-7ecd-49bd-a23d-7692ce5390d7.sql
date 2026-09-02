
ALTER TABLE public.variable_costs
  ADD COLUMN IF NOT EXISTS iva_percent numeric(5,2) NOT NULL DEFAULT 21
    CHECK (iva_percent IN (0, 4, 10, 21)),
  ADD COLUMN IF NOT EXISTS deducible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS category text;
