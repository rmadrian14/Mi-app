import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { usePersonalProfile, useRoutine } from "@/hooks/use-training";
import {
  guardarDatosCorporales,
  useFoods,
  useMenus,
  useNutritionProfile,
  useWeightLog,
  type NutritionProfile,
  type NutritionProfileInput,
} from "@/hooks/use-nutrition";
import { Aviso } from "@/components/nutrition/common";
import { Cuestionario } from "@/components/nutrition/cuestionario";
import { PerfilView } from "@/components/nutrition/perfil-view";
import { AlimentosView } from "@/components/nutrition/alimentos-view";
import { MenuView } from "@/components/nutrition/menu-view";
import { CompraView } from "@/components/nutrition/compra-view";
import { PesoView } from "@/components/nutrition/peso-view";
import { parseMantenimiento } from "@/components/nutrition/objetivos-campos";

export const Route = createFileRoute("/_authenticated/nutrition")({
  component: NutritionPage,
  head: () => ({ meta: [{ title: "Alimentación · Veract" }] }),
});

type Pestana = "menu" | "alimentos" | "compra" | "peso" | "perfil";
const PESTANAS: { id: Pestana; label: string }[] = [
  { id: "menu", label: "Menú" },
  { id: "alimentos", label: "Alimentos" },
  { id: "compra", label: "Compra" },
  { id: "peso", label: "Peso" },
  { id: "perfil", label: "Perfil" },
];

// Los objetivos guardados, listos para volver a guardarlos con algún cambio.
function comoInput(p: NutritionProfile): NutritionProfileInput {
  return {
    nivel_actividad: p.nivel_actividad,
    dias_entreno: p.dias_entreno,
    objetivo: p.objetivo,
    ritmo: p.ritmo,
    comidas_por_dia: p.comidas_por_dia,
    restricciones: p.restricciones,
    alimentos_excluidos: p.alimentos_excluidos,
    kcal_objetivo: p.kcal_objetivo,
    proteina_g: p.proteina_g,
    grasa_g: p.grasa_g,
    hidratos_g: p.hidratos_g,
    editado_manual: p.editado_manual,
    kcal_mantenimiento: p.kcal_mantenimiento,
  };
}

// Mensaje claro cuando falta aplicar la migración de la base de datos.
function mensajeError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? "";
  if (
    /schema cache|does not exist|nutrition_profile|sexo|kcal_mantenimiento|menu_activo_id|factor_cocinado|frecuencia|compra_marcados|weight_log|crear_menu|reemplazar_dia|actualizar_gramos/i.test(
      msg,
    )
  ) {
    return "La base de datos de Alimentación todavía no está preparada (falta aplicar las migraciones «nutrition_module» y «nutrition_v2» en Supabase).";
  }
  return msg || "No se ha podido completar la operación.";
}

