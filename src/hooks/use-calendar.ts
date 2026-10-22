import { useCallback, useEffect, useMemo, useRef } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { leerTodo } from "@/lib/supabase-paging";
import {
  aplicarPlan,
  ahoraLocal,
  avisosPendientes,
  diaSemana,
  diasDeRango,
  expandir,
  hoyFecha,
  normalizarEvento,
  sumarDias,
  textoCuando,
  type EventoRow,
  type Fecha,
  type ItemExterno,
  type Plan,
  type Repeticion,
} from "@/lib/calendar";

export type Rango = { desde: Fecha; hasta: Fecha }; // hasta exclusivo

// Lo que necesita la pantalla del calendario. Hay una versión con Supabase (aquí) y otra en
// memoria para probar la pantalla sin base de datos.
export type AlmacenCalendario = {
  userId: string;
  filas: EventoRow[]; // series y eventos sueltos de la ventana que se está viendo
  cargando: boolean;
  error: string | null;
  tareasPendientes: EventoRow[]; // tareas sueltas sin hacer, de cualquier fecha
  aplicar: (plan: Plan) => Promise<void>;
  hijosDe: (serieId: string) => Promise<EventoRow[]>;
};

const COLUMNAS =
  "id, user_id, tipo, titulo, descripcion, ubicacion, todo_el_dia, inicio, fin, color, prioridad, hecho, repeticion, omitidas, serie_id, serie_original, recordatorio_min";

type FilaDb = {
  id: string; user_id: string; tipo: string; titulo: string; descripcion: string | null; ubicacion: string | null; todo_el_dia: boolean;
  inicio: string; fin: string; color: string; prioridad: string | null; hecho: boolean; repeticion: Json | null; omitidas: string[] | null;
  serie_id: string | null; serie_original: string | null; recordatorio_min: number | null;
};

const aFila = (r: FilaDb): EventoRow =>
  normalizarEvento({ ...r, repeticion: (r.repeticion as unknown as Repeticion | null) ?? null, omitidas: r.omitidas ?? [] } as EventoRow);

const aFilaDb = (f: EventoRow, userId: string) => ({
  id: f.id, user_id: userId, tipo: f.tipo, titulo: f.titulo, descripcion: f.descripcion, ubicacion: f.ubicacion, todo_el_dia: f.todo_el_dia,
  inicio: `${f.inicio}:00`, fin: `${f.fin}:00`, color: f.color, prioridad: f.prioridad, hecho: f.hecho,
  repeticion: (f.repeticion as unknown as Json | null) ?? null, omitidas: f.omitidas, serie_id: f.serie_id, serie_original: f.serie_original,
  recordatorio_min: f.recordatorio_min,
});

// Un mensaje claro si falta aplicar la migración (la tabla todavía no existe).
export function errorCalendario(e: unknown): Error {
  const x = e as { code?: string; message?: string } | null;
  const m = x?.message ?? "";
  if (x?.code === "PGRST205" || x?.code === "42P01" || /calendar_events/.test(m) && /schema cache|does not exist/i.test(m)) {
    return new Error("Falta aplicar en Supabase la migración «calendario». Pégala en el SQL Editor y vuelve a abrir esta página.");
  }
  return new Error(m || "No se ha podido guardar el cambio.");
}

// Tareas sueltas sin hacer, de cualquier fecha.
export async function leerPendientes(): Promise<EventoRow[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select(COLUMNAS)
    .eq("tipo", "tarea")
    .eq("hecho", false)
    .is("repeticion", null)
    .is("serie_id", null)
    .order("inicio")
    .limit(300);
  if (error) throw errorCalendario(error);
  return (data as unknown as FilaDb[]).map(aFila);
}

const filtroVentana = (r: Rango) => `repeticion.not.is.null,and(inicio.lt.${r.hasta}T00:00:00,fin.gte.${r.desde}T00:00:00)`;

export async function leerVentana(r: Rango): Promise<EventoRow[]> {
  const { data, error } = await leerTodo<FilaDb>((d, h) =>
    supabase.from("calendar_events").select(COLUMNAS).or(filtroVentana(r)).order("inicio").order("id").range(d, h) as unknown as PromiseLike<{ data: FilaDb[] | null; error: { message: string } | null }>,
  );
  if (error) throw errorCalendario(error);
  return data.map(aFila);
}

