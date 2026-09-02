
-- =========================================================
-- Phase 1: Multi-NIF workspaces foundation
-- =========================================================

-- 1. Role enum
CREATE TYPE public.workspace_role AS ENUM ('owner','admin','gestor','viewer');

-- 2. workspaces table
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  nif text,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workspaces_owner_idx ON public.workspaces(owner_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;

-- 3. workspace_members table
CREATE TABLE public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'gestor',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX workspace_members_user_idx ON public.workspace_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;

-- 4. Security-definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_ws uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _ws AND user_id = _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_ws uuid, _uid uuid, _roles public.workspace_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _ws AND user_id = _uid AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_workspace(_ws uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_workspace_role(_ws, _uid, ARRAY['owner','admin','gestor']::public.workspace_role[]);
$$;

-- 5. Enable RLS + policies on workspace tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select_member ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id, auth.uid()));
CREATE POLICY ws_insert_owner ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY ws_update_admin ON public.workspaces FOR UPDATE
  USING (public.has_workspace_role(id, auth.uid(), ARRAY['owner','admin']::public.workspace_role[]))
  WITH CHECK (public.has_workspace_role(id, auth.uid(), ARRAY['owner','admin']::public.workspace_role[]));
CREATE POLICY ws_delete_owner ON public.workspaces FOR DELETE
  USING (auth.uid() = owner_user_id);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY wsm_select_member ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY wsm_insert_admin ON public.workspace_members FOR INSERT
  WITH CHECK (
    -- Bootstrap: allow inserting yourself as owner when creating a workspace
    (auth.uid() = user_id AND role = 'owner'
      AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_user_id = auth.uid()))
    OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.workspace_role[])
  );
CREATE POLICY wsm_update_admin ON public.workspace_members FOR UPDATE
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.workspace_role[]))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.workspace_role[]));
CREATE POLICY wsm_delete_admin ON public.workspace_members FOR DELETE
  USING (
    public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.workspace_role[])
    OR auth.uid() = user_id  -- allow self-removal
  );

-- Trigger to keep updated_at
CREATE TRIGGER workspaces_set_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 6. Backfill: create a workspace per existing user
-- =========================================================
-- Every user that owns any data (invoices, costs, clients, company_settings)
-- gets a workspace, becomes its owner, and their existing rows are relinked.

WITH all_users AS (
  SELECT DISTINCT user_id AS uid FROM public.company_settings
  UNION SELECT DISTINCT user_id FROM public.clients
  UNION SELECT DISTINCT user_id FROM public.fixed_costs
  UNION SELECT DISTINCT user_id FROM public.variable_costs
  UNION SELECT DISTINCT usuario_id FROM public.invoices
),
inserted AS (
  INSERT INTO public.workspaces (name, nif, owner_user_id)
  SELECT
    COALESCE(NULLIF(cs.legal_name, ''), 'Mi empresa'),
    NULLIF(cs.nif, ''),
    au.uid
  FROM all_users au
  LEFT JOIN public.company_settings cs ON cs.user_id = au.uid
  RETURNING id, owner_user_id
)
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT id, owner_user_id, 'owner' FROM inserted;

-- =========================================================
-- 7. Add workspace_id to data tables (nullable first, backfill, then NOT NULL)
-- =========================================================

ALTER TABLE public.company_settings ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.clients          ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.fixed_costs      ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.variable_costs   ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.invoices         ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Backfill using owner_user_id = data.user_id (1 workspace per user at this point)
UPDATE public.company_settings d SET workspace_id = w.id FROM public.workspaces w WHERE w.owner_user_id = d.user_id;
UPDATE public.clients          d SET workspace_id = w.id FROM public.workspaces w WHERE w.owner_user_id = d.user_id;
UPDATE public.fixed_costs      d SET workspace_id = w.id FROM public.workspaces w WHERE w.owner_user_id = d.user_id;
UPDATE public.variable_costs   d SET workspace_id = w.id FROM public.workspaces w WHERE w.owner_user_id = d.user_id;
UPDATE public.invoices         d SET workspace_id = w.id FROM public.workspaces w WHERE w.owner_user_id = d.usuario_id;

