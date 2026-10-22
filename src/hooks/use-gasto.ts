import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { leerTodo } from "@/lib/supabase-paging";
import { sumarDias, type Fecha } from "@/lib/calendar";
import { hoyISO } from "@/lib/weight-trend";

// Calorías apuntadas en el diario, día por día, de los últimos `dias` días (para estimar el gasto real).
export function useIngestasDiarias(dias = 120): { ingestas: Map<Fecha, number>; cargando: boolean; error: string | null } {
  const { user } = useAuth();
  const hoy = hoyISO();
  const q = useQuery({
    queryKey: ["food_log_kcal_dia", user?.id, hoy, dias],
    enabled: !!user,
    queryFn: async () => {
      const desde = sumarDias(hoy, -dias);
      const { data, error } = await leerTodo<{ fecha: string; kcal: number | string }>(
        (d, h) =>
          supabase.from("food_log").select("fecha, kcal").gte("fecha", desde).order("fecha").order("id").range(d, h) as unknown as PromiseLike<{
            data: { fecha: string; kcal: number | string }[] | null;
            error: { message: string } | null;
          }>,
      );
      if (error) throw new Error(error.message);
      const porDia = new Map<Fecha, number>();
      for (const f of data) porDia.set(f.fecha, (porDia.get(f.fecha) ?? 0) + Number(f.kcal));
      return porDia;
    },
  });
  return { ingestas: q.data ?? new Map<Fecha, number>(), cargando: q.isLoading, error: q.error ? (q.error as Error).message : null };
}
