import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { RENOMBRADOS, SEED_FOODS } from "@/lib/food-seed";
import { type PesoRegistro, hoyISO, ordenar } from "@/lib/weight-trend";
import { escalarEntrada, sumarDias, type EntradaDiario, type NuevaEntrada } from "@/lib/food-log";
import type {
  CategoriaAlimento,
  Comida,
  NivelActividad,
  ObjetivoNutricional,
  Ritmo,
} from "@/lib/nutrition";

/* ------------------------------ Perfil nutricional ------------------------------ */

export type NutritionProfile = {
  id: string;
  user_id: string;
  nivel_actividad: NivelActividad;
  dias_entreno: number;
  objetivo: ObjetivoNutricional;
  ritmo: Ritmo;
  comidas_por_dia: number;
  restricciones: string[];
  alimentos_excluidos: string | null;
  kcal_objetivo: number;
  proteina_g: number;
  grasa_g: number;
  hidratos_g: number;
  editado_manual: boolean;
  kcal_mantenimiento: number | null;
  menu_activo_id: string | null;
};

// El menú activo se guarda aparte (al elegir un menú), no al guardar el perfil.
export type NutritionProfileInput = Omit<NutritionProfile, "id" | "user_id" | "menu_activo_id">;

export function useNutritionProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("nutrition_profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) setError(error.message);
    else {
      setError(null);
      setProfile((data as NutritionProfile | null) ?? null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const guardar = useCallback(
    async (input: NutritionProfileInput) => {
      if (!user) throw new Error("No hay sesión activa.");
      const { data, error } = await supabase
        .from("nutrition_profile")
        .upsert({ user_id: user.id, ...input }, { onConflict: "user_id" })
        .select("*")
        .single();
      if (error) throw error;
      const row = data as NutritionProfile;
      setProfile(row);
      return row;
    },
    [user],
  );

  return { profile, loading, error, guardar, refresh };
}

// Datos corporales compartidos con Entrenamiento (personal_profile). Solo se
// actualiza una fila existente; si no existe aún, la crea la pantalla de
// Entrenamiento (que además siembra la rutina), así que aquí se avisa.
export async function guardarDatosCorporales(
  userId: string,
  d: { sexo: string; edad: number; peso_kg: number; altura_cm: number },
): Promise<void> {
  const { data, error } = await supabase
    .from("personal_profile")
    .update({ sexo: d.sexo, edad: d.edad, peso_kg: d.peso_kg, altura_cm: d.altura_cm })
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Primero completa el cuestionario de Entrenamiento (datos personales).");
  }
}

/* ------------------------------ Alimentos ------------------------------ */

export type FoodRow = {
  id: string;
  user_id: string;
  nombre: string;
  categoria: CategoriaAlimento;
  kcal_100: number;
  proteina_100: number;
  grasa_100: number;
  hidratos_100: number;
  gramos_unidad: number | null;
  unidad_nombre: string | null;
  porcion_min_g: number;
  porcion_max_g: number;
  comidas: string[];
  contiene: string[];
  origen: "semilla" | "manual" | "openfoodfacts";
  codigo_barras: string | null;
  // Peso cocinado / peso tal como se pesa (arroz crudo ≈ 2,8; pollo crudo ≈ 0,75).
  factor_cocinado: number | null;
  // Cuánto aparece en los menús generados (1 = normal).
  frecuencia: number;
};

export type FoodInput = Omit<FoodRow, "id" | "user_id">;

const FOOD_COLS =
  "id, user_id, nombre, categoria, kcal_100, proteina_100, grasa_100, hidratos_100, gramos_unidad, unidad_nombre, porcion_min_g, porcion_max_g, comidas, contiene, origen, codigo_barras, factor_cocinado, frecuencia";

// Los numeric de Postgres llegan como número o como texto según el cliente.
function normalizarFood(r: any): FoodRow {
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    ...r,
    kcal_100: Number(r.kcal_100),
    proteina_100: Number(r.proteina_100),
    grasa_100: Number(r.grasa_100),
    hidratos_100: Number(r.hidratos_100),
    gramos_unidad: n(r.gramos_unidad),
    porcion_min_g: Number(r.porcion_min_g),
    porcion_max_g: Number(r.porcion_max_g),
    factor_cocinado: n(r.factor_cocinado),
    frecuencia: r.frecuencia == null ? 1 : Number(r.frecuencia),
  } as FoodRow;
}

