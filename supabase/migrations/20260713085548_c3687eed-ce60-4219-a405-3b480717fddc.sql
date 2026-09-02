-- workspace_invites
CREATE TABLE public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'gestor',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wi_workspace ON public.workspace_invites(workspace_id);
CREATE INDEX idx_wi_email ON public.workspace_invites(lower(email));
CREATE INDEX idx_wi_token ON public.workspace_invites(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invites TO authenticated;
GRANT ALL ON public.workspace_invites TO service_role;

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Admins/owners del workspace pueden ver invitaciones
CREATE POLICY wi_select_admin ON public.workspace_invites FOR SELECT
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.workspace_role[]));

-- Admins/owners pueden crear invitaciones
CREATE POLICY wi_insert_admin ON public.workspace_invites FOR INSERT
  WITH CHECK (
    public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.workspace_role[])
    AND invited_by = auth.uid()
  );

-- Admins/owners pueden actualizar (marcar aceptada / cancelar)
CREATE POLICY wi_update_admin ON public.workspace_invites FOR UPDATE
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.workspace_role[]))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.workspace_role[]));

-- Admins/owners pueden borrar
CREATE POLICY wi_delete_admin ON public.workspace_invites FOR DELETE
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.workspace_role[]));

-- Función para aceptar invitación por token. SECURITY DEFINER para saltarse RLS al insertar la membresía.
CREATE OR REPLACE FUNCTION public.accept_workspace_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.workspace_invites%ROWTYPE;
  uid uuid := auth.uid();
  user_email text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para aceptar la invitación.';
  END IF;

  SELECT * INTO inv FROM public.workspace_invites WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitación no encontrada.';
  END IF;
  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta invitación ya fue aceptada.';
  END IF;
  IF inv.expires_at < now() THEN
    RAISE EXCEPTION 'La invitación ha expirado.';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid;
  IF lower(user_email) <> lower(inv.email) THEN
    RAISE EXCEPTION 'Esta invitación es para % pero tu sesión es %.', inv.email, user_email;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (inv.workspace_id, uid, inv.role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.workspace_invites
    SET accepted_at = now(), accepted_by = uid
    WHERE id = inv.id;

  RETURN inv.workspace_id;
END $$;

REVOKE ALL ON FUNCTION public.accept_workspace_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(text) TO authenticated;