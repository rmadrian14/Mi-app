import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { PersonalProfile } from "@/hooks/use-training";
import type { NutritionProfile, NutritionProfileInput } from "@/hooks/use-nutrition";
import type { Sexo } from "@/lib/nutrition";
import { Aviso, Card, Field, SectionTitle, btnPrimary, btnSecondary, fmt, inputCls } from "./common";
import {
  ActividadCampos,
  DatosCorporalesCampos,
  ExplicacionObjetivos,
  ObjetivoCampos,
  RestriccionesCampos,
  calcularDesdeDatos,
  parseMantenimiento,
  validarActividad,
  validarDatosCorporales,
  type DatosCuestionario,
} from "./objetivos-campos";

export function PerfilView({
  profile,
  personal,
  onGuardar,
}: {
  profile: NutritionProfile;
  personal: PersonalProfile | null;
  onGuardar: (
    input: NutritionProfileInput,
    corporales: { sexo: string; edad: number; peso_kg: number; altura_cm: number },
  ) => Promise<void>;
}) {
  const [d, setD] = useState<DatosCuestionario>({
    sexo: (personal?.sexo as Sexo | null) ?? "",
    edad: personal?.edad != null ? String(personal.edad) : "",
    peso: personal?.peso_kg != null ? String(personal.peso_kg) : "",
    altura: personal?.altura_cm != null ? String(personal.altura_cm) : "",
    nivel: profile.nivel_actividad,
    diasEntreno: profile.dias_entreno,
    comidasPorDia: profile.comidas_por_dia,
    objetivo: profile.objetivo,
    ritmo: profile.ritmo,
    restricciones: profile.restricciones,
    excluidos: profile.alimentos_excluidos ?? "",
    kcalMantenimiento: profile.kcal_mantenimiento != null ? String(profile.kcal_mantenimiento) : "",
  });
  const [kcal, setKcal] = useState(String(profile.kcal_objetivo));
  const [prot, setProt] = useState(String(profile.proteina_g));
  const [gras, setGras] = useState(String(profile.grasa_g));
  const [hidr, setHidr] = useState(String(profile.hidratos_g));
  const [editado, setEditado] = useState(profile.editado_manual);
  const [cuestionarioCambiado, setCuestionarioCambiado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<DatosCuestionario>) => {
    setD((prev) => ({ ...prev, ...patch }));
    setCuestionarioCambiado(true);
  };

  const calculado = useMemo(() => calcularDesdeDatos(d), [d]);

  const pesoKg = parseFloat(d.peso.replace(",", ".")) || 0;
  const kcalNum = parseInt(kcal, 10) || 0;
  const kcalMacros = 4 * (parseInt(prot, 10) || 0) + 9 * (parseInt(gras, 10) || 0) + 4 * (parseInt(hidr, 10) || 0);
  const descuadre = kcalNum > 0 ? Math.abs(kcalMacros - kcalNum) / kcalNum : 0;

  function recalcular() {
    if (!calculado) {
      setError(validarDatosCorporales(d));
      return;
    }
    setError(null);
    setKcal(String(calculado.kcal));
    setProt(String(calculado.proteina_g));
    setGras(String(calculado.grasa_g));
    setHidr(String(calculado.hidratos_g));
    setEditado(false);
    setCuestionarioCambiado(false);
    toast.success("Objetivos recalculados. Pulsa Guardar para aplicarlos.");
  }

  function editarObjetivo(setter: (v: string) => void, v: string) {
    setter(v.replace(/[^\d]/g, ""));
    setEditado(true);
  }

  // Reparte lo que falte (o sobre) para llegar a las calorías objetivo en los hidratos.
  function equilibrarHidratos() {
    const resto = kcalNum - 4 * (parseInt(prot, 10) || 0) - 9 * (parseInt(gras, 10) || 0);
    setHidr(String(Math.max(0, Math.round(resto / 4))));
    setEditado(true);
  }

  async function guardar() {
    const err = validarDatosCorporales(d) || validarActividad(d);
    if (err) {
      setError(err);
      return;
    }
    const k = parseInt(kcal, 10);
    const p = parseInt(prot, 10);
    const g = parseInt(gras, 10);
    const h = parseInt(hidr, 10);
    if (![k, p, g, h].every((n) => Number.isFinite(n) && n >= 0) || k <= 0) {
      setError("Revisa las calorías y los macros: deben ser números positivos.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(
        {
          nivel_actividad: d.nivel,
          dias_entreno: d.diasEntreno,
          objetivo: d.objetivo,
          ritmo: d.ritmo,
          comidas_por_dia: d.comidasPorDia,
          restricciones: d.restricciones,
          alimentos_excluidos: d.excluidos.trim() || null,
          kcal_objetivo: k,
          proteina_g: p,
          grasa_g: g,
          hidratos_g: h,
          editado_manual: editado,
          kcal_mantenimiento: parseMantenimiento(d.kcalMantenimiento),
        },
        {
          sexo: d.sexo,
          edad: parseInt(d.edad, 10),
          peso_kg: parseFloat(d.peso.replace(",", ".")),
          altura_cm: parseFloat(d.altura.replace(",", ".")),
        },
      );
      setCuestionarioCambiado(false);
      toast.success("Perfil guardado.");
    } catch (e) {
      setError((e as Error).message || "No se ha podido guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Tus objetivos diarios</SectionTitle>
          {editado && (
            <span className="mb-3 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
              Editados a mano
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Calorías (kcal)">
            <input inputMode="numeric" value={kcal} onChange={(e) => editarObjetivo(setKcal, e.target.value)} className={inputCls} />
          </Field>
          <Field label="Proteína (g)">
            <input inputMode="numeric" value={prot} onChange={(e) => editarObjetivo(setProt, e.target.value)} className={inputCls} />
          </Field>
          <Field label="Grasa (g)">
            <input inputMode="numeric" value={gras} onChange={(e) => editarObjetivo(setGras, e.target.value)} className={inputCls} />
          </Field>
          <Field label="Hidratos (g)">
            <input inputMode="numeric" value={hidr} onChange={(e) => editarObjetivo(setHidr, e.target.value)} className={inputCls} />
          </Field>
        </div>
        {pesoKg > 0 && (
          <p className="mt-2 text-[11px] text-slate-500">
            Por kg de peso: proteína {fmt((parseInt(prot, 10) || 0) / pesoKg, 1)} g · grasa{" "}
            {fmt((parseInt(gras, 10) || 0) / pesoKg, 1)} g · hidratos {fmt((parseInt(hidr, 10) || 0) / pesoKg, 1)} g
            (guías deportivas: 3–5 g/kg de hidratos con actividad ligera, 5–7 con ~1 h diaria de ejercicio moderado).
          </p>
        )}
        {descuadre > 0.05 && (
          <div className="mt-3 space-y-2">
            <Aviso>
              Los macros suman {fmt(kcalMacros)} kcal (4 por g de proteína e hidratos, 9 por g de grasa), distinto de
              tus {fmt(kcalNum)} kcal. Puedes dejarlo así, pero el menú intentará cuadrar ambos.
            </Aviso>
            <button type="button" onClick={equilibrarHidratos} className={btnSecondary}>
              Ajustar los hidratos para cuadrar las calorías
            </button>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={recalcular} className={btnSecondary}>
            Recalcular desde el cuestionario
          </button>
        </div>
        {cuestionarioCambiado && (
          <div className="mt-3">
            <Aviso tono="gris">
              Has cambiado respuestas del cuestionario. Pulsa «Recalcular» si quieres que se actualicen tus objetivos.
            </Aviso>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Cuestionario</SectionTitle>
        <div className="space-y-6">
          <DatosCorporalesCampos d={d} set={set} />
          <ActividadCampos d={d} set={set} />
          <ObjetivoCampos d={d} set={set} />
          <RestriccionesCampos d={d} set={set} />
        </div>
      </Card>

      {calculado && (
        <Card>
          <SectionTitle>Cómo se calculan</SectionTitle>
          <ExplicacionObjetivos r={calculado} d={d} />
        </Card>
      )}

      {error && <Aviso tono="rojo">{error}</Aviso>}
      <button type="button" onClick={guardar} disabled={guardando} className={btnPrimary + " w-full"}>
        {guardando ? "Guardando…" : "Guardar perfil"}
      </button>
    </div>
  );
}
