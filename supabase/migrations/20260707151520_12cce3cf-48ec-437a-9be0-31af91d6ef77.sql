-- Estado de cobro por factura (tesorería vs devengo)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS cobrada_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS metodo_cobro text NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_cobrada_at
  ON public.invoices (usuario_id, cobrada_at);

-- Cuota autónomos como concepto propio dentro de gastos fijos
ALTER TABLE public.fixed_costs
  ADD COLUMN IF NOT EXISTS is_cuota_autonomos boolean NOT NULL DEFAULT false;