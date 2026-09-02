
-- 1) Remove client-side INSERT/UPDATE on user_subscriptions (privilege escalation fix)
DROP POLICY IF EXISTS "subs_insert_own" ON public.user_subscriptions;
DROP POLICY IF EXISTS "subs_update_own" ON public.user_subscriptions;

-- Auto-provision default 'basic' row for new users so app flows keep working
CREATE OR REPLACE FUNCTION public.provision_user_subscription_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (id, plan_type, monthly_limit)
  VALUES (NEW.id, 'basic', 10)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_provision_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_provision_subscription
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.provision_user_subscription_for_new_user();

-- Backfill existing users missing a subscription row
INSERT INTO public.user_subscriptions (id, plan_type, monthly_limit)
SELECT u.id, 'basic', 10 FROM auth.users u
LEFT JOIN public.user_subscriptions s ON s.id = u.id
WHERE s.id IS NULL;

-- 2) Restrict SECURITY DEFINER functions to authenticated users only
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write_workspace(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, public.workspace_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_workspace_invite(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_workspace(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, public.workspace_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(text) TO authenticated, service_role;
