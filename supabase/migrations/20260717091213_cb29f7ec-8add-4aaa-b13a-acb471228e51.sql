ALTER TABLE public.company_settings 
  ADD COLUMN IF NOT EXISTS opera_ue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inscrito_roi boolean NOT NULL DEFAULT false;