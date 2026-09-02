import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

type Entry = {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  meta: any;
  user_id: string;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  "invoice.issued": "Factura emitida",
  "invoice.marked_paid": "Factura marcada como cobrada",
  "expense.created": "Gasto añadido",
  "expense.deleted": "Gasto eliminado",
  "member.role_changed": "Rol modificado",
  "member.removed": "Miembro eliminado",
  "invite.created": "Invitación creada",
};

export function WorkspaceAuditLog({ workspaceId }: { workspaceId: string }) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["ws:audit", workspaceId],
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await (supabase as any)
        .from("workspace_audit_log")
        .select("id, action, entity, entity_id, meta, user_id, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-emerald-400" />
          Historial del NIF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading && <div className="text-xs text-slate-500">Cargando…</div>}
        {!isLoading && entries.length === 0 && (
          <div className="text-xs text-slate-500">
            Aún no hay eventos registrados. Se irán acumulando cuando emitas facturas o marques cobros.
          </div>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs"
          >
            <Badge variant="outline" className="border-slate-700 text-[10px] text-slate-400">
              {ACTION_LABEL[e.action] ?? e.action}
            </Badge>
            <div className="min-w-0 flex-1">
              {e.entity && (
                <div className="truncate text-slate-300">
                  {e.entity}
                  {e.meta?.label ? ` · ${e.meta.label}` : ""}
                </div>
              )}
              <div className="text-[10px] text-slate-500">
                {new Date(e.created_at).toLocaleString("es-ES")} · autor{" "}
                <span className="font-mono">{e.user_id.slice(0, 8)}</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}