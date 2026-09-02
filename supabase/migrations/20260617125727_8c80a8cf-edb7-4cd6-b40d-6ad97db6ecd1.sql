
-- Restrict EXECUTE on issue_invoice to authenticated users only
REVOKE ALL ON FUNCTION public.issue_invoice(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_invoice(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.issue_invoice(uuid) TO authenticated;

-- Add owner-scoped INSERT policy on invoice_logs
CREATE POLICY "logs_insert_own"
ON public.invoice_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.invoices
    WHERE id = invoice_id AND user_id = auth.uid()
  )
);