export function useAlmacenSupabase(rango: Rango): AlmacenCalendario | null {
  const { user } = useAuth();
  const qc = useQueryClient();
  const clave = useMemo(() => ["calendar_events", user?.id, rango.desde, rango.hasta], [user?.id, rango.desde, rango.hasta]);

  const eventos = useQuery({ queryKey: clave, enabled: !!user, placeholderData: keepPreviousData, queryFn: () => leerVentana(rango) });

  const pendientes = useQuery({ queryKey: ["calendar_tareas_pendientes", user?.id], enabled: !!user, queryFn: leerPendientes });

  const aplicar = useCallback(
    async (plan: Plan) => {
      if (!user) throw new Error("No hay sesión activa.");
      const previo = qc.getQueryData<EventoRow[]>(clave);
      if (previo) qc.setQueryData(clave, aplicarPlan(previo, plan)); // se ve al instante
      try {
        if (plan.guardar.length) {
          // Una sola petición = una sola operación en la base de datos
          const { error } = await supabase.from("calendar_events").upsert(plan.guardar.map((f) => aFilaDb(f, user.id)), { onConflict: "id" });
          if (error) throw errorCalendario(error);
        }
        if (plan.eliminar.length) {
          const { error } = await supabase.from("calendar_events").delete().in("id", plan.eliminar);
          if (error) throw errorCalendario(error);
        }
      } catch (e) {
        if (previo) qc.setQueryData(clave, previo);
        throw e instanceof Error ? e : errorCalendario(e);
      } finally {
        void qc.invalidateQueries({ queryKey: ["calendar_events"] });
        void qc.invalidateQueries({ queryKey: ["calendar_tareas_pendientes"] });
        void qc.invalidateQueries({ queryKey: ["calendar_avisos"] });
      }
    },
    [user, qc, clave],
  );

  const hijosDe = useCallback(async (serieId: string) => {
    const { data, error } = await supabase.from("calendar_events").select(COLUMNAS).eq("serie_id", serieId);
    if (error) throw errorCalendario(error);
    return (data as unknown as FilaDb[]).map(aFila);
  }, []);

  if (!user) return null;
  const error = eventos.error ?? pendientes.error;
  return {
    userId: user.id,
    filas: eventos.data ?? [],
    cargando: eventos.isLoading,
    error: error ? (error as Error).message : null,
    tareasPendientes: pendientes.data ?? [],
    aplicar,
    hijosDe,
  };
}

/* ------------------------------ Capas de solo lectura ------------------------------ */

// Plazos fiscales orientativos (los mismos de siempre) como una capa del calendario.
export function useCapaFiscal(rango: Rango, activa: boolean): ItemExterno[] {
  const q = useQuery({
    queryKey: ["fiscal_deadlines"],
    enabled: activa,
    queryFn: async () => {
      const { data, error } = await supabase.from("fiscal_deadlines").select("id, deadline_date, title").order("deadline_date");
      if (error) throw error;
      return data ?? [];
    },
  });
  return useMemo(
    () =>
      activa
        ? (q.data ?? [])
            .filter((d) => d.deadline_date >= rango.desde && d.deadline_date < rango.hasta)
            .map((d) => ({ id: `fiscal-${d.id}`, fecha: d.deadline_date, titulo: d.title, detalle: "Plazo fiscal orientativo. Verifica siempre en la AEAT antes de presentar.", capa: "fiscal", color: "cian" as const }))
        : [],
    [q.data, rango.desde, rango.hasta, activa],
  );
}

// Los días de entreno de «Mi Rutina» (Push el lunes, Pull el martes...) repetidos cada semana.
export function useCapaEntreno(rango: Rango, activa: boolean): ItemExterno[] {
  const q = useQuery({
    queryKey: ["routine_days_calendario"],
    enabled: activa,
    queryFn: async () => {
      const { data, error } = await supabase.from("routine_days").select("dia_semana, nombre_dia, es_dia_entreno");
      if (error) throw error;
      return data ?? [];
    },
  });
  return useMemo(() => {
    if (!activa) return [];
    const porDia = new Map((q.data ?? []).filter((d) => d.es_dia_entreno).map((d) => [d.dia_semana, d.nombre_dia]));
    return diasDeRango(rango.desde, rango.hasta)
      .filter((f) => porDia.has(diaSemana(f)))
      .map((f) => ({ id: `entreno-${f}`, fecha: f, titulo: `Entreno: ${porDia.get(diaSemana(f))}`, detalle: "Tu rutina de entrenamiento (se cambia en Entrenamiento → Mi Rutina).", capa: "entreno", color: "esmeralda" as const }));
  }, [q.data, rango.desde, rango.hasta, activa]);
}

/* ------------------------------ Avisos ------------------------------ */

// Avisa (mensaje en la app y, si lo permitiste, del navegador) de los recordatorios que vencen
// mientras la app está abierta. No hay avisos con la app cerrada.
export function useAvisosCalendario() {
  const { user } = useAuth();
  const hoy = hoyFecha();
  const ventana: Rango = { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, 3) };
  const q = useQuery({ queryKey: ["calendar_avisos", user?.id, ventana.desde], enabled: !!user, refetchInterval: 5 * 60 * 1000, queryFn: () => leerVentana(ventana) });
  const filas = q.data;
  const ultima = useRef(ahoraLocal());

  useEffect(() => {
    if (!filas) return;
    const revisar = () => {
      const ahora = ahoraLocal();
      const desde = ultima.current;
      ultima.current = ahora;
      const ocs = expandir(filas, ventana.desde, ventana.hasta);
      for (const o of avisosPendientes(ocs, desde, ahora)) {
        const cuando = textoCuando(o);
        toast(o.titulo, { description: cuando, duration: 15000 });
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification(o.titulo, { body: cuando });
          } catch {
            /* algunos navegadores solo permiten avisos desde el service worker */
          }
        }
      }
    };
    const t = setInterval(revisar, 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas]);
}
