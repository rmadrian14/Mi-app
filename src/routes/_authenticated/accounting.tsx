import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { resolveActiveWorkspaceId } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_authenticated/accounting")({
  component: AccountingPage,
  head: () => ({
    meta: [
      { title: "Contabilidad · Veract" },
      {
        name: "description",
        content:
          "Registra tus gastos con su justificante. Se descuentan automáticamente del IVA y del IRPF de tus borradores.",
      },
    ],
  }),
});

// ---------- Helpers de Storage (justificantes) ----------
async function subirJustificante(file: File, workspaceId: string): Promise<string | null> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${workspaceId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("justificantes").upload(path, file);
  if (error) {
    console.warn("[subirJustificante] error:", error);
    return null;
  }
  return path;
}

async function obtenerUrlFirmada(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("justificantes")
    .createSignedUrl(path, 3600);
  if (error) {
    console.warn("[obtenerUrlFirmada] error:", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

// ---------- Tipos ----------
type Categoria = "fijo" | "variable";
type TipoBien = "mueble" | "inmueble";
type CategoriaAmort = "informatico" | "mobiliario" | "maquinaria" | "vehiculo" | "otro";

type Gasto = {
  id: string;
  fecha: string;
  proveedor: string;
  descripcion: string;
  categoria: Categoria;
  base: number;
  tipoIVA: number;
  pctDeducible: number;
  esBien: boolean;
  tipoBien?: TipoBien;
  categoriaAmortizacion?: CategoriaAmort;
  aniosAmortizacion?: number;
  archivo?: string | null;
  estado?: "completo" | "incompleto";
  archivoUrl?: string | null;
};

type Bien = {
  id: string;
  gastoId: string;
  descripcion: string;
  fechaAdquisicion: string;
  base: number;
  tipoIVA: number;
  pctInicial: number;
  tipoBien: TipoBien;
  categoriaAmortizacion: CategoriaAmort;
  aniosAmortizacion: number;
};

type Factura = {
  fecha: string;
  cliente: string;
  concepto: string;
  base: number;
  tipoIVA: number;
  retencionPct: number;
};

const AMORT_OPTIONS: { value: CategoriaAmort; label: string; anios: number }[] = [
  { value: "informatico", label: "Ordenador o equipo informático (4 años)", anios: 4 },
  { value: "mobiliario", label: "Mobiliario y enseres (10 años)", anios: 10 },
  { value: "maquinaria", label: "Maquinaria o herramientas (8 años)", anios: 8 },
  { value: "vehiculo", label: "Vehículo (6 años)", anios: 6 },
  { value: "otro", label: "Otro — no lo sé, usar 5 años por defecto", anios: 5 },
];

const BIENES_INICIALES: Bien[] = [
  { id: "1", gastoId: "5", descripcion: "MacBook Pro (equipo de trabajo)", fechaAdquisicion: "2026-06-18", base: 1800, tipoIVA: 21, pctInicial: 100, tipoBien: "mueble", categoriaAmortizacion: "informatico", aniosAmortizacion: 4 },
];

const ACUMULADO_1T = { ingresos: 4200, retenciones: 480, resultadoBruto07: 620, gastos: 380 };
const DATOS_2T_2025 = { ingresos: 3600, gastos: 420 };

function inicioTrimestreActual(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
}
function finTrimestreActual(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3 + 3, 0).toISOString().slice(0, 10);
}

// ---------- Utilidades ----------
const fmt = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const formatFecha = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const todayISO = () => new Date().toISOString().slice(0, 10);

const cuota = (g: { base: number; tipoIVA: number }) => (g.base * g.tipoIVA) / 100;
const cuotaDeducible = (g: { base: number; tipoIVA: number; pctDeducible: number }) =>
  (cuota(g) * g.pctDeducible) / 100;
const amortizacionTrimestral = (g: { base: number; aniosAmortizacion?: number }) =>
  g.base / (g.aniosAmortizacion || 1) / 4;
const baseDeducibleIRPF = (g: Gasto | SimGasto) =>
  g.esBien ? amortizacionTrimestral(g) : (g.base * g.pctDeducible) / 100;

type SimGasto = Omit<Gasto, "id" | "fecha" | "proveedor" | "archivo" | "categoria"> & {
  categoria: Categoria;
};

function calcularImpactoFiscal(
  lista: (Gasto | SimGasto)[],
  totals: { ingresosT2: number; ivaDevengadoT2: number; retencionesT2: number },
) {
  const efectivos = lista.filter(
    (g) => !("estado" in g) || (g as Gasto).estado !== "incompleto",
  );
  const ivaDeducibleTotal = efectivos.reduce((s, g) => s + cuotaDeducible(g), 0);
  const ivaAPagar = totals.ivaDevengadoT2 - ivaDeducibleTotal;
  const gastosDeduciblesIRPF = efectivos.reduce((s, g) => s + baseDeducibleIRPF(g), 0);
  const gastosAcum = ACUMULADO_1T.gastos + gastosDeduciblesIRPF;
  const ingresosAcum = ACUMULADO_1T.ingresos + totals.ingresosT2;
  const rendimientoNeto = ingresosAcum - gastosAcum;
  const c04 = Math.max(0, rendimientoNeto * 0.2);
  const retencionesAcum = ACUMULADO_1T.retenciones + totals.retencionesT2;
  const c07 = c04 - ACUMULADO_1T.resultadoBruto07 - retencionesAcum;
  return { ivaAPagar, irpfAPagar: Math.max(0, c07) };
}

// ---------- Componente principal ----------
type Tab = "resumen" | "ingresos" | "gastos" | "bienes" | "simulador";

function AccountingPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("resumen");
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [bienes, setBienes] = useState<Bien[]>(BIENES_INICIALES);
  const [facturas, setFacturas] = useState<Factura[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const workspace_id = await resolveActiveWorkspaceId(user.id);
      const { data } = await supabase
        .from("invoices")
        .select("fecha_emision, nombre_receptor, base_imponible, iva_porcentaje, irpf_porcentaje")
        .eq("workspace_id", workspace_id)
        .gte("fecha_emision", inicioTrimestreActual())
        .lte("fecha_emision", finTrimestreActual())
        .order("fecha_emision");
      setFacturas(
        (data ?? []).map((f: any) => ({
          fecha: String(f.fecha_emision).slice(0, 10),
          cliente: f.nombre_receptor,
          concepto: "",
          base: Number(f.base_imponible) || 0,
          tipoIVA: Number(f.iva_porcentaje) || 0,
          retencionPct: Number(f.irpf_porcentaje) || 0,
        })),
      );
    })();
  }, [user]);

  const cargarGastos = useCallback(async () => {
    if (!user) return;
    const workspace_id = await resolveActiveWorkspaceId(user.id);
    const [{ data: fijos }, { data: variables }] = await Promise.all([
      supabase.from("fixed_costs").select("*").eq("workspace_id", workspace_id),
      supabase.from("variable_costs").select("*").eq("workspace_id", workspace_id),
    ]);
    const gastosFijos: Gasto[] = (fijos ?? []).map((f: any) => ({
      id: String(f.id),
      fecha: f.date,
      proveedor: f.concept,
      descripcion: "",
      categoria: "fijo",
      base: Number(f.amount) || 0,
      tipoIVA: Number(f.iva_percent) || 0,
      pctDeducible: Number(f.pct_deducible) || 0,
      esBien: false,
      archivo: null,
      estado: "completo",
    }));
    const gastosVariables: Gasto[] = (variables ?? []).map((v: any) => ({
      id: String(v.id),
      fecha: v.date,
      proveedor: v.provider ?? v.concept,
      descripcion: v.concept,
      categoria: "variable",
      base: Number(v.amount) || 0,
      tipoIVA: Number(v.iva_percent) || 0,
      pctDeducible: Number(v.pct_deducible) || 0,
      esBien: !!v.es_bien_inversion,
      archivo: v.archivo_nombre ?? null,
      archivoUrl: v.archivo_url ?? null,
      estado: (v.estado as "completo" | "incompleto") ?? "completo",
    }));
    setGastos([...gastosFijos, ...gastosVariables]);
  }, [user]);

  useEffect(() => {
    cargarGastos();
  }, [cargarGastos]);

  const totals = useMemo(() => {
    const ingresosT2 = facturas.reduce((s, f) => s + f.base, 0);
    const ivaDevengadoT2 = facturas.reduce((s, f) => s + (f.base * f.tipoIVA) / 100, 0);
    const retencionesT2 = facturas.reduce((s, f) => s + (f.base * f.retencionPct) / 100, 0);
    return { ingresosT2, ivaDevengadoT2, retencionesT2 };
  }, [facturas]);

  return (
    <div
      className="min-h-screen text-[#dde3ee]"
      style={{
        background:
          "radial-gradient(900px 500px at 15% -10%, rgba(52,211,153,.07), transparent 60%)," +
          "radial-gradient(900px 500px at 90% 0%, rgba(59,130,246,.07), transparent 55%)," +
          "#0b0d14",
      }}
    >
      <div className="mx-auto max-w-[980px] px-5 pb-24 pt-8">
        <header className="mb-5">
          <h1 className="text-xl font-bold tracking-tight">Contabilidad</h1>
          <p className="mt-1 max-w-[600px] text-[13px] leading-relaxed text-[#56637c]">
            Registra tus gastos con su justificante. En cuanto están aquí, se descuentan
            automáticamente del IVA y del IRPF de tus borradores.
          </p>
        </header>

        <div className="mb-[18px] flex gap-1.5 border-b border-[#1d2538]">
          {([
            ["resumen", "Resumen"],
            ["ingresos", "Ingresos"],
            ["gastos", "Gastos"],
            ["bienes", "Bienes de inversión"],
            ["simulador", "Simulador"],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={
                "relative top-px mr-[22px] cursor-pointer border-b-2 px-1 py-[11px] text-[13.5px] font-semibold " +
                (tab === id
                  ? "border-[#34d399] text-[#dde3ee]"
                  : "border-transparent text-[#56637c] hover:text-[#dde3ee]")
              }
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "resumen" && <TabResumen gastos={gastos} facturas={facturas} totals={totals} />}
        {tab === "ingresos" && <TabIngresos facturas={facturas} />}
        {tab === "gastos" && (
          <TabGastos
            gastos={gastos}
            setGastos={setGastos}
            setBienes={setBienes}
            user={user}
            recargarGastos={cargarGastos}
          />
        )}
        {tab === "bienes" && <TabBienes bienes={bienes} />}
        {tab === "simulador" && (
          <TabSimulador gastos={gastos} setGastos={setGastos} setBienes={setBienes} totals={totals} />
        )}
      </div>
    </div>
  );
}

// ---------- Primitivas visuales ----------
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={
        "mb-4 rounded-[14px] border border-[#1d2538] bg-[#131926] p-5 last:mb-0 " + className
      }
    >
      {children}
    </div>
  );
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-[14px] text-[10.5px] font-bold uppercase tracking-[.1em] text-[#34d399]">
      {children}
    </p>
  );
}
function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn";
}) {
  const color = tone === "warn" ? "text-[#f59e0b]" : tone === "ok" ? "text-[#34d399]" : "";
  return (
    <div className="rounded-[12px] border border-[#1d2538] bg-[#131926] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[.06em] text-[#56637c]">
        {label}
      </div>
      <div className={"mt-1.5 text-xl font-bold tabular-nums " + color}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[#56637c]">{sub}</div>}
    </div>
  );
}
function Fnote({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[11.5px] leading-relaxed text-[#56637c]">{children}</p>;
}
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#56637c]">
      {children}
    </label>
  );
}
const inputCls =
  "w-full rounded-lg border border-[#1d2538] bg-[#0d1018] px-[11px] py-[9px] text-[13px] text-[#dde3ee] focus:border-[#34d399] focus:outline-none";

function CatButton({
  selected,
  onClick,
  variant,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  variant: "fijo" | "variable" | "neutral";
  children: React.ReactNode;
}) {
  const sel =
    variant === "fijo"
      ? "border-[#3b82f6] bg-[rgba(59,130,246,.1)] text-[#3b82f6]"
      : variant === "variable"
      ? "border-[#34d399] bg-[rgba(52,211,153,.1)] text-[#34d399]"
      : "border-[#dde3ee] text-[#dde3ee]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 cursor-pointer rounded-lg border px-1.5 py-[9px] text-center text-xs font-semibold " +
        (selected ? sel : "border-[#1d2538] bg-[#0d1018] text-[#56637c]")
      }
    >
      {children}
    </button>
  );
}

