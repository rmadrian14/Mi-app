import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveActiveWorkspaceId, useActiveWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Building2, Home, Map, Briefcase, Percent, Euro, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
  head: () => ({ meta: [{ title: "Perfil del emisor · Veract" }] }),
});

type Form = {
  tipo_emisor: "autonomo" | "empresa" | "";
  legal_name: string;
  nif: string;
  address: string;
  postal_code: string;
  city: string;
  province: string;
  country: string;
  territorio: "peninsula_baleares" | "canarias" | "ceuta" | "melilla" | "";
  tipo_actividad: "profesional" | "empresarial" | "";
  categoria_irpf: string;
  fecha_alta: string;
  renunciar_reducido: boolean;
  opera_ue: boolean | null;
  inscrito_roi: boolean;
  vende_ue: boolean | null;
  acogido_oss: boolean;
  ventas_ue_acumuladas: string;
  email: string;
};

const initialForm: Form = {
  tipo_emisor: "",
  legal_name: "",
  nif: "",
  address: "",
  postal_code: "",
  city: "",
  province: "",
  country: "España",
  territorio: "",
  tipo_actividad: "",
  categoria_irpf: "profesional",
  fecha_alta: "",
  renunciar_reducido: false,
  opera_ue: null,
  inscrito_roi: false,
  vende_ue: null,
  acogido_oss: false,
  ventas_ue_acumuladas: "",
  email: "",
};

const STEPS = [
  { label: "Identificación", icon: Building2 },
  { label: "Domicilio", icon: Home },
  { label: "Territorio", icon: Map },
  { label: "Actividad", icon: Briefcase },
  { label: "IRPF", icon: Percent },
  { label: "Operaciones UE", icon: Euro },
  { label: "Contacto", icon: Mail },
] as const;

