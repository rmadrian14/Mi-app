import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { resolveActiveWorkspaceId } from "@/hooks/use-workspace";

export type Period = "mensual" | "anual";
export const PERIOD_DIVISOR: Record<Period, number> = { mensual: 1, anual: 12 };

export type FixedCostRow = {
  id: string;
  user_id: string;
  concept: string;
  amount: number;
  period: Period;
  created_at: string;
  is_cuota_autonomos: boolean;
};

export type VariableCostRow = {
  id: string;
  user_id: string;
  concept: string;
  amount: number;
  date: string;
  created_at: string;
  iva_percent: number;
  deducible: boolean;
  category: string | null;
};

export function useFixedCosts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<FixedCostRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("fixed_costs")
      .select("id, user_id, concept, amount, period, created_at, is_cuota_autonomos")
      .order("created_at", { ascending: false });
    if (!error) setRows(((data ?? []) as unknown) as FixedCostRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (
      concept: string,
      amount: number,
      period: Period,
      opts?: { is_cuota_autonomos?: boolean },
    ) => {
      if (!user) return null;
      const workspace_id = await resolveActiveWorkspaceId(user.id);
      const { data, error } = await supabase
        .from("fixed_costs")
        .insert({
          user_id: user.id,
          workspace_id,
          concept,
          amount,
          period,
          is_cuota_autonomos: opts?.is_cuota_autonomos ?? false,
        })
        .select("id, user_id, concept, amount, period, created_at, is_cuota_autonomos")
        .single();
      if (error) throw error;
      const row = data as unknown as FixedCostRow;
      setRows((prev) => [row, ...prev]);
      return row;
    },
    [user],
  );

  const update = useCallback(
    async (
      id: string,
      patch: Partial<{
        concept: string;
        amount: number;
        period: Period;
        is_cuota_autonomos: boolean;
      }>,
    ) => {
      const { data, error } = await supabase
        .from("fixed_costs")
        .update(patch)
        .eq("id", id)
        .select("id, user_id, concept, amount, period, created_at, is_cuota_autonomos")
        .single();
      if (error) throw error;
      const row = data as unknown as FixedCostRow;
      setRows((prev) => prev.map((r) => (r.id === id ? row : r)));
      return row;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("fixed_costs").delete().eq("id", id);
    if (error) throw error;
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { rows, loading, add, update, remove, refresh };
}

export function useVariableCosts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<VariableCostRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("variable_costs")
      .select("id, user_id, concept, amount, date, created_at, iva_percent, deducible, category")
      .order("date", { ascending: false });
    if (!error) setRows(((data ?? []) as unknown) as VariableCostRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (
      concept: string,
      amount: number,
      date: string,
      opts?: { iva_percent?: number; deducible?: boolean; category?: string | null },
    ) => {
      if (!user) return null;
      const workspace_id = await resolveActiveWorkspaceId(user.id);
      const { data, error } = await supabase
        .from("variable_costs")
        .insert({
          user_id: user.id,
          workspace_id,
          concept,
          amount,
          date,
          iva_percent: opts?.iva_percent ?? 21,
          deducible: opts?.deducible ?? true,
          category: opts?.category ?? null,
        })
        .select("id, user_id, concept, amount, date, created_at, iva_percent, deducible, category")
        .single();
      if (error) throw error;
      const row = data as unknown as VariableCostRow;
      setRows((prev) => [row, ...prev]);
      return row;
    },
    [user],
  );

  const update = useCallback(
    async (
      id: string,
      patch: Partial<{
        concept: string;
        amount: number;
        date: string;
        iva_percent: number;
        deducible: boolean;
        category: string | null;
      }>,
    ) => {
      const { data, error } = await supabase
        .from("variable_costs")
        .update(patch)
        .eq("id", id)
        .select("id, user_id, concept, amount, date, created_at, iva_percent, deducible, category")
        .single();
      if (error) throw error;
      const row = data as unknown as VariableCostRow;
      setRows((prev) => prev.map((r) => (r.id === id ? row : r)));
      return row;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("variable_costs").delete().eq("id", id);
    if (error) throw error;
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { rows, loading, add, update, remove, refresh };
}
