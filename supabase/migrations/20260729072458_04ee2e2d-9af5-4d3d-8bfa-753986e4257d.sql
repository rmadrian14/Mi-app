ALTER TABLE public.variable_costs
  ADD COLUMN IF NOT EXISTS archivo_nombre text;

CREATE POLICY "miembros del workspace suben justificantes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'justificantes'
  AND public.is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
);

CREATE POLICY "miembros del workspace ven justificantes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'justificantes'
  AND public.is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
);

CREATE POLICY "miembros del workspace borran justificantes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'justificantes'
  AND public.is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
);