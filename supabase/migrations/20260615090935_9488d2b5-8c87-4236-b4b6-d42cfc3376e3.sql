
CREATE OR REPLACE FUNCTION public.deny_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'invoice_logs is append-only'; END $$;
