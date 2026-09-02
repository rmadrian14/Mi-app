ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'empresa'
    CHECK (tipo IN ('particular','empresa','autonomo')),
  ADD COLUMN IF NOT EXISTS nif_iva text;