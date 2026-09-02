import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveActiveWorkspaceId, useActiveWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/company")({
  component: CompanyPage,
  head: () => ({ meta: [{ title: "Datos del emisor · Estimac" }] }),
});

type CompanySettings = {
  user_id: string;
  nif: string;
  legal_name: string;
  address: string;
  postal_code: string;
  city: string;
  province: string;
  country: string;
  email: string;
  tipo_actividad?: string;
  categoria_irpf?: string;
  fecha_alta?: string | null;
  renunciar_reducido?: boolean;
  acogido_oss?: boolean;
  ventas_ue_acumuladas?: number;
};

const empty: Omit<CompanySettings, "user_id"> = {
  nif: "", legal_name: "", address: "", postal_code: "",
  city: "", province: "", country: "España", email: "",
  tipo_actividad: "profesional", categoria_irpf: "profesional",
  fecha_alta: null, renunciar_reducido: false,
  acogido_oss: false, ventas_ue_acumuladas: 0,
};

function CompanyPage() {
  const qc = useQueryClient();
  const { workspaceId } = useActiveWorkspace();
  const { data } = useQuery({
    queryKey: ["company_settings", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const { data, error } = await supabase
        .from("company_settings").select("*").eq("workspace_id", workspaceId!).maybeSingle() as any;
      if (error) throw error;
      return data ?? { user_id: uid, ...empty };
    },
  });

  const [form, setForm] = useState<CompanySettings | null>(null);
  useEffect(() => { if (data) setForm(data as CompanySettings); }, [data]);

  const save = useMutation({
    mutationFn: async (f: CompanySettings) => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const ws = await resolveActiveWorkspaceId(uid);
      const { error } = await (supabase as any)
        .from("company_settings")
        .upsert({ ...f, user_id: uid, workspace_id: ws }, { onConflict: "workspace_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Datos fiscales guardados");
      qc.invalidateQueries({ queryKey: ["company_settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (!form) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) =>
    setForm({ ...form, [k]: v });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos fiscales del emisor</CardTitle>
          <p className="text-sm text-muted-foreground">
            Aparecerán en todas tus facturas y se incluirán en el hash de cadena VeriFactu.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="NIF / CIF *">
            <Input value={form.nif} onChange={(e) => set("nif", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Razón social *">
            <Input value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} />
          </Field>
          <Field label="Dirección">
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="CP">
              <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
            </Field>
            <Field label="Ciudad">
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Provincia">
              <Input value={form.province} onChange={(e) => set("province", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="País">
              <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
          </div>

          <div className="pt-3 border-t border-border space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
              Perfil fiscal (para el motor legal AEAT)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de actividad">
                <Select value={form.tipo_actividad ?? "profesional"}
                  onValueChange={(v) => set("tipo_actividad", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profesional">Profesional (sección 2ª/3ª IAE)</SelectItem>
                    <SelectItem value="empresarial">Empresarial (sección 1ª IAE)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Categoría IRPF">
                <Select value={form.categoria_irpf ?? "profesional"}
                  onValueChange={(v) => set("categoria_irpf", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profesional">Profesional (15%)</SelectItem>
                    <SelectItem value="agricola">Agrícola/ganadera (2%)</SelectItem>
                    <SelectItem value="arrendamiento">Arrendamiento inmuebles (19%)</SelectItem>
                    <SelectItem value="derechos_imagen">Derechos de imagen (24%)</SelectItem>
                    <SelectItem value="mediador_seguros">Mediador de seguros (7%)</SelectItem>
                    <SelectItem value="modulos_agro">Módulos actividades agrarias (1%)</SelectItem>
                    <SelectItem value="empresarial">Empresarial (sin retención)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha de alta como autónomo (opcional)">
                <Input type="date" value={form.fecha_alta ?? ""}
                  onChange={(e) => set("fecha_alta", e.target.value || null)} />
              </Field>
              <Field label="Renuncia al 7% reducido">
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" checked={!!form.renunciar_reducido}
                    onChange={(e) => set("renunciar_reducido", e.target.checked)} />
                  <span className="text-xs text-muted-foreground">Aplicar siempre el 15% aunque sea nuevo</span>
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Acogido a OSS (UE)">
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" checked={!!form.acogido_oss}
                    onChange={(e) => set("acogido_oss", e.target.checked)} />
                  <span className="text-xs text-muted-foreground">Aplicar OSS aunque no supere 10 000 €</span>
                </div>
              </Field>
              <Field label="Ventas UE B2C acumuladas (€)">
                <Input type="number" step="0.01" value={form.ventas_ue_acumuladas ?? 0}
                  onChange={(e) => set("ventas_ue_acumuladas", parseFloat(e.target.value) || 0)} />
              </Field>
            </div>
          </div>

          <Button
            onClick={() => save.mutate(form)}
            disabled={save.isPending || !form.nif || !form.legal_name}
            className="w-full"
          >
            Guardar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}