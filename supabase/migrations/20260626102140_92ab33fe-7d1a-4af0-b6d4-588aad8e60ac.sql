ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_rectifying_of uuid
    REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoices_is_rectifying_of_idx
  ON public.invoices(is_rectifying_of);