function OnboardingPage() {
  const navigate = useNavigate();
  const { workspaceId } = useActiveWorkspace();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(initialForm);
  const [saving, setSaving] = useState(false);

  // Prefill from existing company_settings if any
  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (data) {
        const d: any = data;
        setForm((f) => ({
          ...f,
          tipo_emisor: d.tipo_emisor ?? "",
          legal_name: d.legal_name ?? "",
          nif: d.nif ?? "",
          address: d.address ?? "",
          postal_code: d.postal_code ?? "",
          city: d.city ?? "",
          province: d.province ?? "",
          country: d.country ?? "España",
          territorio: d.territorio ?? "",
          tipo_actividad: d.tipo_actividad ?? "",
          categoria_irpf: d.categoria_irpf ?? "profesional",
          fecha_alta: d.fecha_alta ?? "",
          renunciar_reducido: !!d.renunciar_reducido,
          opera_ue: d.opera_ue ?? null,
          inscrito_roi: !!d.inscrito_roi,
          vende_ue: d.vende_ue ?? null,
          acogido_oss: !!d.acogido_oss,
          ventas_ue_acumuladas: d.ventas_ue_acumuladas ? String(d.ventas_ue_acumuladas) : "",
          email: d.email ?? "",
        }));
      }
    })();
  }, [workspaceId]);

  function up<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function canContinue(): boolean {
    switch (step) {
      case 1: return !!form.tipo_emisor && !!form.legal_name.trim() && !!form.nif.trim();
      case 2: return !!form.address.trim() && !!form.postal_code.trim() && !!form.city.trim() && !!form.province.trim() && !!form.country.trim();
      case 3: return !!form.territorio;
      case 4: return !!form.tipo_actividad && (form.tipo_actividad !== "profesional" || !!form.categoria_irpf);
      case 5: return true; // opcional
      case 6: return form.opera_ue !== null && form.vende_ue !== null;
      case 7: return /\S+@\S+\.\S+/.test(form.email);
      default: return true;
    }
  }

  async function submit() {
    if (!workspaceId) {
      toast.error("No hay workspace activo");
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const ws = await resolveActiveWorkspaceId(uid);
      const payload: any = {
        user_id: uid,
        workspace_id: ws,
        tipo_emisor: form.tipo_emisor || "autonomo",
        legal_name: form.legal_name.trim(),
        nif: form.nif.trim(),
        address: form.address.trim(),
        postal_code: form.postal_code.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
        country: form.country.trim() || "España",
        territorio: form.territorio || "peninsula_baleares",
        tipo_actividad: form.tipo_actividad || "profesional",
        categoria_irpf: form.categoria_irpf || "profesional",
        fecha_alta: form.fecha_alta || null,
        renunciar_reducido: form.renunciar_reducido,
        opera_ue: !!form.opera_ue,
        inscrito_roi: form.opera_ue ? form.inscrito_roi : false,
        vende_ue: !!form.vende_ue,
        acogido_oss: form.acogido_oss,
        ventas_ue_acumuladas: form.ventas_ue_acumuladas ? Number(form.ventas_ue_acumuladas) : 0,
        email: form.email.trim(),
        onboarding_completed: true,
      };
      const { error } = await (supabase as any)
        .from("company_settings")
        .upsert(payload, { onConflict: "workspace_id" });
      if (error) throw error;
      toast.success("Perfil guardado");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const progress = Math.round((step / STEPS.length) * 100);
  const StepIcon = STEPS[step - 1].icon;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Perfil del emisor</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Rellena esto una vez. Se guarda en tu perfil y se aplica siempre que emitas una factura.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 shadow-xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <StepIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Paso {step} · {STEPS[step - 1].label}
              </div>
              <h2 className="text-lg font-semibold">{stepTitle(step)}</h2>
            </div>
          </div>
          <p className="mb-6 text-sm text-slate-400">{stepDesc(step)}</p>

          <div className="space-y-4">
            {step === 1 && <Step1 form={form} up={up} />}
            {step === 2 && <Step2 form={form} up={up} />}
            {step === 3 && <Step3 form={form} up={up} />}
            {step === 4 && <Step4 form={form} up={up} />}
            {step === 5 && <Step5 form={form} up={up} />}
            {step === 6 && <Step6 form={form} up={up} />}
            {step === 7 && <Step7 form={form} up={up} />}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-slate-800 pt-6">
            <Button
              variant="ghost"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="text-slate-400 hover:text-white"
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Atrás
            </Button>
            {step < STEPS.length ? (
              <Button
                disabled={!canContinue()}
                onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
                className="bg-gradient-to-r from-emerald-500 to-indigo-500 text-slate-950 hover:opacity-90"
              >
                Siguiente <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                disabled={!canContinue() || saving}
                onClick={submit}
                className="bg-gradient-to-r from-emerald-500 to-indigo-500 text-slate-950 hover:opacity-90"
              >
                <Check className="mr-1 h-4 w-4" /> {saving ? "Guardando…" : "Finalizar"}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs text-slate-500">
              Paso <b className="text-slate-300">{step}</b> de {STEPS.length}
            </span>
            <span className="text-xs font-bold text-emerald-400">{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function stepTitle(s: number): string {
  return [
    "¿Quién emite las facturas?",
    "Domicilio fiscal",
    "¿Dónde tributas tú?",
    "Tu actividad",
    "Retención de IRPF",
    "Operaciones con la Unión Europea",
    "Contacto",
  ][s - 1];
}
function stepDesc(s: number): string {
  return [
    "Estos datos aparecen en cada factura y son los que valida la AEAT.",
    "La dirección que figura en tu alta censal.",
    "Distinto del territorio del cliente. Afecta a tu retención de IRPF si estás en Ceuta o Melilla.",
    "No hace falta que sepas los términos exactos: elige lo que más se parezca a tu caso.",
    "Solo aplica a tu categoría (General profesional). Si no rellenas la fecha de alta, se aplica el tipo general del 15%.",
    "Cubre tanto operaciones con empresas de la UE como ventas a particulares de otros países de la UE.",
    "El email es obligatorio; lo usamos como contacto en las facturas.",
  ][s - 1];
}

// -------- Reusable UI --------

function Choice<T extends string>({
  value,
  selected,
  onSelect,
  title,
  hint,
}: {
  value: T;
  selected: boolean;
  onSelect: (v: T) => void;
  title: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={
        "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition " +
        (selected
          ? "border-emerald-500 bg-emerald-500/10"
          : "border-slate-800 bg-slate-950/60 hover:border-slate-700")
      }
    >
      <span
        className={
          "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border " +
          (selected ? "border-emerald-400" : "border-slate-600")
        }
      >
        {selected && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-slate-100">{title}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
      </span>
    </button>
  );
}

function CheckRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left"
    >
      <span
        className={
          "grid h-4 w-4 place-items-center rounded border " +
          (checked ? "border-emerald-400 bg-emerald-400 text-slate-950" : "border-slate-600")
        }
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="text-sm text-slate-200">{label}</span>
    </button>
  );
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
        {required !== undefined && (
          <span className={"rounded-full px-2 py-0.5 text-[9px] font-bold " + (required ? "bg-rose-500/15 text-rose-400" : "bg-amber-500/15 text-amber-400")}>
            {required ? "Obligatorio" : "Opcional"}
          </span>
        )}
      </Label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// -------- Steps --------

type StepProps = { form: Form; up: <K extends keyof Form>(k: K, v: Form[K]) => void };

function Step1({ form, up }: StepProps) {
  return (
    <>
      <Field label="Tipo de emisor" required>
        <div className="space-y-2">
          <Choice value="autonomo" selected={form.tipo_emisor === "autonomo"} onSelect={(v) => up("tipo_emisor", v)} title="Autónomo" hint="Persona física de alta en el RETA" />
          <Choice value="empresa" selected={form.tipo_emisor === "empresa"} onSelect={(v) => up("tipo_emisor", v)} title="Empresa" hint="SL, SA u otra sociedad mercantil" />
        </div>
      </Field>
      <Field label="Nombre o razón social" required>
        <Input value={form.legal_name} onChange={(e) => up("legal_name", e.target.value)} placeholder="Tal como consta en Hacienda" />
      </Field>
      <Field label="NIF / CIF" required>
        <Input value={form.nif} onChange={(e) => up("nif", e.target.value)} placeholder="12345678A / B12345678" />
      </Field>
    </>
  );
}

function Step2({ form, up }: StepProps) {
  return (
    <>
      <Field label="Dirección" required>
        <Input value={form.address} onChange={(e) => up("address", e.target.value)} placeholder="Calle Recogidas, 12, 3ºB" />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Código postal" required>
          <Input value={form.postal_code} onChange={(e) => up("postal_code", e.target.value)} placeholder="18005" />
        </Field>
        <Field label="Municipio" required>
          <Input value={form.city} onChange={(e) => up("city", e.target.value)} placeholder="Granada" />
        </Field>
        <Field label="Provincia" required>
          <Input value={form.province} onChange={(e) => up("province", e.target.value)} placeholder="Granada" />
        </Field>
      </div>
      <Field label="País" required>
        <Input value={form.country} onChange={(e) => up("country", e.target.value)} />
      </Field>
    </>
  );
}

function Step3({ form, up }: StepProps) {
  return (
    <Field label="Territorio del emisor" required>
      <div className="space-y-2">
        <Choice value="peninsula_baleares" selected={form.territorio === "peninsula_baleares"} onSelect={(v) => up("territorio", v)} title="Península y Baleares" />
        <Choice value="canarias" selected={form.territorio === "canarias"} onSelect={(v) => up("territorio", v)} title="Canarias" />
        <Choice value="ceuta" selected={form.territorio === "ceuta"} onSelect={(v) => up("territorio", v)} title="Ceuta" />
        <Choice value="melilla" selected={form.territorio === "melilla"} onSelect={(v) => up("territorio", v)} title="Melilla" />
      </div>
    </Field>
  );
}

function Step4({ form, up }: StepProps) {
  return (
    <>
      <Field label="Tipo de actividad" required>
        <div className="space-y-2">
          <Choice value="profesional" selected={form.tipo_actividad === "profesional"} onSelect={(v) => up("tipo_actividad", v)} title="Actividad profesional" hint="Consultoría, diseño, formación… — puede llevar retención de IRPF" />
          <Choice value="empresarial" selected={form.tipo_actividad === "empresarial"} onSelect={(v) => up("tipo_actividad", v)} title="Actividad empresarial" hint="Venta de productos, comercio, servicios digitales… — sin retención" />
        </div>
      </Field>
      {form.tipo_actividad === "profesional" && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <Field label="¿Qué describe mejor tu actividad?" required hint="Casi todos los profesionales son 'General'. Solo cambia si tu actividad encaja claramente en otra categoría.">
            <div className="space-y-2">
              {[
                ["profesional", "General", "Sección 2ª/3ª del IAE — la mayoría de profesionales"],
                ["agricola", "Agrícola, ganadera o forestal", ""],
                ["arrendamiento", "Arrendamiento de inmuebles", ""],
                ["derechos_imagen", "Cesión de derechos de imagen", ""],
                ["mediador_seguros", "Mediación de seguros", ""],
                ["modulos_agro", "Módulos en actividad agraria", ""],
              ].map(([v, t, h]) => (
                <Choice
                  key={v}
                  value={v}
                  selected={form.categoria_irpf === v}
                  onSelect={(val) => up("categoria_irpf", val)}
                  title={t}
                  hint={h || undefined}
                />
              ))}
            </div>
          </Field>
        </div>
      )}
    </>
  );
}

function Step5({ form, up }: StepProps) {
  const applies = form.tipo_actividad === "profesional" && form.categoria_irpf === "profesional";
  if (!applies) {
    return <p className="text-sm text-slate-400">Tu categoría no lleva retención de IRPF, así que no hay nada que rellenar en este paso.</p>;
  }
  return (
    <>
      <Field label="Fecha de alta de tu actividad" hint="Si tu alta es de hace 2 años o menos, aplica el 7% reducido automáticamente.">
        <Input type="date" value={form.fecha_alta} onChange={(e) => up("fecha_alta", e.target.value)} />
      </Field>
      <CheckRow
        checked={form.renunciar_reducido}
        onToggle={() => up("renunciar_reducido", !form.renunciar_reducido)}
        label="Renuncio al tipo reducido del 7% aunque me corresponda"
      />
    </>
  );
}

function Step6({ form, up }: StepProps) {
  return (
    <>
      <Field label="¿Realizas operaciones (compras o ventas) con empresas de otros países de la Unión Europea?" required>
        <div className="grid grid-cols-2 gap-2">
          <Choice value={"si" as any} selected={form.opera_ue === true} onSelect={() => up("opera_ue", true)} title="Sí" />
          <Choice value={"no" as any} selected={form.opera_ue === false} onSelect={() => up("opera_ue", false)} title="No" />
        </div>
      </Field>
      {form.opera_ue === true && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <CheckRow
            checked={form.inscrito_roi}
            onToggle={() => up("inscrito_roi", !form.inscrito_roi)}
            label="Estoy inscrito en el ROI (Registro de Operadores Intracomunitarios)"
          />
        </div>
      )}
      <Field label="¿Vendes a particulares de otros países de la UE?" required>
        <div className="grid grid-cols-2 gap-2">
          <Choice value={"si" as any} selected={form.vende_ue === true} onSelect={() => up("vende_ue", true)} title="Sí" />
          <Choice value={"no" as any} selected={form.vende_ue === false} onSelect={() => up("vende_ue", false)} title="No" />
        </div>
      </Field>
      {form.vende_ue === true && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <CheckRow
            checked={form.acogido_oss}
            onToggle={() => up("acogido_oss", !form.acogido_oss)}
            label="Estoy acogido al régimen OSS (Ventanilla Única)"
          />
          <Field label="Ventas acumuladas a particulares UE este año (€)" hint="Para saber si superas el umbral de 10.000 € y toca aplicar OSS.">
            <Input
              inputMode="decimal"
              value={form.ventas_ue_acumuladas}
              onChange={(e) => up("ventas_ue_acumuladas", e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="0"
            />
          </Field>
        </div>
      )}
    </>
  );
}

function Step7({ form, up }: StepProps) {
  return (
    <Field label="Email de contacto" required>
      <Input type="email" value={form.email} onChange={(e) => up("email", e.target.value)} placeholder="tuempresa@email.com" />
    </Field>
  );
}