import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { PlanPriceId } from "@/lib/stripe";

export type SubscriptionStatus = "active" | "trial" | "inactive";
// Compat: limite "máximo" del plan más alto (Pro). Las pantallas que sólo
// muestran avisos genéricos siguen importándolo.
export const VERIFACTU_MONTHLY_LIMIT = 2500;

export type PlanTier = 'basic' | 'medium' | 'pro' | 'none';

const PLAN_LIMIT_BY_TIER: Record<PlanTier, number> = {
  basic: 50,
  medium: 250,
  pro: 2500,
  none: 0,
};

export function useSubscription() {
  const { user } = useAuth();
  // Pagos desactivados temporalmente: todas las cuentas tienen acceso completo
  // como plan Pro mientras terminamos las pruebas internas.
  const [status, setStatus] = useState<SubscriptionStatus>("active");
  const [tier, setTier] = useState<PlanTier>('pro');
  const [priceId, setPriceId] = useState<PlanPriceId | null>(null);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [planLimit, setPlanLimit] = useState(PLAN_LIMIT_BY_TIER.pro);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const { count } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", user.id)
        .eq("status", "sent_to_aeat")
        .gte("fecha_emision", start)
        .lt("fecha_emision", end);
      if (cancelled) return;

      setStatus('active');
      setTier('pro');
      setPriceId(null);
      setPlanLimit(PLAN_LIMIT_BY_TIER.pro);
      setMonthlyCount(count ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Sin límite mientras los pagos están desactivados.
  const atVerifactuLimit = false;
  return { status, tier, priceId, monthlyCount, planLimit, loading, atVerifactuLimit };
}