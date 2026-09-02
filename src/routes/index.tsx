import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuth } from "@/hooks/use-auth";
import { PaywallView } from "@/components/paywall-view";
import {
  useFixedCosts,
  useVariableCosts,
  PERIOD_DIVISOR,
  type Period,
  type FixedCostRow,
  type VariableCostRow,
} from "@/hooks/use-costs";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend as RLegend,
  ResponsiveContainer,
} from "recharts";

import {
  Wallet,
  Receipt,
  Clock,
  TrendingUp,
  Calculator,
  Briefcase,
  ShieldAlert,
  Target,
  PlusCircle,
  TrendingDown,
  Trophy,
  RotateCcw,
  Gauge,
  BarChart3,
  Trash2,
  Plus,
  Tag,
  CalendarDays,
  CircleDollarSign,
  Info,
  Download,
  Pencil,
  Copy,
  Check,
  Newspaper,
  ExternalLink,
  X,
  Radar,
  FileText,
  Hourglass,
  ChevronDown,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

/* ------------------------------ utils ------------------------------ */

const fmt = (n: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);

const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------ Sparkline ------------------------------ */

function Sparkline({ points, active }: { points: number[]; active: boolean }) {
  const W = 120;
  const H = 24;
  if (!points.length || points.every((p) => p === 0)) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-6 w-full opacity-60">
        <line
          x1="2"
          y1={H / 2}
          x2={W - 2}
          y2={H / 2}
          stroke="rgb(100 116 139)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
      </svg>
    );
  }
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = points.length > 1 ? (W - 4) / (points.length - 1) : 0;
  const coords = points.map((v, i) => {
    const x = 2 + i * step;
    const y = H - 2 - ((v - min) / range) * (H - 4);
    return [x, y] as const;
  });
  const path = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L ${(2 + (points.length - 1) * step).toFixed(1)} ${H} L 2 ${H} Z`;
  const stroke = active ? "rgb(52 211 153)" : "rgb(110 231 183)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-6 w-full">
      <defs>
        <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkFill)" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function usePersistentState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);
  const hydratedRef = useRef(false);
  // Load from localStorage after mount to avoid SSR hydration mismatches.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setState(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [key, state]);
  return [state, setState] as const;
}

type Expense = { id: string; concept: string; amount: number; date: string };
type Income = { id: string; concept: string; amount: number; date: string };

/* ------------------------------ inputs ------------------------------ */

type NumInputProps = {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  icon: React.ReactNode;
  suffix?: string;
  min?: number;
  step?: number;
};

function NumberInput({
  label,
  hint,
  value,
  onChange,
  icon,
  suffix = "€",
  min = 0,
  step = 1,
}: NumInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
        <span className="text-emerald-400">{icon}</span>
        {label}
      </label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      <div className="relative">
        <input
          type="number"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 pr-10 text-slate-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
          {suffix}
        </span>
      </div>
    </div>
  );
}

function ResultCard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accent: "emerald" | "indigo";
}) {
  const ring =
    accent === "emerald"
      ? "from-emerald-500/20 to-emerald-500/0 border-emerald-500/30"
      : "from-indigo-500/20 to-indigo-500/0 border-indigo-500/30";
  const text = accent === "emerald" ? "text-emerald-400" : "text-indigo-400";
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${ring} bg-slate-800/40 p-5`}>
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <span className={text}>{icon}</span>
        {title}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</div>
      {subtitle && <div className="mt-1 text-xs text-slate-400">{subtitle}</div>}
    </div>
  );
}

/* ------------------------------ main ------------------------------ */

type TabKey = "contabilidad" | "proyectos" | "radar";

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/accounting", replace: true });
  }, [navigate]);
  return null;
}

