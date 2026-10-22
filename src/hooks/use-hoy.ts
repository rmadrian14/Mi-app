import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { leerPendientes, leerVentana } from "@/hooks/use-calendar";
import { ahoraLocal, diaSemana, hoyFecha, sumarDias, type EventoRow } from "@/lib/calendar";
import { construirHoy, type DatosHoy, type HabitoTipo, type ResumenHoy } from "@/lib/hoy";

// Cada parte se lee por separado: si una falla (por ejemplo, una tabla que aún no existe), las demás se siguen viendo.
async function intentar<T>(parte: string, vacio: T, f: () => PromiseLike<T>, fallos: string[]): Promise<T> {
  try {
    return await f();
  } catch {
    fallos.push(parte);
    return vacio;
  }
}

async function leerDatos(fecha: string, ahora: string): Promise<{ datos: DatosHoy; fallos: string[] }> {
  const fallos: string[] = [];
  const dow = diaSemana(fecha);

  const dia = await intentar("entreno", null as DatosHoy["dia"], async () => {
    const { data: d, error } = await supabase.from("routine_days").select("id, nombre_dia, es_dia_entreno").eq("dia_semana", dow).maybeSingle();
    if (error) throw error;
    if (!d) return null;
    const [ej, hab] = await Promise.all([
      supabase.from("routine_exercises").select("id", { count: "exact", head: true }).eq("routine_day_id", d.id),
      supabase.from("routine_daily_habits").select("tipo").eq("routine_day_id", d.id),
    ]);
    return {
      nombre_dia: d.nombre_dia,
      es_dia_entreno: d.es_dia_entreno,
      ejercicios: ej.count ?? 0,
      habitos: ((hab.data ?? []) as { tipo: HabitoTipo }[]).map((h) => h.tipo),
    };
  }, fallos);

  const [sesionesHoy, habitosHechos, perfil, comidasHoy, ultimoPeso, eventos, pendientes] = await Promise.all([
    intentar("sesiones", [] as DatosHoy["sesionesHoy"], async () => {
      const { data, error } = await supabase.from("training_sessions").select("completado, es_extra").eq("fecha", fecha);
      if (error) throw error;
      return data ?? [];
    }, fallos),
    intentar("habitos", [] as HabitoTipo[], async () => {
      const { data, error } = await supabase.from("daily_habit_logs").select("tipo, completado").eq("fecha", fecha);
      if (error) throw error;
      return ((data ?? []) as { tipo: HabitoTipo; completado: boolean }[]).filter((h) => h.completado).map((h) => h.tipo);
    }, fallos),
    intentar("perfil", null as DatosHoy["perfil"], async () => {
      const { data, error } = await supabase.from("nutrition_profile").select("kcal_objetivo, proteina_g, grasa_g, hidratos_g").maybeSingle();
      if (error) throw error;
      return data;
    }, fallos),
    intentar("comidas", [] as DatosHoy["comidasHoy"], async () => {
      const { data, error } = await supabase.from("food_log").select("kcal, proteina_g, grasa_g, hidratos_g").eq("fecha", fecha);
      if (error) throw error;
      return (data ?? []).map((c) => ({ kcal: +c.kcal, proteina_g: +c.proteina_g, grasa_g: +c.grasa_g, hidratos_g: +c.hidratos_g }));
    }, fallos),
    intentar("peso", null as DatosHoy["ultimoPeso"], async () => {
      const { data, error } = await supabase.from("weight_log").select("fecha, peso_kg").order("fecha", { ascending: false }).limit(1);
      if (error) throw error;
      return data?.[0] ? { fecha: data[0].fecha, peso_kg: +data[0].peso_kg } : null;
    }, fallos),
    intentar("agenda", [] as EventoRow[], () => leerVentana({ desde: fecha, hasta: sumarDias(fecha, 1) }), fallos),
    intentar("tareas", [] as EventoRow[], leerPendientes, fallos),
  ]);

  return { datos: { fecha, ahora, dia, sesionesHoy, habitosHechos, perfil, comidasHoy, ultimoPeso, eventos, pendientes }, fallos };
}

// El resumen del día del usuario con sesión. Se vuelve a leer al volver a la pestaña.
export function useHoy(): { resumen: ResumenHoy | null; fallos: string[]; cargando: boolean } {
  const { user } = useAuth();
  const fecha = hoyFecha();
  const q = useQuery({
    queryKey: ["hoy", user?.id, fecha],
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: () => leerDatos(fecha, ahoraLocal()),
  });
  const resumen = useMemo(() => (q.data ? construirHoy(q.data.datos) : null), [q.data]);
  return { resumen, fallos: q.data?.fallos ?? [], cargando: q.isLoading };
}
