
-- Drop existing invoicing schema
DROP FUNCTION IF EXISTS public.issue_invoice(uuid) CASCADE;
DROP TABLE IF EXISTS public.invoice_logs CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;

-- user_subscriptions
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type text NOT NULL DEFAULT 'basic' CHECK (plan_type IN ('basic','pro')),
  monthly_limit integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subs_select_own" ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "subs_insert_own" ON public.user_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "subs_update_own" ON public.user_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "subs_delete_own" ON public.user_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = id);

-- invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.user_subscriptions(id) ON DELETE CASCADE,
  numero_factura text NOT NULL,
  fecha_emision timestamptz NOT NULL DEFAULT now(),
  fecha_operacion timestamptz NOT NULL,
  tipo_factura text NOT NULL DEFAULT 'F1',
  regimen_iva text NOT NULL DEFAULT '01',
  nif_receptor text NOT NULL CHECK (char_length(nif_receptor) <= 9),
  nombre_receptor text NOT NULL,
  base_imponible numeric(12,2) NOT NULL,
  iva_porcentaje numeric(4,2) NOT NULL,
  irpf_porcentaje numeric(4,2) NOT NULL DEFAULT 0.00,
  total_factura numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent_to_aeat','error')),
  hash_verifactu text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_user_numero_unique UNIQUE (usuario_id, numero_factura)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_own" ON public.invoices
  FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "invoices_insert_own" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "invoices_update_own" ON public.invoices
  FOR UPDATE TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "invoices_delete_own" ON public.invoices
  FOR DELETE TO authenticated USING (auth.uid() = usuario_id);
