import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveActiveWorkspaceId } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
  head: () => ({ meta: [{ title: "Clientes · Estimac" }] }),
});

type Client = {
  id: string; nif: string; name: string;
  address: string; postal_code: string; city: string;
  province: string; country: string; email: string;
};

const blank = { nif: "", name: "", address: "", postal_code: "", city: "", province: "", country: "España", email: "" };

function ClientsPage() {
  const qc = useQueryClient();
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as Client[];
    },
  });

  const [form, setForm] = useState(blank);

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const workspace_id = await resolveActiveWorkspaceId(uid);
      const { error } = await supabase.from("clients").insert({ ...form, user_id: uid, workspace_id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente creado");
      setForm(blank);
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });

  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-4 py-6 md:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader><CardTitle>Clientes</CardTitle></CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no tienes clientes.</p>
          ) : (
            <ul className="divide-y">
              {clients.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.nif} · {c.city}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Nuevo cliente</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <FieldRow label="Nombre *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FieldRow>
          <FieldRow label="NIF">
            <Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value.toUpperCase() })} />
          </FieldRow>
          <FieldRow label="Dirección">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </FieldRow>
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="CP"><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></FieldRow>
            <FieldRow label="Ciudad"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></FieldRow>
          </div>
          <FieldRow label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FieldRow>
          <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending} className="w-full">
            <Plus className="h-4 w-4" /> Añadir
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}