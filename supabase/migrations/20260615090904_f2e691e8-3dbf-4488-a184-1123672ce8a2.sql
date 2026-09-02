
-- =========================================================
-- VeriFactu invoicing schema
-- =========================================================

-- ENUMS
CREATE TYPE public.invoice_status AS ENUM ('draft_quote', 'draft_invoice', 'issued');
CREATE TYPE public.invoice_type AS ENUM ('F1', 'F2', 'R');

-- =========================================================
-- COMPANY_SETTINGS (one row per user)
-- =========================================================
CREATE TABLE public.company_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nif TEXT NOT NULL DEFAULT '',
  legal_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'España',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_company_settings" ON public.company_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- CLIENTS
-- =========================================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nif TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'España',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clients_user_idx ON public.clients(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_clients" ON public.clients
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- INVOICES
-- =========================================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,

  -- Document state
  status public.invoice_status NOT NULL DEFAULT 'draft_quote',
  invoice_type public.invoice_type NOT NULL DEFAULT 'F1',

  -- Fiscal numbering (assigned on issue)
  fiscal_series TEXT,            -- 'ORD' or 'R'
  fiscal_year INT,
  fiscal_seq INT,
  invoice_number TEXT,           -- e.g. '2026-0001' or 'R-2026-0001'
  issued_at TIMESTAMPTZ,         -- fecha de expedición
  issue_date DATE,

  -- Snapshots (frozen on issue)
  issuer_snapshot JSONB,
  client_snapshot JSONB,

  -- Amounts (calculated)
  base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 21,
  vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- VeriFactu chain
  previous_hash TEXT,
  hash TEXT,
  xml_payload TEXT,
  qr_url TEXT,

  -- Rectificative
  rectifies_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Uniqueness: invoice_number unique per user once assigned
  CONSTRAINT invoices_number_unique UNIQUE (user_id, invoice_number),
  -- Uniqueness: sequential numbers cannot be reused
  CONSTRAINT invoices_seq_unique UNIQUE (user_id, fiscal_series, fiscal_year, fiscal_seq)
);
CREATE INDEX invoices_user_status_idx ON public.invoices(user_id, status);
CREATE INDEX invoices_user_issued_at_idx ON public.invoices(user_id, issued_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_own" ON public.invoices
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoices_insert_own" ON public.invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status IN ('draft_quote','draft_invoice'));
CREATE POLICY "invoices_update_drafts" ON public.invoices
  FOR UPDATE USING (auth.uid() = user_id AND status IN ('draft_quote','draft_invoice'))
              WITH CHECK (auth.uid() = user_id AND status IN ('draft_quote','draft_invoice'));
CREATE POLICY "invoices_delete_drafts" ON public.invoices
  FOR DELETE USING (auth.uid() = user_id AND status IN ('draft_quote','draft_invoice'));

-- =========================================================
-- INVOICE_ITEMS
-- =========================================================
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 21,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0
);
CREATE INDEX invoice_items_invoice_idx ON public.invoice_items(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select_own" ON public.invoice_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));
CREATE POLICY "items_modify_own_drafts" ON public.invoice_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND i.user_id = auth.uid() AND i.status IN ('draft_quote','draft_invoice')
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND i.user_id = auth.uid() AND i.status IN ('draft_quote','draft_invoice')
  ));

-- =========================================================
-- INVOICE_LOGS (audit trail, append-only)
-- =========================================================
CREATE TABLE public.invoice_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  app_name TEXT NOT NULL DEFAULT 'Estimac',
  app_version TEXT NOT NULL DEFAULT 'v1.0',
  hash TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invoice_logs_invoice_idx ON public.invoice_logs(invoice_id);
GRANT SELECT, INSERT ON public.invoice_logs TO authenticated;
GRANT ALL ON public.invoice_logs TO service_role;
ALTER TABLE public.invoice_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_select_own" ON public.invoice_logs
  FOR SELECT USING (auth.uid() = user_id);
-- inserts only via SECURITY DEFINER issue_invoice()

-- =========================================================
-- updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_company_updated BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Trigger: prevent modification/deletion of issued invoices
-- (RLS already blocks them for the auth role; this is a hard
-- safeguard against service_role mistakes.)
-- =========================================================
CREATE OR REPLACE FUNCTION public.invoice_lock_issued()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'issued' THEN
      RAISE EXCEPTION 'Cannot delete an issued invoice (%).', OLD.invoice_number;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'issued' THEN
      -- Allow no fiscal changes once issued. We compare critical fields.
      IF NEW.status <> OLD.status
        OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
        OR NEW.hash IS DISTINCT FROM OLD.hash
        OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
        OR NEW.base_amount IS DISTINCT FROM OLD.base_amount
        OR NEW.vat_amount IS DISTINCT FROM OLD.vat_amount
        OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
        OR NEW.invoice_type IS DISTINCT FROM OLD.invoice_type
      THEN
        RAISE EXCEPTION 'Issued invoice (%) is immutable.', OLD.invoice_number;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_invoice_lock
  BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoice_lock_issued();

