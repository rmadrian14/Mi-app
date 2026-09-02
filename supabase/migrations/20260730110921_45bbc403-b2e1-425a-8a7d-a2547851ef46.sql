CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.emitir_factura(
  _workspace_id uuid,
  _tipo_factura text,
  _regimen_iva text,
  _nif_receptor text,
  _nombre_receptor text,
  _base_imponible numeric,
  _iva_porcentaje numeric,
  _irpf_porcentaje numeric,
  _total_factura numeric,
  _fecha_operacion timestamptz,
  _is_rectifying_of uuid DEFAULT NULL
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  caller uuid := auth.uid();
  inv public.invoices;
  emisor_nif text;
  prefix text;
  yr int;
  next_seq int;
  numero text;
  huella_anterior text;
  fecha_gen timestamptz := now();
  cadena text;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF NOT public.is_workspace_member(_workspace_id, caller) THEN
    RAISE EXCEPTION 'No perteneces a este workspace';
  END IF;

  SELECT nif INTO emisor_nif FROM public.company_settings
  WHERE workspace_id = _workspace_id LIMIT 1;
  IF emisor_nif IS NULL OR emisor_nif = '' THEN
    RAISE EXCEPTION 'Configura primero el NIF del emisor en Datos de la empresa';
  END IF;

  yr := EXTRACT(YEAR FROM _fecha_operacion)::int;
  prefix := CASE WHEN _tipo_factura LIKE 'R%' THEN 'R-' || yr || '-' ELSE yr || '-' END;

  SELECT COALESCE(MAX((regexp_match(numero_factura, '(\d+)$'))[1]::int), 0) + 1
  INTO next_seq
  FROM public.invoices
  WHERE workspace_id = _workspace_id AND numero_factura LIKE prefix || '%';

  numero := prefix || lpad(next_seq::text, 3, '0');

  SELECT hash_verifactu INTO huella_anterior
  FROM public.invoices
  WHERE workspace_id = _workspace_id AND hash_verifactu IS NOT NULL
  ORDER BY fecha_hora_gen_registro DESC NULLS LAST
  LIMIT 1;

  cadena :=
    'IDEmisorFactura=' || emisor_nif ||
    '&NumSerieFactura=' || numero ||
    '&FechaExpedicionFactura=' || to_char(_fecha_operacion, 'DD-MM-YYYY') ||
    '&TipoFactura=' || _tipo_factura ||
    '&CuotaTotal=' || to_char(_base_imponible * _iva_porcentaje / 100, 'FM999999990.00') ||
    '&ImporteTotal=' || to_char(_total_factura, 'FM999999990.00') ||
    '&Huella=' || COALESCE(huella_anterior, '') ||
    '&FechaHoraHusoGenRegistro=' || to_char(fecha_gen, 'YYYY-MM-DD"T"HH24:MI:SS');

  INSERT INTO public.invoices (
    usuario_id, workspace_id, numero_factura, fecha_emision, fecha_operacion,
    tipo_factura, regimen_iva, nif_receptor, nombre_receptor,
    base_imponible, iva_porcentaje, irpf_porcentaje, total_factura,
    status, hash_verifactu, fecha_hora_gen_registro, is_rectifying_of
  ) VALUES (
    caller, _workspace_id, numero, now(), _fecha_operacion,
    _tipo_factura, _regimen_iva, _nif_receptor, _nombre_receptor,
    _base_imponible, _iva_porcentaje, _irpf_porcentaje, _total_factura,
    'sent_to_aeat', encode(extensions.digest(cadena, 'sha256'), 'hex'), fecha_gen,
    _is_rectifying_of
  )
  RETURNING * INTO inv;

  RETURN inv;
END;
$$;

REVOKE ALL ON FUNCTION public.emitir_factura(uuid, text, text, text, text, numeric, numeric, numeric, numeric, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emitir_factura(uuid, text, text, text, text, numeric, numeric, numeric, numeric, timestamptz, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.invoices_lock_issued()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'sent_to_aeat' THEN
      RAISE EXCEPTION 'No se puede borrar una factura ya emitida (%).', OLD.numero_factura;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'sent_to_aeat' THEN
      IF NEW.numero_factura IS DISTINCT FROM OLD.numero_factura
        OR NEW.hash_verifactu IS DISTINCT FROM OLD.hash_verifactu
        OR NEW.base_imponible IS DISTINCT FROM OLD.base_imponible
        OR NEW.total_factura IS DISTINCT FROM OLD.total_factura
        OR NEW.tipo_factura IS DISTINCT FROM OLD.tipo_factura
        OR NEW.nif_receptor IS DISTINCT FROM OLD.nif_receptor
        OR NEW.iva_porcentaje IS DISTINCT FROM OLD.iva_porcentaje
      THEN
        RAISE EXCEPTION 'La factura % ya está emitida y es inmutable.', OLD.numero_factura;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoices_lock ON public.invoices;
CREATE TRIGGER trg_invoices_lock
  BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_lock_issued();