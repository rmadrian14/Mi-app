GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, public.workspace_role[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_write_workspace(uuid, uuid) TO authenticated, anon;