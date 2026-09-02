import { supabase } from "@/integrations/supabase/client";

/**
 * Append an entry to workspace_audit_log. Silent-fail: audit is best-effort,
 * we never block a business action on it.
 */
export async function logAudit(params: {
  workspaceId: string;
  userId: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await (supabase as any).from("workspace_audit_log").insert({
      workspace_id: params.workspaceId,
      user_id: params.userId,
      action: params.action,
      entity: params.entity ?? null,
      entity_id: params.entityId ?? null,
      meta: params.meta ?? null,
    });
  } catch {
    // no-op
  }
}