-- Also protect items: no edits if parent is issued
CREATE OR REPLACE FUNCTION public.invoice_items_lock_issued()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE st public.invoice_status;
BEGIN
  SELECT status INTO st FROM public.invoices
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF st = 'issued' THEN
    RAISE EXCEPTION 'Invoice items are immutable once the invoice is issued.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_invoice_items_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.invoice_items_lock_issued();

-- Audit logs are append-only
CREATE OR REPLACE FUNCTION public.deny_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'invoice_logs is append-only'; END $$;

CREATE TRIGGER trg_logs_immutable
  BEFORE UPDATE OR DELETE ON public.invoice_logs
  FOR EACH ROW EXECUTE FUNCTION public.deny_change();

-- =========================================================
-- issue_invoice(): assigns number, computes chained hash,
-- writes audit log. SECURITY DEFINER so it can update issued
-- rows and insert logs despite RLS.
-- =========================================================
CREATE OR REPLACE FUNCTION public.issue_invoice(_invoice_id UUID)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.invoices;
  caller UUID := auth.uid();
  cs public.company_settings;
  cli public.clients;
  series TEXT;
  yr INT;
  next_seq INT;
  fmt_number TEXT;
  prev_hash TEXT;
  base_total NUMERIC(12,2);
  vat_total NUMERIC(12,2);
  grand_total NUMERIC(12,2);
  hash_input TEXT;
  new_hash TEXT;
  now_ts TIMESTAMPTZ := now();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO inv FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF inv.user_id <> caller THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF inv.status = 'issued' THEN RAISE EXCEPTION 'Invoice already issued'; END IF;

  SELECT * INTO cs FROM public.company_settings WHERE user_id = caller;
  IF NOT FOUND OR cs.nif = '' OR cs.legal_name = '' THEN
    RAISE EXCEPTION 'Configura primero los datos fiscales del emisor (NIF y razón social).';
  END IF;

  IF inv.client_id IS NOT NULL THEN
    SELECT * INTO cli FROM public.clients WHERE id = inv.client_id;
  END IF;

  -- Compute totals from items
  SELECT
    COALESCE(SUM(line_total),0),
    COALESCE(SUM(line_total * vat_rate / 100),0)
  INTO base_total, vat_total
  FROM public.invoice_items WHERE invoice_id = inv.id;

  IF inv.invoice_type = 'R' THEN
    series := 'R';
  ELSE
    series := 'ORD';
  END IF;

  yr := EXTRACT(YEAR FROM now_ts)::INT;

  -- Next sequence per user/series/year, locking concurrent issues
  SELECT COALESCE(MAX(fiscal_seq), 0) + 1 INTO next_seq
  FROM public.invoices
  WHERE user_id = caller AND fiscal_series = series AND fiscal_year = yr
  FOR UPDATE;

  IF series = 'R' THEN
    fmt_number := 'R-' || yr || '-' || lpad(next_seq::text, 4, '0');
  ELSE
    fmt_number := yr || '-' || lpad(next_seq::text, 4, '0');
  END IF;

  -- Previous hash (last issued invoice for this user, any series)
  SELECT hash INTO prev_hash
  FROM public.invoices
  WHERE user_id = caller AND status = 'issued' AND hash IS NOT NULL
  ORDER BY issued_at DESC NULLS LAST
  LIMIT 1;

  grand_total := base_total + vat_total;

  hash_input := cs.nif || '|' || fmt_number || '|' || now_ts::text
                || '|' || grand_total::text || '|' || COALESCE(prev_hash, '');
  new_hash := encode(digest(hash_input, 'sha256'), 'hex');

  UPDATE public.invoices SET
    status = 'issued',
    fiscal_series = series,
    fiscal_year = yr,
    fiscal_seq = next_seq,
    invoice_number = fmt_number,
    issued_at = now_ts,
    issue_date = now_ts::date,
    base_amount = base_total,
    vat_amount = vat_total,
    total_amount = grand_total,
    previous_hash = prev_hash,
    hash = new_hash,
    issuer_snapshot = to_jsonb(cs),
    client_snapshot = to_jsonb(cli)
  WHERE id = inv.id
  RETURNING * INTO inv;

  INSERT INTO public.invoice_logs (invoice_id, user_id, action, app_name, app_version, hash, payload)
  VALUES (inv.id, caller, 'EMISIÓN', 'Estimac', 'v1.0', new_hash,
          jsonb_build_object(
            'invoice_number', fmt_number,
            'total', grand_total,
            'previous_hash', prev_hash
          ));

  RETURN inv;
END $$;

REVOKE ALL ON FUNCTION public.issue_invoice(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_invoice(UUID) TO authenticated;

-- Ensure pgcrypto is available for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