export function useFoods() {
  const { user } = useAuth();
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setFoods([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("foods").select(FOOD_COLS).eq("user_id", user.id).order("nombre");
    setFoods(((data ?? []) as any[]).map(normalizarFood));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Idempotente: solo inserta los alimentos básicos que aún no existen (por
  // nombre) y nunca pisa los que el usuario haya editado.
  const cargarBasicos = useCallback(async () => {
    if (!user) throw new Error("No hay sesión activa.");
    // Nombres corregidos: se renombra el alimento que ya tienes para no duplicarlo. Si el nombre
    // nuevo ya existe (error de unicidad) no se toca nada.
    for (const [viejo, nuevo] of RENOMBRADOS) {
      const { error: errRen } = await supabase
        .from("foods")
        .update({ nombre: nuevo })
        .eq("user_id", user.id)
        .eq("nombre", viejo)
        .eq("origen", "semilla");
      if (errRen && errRen.code !== "23505") throw errRen;
    }
    const rows = SEED_FOODS.map((s) => ({
      user_id: user.id,
      nombre: s.nombre,
      categoria: s.categoria,
      kcal_100: s.kcal_100,
      proteina_100: s.proteina_100,
      grasa_100: s.grasa_100,
      hidratos_100: s.hidratos_100,
      gramos_unidad: s.gramos_unidad,
      unidad_nombre: s.unidad_nombre,
      porcion_min_g: s.porcion_min_g,
      porcion_max_g: s.porcion_max_g,
      comidas: s.comidas,
      contiene: s.contiene,
      origen: "semilla" as const,
      factor_cocinado: s.factor_cocinado,
      frecuencia: s.frecuencia,
    }));
    const { error } = await supabase
      .from("foods")
      .upsert(rows, { onConflict: "user_id,nombre", ignoreDuplicates: true });
    if (error) throw error;
    await refresh();
  }, [user, refresh]);

  const crear = useCallback(
    async (input: FoodInput) => {
      if (!user) throw new Error("No hay sesión activa.");
      const { data, error } = await supabase
        .from("foods")
        .insert({ user_id: user.id, ...input })
        .select(FOOD_COLS)
        .single();
      if (error) throw error;
      const row = normalizarFood(data);
      setFoods((prev) => [...prev, row].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      return row;
    },
    [user],
  );

  const actualizar = useCallback(async (id: string, patch: Partial<FoodInput>) => {
    const { data, error } = await supabase.from("foods").update(patch).eq("id", id).select(FOOD_COLS).single();
    if (error) throw error;
    const row = normalizarFood(data);
    setFoods((prev) => prev.map((f) => (f.id === id ? row : f)).sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return row;
  }, []);

  const eliminar = useCallback(async (id: string) => {
    const { error } = await supabase.from("foods").delete().eq("id", id);
    if (error) throw error;
    setFoods((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { foods, loading, crear, actualizar, eliminar, cargarBasicos, refresh };
}

/* ------------------------------ Menús ------------------------------ */

export type MenuRow = { id: string; nombre: string; created_at: string; compra_marcados: string[] };

export type MenuItemRow = {
  id: string;
  menu_id: string;
  dia_semana: number;
  comida: Comida;
  food_id: string;
  gramos: number;
  orden: number;
};

export type MenuItemInput = { dia_semana: number; comida: Comida; food_id: string; gramos: number };

const ITEM_COLS = "id, menu_id, dia_semana, comida, food_id, gramos, orden";
const MENU_COLS = "id, nombre, created_at, compra_marcados";

function normalizarItem(r: any): MenuItemRow {
  return { ...r, gramos: Number(r.gramos) } as MenuItemRow;
}

function normalizarMenu(r: any): MenuRow {
  return {
    id: r.id,
    nombre: r.nombre,
    created_at: r.created_at,
    compra_marcados: Array.isArray(r.compra_marcados) ? r.compra_marcados : [],
  };
}

const LS_MENU = "veract-menu-activo";

export function useMenus() {
  const { user } = useAuth();
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarItems = useCallback(async (menuId: string | null) => {
    if (!menuId) {
      setItems([]);
      return;
    }
    const { data } = await supabase
      .from("menu_items")
      .select(ITEM_COLS)
      .eq("menu_id", menuId)
      .order("dia_semana")
      .order("orden");
    setItems(((data ?? []) as any[]).map(normalizarItem));
  }, []);

  // El menú activo vive en el perfil nutricional (así móvil y ordenador
  // coinciden); localStorage queda solo de respaldo.
  const guardarActivo = useCallback(
    async (id: string | null) => {
      try {
        if (id) window.localStorage.setItem(LS_MENU, id);
      } catch {}
      if (!user) return;
      // Sin perfil nutricional aún no hay fila que actualizar; no es un error.
      await supabase.from("nutrition_profile").update({ menu_activo_id: id }).eq("user_id", user.id);
    },
    [user],
  );

  const refresh = useCallback(async () => {
    if (!user) {
      setMenus([]);
      setSelectedId(null);
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("menus").select(MENU_COLS).eq("user_id", user.id).order("created_at");
    const list = ((data ?? []) as any[]).map(normalizarMenu);
    setMenus(list);
    const { data: np } = await supabase
      .from("nutrition_profile")
      .select("menu_activo_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const remoto = (np as { menu_activo_id?: string | null } | null)?.menu_activo_id ?? null;
    let local: string | null = null;
    try {
      local = window.localStorage.getItem(LS_MENU);
    } catch {}
    const elegido =
      list.find((m) => m.id === remoto)?.id ?? list.find((m) => m.id === local)?.id ?? list[list.length - 1]?.id ?? null;
    setSelectedId(elegido);
    await cargarItems(elegido);
    setLoading(false);
  }, [user, cargarItems]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const seleccionar = useCallback(
    async (id: string | null) => {
      setSelectedId(id);
      void guardarActivo(id);
      await cargarItems(id);
    },
    [cargarItems, guardarActivo],
  );

  // Crea un menú con sus alimentos en una sola transacción y lo selecciona.
  const crearMenu = useCallback(
    async (nombre: string, iniciales: MenuItemInput[] = []) => {
      if (!user) throw new Error("No hay sesión activa.");
      const { data, error } = await supabase.rpc("crear_menu", {
        p_nombre: nombre,
        p_items: iniciales as unknown as Json,
      });
      if (error) throw error;
      const menu = normalizarMenu(Array.isArray(data) ? data[0] : data);
      setMenus((prev) => [...prev, menu]);
      setSelectedId(menu.id);
      void guardarActivo(menu.id);
      await cargarItems(menu.id);
      return menu;
    },
    [user, cargarItems, guardarActivo],
  );

  const renombrar = useCallback(async (id: string, nombre: string) => {
    const { error } = await supabase.from("menus").update({ nombre }).eq("id", id);
    if (error) throw error;
    setMenus((prev) => prev.map((m) => (m.id === id ? { ...m, nombre } : m)));
  }, []);

  const eliminarMenu = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("menus").delete().eq("id", id);
      if (error) throw error;
      const resto = menus.filter((m) => m.id !== id);
      setMenus(resto);
      if (selectedId === id) await seleccionar(resto[resto.length - 1]?.id ?? null);
    },
    [menus, selectedId, seleccionar],
  );

  const duplicarMenu = useCallback(
    async (id: string, nombre: string) => {
      const origen = id === selectedId ? items : [];
      let fuente = origen;
      if (id !== selectedId) {
        const { data } = await supabase.from("menu_items").select(ITEM_COLS).eq("menu_id", id);
        fuente = ((data ?? []) as any[]).map(normalizarItem);
      }
      return crearMenu(
        nombre,
        fuente.map((i) => ({ dia_semana: i.dia_semana, comida: i.comida, food_id: i.food_id, gramos: i.gramos })),
      );
    },
    [crearMenu, items, selectedId],
  );

  const anadirItem = useCallback(
    async (input: MenuItemInput) => {
      if (!user || !selectedId) throw new Error("No hay menú seleccionado.");
      const orden = items.filter((i) => i.dia_semana === input.dia_semana && i.comida === input.comida).length;
      const { data, error } = await supabase
        .from("menu_items")
        .insert({ user_id: user.id, menu_id: selectedId, orden, ...input })
        .select(ITEM_COLS)
        .single();
      if (error) throw error;
      const row = normalizarItem(data);
      setItems((prev) => [...prev, row]);
      return row;
    },
    [user, selectedId, items],
  );

  const actualizarGramos = useCallback(async (id: string, gramos: number) => {
    const { error } = await supabase.from("menu_items").update({ gramos }).eq("id", id);
    if (error) throw error;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, gramos } : i)));
  }, []);

  // Cambia los gramos de varios alimentos a la vez, en una sola transacción.
  const actualizarVarios = useCallback(async (cambios: { id: string; gramos: number }[]) => {
    if (!cambios.length) return;
    const { error } = await supabase.rpc("actualizar_gramos", { p_cambios: cambios as unknown as Json });
    if (error) throw error;
    const mapa = new Map(cambios.map((c) => [c.id, c.gramos]));
    setItems((prev) => prev.map((i) => (mapa.has(i.id) ? { ...i, gramos: mapa.get(i.id)! } : i)));
  }, []);

  const quitarItem = useCallback(async (id: string) => {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) throw error;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Sustituye los alimentos de un día (o solo de algunas comidas) en una sola
  // transacción: si algo falla, el día queda exactamente como estaba.
  const reemplazar = useCallback(
    async (dia: number, nuevos: Omit<MenuItemInput, "dia_semana">[], comidas?: Comida[]) => {
      if (!selectedId) throw new Error("No hay menú seleccionado.");
      const { data, error } = await supabase.rpc("reemplazar_dia", {
        p_menu_id: selectedId,
        p_dia: dia,
        p_comidas: comidas ?? null,
        p_items: nuevos as unknown as Json,
      });
      if (error) throw error;
      const creados = ((data ?? []) as any[]).map(normalizarItem);
      setItems((prev) => [
        ...prev.filter((i) => !(i.dia_semana === dia && (!comidas || comidas.includes(i.comida)))),
        ...creados,
      ]);
    },
    [selectedId],
  );

  // Alimentos ya marcados en la lista de la compra del menú activo (se guardan
  // en la base de datos, así que se ven igual en todos los dispositivos).
  const compraMarcados = useMemo(
    () => new Set(menus.find((m) => m.id === selectedId)?.compra_marcados ?? []),
    [menus, selectedId],
  );

  const marcarCompra = useCallback(
    async (marcados: string[]) => {
      if (!selectedId) return;
      const menuId = selectedId;
      setMenus((prev) => prev.map((m) => (m.id === menuId ? { ...m, compra_marcados: marcados } : m)));
      const { error } = await supabase.from("menus").update({ compra_marcados: marcados }).eq("id", menuId);
      if (error) throw error;
    },
    [selectedId],
  );

  const porDia = useMemo(() => {
    const m = new Map<number, MenuItemRow[]>();
    for (const it of items) {
      if (!m.has(it.dia_semana)) m.set(it.dia_semana, []);
      m.get(it.dia_semana)!.push(it);
    }
    for (const l of m.values()) l.sort((a, b) => a.orden - b.orden);
    return m;
  }, [items]);

  return {
    menus,
    selectedId,
    items,
    porDia,
    loading,
    compraMarcados,
    seleccionar,
    crearMenu,
    renombrar,
    eliminarMenu,
    duplicarMenu,
    anadirItem,
    actualizarGramos,
    actualizarVarios,
    quitarItem,
    reemplazar,
    marcarCompra,
    refresh,
  };
}

/* ------------------------------ Peso corporal ------------------------------ */

export type RegistroPeso = PesoRegistro & { id: string };

export function useWeightLog() {
  const { user } = useAuth();
  const [registros, setRegistros] = useState<RegistroPeso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setRegistros([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("weight_log")
      .select("id, fecha, peso_kg")
      .eq("user_id", user.id)
      .order("fecha");
    if (error) {
      setError(error.message);
      setRegistros([]);
    } else {
      setError(null);
      setRegistros(((data ?? []) as any[]).map((r) => ({ id: r.id, fecha: r.fecha, peso_kg: Number(r.peso_kg) })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Una medida por día: si ya existe, se sustituye. Si es la más reciente, el
  // peso del perfil compartido con Entrenamiento se mantiene al día.
  const registrar = useCallback(
    async (fecha: string, pesoKg: number): Promise<{ perfilActualizado: boolean }> => {
      if (!user) throw new Error("No hay sesión activa.");
      const { data, error } = await supabase
        .from("weight_log")
        .upsert({ user_id: user.id, fecha, peso_kg: pesoKg }, { onConflict: "user_id,fecha" })
        .select("id, fecha, peso_kg")
        .single();
      if (error) throw error;
      const nuevo: RegistroPeso = { id: data.id, fecha: data.fecha, peso_kg: Number(data.peso_kg) };
      const resto = registros.filter((r) => r.fecha !== fecha);
      const todos = ordenar([...resto, nuevo]) as RegistroPeso[];
      setRegistros(todos);
      const esElMasReciente = todos[todos.length - 1].fecha === fecha;
      if (esElMasReciente) {
        await supabase.from("personal_profile").update({ peso_kg: pesoKg }).eq("user_id", user.id);
      }
      return { perfilActualizado: esElMasReciente };
    },
    [user, registros],
  );

  const eliminar = useCallback(async (id: string) => {
    const { error } = await supabase.from("weight_log").delete().eq("id", id);
    if (error) throw error;
    setRegistros((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { registros, loading, error, registrar, eliminar, refresh, hoy: hoyISO };
}

/* ------------------------------ Diario de comidas ------------------------------ */

const LOG_COLS = "id, fecha, comida, food_id, nombre, gramos, kcal, proteina_g, grasa_g, hidratos_g, orden, created_at";
const DIAS_RECIENTES = 30;

function normalizarEntrada(r: any): EntradaDiario {
  return {
    id: r.id,
    fecha: r.fecha,
    comida: r.comida,
    food_id: r.food_id ?? null,
    nombre: r.nombre,
    gramos: r.gramos == null ? null : Number(r.gramos),
    kcal: Number(r.kcal),
    proteina_g: Number(r.proteina_g),
    grasa_g: Number(r.grasa_g),
    hidratos_g: Number(r.hidratos_g),
    orden: Number(r.orden),
    created_at: r.created_at,
  };
}

const porOrden = (a: EntradaDiario, b: EntradaDiario) =>
  a.orden - b.orden || (a.created_at ?? "").localeCompare(b.created_at ?? "");

// Lo que se come en una fecha (AAAA-MM-DD) y, aparte, el historial de los últimos
// días para sugerir "recientes". Cada entrada guarda sus kcal y macros ya
// calculados (ver src/lib/food-log.ts).
export function useFoodLog(fecha: string) {
  const { user } = useAuth();
  const [entradas, setEntradas] = useState<EntradaDiario[]>([]);
  const [historial, setHistorial] = useState<EntradaDiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setEntradas([]);
      setHistorial([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const desde = sumarDias(hoyISO(), -DIAS_RECIENTES);
    const [dia, hist] = await Promise.all([
      supabase
        .from("food_log")
        .select(LOG_COLS)
        .eq("user_id", user.id)
        .eq("fecha", fecha)
        .order("orden")
        .order("created_at"),
      supabase
        .from("food_log")
        .select(LOG_COLS)
        .eq("user_id", user.id)
        .gte("fecha", desde)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    const fallo = dia.error ?? hist.error;
    if (fallo) {
      setError(fallo.message);
      setEntradas([]);
      setHistorial([]);
    } else {
      setError(null);
      setEntradas(((dia.data ?? []) as any[]).map(normalizarEntrada).sort(porOrden));
      setHistorial(((hist.data ?? []) as any[]).map(normalizarEntrada));
    }
    setLoading(false);
  }, [user, fecha]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const anadir = useCallback(
    async (nuevas: NuevaEntrada[]) => {
      if (!user) throw new Error("No hay sesión activa.");
      if (!nuevas.length) return [];
      const { data, error } = await supabase
        .from("food_log")
        .insert(nuevas.map((n) => ({ ...n, user_id: user.id })))
        .select(LOG_COLS);
      if (error) throw error;
      const creadas = ((data ?? []) as any[]).map(normalizarEntrada);
      setEntradas((prev) => [...prev, ...creadas.filter((c) => c.fecha === fecha)].sort(porOrden));
      setHistorial((prev) => [...creadas, ...prev]);
      return creadas;
    },
    [user, fecha],
  );

  // Cambia los gramos de una entrada y reescala sus kcal y macros en proporción.
  const cambiarGramos = useCallback(
    async (id: string, gramos: number) => {
      const actual = entradas.find((e) => e.id === id);
      const nueva = actual ? escalarEntrada(actual, gramos) : null;
      if (!nueva) throw new Error("La cantidad no es válida.");
      const { error } = await supabase
        .from("food_log")
        .update({
          gramos: nueva.gramos,
          kcal: nueva.kcal,
          proteina_g: nueva.proteina_g,
          grasa_g: nueva.grasa_g,
          hidratos_g: nueva.hidratos_g,
        })
        .eq("id", id);
      if (error) throw error;
      const poner = (l: EntradaDiario[]) => l.map((e) => (e.id === id ? nueva : e));
      setEntradas(poner);
      setHistorial(poner);
    },
    [entradas],
  );

  const quitar = useCallback(async (id: string) => {
    const { error } = await supabase.from("food_log").delete().eq("id", id);
    if (error) throw error;
    setEntradas((prev) => prev.filter((e) => e.id !== id));
    setHistorial((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { entradas, historial, loading, error, anadir, cambiarGramos, quitar, refresh };
}