export function Dashboard({ tab }: { tab: TabKey }) {
  const activeTab = tab;
  const { status: subStatus, loading: subLoading } = useSubscription();

  // Persistent data
  const [expenses, setExpenses] = usePersistentState<Expense[]>("fc.expenses", []);
  const [incomes, setIncomes] = usePersistentState<Income[]>("fc.incomes", []);

  // Costes fijos y variables ahora se persisten en Supabase (fixed_costs /
  // variable_costs) con RLS por auth.uid(). No hay estado local ni rotación
  // automática por trimestres — se muestra la ventana móvil desde los datos
  // reales.

  // Two-week pre-Q4 warning banner (dismissible per session).
  const q4Warning = useMemo(() => {
    const today = new Date();
    const Y = today.getFullYear();
    const oct1 = new Date(Y, 9, 1);
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntil = Math.ceil((oct1.getTime() - today.getTime()) / msPerDay);
    return { show: daysUntil > 0 && daysUntil <= 14, daysUntil, year: Y };
  }, []);
  const [q4WarningDismissed, setQ4WarningDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem("q4WarningDismissed") === "true";
    } catch {
      return false;
    }
  });

  // Calculator inputs (persisted)
  const [marketRate, setMarketRate] = usePersistentState("fc.marketRate", 30);
  const [profitMargin, setProfitMargin] = usePersistentState("fc.profitMargin", 20);
  const [businessExpenses, setBusinessExpenses] = usePersistentState(
    "fc.businessExpenses",
    300,
  );
  const [monthlyBillableHours, setMonthlyBillableHours] = usePersistentState(
    "fc.monthlyBillableHours",
    100,
  );
  const [projectHours, setProjectHours] = usePersistentState("fc.projectHours", 40);
  const [contingency, setContingency] = usePersistentState("fc.contingency", 10);

  // Gamification
  const [monthlyGoal, setMonthlyGoal] = usePersistentState("fc.monthlyGoal", 3000);
  const [todayIncome, setTodayIncome] = useState(0);
  const celebratedRef = useRef(false);

  const totalExpenses = useMemo(
    () => expenses.reduce((s, e) => s + (e.amount || 0), 0),
    [expenses],
  );
  const totalIncomes = useMemo(
    () => incomes.reduce((s, i) => s + (i.amount || 0), 0),
    [incomes],
  );
  const netBalance = totalIncomes - totalExpenses;

  const { hourlyRate, expensePerHour, projectPrice } = useMemo(() => {
    const hours = Math.max(monthlyBillableHours, 1);
    const expPerHour = businessExpenses / hours;
    const rate = (marketRate + expPerHour) * (1 + profitMargin / 100);
    const price = projectHours * rate * (1 + contingency / 100);
    return { hourlyRate: rate, expensePerHour: expPerHour, projectPrice: price };
  }, [marketRate, profitMargin, businessExpenses, monthlyBillableHours, projectHours, contingency]);

  const goalSafe = Math.max(monthlyGoal, 1);
  const progressPct = Math.min(100, (totalIncomes / goalSafe) * 100);

  useEffect(() => {
    if (progressPct >= 100 && !celebratedRef.current) {
      celebratedRef.current = true;
    }
    if (progressPct < 100) celebratedRef.current = false;
  }, [progressPct]);

  if (activeTab === "contabilidad" && !subLoading && subStatus === "inactive") {
    return <PaywallView feature="Contabilidad" />;
  }

  return (
    <div className="min-h-full w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
            {q4Warning.show && !q4WarningDismissed && (
              <div className="relative mb-6 flex items-start gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 pr-10 text-sm text-amber-100 shadow">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <div className="font-semibold">
                    Aviso: rotación de trimestres en {q4Warning.daysUntil}{" "}
                    {q4Warning.daysUntil === 1 ? "día" : "días"}
                  </div>
                  <div className="mt-0.5 text-amber-100/90">
                    Al entrar en el T4 de {q4Warning.year}, todos los proyectos,
                    transacciones y registros del T1 de {q4Warning.year} se eliminarán
                    de forma permanente para dar paso al T1 de {q4Warning.year + 1}.
                    Exporta tus datos si quieres conservarlos.
                  </div>
                </div>
                <button
                  onClick={() => {
                    try {
                      sessionStorage.setItem("q4WarningDismissed", "true");
                    } catch {}
                    setQ4WarningDismissed(true);
                  }}
                  className="absolute right-2 top-2 rounded-md p-1 text-amber-200/80 transition-colors hover:bg-amber-500/20 hover:text-amber-50"
                  title="Cerrar"
                  aria-label="Cerrar aviso"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {activeTab === "contabilidad" && (
              <ContabilidadView />
            )}
            {activeTab === "radar" && <RadarAutonomoView />}
      </div>
    </div>
  );
}

/* ------------------------------ Contabilidad ------------------------------ */

type VarCostExtras = {
  iva_percent: number;
  deducible: boolean;
  category: string | null;
};

function QuarterAddForm({
  quarter,
  kind,
  onAdd,
}: {
  quarter: number;
  kind: "income" | "variable_expense";
  onAdd: (name: string, amount: number, extras?: VarCostExtras) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [ivaPercent, setIvaPercent] = useState<number>(21);
  const [deducible, setDeducible] = useState<boolean>(true);
  const [category, setCategory] = useState<string>("");
  const isVar = kind === "variable_expense";
  return (
    <div className="w-full max-w-full space-y-2">
      <div className="grid w-full max-w-full grid-cols-1 gap-2 sm:grid-cols-12">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            kind === "income"
              ? `Corrección de ingreso T${quarter}`
              : `Concepto (ej. Software, Alquiler...)`
          }
          className="w-full max-w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 sm:col-span-7"
        />
        <input
          type="number"
          min={0}
          step="0.01"
          value={amount || ""}
          onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          placeholder="€ (con IVA)"
          className="w-full max-w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 sm:col-span-3"
        />
        <button
          onClick={() => {
            if (!name.trim() || amount <= 0) return;
            onAdd(
              name,
              amount,
              isVar
                ? {
                    iva_percent: ivaPercent,
                    deducible,
                    category: category.trim() || null,
                  }
                : undefined,
            );
            setName("");
            setAmount(0);
            setIvaPercent(21);
            setDeducible(true);
            setCategory("");
          }}
          className="flex w-full max-w-full items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 sm:col-span-2"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {isVar && (
        <div className="grid w-full max-w-full grid-cols-1 gap-2 sm:grid-cols-12">
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 sm:col-span-4">
            <span className="shrink-0 text-slate-500">IVA</span>
            <select
              value={ivaPercent}
              onChange={(e) => setIvaPercent(Number(e.target.value))}
              className="ml-auto bg-transparent text-sm text-slate-100 outline-none"
            >
              <option value={21} className="bg-slate-900">21%</option>
              <option value={10} className="bg-slate-900">10%</option>
              <option value={4} className="bg-slate-900">4%</option>
              <option value={0} className="bg-slate-900">Exento / 0%</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 sm:col-span-4">
            <input
              type="checkbox"
              checked={deducible}
              onChange={(e) => setDeducible(e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
            <span>Deducible fiscalmente</span>
          </label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoría (opcional)"
            className="w-full max-w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500 sm:col-span-4"
          />
        </div>
      )}
    </div>
  );
}

// GestoriaExportButton removed — reemplazado por un único export Excel unificado
// con formato estándar de gestoría (base / %IVA / cuota / total) y hoja de resumen anual.

function ContabilidadView() {
  // Fixed & variable costs are persisted per-user in Supabase (RLS by
  // auth.uid()). Reads/writes flow through these hooks — no localStorage.
  const {
    rows: fixedCosts,
    add: addFixedCost,
    update: updateFixedCost,
    remove: removeFixedCost,
  } = useFixedCosts();
  const {
    rows: variableCosts,
    add: addVariableCost,
    update: updateVariableCost,
    remove: removeVariableCost,
  } = useVariableCosts();
  // Real invoices fetched from Supabase. Replaces the legacy `gprojects` source.
  type InvoiceRow = {
    id: string;
    numero_factura: string;
    fecha_emision: string;
    nif_receptor: string;
    nombre_receptor: string;
    base_imponible: number;
    iva_porcentaje: number;
    total_factura: number;
    hash_verifactu: string | null;
    cobrada_at: string | null;
    metodo_cobro: string | null;
  };
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const { user } = useAuth();
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setInvoices([]);
      setInvoicesLoading(false);
      return;
    }
    (async () => {
      setInvoicesLoading(true);
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, numero_factura, fecha_emision, nif_receptor, nombre_receptor, base_imponible, iva_porcentaje, total_factura, hash_verifactu, cobrada_at, metodo_cobro",
        )
        // Devengo: cuenta toda factura ya emitida (incluye pendientes de envío AEAT),
        // no solo las ya remitidas. Excluimos drafts.
        .in("status", ["issued", "pending", "sent_to_aeat"])
        .order("fecha_emision", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error("No se pudieron cargar las facturas: " + error.message);
        setInvoices([]);
      } else {
        setInvoices((data ?? []) as InvoiceRow[]);
      }
      setInvoicesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Marca / desmarca una factura como cobrada (tesorería, no afecta al devengo fiscal).
  const toggleInvoicePaid = async (inv: InvoiceRow) => {
    const nowIso = new Date().toISOString();
    const nextValue = inv.cobrada_at ? null : nowIso;
    const prev = invoices;
    setInvoices((rows) => rows.map((r) => (r.id === inv.id ? { ...r, cobrada_at: nextValue } : r)));
    const { error } = await supabase
      .from("invoices")
      .update({ cobrada_at: nextValue })
      .eq("id", inv.id);
    if (error) {
      setInvoices(prev);
      toast.error("No se pudo actualizar el cobro: " + error.message);
      return;
    }
    toast.success(nextValue ? "Factura marcada como cobrada." : "Factura marcada como pendiente.");
  };
  // Fixed cost form
  const [fxName, setFxName] = useState("");
  const [fxAmount, setFxAmount] = useState("");
  const [fxFreq, setFxFreq] = useState<Period>("mensual");
  const [fxIsCuotaAut, setFxIsCuotaAut] = useState(false);

  const addFixed = async () => {
    const amt = parseFloat(fxAmount);
    if (!fxName.trim() || !Number.isFinite(amt) || amt <= 0) {
      toast.error("Introduce un nombre y una cantidad válida (> 0).");
      return;
    }
    if (amt > 1_000_000) {
      toast.error("La cantidad parece demasiado alta. Revísala.");
      return;
    }
    try {
      await addFixedCost(fxName.trim(), amt, fxFreq, { is_cuota_autonomos: fxIsCuotaAut });
      setFxName("");
      setFxAmount("");
      setFxFreq("mensual");
      setFxIsCuotaAut(false);
    } catch (e) {
      toast.error("No se pudo guardar el gasto fijo: " + (e as Error).message);
    }
  };

  // Edición inline de gastos fijos.
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [editingFixedDraft, setEditingFixedDraft] = useState<{
    concept: string;
    amount: number;
    period: Period;
    is_cuota_autonomos: boolean;
  } | null>(null);
  const startEditFixed = (f: FixedCostRow) => {
    setEditingFixedId(f.id);
    setEditingFixedDraft({
      concept: f.concept,
      amount: Number(f.amount) || 0,
      period: f.period,
      is_cuota_autonomos: !!f.is_cuota_autonomos,
    });
  };
  const cancelEditFixed = () => {
    setEditingFixedId(null);
    setEditingFixedDraft(null);
  };
  const saveEditFixed = async () => {
    if (!editingFixedId || !editingFixedDraft) return;
    const d = editingFixedDraft;
    if (!d.concept.trim() || !Number.isFinite(d.amount) || d.amount <= 0) {
      toast.error("Concepto o importe no válidos.");
      return;
    }
    try {
      await updateFixedCost(editingFixedId, {
        concept: d.concept.trim(),
        amount: d.amount,
        period: d.period,
        is_cuota_autonomos: d.is_cuota_autonomos,
      });
      cancelEditFixed();
      toast.success("Gasto fijo actualizado.");
    } catch (e) {
      toast.error("No se pudo actualizar: " + (e as Error).message);
    }
  };

  // Rolling 4-quarter window. When today is in Q4 of Y, the displayed T1
  // refers to next year (Y+1); the rest belong to Y.
  const today = new Date();
  const currentYear = today.getFullYear();
  const inQ4 = Math.floor(today.getMonth() / 3) + 1 === 4;
  const yearForQuarter: Record<number, number> = {
    1: inQ4 ? currentYear + 1 : currentYear,
    2: currentYear,
    3: currentYear,
    4: currentYear,
  };
  const year = currentYear;

  const fixedMonthly = useMemo(
    () =>
      fixedCosts.reduce(
        (s, f) => s + Number(f.amount) / PERIOD_DIVISOR[f.period],
        0,
      ),
    [fixedCosts],
  );
  const fixedQuarterly = fixedMonthly * 3;

  // Bucket variable costs into the rolling 4-quarter window (by `date`).
  const varCostsByQuarter = useMemo(() => {
    const buckets: Record<number, VariableCostRow[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const v of variableCosts) {
      if (!v.date) continue;
      const d = new Date(v.date);
      const q = Math.floor(d.getMonth() / 3) + 1;
      if (d.getFullYear() !== yearForQuarter[q]) continue;
      buckets[q].push(v);
    }
    return buckets;
  }, [variableCosts, year]);

  // Bucket invoices into the same rolling 4-quarter window.
  const invoicesByQuarter = useMemo(() => {
    const buckets: Record<number, InvoiceRow[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const inv of invoices) {
      if (!inv.fecha_emision) continue;
      const d = new Date(inv.fecha_emision);
      const q = Math.floor(d.getMonth() / 3) + 1;
      if (d.getFullYear() !== yearForQuarter[q]) continue;
      buckets[q].push(inv);
    }
    return buckets;
  }, [invoices, year]);

  // Per-quarter computation. IVA is computed row-by-row from `iva_percent` and
  // only deducible expenses reduce IVA soportado and the IRPF base. IRPF uses
  // the pago fraccionado (modelo 130): 20% del rendimiento neto acumulado del
  // año menos lo ya devengado en trimestres anteriores.
  const quarterCalcs = useMemo(() => {
    const result: Record<number, {
      grossIncome: number;
      baseImponible: number;
      ivaRepercutido: number;
      variableExpenses: number;
      deducibleExpenses: number;
      baseGastoVar: number;
      ivaSoportado: number;
      ivaAPagar: number; // signed: negativo = a compensar
      fixedQuarterly: number;
      totalExpenses: number;
      irpf: number;
      totalTaxes: number;
      netBase: number;
      netReal: number;
    }> = {} as never;

    let cumulativeNet = 0;
    let cumulativeIrpf = 0;

    for (const q of [1, 2, 3, 4] as const) {
      const qInvoices = invoicesByQuarter[q];
      const qVarCosts = varCostsByQuarter[q];

      let grossIncome = 0;
      let baseImponible = 0;
      for (const inv of qInvoices) {
        grossIncome += Number(inv.total_factura) || 0;
        baseImponible += Number(inv.base_imponible) || 0;
      }
      const ivaRepercutido = grossIncome - baseImponible;

      let variableExpenses = 0;
      let deducibleExpenses = 0;
      let baseGastoVar = 0;
      let ivaSoportado = 0;
      for (const v of qVarCosts) {
        const amt = Number(v.amount) || 0;
        variableExpenses += amt;
        if (!v.deducible) continue;
        deducibleExpenses += amt;
        const iva = Number(v.iva_percent) || 0;
        const base = iva > 0 ? amt / (1 + iva / 100) : amt;
        baseGastoVar += base;
        ivaSoportado += amt - base;
      }
      // Firmado: si es negativo, es IVA a compensar
      const ivaAPagar = ivaRepercutido - ivaSoportado;

      // Rendimiento neto (base IRPF): solo cuenta gasto deducible.
      const totalDeducExpenses = deducibleExpenses + fixedQuarterly;
      const netBase = baseImponible - baseGastoVar - fixedQuarterly;
      cumulativeNet += netBase;

      // Modelo 130: 20% del rendimiento neto acumulado, menos lo ya pagado en
      // trimestres anteriores del mismo año. Si sale negativo, el pago del
      // trimestre es 0 (no se devuelve ese exceso hasta la Renta anual).
      const irpfAccumulated = Math.max(0, cumulativeNet) * 0.20;
      const irpf = Math.max(0, irpfAccumulated - cumulativeIrpf);
      cumulativeIrpf += irpf;

      const totalExpenses = variableExpenses + fixedQuarterly;
      const totalTaxes = Math.max(0, ivaAPagar) + irpf;
      const netReal = grossIncome - totalExpenses - totalTaxes;

      result[q] = {
        grossIncome,
        baseImponible,
        ivaRepercutido,
        variableExpenses,
        deducibleExpenses,
        baseGastoVar,
        ivaSoportado,
        ivaAPagar,
        fixedQuarterly,
        totalExpenses,
        irpf,
        totalTaxes,
        netBase,
        netReal,
      };
      void totalDeducExpenses;
    }
    return result;
  }, [varCostsByQuarter, invoicesByQuarter, fixedQuarterly]);

  const currentQ = Math.floor(new Date().getMonth() / 3) + 1;
  const [openQuarter, setOpenQuarter] = useState<number>(currentQ);

  // ---- Dashboard metrics: KPIs del trimestre en curso, vencimiento y cobros ----
  const dashboard = useMemo(() => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    const y = now.getFullYear();
    const c = quarterCalcs[q];

    // Provisión Hacienda: IVA a pagar (0 si es a compensar) + IRPF 130.
    // IVA a compensar se muestra aparte, no reduce la provisión.
    const ivaToPay = Math.max(0, c.ivaAPagar);
    const ivaToOffset = Math.max(0, -c.ivaAPagar);
    const provision = ivaToPay + c.irpf;

    // Neto real disponible del trimestre (después de impuestos).
    const netAvailable = c.netReal;

    // Progreso del trimestre.
    const quarterStart = new Date(y, (q - 1) * 3, 1);
    const quarterEnd = new Date(y, q * 3, 0, 23, 59, 59); // last day of quarter
    const totalMs = quarterEnd.getTime() - quarterStart.getTime();
    const elapsedMs = Math.max(0, now.getTime() - quarterStart.getTime());
    const progressPct = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

    // Fecha límite de presentación del modelo (20 abril / julio / octubre, 30 enero para T4).
    const deadlineMap: Record<number, Date> = {
      1: new Date(y, 3, 20), // 20 abril
      2: new Date(y, 6, 20), // 20 julio
      3: new Date(y, 9, 20), // 20 octubre
      4: new Date(y + 1, 0, 30), // 30 enero del año siguiente
    };
    const deadline = deadlineMap[q];
    const daysToClose = Math.max(
      0,
      Math.ceil((quarterEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const daysToDeadline = Math.ceil(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Facturas pendientes de cobro (no marcadas cobrada_at) del año en curso.
    const pending = invoices
      .filter((inv) => !inv.cobrada_at && inv.fecha_emision)
      .map((inv) => {
        const emit = new Date(inv.fecha_emision);
        const daysOld = Math.floor((now.getTime() - emit.getTime()) / (1000 * 60 * 60 * 24));
        return { inv, daysOld };
      })
      .sort((a, b) => b.daysOld - a.daysOld);
    const pendingTotal = pending.reduce((s, p) => s + (Number(p.inv.total_factura) || 0), 0);
    const pendingBase = pending.reduce((s, p) => s + (Number(p.inv.base_imponible) || 0), 0);
    const paidInvoices = invoices.filter((inv) => inv.cobrada_at);
    const collectedTotal = paidInvoices.reduce(
      (s, inv) => s + (Number(inv.total_factura) || 0),
      0,
    );

    // Caja disponible (tesorería real): cobrado − gastos − impuestos ya provisionados.
    // Simplificación: usamos el neto real del trimestre pero descontamos lo aún no cobrado.
    const pendingInQuarter = pending
      .filter(({ inv }) => {
        const d = new Date(inv.fecha_emision);
        return d.getFullYear() === y && Math.floor(d.getMonth() / 3) + 1 === q;
      })
      .reduce((s, p) => s + (Number(p.inv.total_factura) || 0), 0);
    const cashAvailable = netAvailable - pendingInQuarter;

    return {
      q,
      y,
      c,
      ivaToPay,
      ivaToOffset,
      provision,
      netAvailable,
      cashAvailable,
      progressPct,
      deadline,
      daysToClose,
      daysToDeadline,
      pending,
      pendingTotal,
      pendingBase,
      paidInvoices,
      collectedTotal,
    };
  }, [quarterCalcs, invoices]);

  // Totales anuales agregados sobre los 4 trimestres.
  const annualTotals = useMemo(() => {
    const acc = {
      grossIncome: 0,
      baseImponible: 0,
      ivaRepercutido: 0,
      baseGastoVar: 0,
      ivaSoportado: 0,
      fixedQuarterly: 0,
      variableExpenses: 0,
      irpf: 0,
      ivaAPagar: 0,
      totalTaxes: 0,
      netBase: 0,
      netReal: 0,
    };
    for (const q of [1, 2, 3, 4] as const) {
      const c = quarterCalcs[q];
      acc.grossIncome += c.grossIncome;
      acc.baseImponible += c.baseImponible;
      acc.ivaRepercutido += c.ivaRepercutido;
      acc.baseGastoVar += c.baseGastoVar;
      acc.ivaSoportado += c.ivaSoportado;
      acc.fixedQuarterly += c.fixedQuarterly;
      acc.variableExpenses += c.variableExpenses;
      acc.irpf += c.irpf;
      acc.ivaAPagar += c.ivaAPagar;
      acc.totalTaxes += c.totalTaxes;
      acc.netBase += c.netBase;
      acc.netReal += c.netReal;
    }
    return acc;
  }, [quarterCalcs]);
  const [showAnnual, setShowAnnual] = useState(false);

  // Per-user alert key so the notice reappears when switching accounts.
  const alertKey = user?.id ? `hideStorageAlert:${user.id}` : null;
  const [showStorageAlert, setShowStorageAlert] = useState<boolean>(true);
  useEffect(() => {
    if (typeof window === "undefined" || !alertKey) return;
    try {
      setShowStorageAlert(localStorage.getItem(alertKey) !== "true");
    } catch {
      setShowStorageAlert(true);
    }
  }, [alertKey]);

  // Insert a variable cost for quarter Q (date = today when today is in Q,
  // otherwise the first day of that quarter's target year).
  const addVariableCostToQuarter = async (
    q: number,
    name: string,
    amount: number,
    extras?: VarCostExtras,
  ) => {
    if (!name.trim()) {
      toast.error("Introduce un concepto para el gasto.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Introduce un importe válido (> 0).");
      return;
    }
    if (amount > 1_000_000) {
      toast.error("El importe parece demasiado alto. Revísalo.");
      return;
    }
    const now = new Date();
    const targetYear = yearForQuarter[q];
    const inThisQuarter =
      now.getFullYear() === targetYear && Math.floor(now.getMonth() / 3) + 1 === q;
    // If the target quarter is in the future, park it at its first day; otherwise
    // never use a future date (would break devengo).
    const startOfQ = new Date(targetYear, (q - 1) * 3, 1);
    const d = inThisQuarter ? now : startOfQ > now ? startOfQ : startOfQ;
    try {
      await addVariableCost(name.trim(), amount, d.toISOString().slice(0, 10), extras);
    } catch (e) {
      toast.error("No se pudo guardar el coste variable: " + (e as Error).message);
    }
  };

  // Inline edit state for variable cost rows.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    concept: string;
    amount: number;
    iva_percent: number;
    deducible: boolean;
    category: string;
  } | null>(null);
  const startEdit = (v: VariableCostRow) => {
    setEditingId(v.id);
    setEditDraft({
      concept: v.concept,
      amount: Number(v.amount) || 0,
      iva_percent: Number(v.iva_percent) || 21,
      deducible: !!v.deducible,
      category: v.category ?? "",
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };
  const saveEdit = async () => {
    if (!editingId || !editDraft) return;
    if (!editDraft.concept.trim() || editDraft.amount <= 0) {
      toast.error("Concepto e importe son obligatorios.");
      return;
    }
    try {
      await updateVariableCost(editingId, {
        concept: editDraft.concept.trim(),
        amount: editDraft.amount,
        iva_percent: editDraft.iva_percent,
        deducible: editDraft.deducible,
        category: editDraft.category.trim() || null,
      });
      cancelEdit();
    } catch (e) {
      toast.error("No se pudo actualizar: " + (e as Error).message);
    }
  };

  const [exporting, setExporting] = useState(false);
  const exportExcel = async () => {
    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "Contabilidad";
      wb.created = new Date();

      const EUR = '#,##0.00 "€"';
      const PCT = '0.00"%"';
      const FONT = { name: "Arial" as const };

      const paintCells = (
        ws: ExcelJS.Worksheet,
        rowNumber: number,
        cols: number,
        argb: string,
        bold = false,
      ) => {
        for (let col = 1; col <= cols; col++) {
          const cell = ws.getCell(rowNumber, col);
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
          cell.font = { ...FONT, bold };
        }
      };

      // ─── Resumen Anual ────────────────────────────────────────────────
      const summary = wb.addWorksheet("Resumen Anual");
      summary.columns = [
        { width: 22 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 18 },
        { width: 18 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
      ];
      const sHeader = summary.addRow([
        "Periodo",
        "Base Ingresos",
        "IVA Repercutido",
        "Base Gastos Deduc.",
        "IVA Soportado",
        "IVA Resultado",
        "Rendimiento Neto",
        "IRPF (Mod. 130)",
        "Total Impuestos",
        "Neto Real",
      ]);
      sHeader.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      paintCells(summary, sHeader.number, 10, "FFDDE8F5", true);

      const totals = {
        base: 0, ivaR: 0, baseG: 0, ivaS: 0, ivaRes: 0, neto: 0, irpf: 0, imp: 0, real: 0,
      };
      for (const q of [1, 2, 3, 4] as const) {
        const c = quarterCalcs[q];
        const row = summary.addRow([
          `T${q} ${yearForQuarter[q]}`,
          Number(c.baseImponible.toFixed(2)),
          Number(c.ivaRepercutido.toFixed(2)),
          Number(c.baseGastoVar.toFixed(2)),
          Number(c.ivaSoportado.toFixed(2)),
          Number(c.ivaAPagar.toFixed(2)),
          Number(c.netBase.toFixed(2)),
          Number(c.irpf.toFixed(2)),
          Number((Math.max(0, c.ivaAPagar) + c.irpf).toFixed(2)),
          Number(c.netReal.toFixed(2)),
        ]);
        row.eachCell((cell, col) => {
          if (col >= 2) cell.numFmt = EUR;
          cell.font = FONT;
        });
        totals.base += c.baseImponible;
        totals.ivaR += c.ivaRepercutido;
        totals.baseG += c.baseGastoVar;
        totals.ivaS += c.ivaSoportado;
        totals.ivaRes += c.ivaAPagar;
        totals.neto += c.netBase;
        totals.irpf += c.irpf;
        totals.imp += Math.max(0, c.ivaAPagar) + c.irpf;
        totals.real += c.netReal;
      }
      const totalRow = summary.addRow([
        "TOTAL",
        Number(totals.base.toFixed(2)),
        Number(totals.ivaR.toFixed(2)),
        Number(totals.baseG.toFixed(2)),
        Number(totals.ivaS.toFixed(2)),
        Number(totals.ivaRes.toFixed(2)),
        Number(totals.neto.toFixed(2)),
        Number(totals.irpf.toFixed(2)),
        Number(totals.imp.toFixed(2)),
        Number(totals.real.toFixed(2)),
      ]);
      paintCells(summary, totalRow.number, 10, "FFD9EAD3", true);
      totalRow.eachCell((cell, col) => {
        if (col >= 2) cell.numFmt = EUR;
      });

      // ─── Hoja por trimestre ───────────────────────────────────────────
      for (const q of [1, 2, 3, 4] as const) {
        const qInvoices = invoicesByQuarter[q];
        const qVar = varCostsByQuarter[q];
        const c = quarterCalcs[q];
        const ws = wb.addWorksheet(`T${q} ${yearForQuarter[q]}`);
        ws.columns = [
          { width: 12 },
          { width: 20 },
          { width: 30 },
          { width: 18 },
          { width: 14 },
          { width: 10 },
          { width: 14 },
          { width: 14 },
          { width: 14 },
        ];

        // Título del bloque
        const title = ws.addRow([`FACTURAS EMITIDAS · T${q} ${yearForQuarter[q]}`]);
        ws.mergeCells(title.number, 1, title.number, 9);
        paintCells(ws, title.number, 9, "FF00A65A", true);
        title.getCell(1).font = { ...FONT, bold: true, color: { argb: "FFFFFFFF" } };
        title.alignment = { horizontal: "left", vertical: "middle" };

        const invHead = ws.addRow([
          "Fecha",
          "Nº Factura",
          "Cliente",
          "NIF",
          "Base Imponible",
          "%IVA",
          "Cuota IVA",
          "Total",
          "",
        ]);
        paintCells(ws, invHead.number, 9, "FFDDE8F5", true);

        if (qInvoices.length === 0) {
          const r = ws.addRow(["—", "Sin facturas en este trimestre", "", "", 0, 0, 0, 0, ""]);
          r.getCell(5).numFmt = EUR;
          r.getCell(6).numFmt = PCT;
          r.getCell(7).numFmt = EUR;
          r.getCell(8).numFmt = EUR;
        } else {
          for (const inv of qInvoices) {
            const base = Number(inv.base_imponible) || 0;
            const iva = Number(inv.iva_porcentaje) || 0;
            const cuota = Number(inv.total_factura) - base;
            const r = ws.addRow([
              inv.fecha_emision?.slice(0, 10) ?? "",
              inv.numero_factura ?? "",
              inv.nombre_receptor ?? "",
              inv.nif_receptor ?? "",
              Number(base.toFixed(2)),
              iva,
              Number(cuota.toFixed(2)),
              Number(Number(inv.total_factura).toFixed(2)),
              "",
            ]);
            r.getCell(5).numFmt = EUR;
            r.getCell(6).numFmt = PCT;
            r.getCell(7).numFmt = EUR;
            r.getCell(8).numFmt = EUR;
          }
        }
        const invTot = ws.addRow([
          "TOTAL",
          "",
          "",
          "",
          Number(c.baseImponible.toFixed(2)),
          "",
          Number(c.ivaRepercutido.toFixed(2)),
          Number(c.grossIncome.toFixed(2)),
          "",
        ]);
        paintCells(ws, invTot.number, 9, "FFD9EAD3", true);
        invTot.getCell(5).numFmt = EUR;
        invTot.getCell(7).numFmt = EUR;
        invTot.getCell(8).numFmt = EUR;

        ws.addRow([]);

        // Bloque de gastos variables
        const gastosTitle = ws.addRow([`GASTOS · T${q} ${yearForQuarter[q]}`]);
        ws.mergeCells(gastosTitle.number, 1, gastosTitle.number, 9);
        paintCells(ws, gastosTitle.number, 9, "FFC0392B", true);
        gastosTitle.getCell(1).font = { ...FONT, bold: true, color: { argb: "FFFFFFFF" } };

        const gHead = ws.addRow([
          "Fecha",
          "Concepto",
          "Categoría",
          "Deducible",
          "Base",
          "%IVA",
          "Cuota IVA",
          "Total",
          "",
        ]);
        paintCells(ws, gHead.number, 9, "FFDDE8F5", true);

        if (qVar.length === 0) {
          const r = ws.addRow(["—", "Sin gastos variables", "", "", 0, 0, 0, 0, ""]);
          r.getCell(5).numFmt = EUR;
          r.getCell(6).numFmt = PCT;
          r.getCell(7).numFmt = EUR;
          r.getCell(8).numFmt = EUR;
        } else {
          for (const v of qVar) {
            const total = Number(v.amount) || 0;
            const iva = Number(v.iva_percent) || 0;
            const base = iva > 0 ? total / (1 + iva / 100) : total;
            const cuota = total - base;
            const r = ws.addRow([
              v.date ?? "",
              v.concept ?? "",
              v.category ?? "",
              v.deducible ? "Sí" : "No",
              Number(base.toFixed(2)),
              iva,
              Number(cuota.toFixed(2)),
              Number(total.toFixed(2)),
              "",
            ]);
            r.getCell(5).numFmt = EUR;
            r.getCell(6).numFmt = PCT;
            r.getCell(7).numFmt = EUR;
            r.getCell(8).numFmt = EUR;
            if (!v.deducible) {
              r.eachCell((cell) => (cell.font = { ...FONT, italic: true, color: { argb: "FF888888" } }));
            }
          }
        }
        const gTot = ws.addRow([
          "TOTAL (solo deducibles)",
          "",
          "",
          "",
          Number(c.baseGastoVar.toFixed(2)),
          "",
          Number(c.ivaSoportado.toFixed(2)),
          Number((c.baseGastoVar + c.ivaSoportado).toFixed(2)),
          "",
        ]);
        paintCells(ws, gTot.number, 9, "FFF9CBCB", true);
        gTot.getCell(5).numFmt = EUR;
        gTot.getCell(7).numFmt = EUR;
        gTot.getCell(8).numFmt = EUR;

        ws.addRow([]);

        // Bloque de gastos fijos (prorrateo trimestral)
        const fxTitle = ws.addRow(["GASTOS FIJOS · Prorrateo trimestral"]);
        ws.mergeCells(fxTitle.number, 1, fxTitle.number, 9);
        paintCells(ws, fxTitle.number, 9, "FF7F8C8D", true);
        fxTitle.getCell(1).font = { ...FONT, bold: true, color: { argb: "FFFFFFFF" } };

        const fxHead = ws.addRow([
          "Concepto",
          "Frecuencia",
          "Importe unitario",
          "Importe mensual",
          "Prorrateo trimestral",
          "",
          "",
          "",
          "",
        ]);
        paintCells(ws, fxHead.number, 9, "FFDDE8F5", true);
        if (fixedCosts.length === 0) {
          ws.addRow(["Sin gastos fijos", "", "", 0, 0, "", "", "", ""]);
        } else {
          for (const fx of fixedCosts) {
            const monthly = Number(fx.amount) / PERIOD_DIVISOR[fx.period];
            const r = ws.addRow([
              fx.concept,
              fx.period,
              Number(Number(fx.amount).toFixed(2)),
              Number(monthly.toFixed(2)),
              Number((monthly * 3).toFixed(2)),
              "",
              "",
              "",
              "",
            ]);
            r.getCell(3).numFmt = EUR;
            r.getCell(4).numFmt = EUR;
            r.getCell(5).numFmt = EUR;
          }
        }
        const fxTot = ws.addRow([
          "TOTAL",
          "",
          "",
          Number(c.fixedQuarterly / 3 > 0 ? (c.fixedQuarterly / 3).toFixed(2) : "0"),
          Number(c.fixedQuarterly.toFixed(2)),
          "",
          "",
          "",
          "",
        ]);
        paintCells(ws, fxTot.number, 9, "FFD9D9D9", true);
        fxTot.getCell(4).numFmt = EUR;
        fxTot.getCell(5).numFmt = EUR;

        ws.addRow([]);

        // Bloque de liquidación
        const liqTitle = ws.addRow(["LIQUIDACIÓN DEL TRIMESTRE"]);
        ws.mergeCells(liqTitle.number, 1, liqTitle.number, 9);
        paintCells(ws, liqTitle.number, 9, "FF2C3E50", true);
        liqTitle.getCell(1).font = { ...FONT, bold: true, color: { argb: "FFFFFFFF" } };

        const liq: Array<[string, number, string?]> = [
          ["IVA Repercutido (ventas)", c.ivaRepercutido],
          ["IVA Soportado (gastos deducibles)", c.ivaSoportado],
          [
            c.ivaAPagar >= 0 ? "IVA a Pagar (Mod. 303)" : "IVA a Compensar (Mod. 303)",
            c.ivaAPagar,
          ],
          ["Base Ingresos", c.baseImponible],
          ["Base Gastos Deducibles", c.baseGastoVar],
          ["Gastos Fijos (prorrateo)", c.fixedQuarterly],
          ["Rendimiento Neto", c.netBase],
          ["IRPF Pago Fraccionado (Mod. 130)", c.irpf],
          ["Total Impuestos del Trimestre", Math.max(0, c.ivaAPagar) + c.irpf, "bold"],
          ["Neto Real (después de impuestos)", c.netReal, "bold"],
        ];
        for (const [label, val, style] of liq) {
          const r = ws.addRow([label, "", "", "", Number(val.toFixed(2)), "", "", "", ""]);
          r.getCell(5).numFmt = EUR;
          if (style === "bold") {
            paintCells(ws, r.number, 9, "FFFFF2CC", true);
          }
        }
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const years = Array.from(new Set(Object.values(yearForQuarter))).sort();
      const label = years.length === 1 ? String(years[0]) : `${years[0]}-${years[years.length - 1]}`;
      a.href = url;
      a.download = `contabilidad_${label}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Excel para gestoría generado.");
    } catch (e) {
      toast.error("Error al exportar: " + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-6">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">Contabilidad</h1>
        <p className="text-sm text-slate-400">
          Centro contable multi-trimestre · Ventana móvil de 4 trimestres
          {inQ4
            ? ` (T2–T4 ${currentYear} y T1 ${currentYear + 1})`
            : ` (T1–T4 ${currentYear})`}
          . Los proyectos cerrados se enrutan automáticamente al trimestre
          correspondiente según su fecha de cierre.
        </p>
      </header>

      {/* KPI banner del trimestre en curso */}
      <section
        aria-label="Estado del trimestre en curso"
        className="w-full max-w-full overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-indigo-500/10 p-4 sm:p-5"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Gauge className="h-5 w-5 text-emerald-400" />
          <h2 className="text-base font-semibold sm:text-lg">
            Estado T{dashboard.q} · {dashboard.y}
          </h2>
          <span className="ml-auto text-[11px] text-slate-400">
            {dashboard.daysToClose} día{dashboard.daysToClose === 1 ? "" : "s"} para cerrar el
            trimestre
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-400">
              <TrendingUp className="h-3.5 w-3.5" /> Facturado
            </div>
            <div className="mt-1 truncate text-lg font-bold text-emerald-300">
              {fmt(dashboard.c.baseImponible)}
            </div>
            <div className="text-[10px] text-slate-500">Base imponible del trimestre</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-400">
              <ShieldAlert className="h-3.5 w-3.5" /> Provisión Hacienda
            </div>
            <div className="mt-1 truncate text-lg font-bold text-amber-300">
              {fmt(dashboard.provision)}
            </div>
            <div className="text-[10px] text-slate-500">
              IVA {fmt(dashboard.ivaToPay)} + IRPF {fmt(dashboard.c.irpf)}
              {dashboard.ivaToOffset > 0 ? ` · a compensar ${fmt(dashboard.ivaToOffset)}` : ""}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-400">
              <Wallet className="h-3.5 w-3.5" /> Neto real
            </div>
            <div
              className={`mt-1 truncate text-lg font-bold ${
                dashboard.netAvailable >= 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {fmt(dashboard.netAvailable)}
            </div>
            <div className="text-[10px] text-slate-500">Tras gastos e impuestos</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-400">
              <CircleDollarSign className="h-3.5 w-3.5" /> Caja disponible
            </div>
            <div
              className={`mt-1 truncate text-lg font-bold ${
                dashboard.cashAvailable >= 0 ? "text-sky-300" : "text-rose-300"
              }`}
            >
              {fmt(dashboard.cashAvailable)}
            </div>
            <div className="text-[10px] text-slate-500">Neto − facturado sin cobrar</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[10px] text-slate-500">
            <span>Progreso del trimestre</span>
            <span>{dashboard.progressPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500"
              style={{ width: `${dashboard.progressPct}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            Presentación modelo 130 / 303 antes del{" "}
            {dashboard.deadline.toLocaleDateString("es-ES", { day: "2-digit", month: "long" })}
            {dashboard.daysToDeadline > 0
              ? ` (faltan ${dashboard.daysToDeadline} días)`
              : " (fecha superada)"}
          </div>
        </div>
        {dashboard.daysToDeadline <= 15 && dashboard.daysToDeadline >= 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Quedan {dashboard.daysToDeadline} día
              {dashboard.daysToDeadline === 1 ? "" : "s"} para presentar el modelo 130/303.
              Provisión estimada: <span className="font-semibold">{fmt(dashboard.provision)}</span>.
            </span>
          </div>
        )}
      </section>

      {/* Facturas pendientes de cobro */}
      {(dashboard.pending.length > 0 || dashboard.paidInvoices.length > 0) && (
        <section className="w-full max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Hourglass className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-semibold sm:text-lg">Cobros pendientes</h2>
            <span className="ml-auto text-[11px] text-slate-400">
              Total pendiente:{" "}
              <span className="font-semibold text-amber-300">{fmt(dashboard.pendingTotal)}</span>
              {" · "}Cobrado:{" "}
              <span className="font-semibold text-emerald-300">{fmt(dashboard.collectedTotal)}</span>
            </span>
          </div>
          {dashboard.pending.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">
              Todas las facturas están cobradas.
            </div>
          ) : (
            <ul className="w-full max-w-full divide-y divide-slate-800">
              {dashboard.pending.slice(0, 6).map(({ inv, daysOld }) => {
                const bucket =
                  daysOld <= 30
                    ? { label: `${daysOld}d`, cls: "bg-emerald-500/15 text-emerald-300" }
                    : daysOld <= 60
                      ? { label: `${daysOld}d`, cls: "bg-amber-500/15 text-amber-300" }
                      : { label: `${daysOld}d`, cls: "bg-rose-500/20 text-rose-300" };
                return (
                  <li
                    key={inv.id}
                    className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-100">
                        {inv.numero_factura} · {inv.nombre_receptor}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Emitida {inv.fecha_emision?.slice(0, 10) ?? "—"} · NIF{" "}
                        {inv.nif_receptor || "—"}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${bucket.cls}`}
                    >
                      {bucket.label}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-emerald-300">
                      {fmt(Number(inv.total_factura) || 0)}
                    </span>
                    <button
                      onClick={() => toggleInvoicePaid(inv)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
                      aria-label={`Marcar factura ${inv.numero_factura} como cobrada`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Cobrada
                    </button>
                  </li>
                );
              })}
              {dashboard.pending.length > 6 && (
                <li className="pt-2 text-center text-[11px] text-slate-500">
                  Y {dashboard.pending.length - 6} más…
                </li>
              )}
            </ul>
          )}
          {dashboard.paidInvoices.length > 0 && (
            <details className="mt-3 group">
              <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-200">
                {dashboard.paidInvoices.length} factura
                {dashboard.paidInvoices.length === 1 ? "" : "s"} cobrada
                {dashboard.paidInvoices.length === 1 ? "" : "s"} — desmarcar
              </summary>
              <ul className="mt-2 divide-y divide-slate-800/60">
                {dashboard.paidInvoices.slice(0, 8).map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-2 py-1.5 text-xs text-slate-400"
                  >
                    <span className="truncate">
                      {inv.numero_factura} · {inv.nombre_receptor}
                    </span>
                    <span className="shrink-0 font-medium text-emerald-400">
                      {fmt(Number(inv.total_factura) || 0)}
                    </span>
                    <button
                      onClick={() => toggleInvoicePaid(inv)}
                      className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                      aria-label={`Marcar factura ${inv.numero_factura} como pendiente`}
                      title="Desmarcar cobro"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {/* Resumen anual desplegable */}
      <section className="w-full max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <button
          onClick={() => setShowAnnual((v) => !v)}
          aria-expanded={showAnnual}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/40 sm:px-5"
        >
          <Calculator className="h-5 w-5 text-indigo-400" />
          <div className="flex-1">
            <div className="text-base font-semibold">Resumen anual · {year}</div>
            <div className="text-[11px] text-slate-500">
              Facturado {fmt(annualTotals.baseImponible)} · Impuestos{" "}
              {fmt(annualTotals.totalTaxes)} · Neto {fmt(annualTotals.netReal)}
            </div>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-slate-400 transition-transform ${
              showAnnual ? "rotate-180" : ""
            }`}
          />
        </button>
        {showAnnual && (
          <div className="overflow-x-auto border-t border-slate-800 p-3 sm:p-5">
            <table className="w-full min-w-[560px] text-xs sm:text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-2 font-medium">Concepto</th>
                  {([1, 2, 3, 4] as const).map((q) => (
                    <th key={q} className="pb-2 text-right font-medium">
                      T{q}
                    </th>
                  ))}
                  <th className="pb-2 text-right font-semibold text-slate-200">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(
                  [
                    ["Base imponible", "baseImponible", "text-emerald-300"],
                    ["IVA repercutido", "ivaRepercutido", "text-slate-200"],
                    ["Base gasto deducible", "baseGastoVar", "text-slate-200"],
                    ["IVA soportado", "ivaSoportado", "text-slate-200"],
                    ["Gastos fijos (prorrateo)", "fixedQuarterly", "text-slate-200"],
                    ["Rendimiento neto", "netBase", "text-slate-200"],
                    ["IRPF (Modelo 130)", "irpf", "text-amber-300"],
                    ["Total impuestos", "totalTaxes", "text-amber-300"],
                    ["Neto real", "netReal", "text-emerald-300"],
                  ] as const
                ).map(([label, key, cls]) => (
                  <tr key={key} className="text-slate-200">
                    <td className="py-2 font-medium">{label}</td>
                    {([1, 2, 3, 4] as const).map((q) => (
                      <td key={q} className={`py-2 text-right ${cls}`}>
                        {fmt(quarterCalcs[q][key] as number)}
                      </td>
                    ))}
                    <td className={`py-2 text-right font-semibold ${cls}`}>
                      {fmt(annualTotals[key] as number)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Aviso de retención + export Excel unificado */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {showStorageAlert && (
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
            <Info className="h-4 w-4 shrink-0 text-amber-300" />
            <span className="flex-1 truncate">
              Política de almacenamiento: la app mantiene exactamente 4 trimestres. Al entrar en T4,
              los datos del T1 del año en curso se eliminan para abrir el T1 del año siguiente.
              Exporta tus datos para conservarlos.
            </span>
            <button
              onClick={() => {
                try {
                  if (alertKey) localStorage.setItem(alertKey, "true");
                } catch {}
                setShowStorageAlert(false);
              }}
              className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
              title="Ocultar"
              aria-label="Ocultar aviso de almacenamiento"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <button
          onClick={exportExcel}
          disabled={exporting}
          className="flex w-full max-w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow transition-colors hover:bg-emerald-500 disabled:opacity-50 sm:w-auto sm:px-4 sm:text-sm"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">
            {exporting ? "Generando Excel…" : "Exportar Excel para Gestoría"}
          </span>
        </button>
      </div>

      {/* Annual snapshot across quarters */}
      <div className="w-full max-w-full overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-indigo-500/10 p-4 sm:p-6">
        <div className="mb-4 flex min-w-0 items-center gap-2">
          <Wallet className="h-5 w-5 text-emerald-400" />
          <h2 className="min-w-0 text-base font-semibold sm:text-lg">Resumen Anual por Trimestres · {year}</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {([1, 2, 3, 4] as const).map((q) => {
            const c = quarterCalcs[q];
            const active = openQuarter === q;
            // Build sparkline points from real Supabase invoices in the quarter,
            // ordered chronologically by fecha_emision and cumulated.
            const qInvs = invoicesByQuarter[q]
              .slice()
              .sort((a, b) =>
                (a.fecha_emision ?? "").localeCompare(b.fecha_emision ?? ""),
              );
            let acc = 0;
            // Uses base imponible (sin IVA) so the sparkline represents real ingresos.
            const sparkPoints = qInvs.map((inv) => (acc += Number(inv.base_imponible) || 0));
            return (
              <button
                key={q}
                onClick={() => setOpenQuarter(q)}
                className={`w-full max-w-full overflow-hidden rounded-xl border p-4 text-left transition-all ${
                  active
                    ? "border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/40"
                    : "border-slate-800 bg-slate-900 hover:border-slate-700"
                }`}
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {q}º Trimestre (T{q})
                  </span>
                  <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" />
                </div>
                <div className="mt-2 truncate text-base font-bold text-white">{fmt(c.grossIncome)}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Neto: <span className={c.netReal >= 0 ? "text-emerald-300" : "text-rose-300"}>{fmt(c.netReal)}</span>
                </div>
                <Sparkline points={sparkPoints} active={active} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Gastos Fijos */}
      <section className="w-full max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
        <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-indigo-400" />
          <h2 className="min-w-0 text-base font-semibold sm:text-lg">Gastos Fijos (compartidos entre trimestres)</h2>
          </div>
          <span className="text-xs text-slate-400 sm:ml-auto">
            Mensual: <span className="font-semibold text-indigo-300">{fmt(fixedMonthly)}</span> · Trimestral: <span className="font-semibold text-indigo-300">{fmt(fixedQuarterly)}</span>
          </span>
        </div>
        <div className="mb-4 grid w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-12 md:col-span-5">
            <label className="mb-1 block text-xs font-medium text-slate-400">Nombre del Gasto Fijo</label>
            <div className="relative">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={fxName}
                onChange={(e) => setFxName(e.target.value)}
                placeholder="Ej. Alquiler oficina, software..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="sm:col-span-6 md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-400">Cantidad (€)</label>
            <div className="relative">
              <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="number"
                min={0}
                step="0.01"
                value={fxAmount}
                onChange={(e) => setFxAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="sm:col-span-6 md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-400">Frecuencia</label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={fxFreq}
                onChange={(e) => setFxFreq(e.target.value as Period)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-emerald-500"
              >
                <option value="mensual">Mensual</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>
          <div className="flex items-end sm:col-span-12 md:col-span-1">
            <button
              onClick={addFixed}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
              title="Añadir"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <label className="mb-4 -mt-1 flex cursor-pointer items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={fxIsCuotaAut}
            onChange={(e) => setFxIsCuotaAut(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-emerald-500"
          />
          <span>
            Es <span className="font-semibold text-emerald-300">cuota de autónomos</span> (sin IVA,
            se listará aparte en el Excel para la gestoría).
          </span>
        </label>
        {fixedCosts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">
            No has añadido gastos fijos.
          </div>
        ) : (
          <>
            <div className="grid w-full max-w-full grid-cols-1 gap-3 md:hidden">
              {fixedCosts.map((f) => (
                <div key={f.id} className="w-full max-w-full rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  {editingFixedId === f.id && editingFixedDraft ? (
                    <div className="space-y-2 text-sm">
                      <input
                        value={editingFixedDraft.concept}
                        onChange={(e) =>
                          setEditingFixedDraft({ ...editingFixedDraft, concept: e.target.value })
                        }
                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editingFixedDraft.amount || ""}
                          onChange={(e) =>
                            setEditingFixedDraft({
                              ...editingFixedDraft,
                              amount: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5"
                        />
                        <select
                          value={editingFixedDraft.period}
                          onChange={(e) =>
                            setEditingFixedDraft({
                              ...editingFixedDraft,
                              period: e.target.value as Period,
                            })
                          }
                          className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5"
                        >
                          <option value="mensual">Mensual</option>
                          <option value="anual">Anual</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={editingFixedDraft.is_cuota_autonomos}
                          onChange={(e) =>
                            setEditingFixedDraft({
                              ...editingFixedDraft,
                              is_cuota_autonomos: e.target.checked,
                            })
                          }
                          className="h-3.5 w-3.5 accent-emerald-500"
                        />
                        Es cuota de autónomos
                      </label>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={saveEditFixed}
                          className="flex-1 rounded-md bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={cancelEditFixed}
                          className="rounded-md border border-slate-700 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-100">{f.concept}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="inline-flex rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs font-medium text-indigo-300 ring-1 ring-indigo-500/30">
                          {f.period === "mensual" ? "Mensual" : "Anual"}
                        </span>
                        {f.is_cuota_autonomos && (
                          <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                            Cuota autónomos
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => startEditFixed(f)}
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-emerald-300"
                        aria-label={`Editar gasto fijo ${f.concept}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => removeFixedCost(f.id)}
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                        title="Eliminar"
                        aria-label={`Eliminar gasto fijo ${f.concept}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  )}
                  {editingFixedId !== f.id && (
                  <div className="mt-3 grid grid-cols-1 gap-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Cantidad</span>
                      <span className="font-semibold text-rose-300">{fmt(Number(f.amount))}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Equivalente mensual</span>
                      <span className="font-semibold text-indigo-200">{fmt(Number(f.amount) / PERIOD_DIVISOR[f.period])}</span>
                    </div>
                  </div>
                  )}
                </div>
              ))}
            </div>
            <div className="hidden w-full max-w-full overflow-hidden md:block">
            <table className="w-full max-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="pb-2">Nombre</th>
                  <th className="pb-2">Frecuencia</th>
                  <th className="pb-2 text-right">Cantidad</th>
                  <th className="pb-2 text-right">Equivalente mensual</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {fixedCosts.map((f) =>
                  editingFixedId === f.id && editingFixedDraft ? (
                    <tr key={f.id} className="bg-slate-950/50 align-top">
                      <td className="py-2 pr-2">
                        <input
                          value={editingFixedDraft.concept}
                          onChange={(e) =>
                            setEditingFixedDraft({ ...editingFixedDraft, concept: e.target.value })
                          }
                          className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm"
                        />
                        <label className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                          <input
                            type="checkbox"
                            checked={editingFixedDraft.is_cuota_autonomos}
                            onChange={(e) =>
                              setEditingFixedDraft({
                                ...editingFixedDraft,
                                is_cuota_autonomos: e.target.checked,
                              })
                            }
                            className="h-3 w-3 accent-emerald-500"
                          />
                          Cuota autónomos
                        </label>
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          value={editingFixedDraft.period}
                          onChange={(e) =>
                            setEditingFixedDraft({
                              ...editingFixedDraft,
                              period: e.target.value as Period,
                            })
                          }
                          className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm"
                        >
                          <option value="mensual">Mensual</option>
                          <option value="anual">Anual</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editingFixedDraft.amount || ""}
                          onChange={(e) =>
                            setEditingFixedDraft({
                              ...editingFixedDraft,
                              amount: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-24 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2 text-right text-xs text-slate-500">—</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={saveEditFixed}
                            className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={cancelEditFixed}
                            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                  <tr key={f.id} className="text-slate-200">
                    <td className="py-2.5 font-medium">
                      <span className="truncate">{f.concept}</span>
                      {f.is_cuota_autonomos && (
                        <span className="ml-2 inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                          Cuota autónomos
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs font-medium text-indigo-300 ring-1 ring-indigo-500/30">
                        {f.period === "mensual" ? "Mensual" : "Anual"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-rose-300">{fmt(Number(f.amount))}</td>
                    <td className="py-2.5 text-right font-semibold text-indigo-200">
                      {fmt(Number(f.amount) / PERIOD_DIVISOR[f.period])}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => startEditFixed(f)}
                          className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-emerald-300"
                          aria-label={`Editar gasto fijo ${f.concept}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeFixedCost(f.id)}
                          className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                          title="Eliminar"
                          aria-label={`Eliminar gasto fijo ${f.concept}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  ),
                )}
              </tbody>
            </table>
            </div>
          </>
        )}
      </section>

      {/* Quarter panels */}
      <div className="space-y-4">
        {([1, 2, 3, 4] as const).map((q) => {
          const c = quarterCalcs[q];
          const qInvoiceList = invoicesByQuarter[q]
            .slice()
            .sort((a, b) => (b.fecha_emision ?? "").localeCompare(a.fecha_emision ?? ""));
          const variableList = varCostsByQuarter[q]
            .slice()
            .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
          const isOpen = openQuarter === q;
          return (
            <section
              key={q}
              className="w-full max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
            >
              <button
                onClick={() => setOpenQuarter(isOpen ? 0 : q)}
                className="flex w-full max-w-full items-center justify-between gap-3 px-3 py-4 text-left transition-colors hover:bg-slate-800/40 sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-sm font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                    T{q}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-white">
                      {q}º Trimestre (T{q})
                    </div>
                    <div className="truncate text-[11px] text-slate-500">
                      {qInvoiceList.length} factura{qInvoiceList.length === 1 ? "" : "s"} · Facturado {fmt(c.grossIncome)}
                    </div>
                  </div>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isOpen && (
                <div className="w-full max-w-full overflow-hidden space-y-5 border-t border-slate-800 px-3 py-4 sm:px-5 sm:py-5">
                  {/* Totals */}
                  <div className="grid w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                    <div className="w-full max-w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400">
                        Total Facturado
                      </div>
                      <div className="mt-1 truncate text-base font-bold text-white sm:text-lg">
                        {fmt(c.grossIncome)}
                      </div>
                      <div className="truncate text-[10px] text-slate-500">
                        Base: {fmt(c.baseImponible)}
                      </div>
                    </div>
                    <div className="w-full max-w-full overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                      <div className="flex w-full max-w-full flex-col gap-2 sm:flex-row sm:items-stretch">
                        {/* IVA */}
                        <div className="flex min-w-0 flex-1 flex-col justify-center">
                          <div className="text-[11px] uppercase tracking-wider text-amber-300">
                            {c.ivaAPagar < 0 ? "IVA a Compensar" : "IVA Trimestral"}
                          </div>
                          <div className="mt-1 truncate text-base font-bold text-amber-300 sm:text-lg">
                            {fmt(Math.abs(c.ivaAPagar))}
                          </div>
                          <div className="truncate text-[10px] text-amber-200/70">
                            Rep.: {fmt(c.ivaRepercutido)} • Sop.: {fmt(c.ivaSoportado)}
                          </div>
                        </div>
                        {/* Separator */}
                        <div className="h-px w-full bg-amber-500/20 sm:h-auto sm:w-px" />
                        {/* IRPF */}
                        <div className="flex min-w-0 flex-1 flex-col justify-center">
                          <div className="text-[11px] uppercase tracking-wider text-amber-300">
                            IRPF (Modelo 130)
                          </div>
                          <div className="mt-1 truncate text-base font-bold text-amber-300 sm:text-lg">
                            {fmt(c.irpf)}
                          </div>
                          <div className="truncate text-[10px] text-amber-200/70">
                            20% del rendim. neto acumulado
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="w-full max-w-full overflow-hidden rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
                      <div className="text-[11px] uppercase tracking-wider text-rose-300">
                        Total Gastos
                      </div>
                      <div className="mt-1 truncate text-base font-bold text-rose-300 sm:text-lg">
                        {fmt(c.totalExpenses)}
                      </div>
                      <div className="truncate text-[10px] text-slate-500">
                        Var.: {fmt(c.variableExpenses)} · Fijos: {fmt(c.fixedQuarterly)}
                      </div>
                    </div>
                    <div className="w-full max-w-full overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <div className="text-[11px] uppercase tracking-wider text-emerald-300">
                        Beneficio Neto
                      </div>
                      <div
                        className={`mt-1 truncate text-base font-bold sm:text-lg ${
                          c.netReal >= 0 ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {fmt(c.netReal)}
                      </div>
                    </div>
                  </div>

                  {/* Ingresos + Costes Variables grids */}
                  <div className="grid w-full max-w-full grid-cols-1 gap-5 xl:grid-cols-2">
                    {/* Ingresos */}
                    <div className="w-full max-w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:p-4">
                      <div className="mb-3 flex min-w-0 items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                        <h3 className="min-w-0 text-sm font-semibold">Facturas T{q}</h3>
                        <span className="ml-auto shrink-0 text-xs text-emerald-300">
                          {fmt(c.grossIncome)}
                        </span>
                      </div>
                      <p className="mb-2 text-[10px] text-slate-500">
                        Facturas emitidas (por fecha de devengo). Se excluyen borradores.
                      </p>
                      {invoicesLoading ? (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">
                          Cargando facturas…
                        </div>
                      ) : qInvoiceList.length === 0 ? (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">
                          Sin facturas enviadas a la AEAT en este trimestre.
                        </div>
                      ) : (
                        <ul className="mt-2 w-full max-w-full divide-y divide-slate-800">
                          {qInvoiceList.map((inv) => (
                            <li
                              key={inv.id}
                              className="flex w-full max-w-full flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                            >
                              <div className="min-w-0 max-w-full">
                                <div className="truncate font-medium text-slate-100">
                                  {inv.numero_factura} · {inv.nombre_receptor}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {inv.fecha_emision?.slice(0, 10) ?? "—"} · NIF {inv.nif_receptor || "—"}
                                </div>
                              </div>
                              <div className="flex w-full max-w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                                <span className="truncate text-sm font-semibold text-emerald-400 sm:text-base">
                                  +{fmt(Number(inv.total_factura) || 0)}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Costes variables */}
                    <div className="w-full max-w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:p-4">
                      <div className="mb-3 flex min-w-0 items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-amber-400" />
                        <h3 className="min-w-0 text-sm font-semibold">Costes Variables T{q}</h3>
                        <span className="ml-auto shrink-0 text-xs text-amber-300">
                          {fmt(c.variableExpenses)}
                        </span>
                      </div>
                      <QuarterAddForm
                        quarter={q}
                        kind="variable_expense"
                        onAdd={(name, amt) =>
                          addVariableCostToQuarter(q, name, amt)
                        }
                      />
                      {variableList.length === 0 ? (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">
                          Sin costes variables en este trimestre.
                        </div>
                      ) : (
                        <ul className="mt-2 w-full max-w-full divide-y divide-slate-800">
                          {variableList.map((v) => {
                            const amount = Number(v.amount) || 0;
                            const budget = c.grossIncome || amount;
                            const pct = budget > 0 ? (amount / budget) * 100 : 0;
                            const isHigh = pct > 20;
                            const isModerate = pct >= 5 && pct <= 20;
                            const colorClass = isHigh
                              ? "text-red-500"
                              : isModerate
                                ? "text-rose-400"
                                : "text-rose-400/50";
                            const isEditing = editingId === v.id && editDraft;
                            if (isEditing && editDraft) {
                              return (
                                <li key={v.id} className="w-full max-w-full py-2">
                                  <div className="grid w-full max-w-full grid-cols-1 gap-2 rounded-lg border border-emerald-500/40 bg-slate-950/60 p-3 sm:grid-cols-12">
                                    <input
                                      value={editDraft.concept}
                                      onChange={(e) => setEditDraft({ ...editDraft, concept: e.target.value })}
                                      placeholder="Concepto"
                                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-emerald-500 sm:col-span-5"
                                    />
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={editDraft.amount || ""}
                                      onChange={(e) => setEditDraft({ ...editDraft, amount: parseFloat(e.target.value) || 0 })}
                                      placeholder="€"
                                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-emerald-500 sm:col-span-2"
                                    />
                                    <select
                                      value={editDraft.iva_percent}
                                      onChange={(e) => setEditDraft({ ...editDraft, iva_percent: Number(e.target.value) })}
                                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-emerald-500 sm:col-span-2"
                                    >
                                      <option value={21} className="bg-slate-900">IVA 21%</option>
                                      <option value={10} className="bg-slate-900">IVA 10%</option>
                                      <option value={4} className="bg-slate-900">IVA 4%</option>
                                      <option value={0} className="bg-slate-900">IVA 0%</option>
                                    </select>
                                    <label className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-300 sm:col-span-3">
                                      <input
                                        type="checkbox"
                                        checked={editDraft.deducible}
                                        onChange={(e) => setEditDraft({ ...editDraft, deducible: e.target.checked })}
                                        className="h-4 w-4 accent-emerald-500"
                                      />
                                      Deducible
                                    </label>
                                    <input
                                      value={editDraft.category}
                                      onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                                      placeholder="Categoría (opcional)"
                                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500 sm:col-span-8"
                                    />
                                    <div className="flex items-center gap-2 sm:col-span-4 sm:justify-end">
                                      <button
                                        onClick={saveEdit}
                                        className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                                      >
                                        <Check className="h-3.5 w-3.5" /> Guardar
                                      </button>
                                      <button
                                        onClick={cancelEdit}
                                        className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                </li>
                              );
                            }
                            return (
                            <li
                              key={v.id}
                              className="flex w-full max-w-full flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                            >
                              <div className="min-w-0 max-w-full">
                                <div className={`truncate font-medium ${colorClass}`}>
                                  {v.concept}
                                  {!v.deducible && (
                                    <span className="ml-2 rounded-full bg-slate-700/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-300">
                                      no deducible
                                    </span>
                                  )}
                                </div>
                                <div className="truncate text-[10px] text-slate-500">
                                  {v.date ?? "—"} · IVA {Number(v.iva_percent ?? 21)}%
                                  {v.category ? ` · ${v.category}` : ""} · {pct.toFixed(1)}% del presupuesto
                                </div>
                              </div>
                              <div className="flex w-full max-w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
                                {isHigh && (
                                  <span className="max-w-full truncate rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400 ring-1 ring-red-500/40">
                                    Impacto Alto (&gt;20%)
                                  </span>
                                )}
                                <span className={`truncate text-sm font-semibold sm:text-base ${colorClass}`}>
                                  -{fmt(amount)}
                                </span>
                                <button
                                  onClick={() => startEdit(v)}
                                  aria-label="Editar"
                                  className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-emerald-300"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => removeVariableCost(v.id)}
                                  aria-label="Eliminar"
                                  className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Charts */}
                  <div className="grid w-full max-w-full grid-cols-1 gap-5 lg:grid-cols-2">
                    <div data-chart-q={q} data-chart-type="pie" className="clear-both w-full max-w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:p-4">
                      <div className="mb-2 flex min-w-0 items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-indigo-400" />
                        <h3 className="min-w-0 text-sm font-semibold">
                          Distribución del Gasto T{q}
                        </h3>
                      </div>
                      {c.totalExpenses <= 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">
                          Sin gastos para graficar.
                        </div>
                      ) : (
                        <div className="clear-both h-[220px] w-full max-w-full overflow-hidden">
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie
                                data={[
                                  {
                                    name: "Costes Variables",
                                    value: Number(c.variableExpenses.toFixed(2)),
                                  },
                                  {
                                    name: "Gastos Fijos",
                                    value: Number(c.fixedQuarterly.toFixed(2)),
                                  },
                                ]}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={45}
                                outerRadius={75}
                                paddingAngle={2}
                                stroke="#0f172a"
                              >
                                <Cell fill="#f59e0b" />
                                <Cell fill="#6366f1" />
                              </Pie>
                              <RTooltip
                                contentStyle={{
                                  background: "#0f172a",
                                  border: "1px solid #334155",
                                  borderRadius: 8,
                                  fontSize: 12,
                                }}
                                formatter={(v: number) => fmt(v)}
                              />
                              <RLegend wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    <div data-chart-q={q} data-chart-type="bar" className="clear-both w-full max-w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:p-4">
                      <div className="mb-2 flex min-w-0 items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                        <h3 className="min-w-0 text-sm font-semibold">
                          Margen de Beneficio Real T{q}
                        </h3>
                      </div>
                      <div className="clear-both h-[220px] w-full max-w-full overflow-hidden">
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart
                            data={[
                              {
                                name: `T${q}`,
                                Bruto: Number(c.grossIncome.toFixed(2)),
                                Neto: Number(c.netReal.toFixed(2)),
                              },
                            ]}
                          >
                            <XAxis
                              dataKey="name"
                              stroke="#94a3b8"
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis
                              stroke="#94a3b8"
                              tick={{ fontSize: 11 }}
                              tickFormatter={(v) => `${v}€`}
                            />
                            <RTooltip
                              contentStyle={{
                                background: "#0f172a",
                                border: "1px solid #334155",
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                              formatter={(v: number) => fmt(v)}
                            />
                            <RLegend wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }} />
                            <Bar dataKey="Bruto" fill="#10b981" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="Neto" fill="#6366f1" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Radar Autónomo ------------------------------ */

type StaticArticle = {
  title: string;
  link: string;
  description: string;
};

const STATIC_ARTICLES: StaticArticle[] = [
  {
    title: "Regularización de cuotas de autónomos 2026",
    link: "https://www.escura.com/es/regularizacion-de-cuotas-de-autonomos-2026/",
    description:
      "Cómo la Seguridad Social ajustará las cuotas según los rendimientos netos reales del ejercicio y qué pasos seguir si te toca pagar o devolver diferencias.",
  },
  {
    title: "¿Qué es el RETA? Derechos y obligaciones de los autónomos",
    link: "https://www.elautonomo.es/es/reta",
    description:
      "Guía completa sobre el Régimen Especial de Trabajadores Autónomos: alta, cotización, prestaciones y obligaciones fiscales que debes conocer.",
  },
  {
    title: "Cuotas de autónomos en 2026: bases de cotización y tramos",
    link: "https://www.contasimple.com/blog/cuotas-autonomos-2026/",
    description:
      "Tabla actualizada con los 15 tramos de cotización por rendimiento neto, importes mensuales y cómo elegir la base que mejor se adapta a tu actividad.",
  },
  {
    title: "Ley Antifraude 2026: cómo adaptar tu facturación sin complicarte la vida",
    link: "https://www.caixaruralgalega.gal/es/empresas/ley-antifraude-2026-como-adaptar-tu-facturacion-sin-complicarte-vida",
    description:
      "Pasos prácticos para cumplir con la nueva normativa antifraude: software de facturación certificado, registros inalterables y obligaciones técnicas.",
  },
  {
    title: "Ley 11/2021 Antifraude: Guía para adaptarte a la nueva normativa y prevenir el fraude fiscal",
    link: "https://getrenn.com/es/blog/ley-antifraude",
    description:
      "Análisis detallado de la Ley 11/2021: limitaciones a pagos en efectivo, requisitos de los sistemas informáticos y sanciones por incumplimiento.",
  },
  {
    title: "¿Qué es el Ingreso Mínimo Vital?",
    link: "https://www.inclusion.gob.es/web/inclusion/ingreso-minimo-vital/que-es",
    description:
      "Información oficial del Ministerio sobre la prestación no contributiva diseñada para garantizar unos ingresos mínimos a personas en situación de vulnerabilidad.",
  },
  {
    title: "Requisitos para el Ingreso Mínimo Vital [2026] - IMV",
    link: "https://taxdown.es/ingreso-minimo-vital/requisitos",
    description:
      "Quién puede solicitar el IMV en 2026: umbrales de renta, patrimonio máximo, unidades de convivencia y documentación necesaria para tramitar la ayuda.",
  },
];

function RadarAutonomoView() {
  const openArticle = (link: string) => {
    window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <Radar className="h-6 w-6 text-emerald-400" /> Radar Autónomo
        </h1>
        <p className="text-sm text-slate-400">
          Recursos clave seleccionados para autónomos: fiscalidad, cotización y ayudas.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {STATIC_ARTICLES.map((it) => (
          <article
            key={it.link}
            onClick={() => openArticle(it.link)}
            className="flex cursor-pointer flex-col rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-emerald-500/40"
          >
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-emerald-400">
              <Newspaper className="h-3.5 w-3.5" />
              Recurso destacado
            </div>
            <h2 className="mb-2 text-base font-semibold leading-snug text-white">
              {it.title}
            </h2>
            <p className="mb-4 line-clamp-3 text-sm text-slate-400">
              {it.description}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openArticle(it.link);
              }}
              className="mt-auto inline-flex cursor-pointer items-center gap-1.5 self-start rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              Leer artículo completo <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
