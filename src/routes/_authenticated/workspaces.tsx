import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Check, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceMembersPanel } from "@/components/workspace-members-panel";
import { WorkspaceAuditLog } from "@/components/workspace-audit-log";

export const Route = createFileRoute("/_authenticated/workspaces")({
  component: WorkspacesPage,
  head: () => ({ meta: [{ title: "NIFs y gestoría · Veract" }] }),
});

type Row = {
  id: string;
  name: string;
  nif: string | null;
  owner_user_id: string;
  role: "owner" | "admin" | "gestor" | "viewer";
};

function WorkspacesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { workspaceId, workspace, setActive } = useActiveWorkspace();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["workspaces:list", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("role, workspaces:workspace_id ( id, name, nif, owner_user_id )")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => r.workspaces ? { ...r.workspaces, role: r.role } : null)
        .filter(Boolean) as Row[];
    },
  });

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNif, setNewNif] = useState("");

  const createWs = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Nombre obligatorio");
      const { data, error } = await supabase
        .from("workspaces")
        .insert({ name: newName.trim(), nif: newNif.trim() || null, owner_user_id: user!.id })
        .select("id").single();
      if (error) throw error;
      // Ensure membership row exists (trigger should not exist for manual creates)
      await supabase.from("workspace_members").upsert(
        { workspace_id: data.id, user_id: user!.id, role: "owner" },
        { onConflict: "workspace_id,user_id" },
      );
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("NIF creado");
      setNewName(""); setNewNif(""); setCreating(false);
      qc.invalidateQueries({ queryKey: ["workspaces:list"] });
      setActive(id);
      // Force reload of cached workspaces
      window.location.reload();
    },
    onError: (e: any) => toast.error(e.message ?? "Error al crear"),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNif, setEditNif] = useState("");

  const saveEdit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("workspaces")
        .update({ name: editName.trim(), nif: editNif.trim() || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("NIF actualizado");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["workspaces:list"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error al guardar"),
  });

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">NIFs y gestoría</h1>
            <p className="text-sm text-slate-400">
              Gestiona los NIFs a los que tienes acceso. Ideal para gestorías con varios clientes.
            </p>
          </div>
          {!creating && (
            <Button onClick={() => setCreating(true)} className="bg-emerald-500 hover:bg-emerald-600">
              <Plus className="mr-1 h-4 w-4" /> Nuevo NIF
            </Button>
          )}
        </header>

        {creating && (
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-base">Crear nuevo NIF</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Nombre o alias</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Cliente García SL"
                    className="border-slate-700 bg-slate-950"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">NIF / CIF</Label>
                  <Input
                    value={newNif}
                    onChange={(e) => setNewNif(e.target.value)}
                    placeholder="B12345678"
                    className="border-slate-700 bg-slate-950"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => createWs.mutate()}
                  disabled={createWs.isPending}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  {createWs.isPending ? "Creando…" : "Crear"}
                </Button>
                <Button variant="ghost" onClick={() => { setCreating(false); setNewName(""); setNewNif(""); }}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-base">Tus NIFs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <div className="text-sm text-slate-500">Cargando…</div>}
            {!isLoading && rows.length === 0 && (
              <div className="text-sm text-slate-500">Aún no tienes NIFs.</div>
            )}
            {rows.map((w) => {
              const active = w.id === workspaceId;
              const isEditing = editingId === w.id;
              const canEdit = w.role === "owner" || w.role === "admin";
              return (
                <div
                  key={w.id}
                  className={
                    "rounded-lg border p-3 transition " +
                    (active ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-800 bg-slate-950")
                  }
                >
                  {isEditing ? (
                    <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="border-slate-700 bg-slate-950"
                      />
                      <Input
                        value={editNif}
                        onChange={(e) => setEditNif(e.target.value)}
                        placeholder="NIF"
                        className="border-slate-700 bg-slate-950"
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => saveEdit.mutate(w.id)}
                          disabled={saveEdit.isPending}
                          className="bg-emerald-500 hover:bg-emerald-600"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gradient-to-br from-indigo-500/30 to-emerald-500/20 text-emerald-300">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-white">{w.name}</span>
                          {active && <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20">Activo</Badge>}
                          <Badge variant="outline" className="border-slate-700 text-[10px] text-slate-400">
                            {w.role}
                          </Badge>
                        </div>
                        <div className="truncate text-xs text-slate-500">{w.nif || "Sin NIF asignado"}</div>
                      </div>
                      <div className="flex gap-1">
                        {!active && (
                          <Button size="sm" variant="outline" onClick={() => setActive(w.id)} className="border-slate-700">
                            Activar
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditingId(w.id); setEditName(w.name); setEditNif(w.nif ?? ""); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500">
          Invita miembros al NIF activo desde el panel de abajo. El propietario mantiene control total.
        </p>

        {workspaceId && workspace?.role && (
          <WorkspaceMembersPanel workspaceId={workspaceId} myRole={workspace.role} />
        )}

        {workspaceId && <WorkspaceAuditLog workspaceId={workspaceId} />}
      </div>
    </div>
  );
}