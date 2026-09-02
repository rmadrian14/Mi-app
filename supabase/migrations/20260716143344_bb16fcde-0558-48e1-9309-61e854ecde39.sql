
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS tipo_emisor text NOT NULL DEFAULT 'autonomo',
  ADD COLUMN IF NOT EXISTS territorio text NOT NULL DEFAULT 'peninsula_baleares',
  ADD COLUMN IF NOT EXISTS vende_ue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