function NutritionPage() {
  const { user } = useAuth();
  const np = useNutritionProfile();
  const personal = usePersonalProfile();
  const routine = useRoutine();
  const foods = useFoods();
  const menus = useMenus();
  const peso = useWeightLog();
  const [pestana, setPestana] = useState<Pestana>("menu");

  if (np.loading || personal.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Cargando…</div>
    );
  }

  if (np.error) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 ring-1 ring-emerald-500/30">
            <UtensilsCrossed className="h-7 w-7 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">Alimentación</h1>
          <Aviso>{mensajeError({ message: np.error })}</Aviso>
          <Link to="/" className="inline-block text-sm font-medium text-slate-400 hover:text-slate-200">
            ← Volver a inicio
          </Link>
        </div>
      </div>
    );
  }

  if (!np.profile) {
    const diasEntreno = routine.days.filter((d) => d.es_dia_entreno).length || 4;
    return (
      <Cuestionario
        personal={personal.profile}
        diasEntrenoInicial={diasEntreno}
        onFinish={async (d, r) => {
          if (!user) throw new Error("No hay sesión activa.");
          try {
            const corporales = {
              sexo: d.sexo,
              edad: parseInt(d.edad, 10),
              peso_kg: parseFloat(d.peso.replace(",", ".")),
              altura_cm: parseFloat(d.altura.replace(",", ".")),
            };
            if (!personal.profile) {
              await personal.createProfileAndSeedRoutine({
                edad: corporales.edad,
                peso_kg: corporales.peso_kg,
                altura_cm: corporales.altura_cm,
                objetivo: null,
                limitaciones: null,
              });
            }
            await guardarDatosCorporales(user.id, corporales);
            await personal.refresh();
            await np.guardar({
              nivel_actividad: d.nivel,
              dias_entreno: d.diasEntreno,
              objetivo: d.objetivo,
              ritmo: d.ritmo,
              comidas_por_dia: d.comidasPorDia,
              restricciones: d.restricciones,
              alimentos_excluidos: d.excluidos.trim() || null,
              kcal_objetivo: r.kcal,
              proteina_g: r.proteina_g,
              grasa_g: r.grasa_g,
              hidratos_g: r.hidratos_g,
              editado_manual: false,
              kcal_mantenimiento: parseMantenimiento(d.kcalMantenimiento),
            });
            await foods.cargarBasicos();
            toast.success("Perfil nutricional guardado.");
          } catch (e) {
            throw new Error(mensajeError(e));
          }
        }}
      />
    );
  }

  const perfil = np.profile;

  return (
    <div className="min-h-screen w-full bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" /> Volver a inicio
        </Link>

        <header className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 ring-1 ring-emerald-500/30">
            <UtensilsCrossed className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Alimentación</h1>
            <p className="text-xs text-slate-400">
              Objetivo: {perfil.kcal_objetivo.toLocaleString("es-ES")} kcal · P {perfil.proteina_g} · G{" "}
              {perfil.grasa_g} · H {perfil.hidratos_g}
            </p>
          </div>
        </header>

        <nav className="mb-5 grid grid-cols-5 gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPestana(p.id)}
              className={
                "rounded-lg px-1 py-2 text-[13px] font-semibold transition sm:px-2 sm:text-sm " +
                (pestana === p.id ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400 hover:text-white")
              }
            >
              {p.label}
            </button>
          ))}
        </nav>

        {pestana === "menu" && <MenuView profile={perfil} foods={foods.foods} menus={menus} />}
        {pestana === "alimentos" && (
          <AlimentosView
            foods={foods.foods}
            loading={foods.loading}
            restricciones={perfil.restricciones}
            excluidos={perfil.alimentos_excluidos}
            onCrear={foods.crear}
            onActualizar={foods.actualizar}
            onEliminar={foods.eliminar}
            onCargarBasicos={foods.cargarBasicos}
          />
        )}
        {pestana === "compra" && <CompraView foods={foods.foods} menus={menus} />}
        {pestana === "peso" && (
          <PesoView
            registros={peso.registros}
            error={peso.error}
            profile={perfil}
            personal={personal.profile}
            onRegistrar={async (fecha, kg) => {
              const { perfilActualizado } = await peso.registrar(fecha, kg);
              if (perfilActualizado) await personal.refresh();
            }}
            onEliminar={peso.eliminar}
            onAplicar={async ({ kcal_objetivo, kcal_mantenimiento }) => {
              // La diferencia de calorías va a los hidratos; proteína y grasa se mantienen.
              const hidratos = Math.max(0, Math.round((kcal_objetivo - 4 * perfil.proteina_g - 9 * perfil.grasa_g) / 4));
              try {
                await np.guardar({
                  ...comoInput(perfil),
                  kcal_objetivo,
                  hidratos_g: hidratos,
                  kcal_mantenimiento,
                  editado_manual: true,
                });
              } catch (e) {
                throw new Error(mensajeError(e));
              }
            }}
          />
        )}
        {pestana === "perfil" && (
          <PerfilView
            profile={perfil}
            personal={personal.profile}
            onGuardar={async (input, corporales) => {
              if (!user) throw new Error("No hay sesión activa.");
              try {
                await guardarDatosCorporales(user.id, corporales);
                await personal.refresh();
                await np.guardar(input);
              } catch (e) {
                throw new Error(mensajeError(e));
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
