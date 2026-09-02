-- VeriFactu explicit fiscal columns + stricter issuance validation

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_nif TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS base_imponible NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS iva_porcentaje NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS iva_cuota NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS hash_control TEXT;

-- Rewrite issuer function: require client with NIF, populate explicit fiscal columns
CREATE OR REPLACE FUNCTION public.issue_invoice(_invoice_id uuid)
 RETURNS public.invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  avg_vat NUMERIC(5,2);
  hash_input TEXT;
  new_hash TEXT;
  now_ts TIMESTAMPTZ := now();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO inv FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF inv.user_id <> caller THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF inv.status = 'issued' THEN RAISE EXCEPTION 'Invoice already issued'; END IF;

  SELECT * INTO cs FROM public.company_settings WHERE user_id = caller;
  IF NOT FOUND OR COALESCE(cs.nif,'') = '' OR COALESCE(cs.legal_name,'') = '' THEN
    RAISE EXCEPTION 'Configura primero los datos fiscales del emisor (NIF y razón social).';
  END IF;

  -- VeriFactu: client with NIF is mandatory
  IF inv.client_id IS NULL THEN
    RAISE EXCEPTION 'Error: Es obligatorio asignar un cliente con NIF para poder emitir la factura legal';
  END IF;
  SELECT * INTO cli FROM public.clients WHERE id = inv.client_id;
  IF NOT FOUND OR COALESCE(cli.nif,'') = '' OR COALESCE(cli.name,'') = '' THEN
    RAISE EXCEPTION 'Error: Es obligatorio asignar un cliente con NIF para poder emitir la factura legal';
  END IF;

  SELECT
    COALESCE(SUM(line_total),0),
    COALESCE(SUM(line_total * vat_rate / 100),0),
    COALESCE(AVG(NULLIF(vat_rate,0)),21)
  INTO base_total, vat_total, avg_vat
  FROM public.invoice_items WHERE invoice_id = inv.id;

  IF base_total <= 0 THEN
    RAISE EXCEPTION 'La factura debe tener al menos una línea con importe.';
  END IF;

  series := CASE WHEN inv.invoice_type = 'R' THEN 'R' ELSE 'ORD' END;
  yr := EXTRACT(YEAR FROM now_ts)::INT;

  SELECT COALESCE(MAX(fiscal_seq), 0) + 1 INTO next_seq
  FROM public.invoices
  WHERE user_id = caller AND fiscal_series = series AND fiscal_year = yr
  FOR UPDATE;

  fmt_number := CASE WHEN series='R'
    THEN 'R-' || yr || '-' || lpad(next_seq::text, 4, '0')
    ELSE yr || '-' || lpad(next_seq::text, 4, '0') END;

  SELECT hash INTO prev_hash
  FROM public.invoices
  WHERE user_id = caller AND status = 'issued' AND hash IS NOT NULL
  ORDER BY issued_at DESC NULLS LAST LIMIT 1;

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
    base_imponible = base_total,
    iva_porcentaje = avg_vat,
    iva_cuota = vat_total,
    hash_control = new_hash,
    customer_nif = cli.nif,
    customer_name = cli.name,
    previous_hash = prev_hash,
    hash = new_hash,
    issuer_snapshot = to_jsonb(cs),
    client_snapshot = to_jsonb(cli)
  WHERE id = inv.id
  RETURNING * INTO inv;

  INSERT INTO public.invoice_logs (invoice_id, user_id, action, app_name, app_version, hash, payload)
  VALUES (inv.id, caller, 'EMISIÓN', 'Estimac', 'v1.0', new_hash,
          jsonb_build_object('invoice_number', fmt_number, 'total', grand_total,
                             'previous_hash', prev_hash, 'customer_nif', cli.nif));

  RETURN inv;
END $function$;