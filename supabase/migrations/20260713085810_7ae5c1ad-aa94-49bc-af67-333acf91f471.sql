CREATE TABLE public.workspace_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  entity text,
  entity_id uuid,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wal_ws_created ON public.workspace_audit_log(workspace_id, created_at DESC);

GRANT SELECT, INSERT ON public.workspace_audit_log TO authenticated;
GRANT ALL ON public.workspace_audit_log TO service_role;

ALTER TABLE public.workspace_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY wal_select_member ON public.workspace_audit_log FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY wal_insert_writer ON public.workspace_audit_log FOR INSERT
  WITH CHECK (
    public.can_write_workspace(workspace_id, auth.uid())
    AND user_id = auth.uid()
  );

-- Append-only: reutiliza deny_change existente
CREATE TRIGGER wal_no_update BEFORE UPDATE ON public.workspace_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.deny_change();
CREATE TRIGGER wal_no_delete BEFORE DELETE ON public.workspace_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.deny_change();