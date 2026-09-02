import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Mail, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

type Role = "owner" | "admin" | "gestor" | "viewer";

type Member = {
  user_id: string;
  role: Role;
  email: string | null;
};

type Invite = {
  id: string;
  email: string;
  role: Role;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export function WorkspaceMembersPanel({
  workspaceId,
  myRole,
}: {
  workspaceId: string;
  myRole: Role;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManage = myRole === "owner" || myRole === "admin";

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["ws:members", workspaceId],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      // Enrich with emails via a lightweight RPC-less path: use auth.users is not accessible.
      // We just show the user_id shortened; email surface would need a profiles view.
      return (data ?? []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        email: null,
      }));
    },
  });

  const { data: invites = [], isLoading: loadingInvites } = useQuery({
    queryKey: ["ws:invites", workspaceId],
    enabled: canManage,
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await (supabase as any)
        .from("workspace_invites")
        .select("id, email, role, token, expires_at, accepted_at, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("gestor");

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!email.trim()) throw new Error("Email obligatorio");
      const { data, error } = await (supabase as any)
        .from("workspace_invites")
        .insert({
          workspace_id: workspaceId,
          email: email.trim().toLowerCase(),
          role,
          invited_by: user!.id,
        })
        .select("token")
        .single();
      if (error) throw error;
      return data.token as string;
    },
    onSuccess: async (token) => {
      const link = `${window.location.origin}/invite/${token}`;
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Invitación creada. Enlace copiado al portapapeles.");
      } catch {
        toast.success("Invitación creada.");
      }
      setEmail("");
      qc.invalidateQueries({ queryKey: ["ws:invites", workspaceId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error al invitar"),
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("workspace_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitación cancelada");
      qc.invalidateQueries({ queryKey: ["ws:invites", workspaceId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: Role }) => {
      const { error } = await supabase
        .from("workspace_members")
        .update({ role: newRole })
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rol actualizado");
      qc.invalidateQueries({ queryKey: ["ws:members", workspaceId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Miembro eliminado");
      qc.invalidateQueries({ queryKey: ["ws:members", workspaceId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const copyLink = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader>
        <CardTitle className="text-base">Miembros del NIF activo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {canManage && (
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <UserPlus className="h-3.5 w-3.5" />
              Invitar por email
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-500">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="gestor@ejemplo.com"
                  className="border-slate-700 bg-slate-950"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-500">Rol</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger className="border-slate-700 bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => createInvite.mutate()}
                  disabled={createInvite.isPending}
                  className="w-full bg-emerald-500 hover:bg-emerald-600"
                >
                  {createInvite.isPending ? "Creando…" : "Invitar"}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              Se genera un enlace único que se copiará al portapapeles. Envíalo al invitado por el canal que prefieras.
            </p>
          </div>
        )}

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Miembros
          </div>
          {loadingMembers && <div className="text-xs text-slate-500">Cargando…</div>}
          <div className="space-y-1">
            {members.map((m) => {
              const isSelf = m.user_id === user?.id;
              const canEditThis = canManage && !isSelf && m.role !== "owner";
              return (
                <div
                  key={m.user_id}
                  className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs"
                >
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-800 text-[10px] text-slate-300">
                    {m.user_id.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[10px] text-slate-400">
                      {m.user_id}
                    </div>
                    {isSelf && <span className="text-[10px] text-emerald-400">Tú</span>}
                  </div>
                  {canEditThis ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        changeRole.mutate({ userId: m.user_id, newRole: v as Role })
                      }
                    >
                      <SelectTrigger className="h-7 w-28 border-slate-700 bg-slate-950 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="gestor">Gestor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="border-slate-700 text-[10px] text-slate-400">
                      {m.role}
                    </Badge>
                  )}
                  {canEditThis && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("¿Eliminar del NIF?")) removeMember.mutate(m.user_id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {canManage && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Invitaciones
            </div>
            {loadingInvites && <div className="text-xs text-slate-500">Cargando…</div>}
            {!loadingInvites && invites.length === 0 && (
              <div className="text-xs text-slate-500">No hay invitaciones pendientes.</div>
            )}
            <div className="space-y-1">
              {invites.map((inv) => {
                const expired = new Date(inv.expires_at) < new Date();
                const accepted = !!inv.accepted_at;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-slate-200">{inv.email}</div>
                      <div className="text-[10px] text-slate-500">
                        {accepted
                          ? `Aceptada · ${new Date(inv.accepted_at!).toLocaleDateString()}`
                          : expired
                          ? "Expirada"
                          : `Expira ${new Date(inv.expires_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <Badge variant="outline" className="border-slate-700 text-[10px] text-slate-400">
                      {inv.role}
                    </Badge>
                    {!accepted && !expired && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyLink(inv.token)}
                        title="Copiar enlace"
                      >
                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                    )}
                    {!accepted && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelInvite.mutate(inv.id)}
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5 text-rose-400" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}