ALTER TABLE public.company_settings ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.clients          ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.fixed_costs      ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.variable_costs   ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.invoices         ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX company_settings_ws_idx ON public.company_settings(workspace_id);
CREATE INDEX clients_ws_idx          ON public.clients(workspace_id);
CREATE INDEX fixed_costs_ws_idx      ON public.fixed_costs(workspace_id);
CREATE INDEX variable_costs_ws_idx   ON public.variable_costs(workspace_id);
CREATE INDEX invoices_ws_idx         ON public.invoices(workspace_id);

-- company_settings should be one row per workspace
CREATE UNIQUE INDEX company_settings_ws_unique ON public.company_settings(workspace_id);

-- =========================================================
-- 8. Replace RLS policies to use workspace membership
-- =========================================================

-- clients
DROP POLICY IF EXISTS own_clients ON public.clients;
CREATE POLICY clients_select ON public.clients FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY clients_write ON public.clients FOR INSERT
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()));
CREATE POLICY clients_update ON public.clients FOR UPDATE
  USING (public.can_write_workspace(workspace_id, auth.uid()))
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()));
CREATE POLICY clients_delete ON public.clients FOR DELETE
  USING (public.can_write_workspace(workspace_id, auth.uid()));

-- company_settings
DROP POLICY IF EXISTS own_company_settings ON public.company_settings;
CREATE POLICY cs_select ON public.company_settings FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY cs_insert ON public.company_settings FOR INSERT
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()));
CREATE POLICY cs_update ON public.company_settings FOR UPDATE
  USING (public.can_write_workspace(workspace_id, auth.uid()))
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()));
CREATE POLICY cs_delete ON public.company_settings FOR DELETE
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::public.workspace_role[]));

-- fixed_costs
DROP POLICY IF EXISTS fixed_costs_select_own ON public.fixed_costs;
DROP POLICY IF EXISTS fixed_costs_insert_own ON public.fixed_costs;
DROP POLICY IF EXISTS fixed_costs_update_own ON public.fixed_costs;
DROP POLICY IF EXISTS fixed_costs_delete_own ON public.fixed_costs;
CREATE POLICY fc_select ON public.fixed_costs FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY fc_insert ON public.fixed_costs FOR INSERT
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()) AND auth.uid() = user_id);
CREATE POLICY fc_update ON public.fixed_costs FOR UPDATE
  USING (public.can_write_workspace(workspace_id, auth.uid()))
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()));
CREATE POLICY fc_delete ON public.fixed_costs FOR DELETE
  USING (public.can_write_workspace(workspace_id, auth.uid()));

-- variable_costs
DROP POLICY IF EXISTS variable_costs_select_own ON public.variable_costs;
DROP POLICY IF EXISTS variable_costs_insert_own ON public.variable_costs;
DROP POLICY IF EXISTS variable_costs_update_own ON public.variable_costs;
DROP POLICY IF EXISTS variable_costs_delete_own ON public.variable_costs;
CREATE POLICY vc_select ON public.variable_costs FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY vc_insert ON public.variable_costs FOR INSERT
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()) AND auth.uid() = user_id);
CREATE POLICY vc_update ON public.variable_costs FOR UPDATE
  USING (public.can_write_workspace(workspace_id, auth.uid()))
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()));
CREATE POLICY vc_delete ON public.variable_costs FOR DELETE
  USING (public.can_write_workspace(workspace_id, auth.uid()));

-- invoices
DROP POLICY IF EXISTS invoices_select_own ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_own ON public.invoices;
DROP POLICY IF EXISTS invoices_update_own ON public.invoices;
DROP POLICY IF EXISTS invoices_delete_own ON public.invoices;
CREATE POLICY inv_select ON public.invoices FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY inv_insert ON public.invoices FOR INSERT
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()) AND auth.uid() = usuario_id);
CREATE POLICY inv_update ON public.invoices FOR UPDATE
  USING (public.can_write_workspace(workspace_id, auth.uid()))
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()));
CREATE POLICY inv_delete ON public.invoices FOR DELETE
  USING (public.can_write_workspace(workspace_id, auth.uid()));

-- =========================================================
-- 9. Auto-provision workspace for new users
-- =========================================================
CREATE OR REPLACE FUNCTION public.provision_workspace_for_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_ws uuid;
BEGIN
  INSERT INTO public.workspaces (name, owner_user_id)
  VALUES ('Mi empresa', NEW.id)
  RETURNING id INTO new_ws;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_ws, NEW.id, 'owner');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_ws ON auth.users;
CREATE TRIGGER on_auth_user_created_ws
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.provision_workspace_for_new_user();