// ---------- Tabs ----------
function TabResumen({
  gastos,
  facturas,
  totals,
}: {
  gastos: Gasto[];
  facturas: Factura[];
  totals: { ingresosT2: number; ivaDevengadoT2: number; retencionesT2: number };
}) {
  const { ingresosT2 } = totals;
  const gastosEfectivos = useMemo(
    () => gastos.filter((g) => g.estado !== "incompleto"),
    [gastos],
  );
  const resumen = useMemo(() => {
    const operativos = gastosEfectivos.filter((g) => !g.esBien);
    const bienes = gastosEfectivos.filter((g) => g.esBien);
    const totalFijo = operativos.filter((g) => g.categoria === "fijo").reduce((s, g) => s + g.base, 0);
    const totalVariable = operativos.filter((g) => g.categoria === "variable").reduce((s, g) => s + g.base, 0);
    const totalOperativos = totalFijo + totalVariable;
    const totalBienes = bienes.reduce((s, g) => s + g.base, 0);
    const beneficio = ingresosT2 - totalOperativos;
    const margen = ingresosT2 > 0 ? (beneficio / ingresosT2) * 100 : 0;
    const { ivaAPagar, irpfAPagar } = calcularImpactoFiscal(gastosEfectivos, totals);
    const pctFijo = totalOperativos > 0 ? (totalFijo / totalOperativos) * 100 : 0;
    return { totalFijo, totalVariable, totalOperativos, totalBienes, beneficio, margen, ivaAPagar, irpfAPagar, pctFijo };
  }, [gastosEfectivos, ingresosT2, totals]);

  const conc = useMemo(() => {
    const porCliente: Record<string, number> = {};
    facturas.forEach((f) => (porCliente[f.cliente] = (porCliente[f.cliente] || 0) + f.base));
    const total = Object.values(porCliente).reduce((s, v) => s + v, 0);
    const ranking = Object.entries(porCliente)
      .map(([cliente, importe]) => ({ cliente, importe, pct: total > 0 ? (importe / total) * 100 : 0 }))
      .sort((a, b) => b.importe - a.importe);
    const top3 = ranking.slice(0, 3).reduce((s, r) => s + r.pct, 0);
    return { ranking, top3, top1: ranking[0]?.pct ?? 0, top1Cliente: ranking[0]?.cliente ?? "" };
  }, [facturas]);

  const proy = useMemo(() => {
    const gastosOp = gastosEfectivos.filter((g) => !g.esBien).reduce((s, g) => s + g.base, 0);
    const cerrados = [
      { ingresos: ACUMULADO_1T.ingresos, gastos: ACUMULADO_1T.gastos },
      { ingresos: ingresosT2, gastos: gastosOp },
    ];
    const promI = cerrados.reduce((s, t) => s + t.ingresos, 0) / cerrados.length;
    const promG = cerrados.reduce((s, t) => s + t.gastos, 0) / cerrados.length;
    const futuros = Array(4 - cerrados.length).fill(null).map(() => ({ ingresos: promI, gastos: promG }));
    const todos = [...cerrados, ...futuros];
    const iA = todos.reduce((s, t) => s + t.ingresos, 0);
    const gA = todos.reduce((s, t) => s + t.gastos, 0);
    return { todos, cerrados: cerrados.length, iA, gA, bA: iA - gA, irpfA: (iA - gA) * 0.2 };
  }, [gastosEfectivos, ingresosT2]);

  const comp = useMemo(() => {
    const gastosOp = gastosEfectivos.filter((g) => !g.esBien).reduce((s, g) => s + g.base, 0);
    const actual = { ingresos: ingresosT2, gastos: gastosOp, beneficio: ingresosT2 - gastosOp };
    const anterior = {
      ingresos: DATOS_2T_2025.ingresos,
      gastos: DATOS_2T_2025.gastos,
      beneficio: DATOS_2T_2025.ingresos - DATOS_2T_2025.gastos,
    };
    return [
      { label: "Ingresos", actual: actual.ingresos, anterior: anterior.ingresos },
      { label: "Gastos", actual: actual.gastos, anterior: anterior.gastos },
      { label: "Beneficio", actual: actual.beneficio, anterior: anterior.beneficio },
    ];
  }, [gastosEfectivos, ingresosT2]);

  const etiquetas = ["1T", "2T", "3T", "4T"];

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="Facturación 2T" value={fmt(ingresosT2)} sub="Total emitido en el trimestre" />
        <Kpi label="Gastos operativos" value={fmt(resumen.totalOperativos)} sub="Fijos + variables (sin bienes de inversión)" />
        <Kpi label="Beneficio del trimestre" value={fmt(resumen.beneficio)} sub={`Margen: ${resumen.margen.toFixed(1)}%`} tone="ok" />
        <Kpi label="IVA a pagar (303)" value={fmt(resumen.ivaAPagar)} sub="Devengado − deducible del trimestre" tone="warn" />
        <Kpi label="IRPF a pagar (130)" value={fmt(resumen.irpfAPagar)} sub="Pago fraccionado acumulado" tone="warn" />
        <Kpi label="Compra bienes de inversión" value={fmt(resumen.totalBienes)} sub="No se resta del beneficio operativo" />
      </div>

      <Card>
        <CardTitle>Costes fijos vs. variables</CardTitle>
        <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-[#1d2538]">
          <div className="h-full bg-[#3b82f6]" style={{ width: `${resumen.pctFijo}%` }} />
          <div className="h-full bg-[#34d399]" style={{ width: `${100 - resumen.pctFijo}%` }} />
        </div>
        <div className="mt-2.5 flex gap-4 text-[11.5px] text-[#56637c]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[#3b82f6]" /> Fijos: {fmt(resumen.totalFijo)} ({resumen.pctFijo.toFixed(0)}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[#34d399]" /> Variables: {fmt(resumen.totalVariable)} ({(100 - resumen.pctFijo).toFixed(0)}%)
          </span>
        </div>
        <Fnote>
          Estos números alimentan directamente el borrador del Modelo 303 (deducible) y del Modelo 130 (gasto acumulado).
        </Fnote>
      </Card>

      <Card>
        <CardTitle>Concentración de clientes</CardTitle>
        {conc.top1 >= 30 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(245,158,11,.1)] px-3 py-1.5 text-xs font-semibold text-[#f59e0b]">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {conc.top1.toFixed(0)}% de tu facturación depende de un solo cliente ({conc.top1Cliente})
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(52,211,153,.1)] px-3 py-1.5 text-xs font-semibold text-[#34d399]">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Facturación razonablemente repartida — tu cliente más grande es el {conc.top1.toFixed(0)}%
          </span>
        )}
        <div className="mt-3">
          {conc.ranking.map((r) => (
            <div key={r.cliente} className="flex items-center gap-3 py-2">
              <div className="flex-1 truncate text-[12.5px] font-semibold">{r.cliente}</div>
              <div className="h-[7px] flex-[2] overflow-hidden rounded-full bg-[#1d2538]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${r.pct}%`, background: "linear-gradient(90deg,#34d399,#3b82f6)" }}
                />
              </div>
              <div className="w-[46px] text-right text-xs font-semibold text-[#56637c]">{r.pct.toFixed(0)}%</div>
            </div>
          ))}
        </div>
        <Fnote>Tus 3 clientes principales suponen el {conc.top3.toFixed(0)}% de la facturación del periodo.</Fnote>
      </Card>

      <Card>
        <CardTitle>Proyección de cierre anual</CardTitle>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <Th>Trimestre</Th>
              <Th num>Ingresos</Th>
              <Th num>Gastos</Th>
              <Th num>Beneficio</Th>
            </tr>
          </thead>
          <tbody>
            {proy.todos.map((t, i) => {
              const est = i >= proy.cerrados;
              return (
                <tr key={i}>
                  <Td>
                    {etiquetas[i]} {est && <span className="text-[11px] text-[#56637c]">(estimado)</span>}
                  </Td>
                  <Td num>{fmt(t.ingresos)}</Td>
                  <Td num>{fmt(t.gastos)}</Td>
                  <Td num>{fmt(t.ingresos - t.gastos)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-2.5 text-[12.5px] font-semibold">
          Proyección anual: {fmt(proy.iA)} ingresos · {fmt(proy.gA)} gastos · {fmt(proy.bA)} beneficio · ~{fmt(proy.irpfA)} de pago fraccionado IRPF en el año
        </div>
        <Fnote>
          Los trimestres futuros se estiman como el promedio de los ya cerrados.
        </Fnote>
      </Card>

      <Card>
        <CardTitle>Comparativa interanual — 2T</CardTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {comp.map((m) => {
            const variacion = m.anterior !== 0 ? ((m.actual - m.anterior) / m.anterior) * 100 : 0;
            const sube = variacion >= 0;
            return (
              <div key={m.label} className="rounded-[10px] border border-[#1d2538] bg-[#0d1018] p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[.05em] text-[#56637c]">{m.label}</div>
                <div className="mt-1.5 text-base font-bold">{fmt(m.actual)}</div>
                <div className={"mt-1 text-[11px] font-semibold " + (sube ? "text-[#34d399]" : "text-[#f0635f]")}>
                  {sube ? "▲" : "▼"} {Math.abs(variacion).toFixed(1)}% vs. {fmt(m.anterior)} (2T 2025)
                </div>
              </div>
            );
          })}
        </div>
        <Fnote>2T 2025 vs. 2T 2026. Necesitas un año completo de histórico — aquí se muestra con datos de ejemplo.</Fnote>
      </Card>
    </div>
  );
}

function Th({ children, num }: { children: React.ReactNode; num?: boolean }) {
  return (
    <th
      className={
        "border-b border-[#1d2538] pb-[7px] pr-1.5 text-[9.5px] font-semibold uppercase tracking-[.05em] text-[#56637c] " +
        (num ? "text-right" : "text-left")
      }
    >
      {children}
    </th>
  );
}
function Td({ children, num }: { children: React.ReactNode; num?: boolean }) {
  return (
    <td
      className={
        "border-b border-[#1d2538] py-[7px] pr-1.5 text-[#dde3ee] " + (num ? "text-right tabular-nums" : "")
      }
    >
      {children}
    </td>
  );
}

function TabIngresos({ facturas }: { facturas: Factura[] }) {
  let totalBase = 0,
    totalIVA = 0,
    totalRet = 0,
    totalNeto = 0;
  const rows = facturas.map((f, i) => {
    const cIVA = (f.base * f.tipoIVA) / 100;
    const ret = (f.base * f.retencionPct) / 100;
    const total = f.base + cIVA - ret;
    totalBase += f.base;
    totalIVA += cIVA;
    totalRet += ret;
    totalNeto += total;
    return (
      <tr key={i}>
        <Td>{formatFecha(f.fecha)}</Td>
        <Td>{f.cliente}</Td>
        <Td>{f.concepto}</Td>
        <Td num>{fmt(f.base)}</Td>
        <Td num>{fmt(cIVA)}</Td>
        <Td num>{ret > 0 ? "−" + fmt(ret) : "—"}</Td>
        <Td num>{fmt(total)}</Td>
      </tr>
    );
  });
  return (
    <Card>
      <CardTitle>Ingresos del 2T 2026</CardTitle>
      <Fnote>
        Esto no se rellena a mano: cada factura que cierras/emites en Veract aparece aquí automáticamente.
      </Fnote>
      <table className="mt-3 w-full border-collapse text-xs">
        <thead>
          <tr>
            <Th>Fecha</Th>
            <Th>Cliente</Th>
            <Th>Concepto</Th>
            <Th num>Base</Th>
            <Th num>IVA</Th>
            <Th num>Retención</Th>
            <Th num>Total</Th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      <div className="mt-2.5 text-xs font-semibold text-[#dde3ee]">
        Total: {fmt(totalBase)} base · {fmt(totalIVA)} IVA · {fmt(totalRet)} retenido · {fmt(totalNeto)} neto cobrado
      </div>
    </Card>
  );
}

function TabGastos({
  gastos,
  setGastos,
  setBienes,
  user,
  recargarGastos,
}: {
  gastos: Gasto[];
  setGastos: React.Dispatch<React.SetStateAction<Gasto[]>>;
  setBienes: React.Dispatch<React.SetStateAction<Bien[]>>;
  user: { id: string } | null;
  recargarGastos: () => Promise<void>;
}) {
  const [fecha, setFecha] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [base, setBase] = useState("");
  const [tipoIVA, setTipoIVA] = useState("21");
  const [pctDeducible, setPctDeducible] = useState("100");
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [esBien, setEsBien] = useState(false);
  const [tipoBien, setTipoBien] = useState<TipoBien>("mueble");
  const [catAmort, setCatAmort] = useState<CategoriaAmort>("informatico");
  const [archivo, setArchivo] = useState<string | null>(null);
  const [archivoUrl, setArchivoUrl] = useState<string | null>(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = () => {
    setFecha("");
    setProveedor("");
    setDescripcion("");
    setBase("");
    setTipoIVA("21");
    setPctDeducible("100");
    setCategoria(null);
    setEsBien(false);
    setTipoBien("mueble");
    setCatAmort("informatico");
    setArchivo(null);
    setArchivoUrl(null);
    setEditingId(null);
  };

  const capturarRapido = async (file: File) => {
    if (!user) return;
    try {
      const workspace_id = await resolveActiveWorkspaceId(user.id);
      const path = await subirJustificante(file, workspace_id);
      const { error } = await supabase.from("variable_costs").insert({
        workspace_id,
        user_id: user.id,
        concept: "",
        provider: "",
        amount: 0,
        iva_percent: 21,
        pct_deducible: 100,
        date: todayISO(),
        es_bien_inversion: false,
        estado: "incompleto",
        archivo_nombre: file.name,
        archivo_url: path,
      });
      if (error) throw error;
      await recargarGastos();
    } catch (err) {
      console.warn("[capturarRapido] no se pudo guardar la captura:", err);
    }
  };

  const completarPendiente = (g: Gasto) => {
    setEditingId(g.id);
    setFecha(g.fecha || todayISO());
    setProveedor(g.proveedor || "");
    setDescripcion(g.descripcion || "");
    setBase(g.base ? String(g.base) : "");
    setTipoIVA(String(g.tipoIVA ?? 21));
    setPctDeducible(String(g.pctDeducible ?? 100));
    setCategoria(g.categoria ?? null);
    setEsBien(!!g.esBien);
    setTipoBien(g.tipoBien ?? "mueble");
    setCatAmort(g.categoriaAmortizacion ?? "informatico");
    setArchivo(g.archivo ?? null);
    setArchivoUrl(g.archivoUrl ?? null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const baseN = parseFloat(base) || 0;
    const cat = categoria ?? "variable";
    const previos = gastos.filter(
      (g) => g.categoria === cat && !g.esBien && g.estado !== "incompleto" && g.id !== editingId,
    );
    if (previos.length >= 3) {
      const media = previos.reduce((s, g) => s + g.base, 0) / previos.length;
      if (baseN > media * 2.5) {
        const ok = confirm(
          `Este importe (${fmt(baseN)}) es bastante más alto que tu gasto medio en "${cat}" (${fmt(
            media,
          )}). ¿Es correcto y quieres guardarlo igualmente?`,
        );
        if (!ok) return;
      }
    }
    const anios = AMORT_OPTIONS.find((o) => o.value === catAmort)?.anios ?? 5;
    try {
      const workspace_id = await resolveActiveWorkspaceId(user.id);
      const tabla = cat === "fijo" ? "fixed_costs" : "variable_costs";
      const payload: any = {
        workspace_id,
        user_id: user.id,
        concept: descripcion || proveedor,
        amount: baseN,
        date: fecha,
        iva_percent: parseFloat(tipoIVA),
        pct_deducible: parseFloat(pctDeducible) || 0,
      };
      if (tabla === "variable_costs") {
        payload.provider = proveedor;
        payload.es_bien_inversion = esBien;
        payload.archivo_nombre = archivo;
        payload.archivo_url = archivoUrl;
        payload.estado = "completo";
      }
      if (editingId !== null) {
        const { error } = await supabase.from(tabla).update(payload).eq("id", editingId);
        if (error) {
          console.warn(
            `[onSubmit] no se pudo actualizar en ${tabla} (posible cambio de categoría del gasto ${editingId}):`,
            error,
          );
        }
      } else {
        const { error } = await supabase.from(tabla).insert(payload);
        if (error) throw error;
      }
      await recargarGastos();
      reset();
    } catch (err) {
      console.warn("[onSubmit] no se pudo guardar el gasto:", err);
    }
  };

  const pendientes = gastos.filter((g) => g.estado === "incompleto");
  const editingGasto = editingId !== null ? gastos.find((g) => g.id === editingId) : null;
  const orden = [...gastos]
    .filter((g) => g.estado !== "incompleto")
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <>
      <Card>
        <CardTitle>Captura rápida</CardTitle>
        <p className="mt-2 mb-3 text-[11.5px] leading-relaxed text-[#56637c]">
          ¿Acabas de pagar algo? Haz la foto ahora, rellena los datos cuando tengas un momento — no se te pierde el ticket.
        </p>
        <label
          htmlFor="capturaInput"
          className="flex cursor-pointer items-center justify-center gap-2.5 rounded-[10px] border border-dashed border-[#1d2538] bg-[#0d1018] px-4 py-[18px] text-[13px] font-semibold text-[#34d399]"
        >
          📷 Foto rápida de un ticket o factura
        </label>
        <input
          id="capturaInput"
          type="file"
          accept="image/*,application/pdf"
          {...({ capture: "environment" } as any)}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) capturarRapido(f);
            e.currentTarget.value = "";
          }}
        />
        {pendientes.length > 0 && (
          <div className="mt-3">
            {pendientes.map((g) => {
              const isPdf = (g.archivo ?? "").toLowerCase().endsWith(".pdf");
              return (
                <div
                  key={g.id}
                  className="mb-2 flex items-center gap-3 rounded-[9px] border border-[rgba(245,158,11,.25)] bg-[rgba(245,158,11,.08)] px-3 py-2.5 last:mb-0"
                >
                  <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[7px] bg-[#0d1018] text-[15px]">
                    {isPdf ? "📄" : "🧾"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold text-[#f59e0b]">
                      Ticket capturado el {formatFecha(g.fecha)}
                    </div>
                    <div className="mt-[1px] text-[11px] text-[#56637c]">
                      Te faltan los datos
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => completarPendiente(g)}
                    className="flex-shrink-0 cursor-pointer rounded-[7px] border-0 bg-[#f59e0b] px-3 py-[7px] text-[11.5px] font-bold text-[#0a0c11]"
                  >
                    Completar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>
          {editingGasto
            ? `Completar gasto (${editingGasto.archivo || "sin justificante"})`
            : "Nuevo gasto"}
        </CardTitle>
        <form onSubmit={onSubmit}>
          <div className="mb-3 flex flex-wrap gap-2.5">
            <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
              <Label>Fecha</Label>
              <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
            </div>
            <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
              <Label>Proveedor</Label>
              <input type="text" required placeholder="Ej. Movistar" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="mb-3 flex flex-col gap-1.5">
            <Label>Descripción</Label>
            <input type="text" placeholder="Ej. Cuota de internet y móvil" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputCls} />
          </div>
          <div className="mb-3 flex flex-wrap gap-2.5">
            <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
              <Label>Base imponible (€)</Label>
              <input type="number" step="0.01" required placeholder="0.00" value={base} onChange={(e) => setBase(e.target.value)} className={inputCls} />
            </div>
            <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
              <Label>Tipo de IVA</Label>
              <select value={tipoIVA} onChange={(e) => setTipoIVA(e.target.value)} className={inputCls}>
                <option value="21">21%</option>
                <option value="10">10%</option>
                <option value="4">4%</option>
                <option value="0">0% / exento</option>
              </select>
            </div>
            <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
              <Label>% deducible</Label>
              <input type="number" min={0} max={100} value={pctDeducible} onChange={(e) => setPctDeducible(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="mb-3 flex flex-col gap-1.5">
            <Label>Categoría</Label>
            <div className="flex gap-2">
              <CatButton selected={categoria === "fijo"} onClick={() => setCategoria("fijo")} variant="fijo">
                Coste fijo
              </CatButton>
              <CatButton selected={categoria === "variable"} onClick={() => setCategoria("variable")} variant="variable">
                Coste variable
              </CatButton>
            </div>
          </div>
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setEsBien((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-[#1d2538] bg-[#0d1018] px-3.5 py-3 text-left"
            >
              <span
                className={
                  "relative h-4 w-4 flex-shrink-0 rounded border " +
                  (esBien ? "border-[#f59e0b] bg-[#f59e0b]" : "border-[#1d2538]")
                }
              >
                {esBien && (
                  <span className="absolute inset-0 grid place-items-center text-[11px] text-[#0a0c11]">
                    ✓
                  </span>
                )}
              </span>
              <span className="text-[12.5px] text-[#dde3ee]">
                Es un bien de inversión (equipo, mobiliario, maquinaria de más de 3.005,06 € y más de 1 año de vida útil)
              </span>
            </button>
          </div>
          {esBien && (
            <div className="mb-3 rounded-lg border border-[#1d2538] bg-[#0d1018] p-3.5">
              <Label>Tipo de bien — para la regularización de IVA</Label>
              <div className="mb-3 mt-1.5 flex gap-2">
                <CatButton selected={tipoBien === "mueble"} onClick={() => setTipoBien("mueble")} variant="neutral">
                  Mueble (5 años)
                </CatButton>
                <CatButton selected={tipoBien === "inmueble"} onClick={() => setTipoBien("inmueble")} variant="neutral">
                  Inmueble (10 años)
                </CatButton>
              </div>
              <Label>¿Qué es, más o menos? — para saber en cuántos años se amortiza en el IRPF</Label>
              <select
                value={catAmort}
                onChange={(e) => setCatAmort(e.target.value as CategoriaAmort)}
                className={inputCls + " mt-1.5"}
              >
                {AMORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Fnote>
                Elige la que más se parezca y Veract reparte el coste en esos años. Una gestoría puede ajustarlo después sin problema.
              </Fnote>
            </div>
          )}
          <div className="mb-3 flex flex-col gap-1.5">
            <Label>Justificante (PDF o imagen)</Label>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f || !user) return;
                setArchivo(f.name);
                setSubiendoArchivo(true);
                const workspace_id = await resolveActiveWorkspaceId(user.id);
                const path = await subirJustificante(f, workspace_id);
                setArchivoUrl(path);
                setSubiendoArchivo(false);
                if (!path) {
                  console.warn("No se pudo subir el justificante, se puede seguir sin él.");
                }
              }}
              className="w-full rounded-lg border border-[#1d2538] bg-[#0d1018] p-1.5 text-xs text-[#56637c]"
            />
            {subiendoArchivo && (
              <span className="text-[11px] text-[#56637c]">Subiendo justificante…</span>
            )}
          </div>
          <button
            type="submit"
            disabled={subiendoArchivo}
            className="mt-1.5 cursor-pointer rounded-lg border-0 px-4 py-2.5 text-[13px] font-bold text-[#0a0c11]"
            style={{
              background: "linear-gradient(90deg,#34d399,#3b82f6)",
              opacity: subiendoArchivo ? 0.6 : 1,
            }}
          >
            {editingId !== null ? "Guardar datos del gasto" : "Añadir gasto"}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={reset}
              className="ml-2 cursor-pointer rounded-lg border border-[#1d2538] bg-[#0d1018] px-4 py-2.5 text-[13px] font-semibold text-[#56637c]"
            >
              Cancelar
            </button>
          )}
        </form>
      </Card>

      <Card>
        <CardTitle>Gastos del 2T 2026</CardTitle>
        {orden.length === 0 ? (
          <p className="px-2 py-5 text-center text-xs text-[#56637c]">Todavía no has añadido ningún gasto.</p>
        ) : (
          <div>
            {orden.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-3 border-b border-[#1d2538] py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
                    {g.proveedor}
                    <Tag variant={g.categoria}>{g.categoria}</Tag>
                    {g.esBien && <Tag variant="bien">Bien de inversión</Tag>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#56637c]">
                    {g.descripcion || ""} · {formatFecha(g.fecha)} · IVA {g.tipoIVA}% · {g.pctDeducible}% deducible
                    {g.archivo && g.archivoUrl && (
                      <button
                        type="button"
                        onClick={async () => {
                          const url = await obtenerUrlFirmada(g.archivoUrl!);
                          if (url) window.open(url, "_blank");
                          else console.warn("No se pudo abrir el justificante.");
                        }}
                        className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-[#1d2538] bg-[#0d1018] px-2 py-0.5 text-[10.5px] text-[#34d399] hover:underline"
                      >
                        📎 {g.archivo}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-[13.5px] font-bold tabular-nums">{fmt(g.base)}</div>
                  <div className="mt-0.5 text-[10.5px] text-[#56637c]">
                    IVA deducible: {fmt(cuotaDeducible(g))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function Tag({ variant, children }: { variant: "fijo" | "variable" | "bien"; children: React.ReactNode }) {
  const style =
    variant === "fijo"
      ? "bg-[rgba(59,130,246,.12)] text-[#3b82f6]"
      : variant === "variable"
      ? "bg-[rgba(52,211,153,.1)] text-[#34d399]"
      : "bg-[rgba(245,158,11,.1)] text-[#f59e0b]";
  return (
    <span
      className={
        "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[.04em] " + style
      }
    >
      {children}
    </span>
  );
}

function TabBienes({ bienes }: { bienes: Bien[] }) {
  return (
    <Card>
      <CardTitle>Registro de bienes de inversión</CardTitle>
      {bienes.length === 0 ? (
        <p className="px-2 py-5 text-center text-xs text-[#56637c]">Sin bienes de inversión registrados.</p>
      ) : (
        bienes.map((b) => <BienCard key={b.id} bien={b} />)
      )}
      <div className="mt-3 flex items-start gap-2.5 rounded-[9px] border border-[rgba(52,211,153,.25)] bg-[rgba(52,211,153,.1)] px-3.5 py-3 text-xs leading-relaxed text-[#34d399]">
        <span>ℹ</span>
        <span>
          La amortización de IRPF usa un reparto lineal simplificado (coste ÷ años elegidos ÷ 4 trimestres),
          no la tabla oficial de coeficientes de Hacienda. Es una aproximación pensada para no complicar al usuario.
        </span>
      </div>
    </Card>
  );
}

function BienCard({ bien }: { bien: Bien }) {
  const cuotaTotal = (bien.base * bien.tipoIVA) / 100;
  const años = bien.tipoBien === "mueble" ? 5 : 10;
  const añoAdq = parseInt(bien.fechaAdquisicion.slice(0, 4));
  const amortT = bien.base / bien.aniosAmortizacion / 4;

  const [pcts, setPcts] = useState<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    for (let i = 1; i < años; i++) map[añoAdq + i] = 100;
    return map;
  });

  const regul = (anio: number) => {
    const pct = pcts[anio] ?? 100;
    const dif = bien.pctInicial - pct;
    if (Math.abs(dif) <= 10) return 0;
    return ((cuotaTotal * bien.pctInicial) / 100 - (cuotaTotal * pct) / 100) / años;
  };

  return (
    <div className="mb-3 rounded-[10px] border border-[#1d2538] bg-[#0d1018] p-4 last:mb-0">
      <div className="mb-2.5 flex items-start justify-between">
        <div>
          <div className="text-[13.5px] font-bold">{bien.descripcion}</div>
          <div className="mt-0.5 text-[11px] text-[#56637c]">
            Adquirido el {formatFecha(bien.fechaAdquisicion)} · {fmt(bien.base)} + {fmt(cuotaTotal)} IVA · Deducción inicial {bien.pctInicial}%
          </div>
          <div className="mt-0.5 text-[11px] text-[#56637c]">
            Amortización IRPF: {fmt(amortT)}/trimestre durante {bien.aniosAmortizacion} años
          </div>
        </div>
        <span className="rounded-full border border-[#1d2538] bg-[#131926] px-2.5 py-0.5 text-[10px] text-[#56637c]">
          {bien.tipoBien === "mueble" ? "Mueble · 5 años (IVA)" : "Inmueble · 10 años (IVA)"}
        </span>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <Th>Ejercicio</Th>
            <Th num>% año adquisición</Th>
            <Th num>% deducción ese año</Th>
            <Th num>Regularización</Th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: años - 1 }, (_, i) => {
            const ejercicio = añoAdq + i + 1;
            const r = regul(ejercicio);
            return (
              <tr key={ejercicio}>
                <Td>{ejercicio}</Td>
                <Td num>{bien.pctInicial}%</Td>
                <Td num>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={pcts[ejercicio] ?? 100}
                    onChange={(e) =>
                      setPcts((p) => ({ ...p, [ejercicio]: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-[60px] rounded-md border border-[#1d2538] bg-[#0d1018] px-1.5 py-1 text-right text-xs text-[#dde3ee]"
                  />
                </Td>
                <Td num>
                  {fmt(Math.abs(r))}
                  {r === 0 ? "" : r > 0 ? " (a ingresar)" : " (a favor)"}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Fnote>
        Solo se regulariza si la diferencia entre el % del año de adquisición y el del ejercicio supera 10 puntos.
      </Fnote>
    </div>
  );
}

function TabSimulador({
  gastos,
  setGastos,
  setBienes,
  totals,
}: {
  gastos: Gasto[];
  setGastos: React.Dispatch<React.SetStateAction<Gasto[]>>;
  setBienes: React.Dispatch<React.SetStateAction<Bien[]>>;
  totals: { ingresosT2: number; ivaDevengadoT2: number; retencionesT2: number };
}) {
  const [descripcion, setDescripcion] = useState("");
  const [base, setBase] = useState("");
  const [tipoIVA, setTipoIVA] = useState("21");
  const [pctDeducible, setPctDeducible] = useState("100");
  const [esBien, setEsBien] = useState(false);
  const [catAmort, setCatAmort] = useState<CategoriaAmort>("informatico");
  const [resultado, setResultado] = useState<null | {
    antes: ReturnType<typeof calcularImpactoFiscal>;
    despues: ReturnType<typeof calcularImpactoFiscal>;
    sim: SimGasto;
  }>(null);

  const simular = (e: React.FormEvent) => {
    e.preventDefault();
    const anios = AMORT_OPTIONS.find((o) => o.value === catAmort)?.anios ?? 5;
    const sim: SimGasto = {
      descripcion,
      categoria: "variable",
      base: parseFloat(base) || 0,
      tipoIVA: parseFloat(tipoIVA),
      pctDeducible: parseFloat(pctDeducible) || 0,
      esBien,
      categoriaAmortizacion: esBien ? catAmort : undefined,
      aniosAmortizacion: esBien ? anios : undefined,
    };
    setResultado({
      antes: calcularImpactoFiscal(gastos, totals),
      despues: calcularImpactoFiscal([...gastos, sim], totals),
      sim,
    });
  };

  const convertir = () => {
    if (!resultado) return;
    const id = crypto.randomUUID();
    const nuevo: Gasto = {
      id,
      fecha: todayISO(),
      proveedor: resultado.sim.descripcion || "Gasto simulado",
      descripcion: resultado.sim.descripcion,
      categoria: "variable",
      base: resultado.sim.base,
      tipoIVA: resultado.sim.tipoIVA,
      pctDeducible: resultado.sim.pctDeducible,
      esBien: resultado.sim.esBien,
      categoriaAmortizacion: resultado.sim.categoriaAmortizacion,
      aniosAmortizacion: resultado.sim.aniosAmortizacion,
      tipoBien: resultado.sim.esBien ? "mueble" : undefined,
      archivo: null,
    };
    setGastos((prev) => [...prev, nuevo]);
    if (nuevo.esBien) {
      setBienes((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          gastoId: id,
          descripcion: nuevo.descripcion || nuevo.proveedor,
          fechaAdquisicion: nuevo.fecha,
          base: nuevo.base,
          tipoIVA: nuevo.tipoIVA,
          pctInicial: nuevo.pctDeducible,
          tipoBien: "mueble",
          categoriaAmortizacion: nuevo.categoriaAmortizacion!,
          aniosAmortizacion: nuevo.aniosAmortizacion!,
        },
      ]);
    }
    setResultado(null);
    setDescripcion("");
    setBase("");
    setPctDeducible("100");
    setTipoIVA("21");
    setEsBien(false);
  };

  return (
    <>
      <Card>
        <CardTitle>Simulador antes de comprar</CardTitle>
        <Fnote>Prueba un gasto hipotético y mira cómo cambiaría tu IVA e IRPF de este trimestre, sin guardar nada.</Fnote>
        <form onSubmit={simular} className="mt-3">
          <div className="mb-3 flex flex-col gap-1.5">
            <Label>Descripción</Label>
            <input type="text" placeholder="Ej. Cámara para el estudio" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputCls} />
          </div>
          <div className="mb-3 flex flex-wrap gap-2.5">
            <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
              <Label>Base imponible (€)</Label>
              <input type="number" step="0.01" required placeholder="0.00" value={base} onChange={(e) => setBase(e.target.value)} className={inputCls} />
            </div>
            <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
              <Label>Tipo de IVA</Label>
              <select value={tipoIVA} onChange={(e) => setTipoIVA(e.target.value)} className={inputCls}>
                <option value="21">21%</option>
                <option value="10">10%</option>
                <option value="4">4%</option>
                <option value="0">0% / exento</option>
              </select>
            </div>
            <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
              <Label>% deducible</Label>
              <input type="number" min={0} max={100} value={pctDeducible} onChange={(e) => setPctDeducible(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setEsBien((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-[#1d2538] bg-[#0d1018] px-3.5 py-3 text-left"
            >
              <span
                className={
                  "relative h-4 w-4 flex-shrink-0 rounded border " +
                  (esBien ? "border-[#f59e0b] bg-[#f59e0b]" : "border-[#1d2538]")
                }
              >
                {esBien && (
                  <span className="absolute inset-0 grid place-items-center text-[11px] text-[#0a0c11]">✓</span>
                )}
              </span>
              <span className="text-[12.5px]">Es un bien de inversión</span>
            </button>
          </div>
          {esBien && (
            <div className="mb-3 rounded-lg border border-[#1d2538] bg-[#0d1018] p-3.5">
              <Label>¿Qué es, más o menos?</Label>
              <select
                value={catAmort}
                onChange={(e) => setCatAmort(e.target.value as CategoriaAmort)}
                className={inputCls + " mt-1.5"}
              >
                {AMORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            className="mt-1.5 cursor-pointer rounded-lg border-0 px-4 py-2.5 text-[13px] font-bold text-[#0a0c11]"
            style={{ background: "linear-gradient(90deg,#34d399,#3b82f6)" }}
          >
            Simular impacto
          </button>
        </form>
      </Card>

      {resultado && (
        <Card>
          <CardTitle>Resultado de la simulación</CardTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Kpi label="IVA a pagar (303)" value={fmt(resultado.antes.ivaAPagar)} sub="Antes de este gasto" />
            <Kpi
              label="IVA a pagar con este gasto"
              value={fmt(resultado.despues.ivaAPagar)}
              sub={`${resultado.despues.ivaAPagar <= resultado.antes.ivaAPagar ? "−" : "+"}${fmt(
                Math.abs(resultado.antes.ivaAPagar - resultado.despues.ivaAPagar),
              )}`}
              tone="ok"
            />
            <Kpi label="IRPF a pagar (130)" value={fmt(resultado.antes.irpfAPagar)} sub="Antes de este gasto" />
            <Kpi
              label="IRPF a pagar con este gasto"
              value={fmt(resultado.despues.irpfAPagar)}
              sub={`${resultado.despues.irpfAPagar <= resultado.antes.irpfAPagar ? "−" : "+"}${fmt(
                Math.abs(resultado.antes.irpfAPagar - resultado.despues.irpfAPagar),
              )}`}
              tone="ok"
            />
          </div>
          <button
            onClick={convertir}
            className="mt-3.5 w-full cursor-pointer rounded-lg border-0 px-4 py-2.5 text-[13px] font-bold text-[#0a0c11]"
            style={{ background: "linear-gradient(90deg,#34d399,#3b82f6)" }}
          >
            Convertir en gasto real
          </button>
          <Fnote>Esto es una simulación. No se guarda como gasto real hasta que pulses el botón.</Fnote>
        </Card>
      )}
    </>
  );
}