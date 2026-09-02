import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveWorkspace } from "@/hooks/use-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, AlertTriangle, Clock, CheckCircle2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portfolio")({
  component: PortfolioPage,
  head: () => ({ meta: [{ title: "Cartera de clientes · Veract" }] }),
});

type WsRow = {
  id: string;
  name: string;
  nif: string | null;
};

type Summary = {
  invoicedBase: number;
  vat: number;
  invoicedCount: number;
  pendingCount: number;
  overduePendingCount: number;
  lastActivity: string | null;
};

function currentQuarterBounds(now = new Date()) {
  const y = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3);
  const start = new Date(y, q * 3, 1);
  const end = new Date(y, q * 3 + 3, 1);
  return { start, end, label: `T${q + 1} ${y}` };
}

function PortfolioPage() {
  const { user } = useAuth();
  const { setActive } = useActiveWorkspace();
  const { start, end, label } = useMemo(() => currentQuarterBounds(), []);
  const [onlyPending, setOnlyPending] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["portfolio", user?.id, start.toISOString()],
    enabled: !!user,
    queryFn: async () => {
      const { data: mem, error: e1 } = await supabase
        .from("workspace_members")
        .select("workspaces:workspace_id ( id, name, nif )")
        .eq("user_id", user!.id);
      if (e1) throw e1;
      const workspaces: WsRow[] = (mem ?? [])
        .map((r: any) => r.workspaces)
        .filter(Boolean);

      const results = await Promise.all(
        workspaces.map(async (w) => {
          const { data: invs } = await supabase
            .from("invoices")
            .select("base_amount, vat_amount, status, cobrada_at, fecha_emision")
            .eq("workspace_id", w.id)
            .gte("fecha_emision", start.toISOString().slice(0, 10))
            .lt("fecha_emision", end.toISOString().slice(0, 10));
          const summary: Summary = {
            invoicedBase: 0,
            vat: 0,
            invoicedCount: 0,
            pendingCount: 0,
            overduePendingCount: 0,
            lastActivity: null,
          };
          const now = Date.now();
          for (const inv of (invs ?? []) as any[]) {
            if (inv.status === "issued") {
              summary.invoicedBase += Number(inv.base_amount ?? 0);
              summary.vat += Number(inv.vat_amount ?? 0);
              summary.invoicedCount += 1;
              if (!inv.cobrada_at) {
                summary.pendingCount += 1;
                const emitted = new Date(inv.fecha_emision).getTime();
                if (now - emitted > 60 * 24 * 3600 * 1000) summary.overduePendingCount += 1;
              }
              if (!summary.lastActivity || inv.fecha_emision > summary.lastActivity) {
                summary.lastActivity = inv.fecha_emision;
              }
            }
          }
          return { workspace: w, summary };
        }),
      );
      return results;
    },
  });

  const filtered = onlyPending
    ? rows.filter((r) => r.summary.pendingCount > 0)
    : rows;

  const totals = filtered.reduce(
    (acc, r) => {
      acc.base += r.summary.invoicedBase;
      acc.vat += r.summary.vat;
      acc.pending += r.summary.pendingCount;
      acc.overdue += r.summary.overduePendingCount;
      return acc;
    },
    { base: 0, vat: 0, pending: 0, overdue: 0 },
  );

  if (!isLoading && rows.length < 2) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-3xl pt-16">
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader>
              <CardTitle>Cartera de clientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-400">
              <p>
                Esta vista está pensada para gestorías con varios NIFs a su
                cargo. Aún gestionas un único NIF, por lo que no hay cartera que
                mostrar.
              </p>
              <p>
                Cuando invites a otros negocios o crees más NIFs, aquí verás el
                estado del trimestre de cada uno de un vistazo.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Cartera de clientes</h1>
            <p className="text-sm text-slate-400">
              Estado del trimestre {label} · {filtered.length} NIF{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button
            variant={onlyPending ? "default" : "outline"}
            onClick={() => setOnlyPending((v) => !v)}
            className={onlyPending ? "bg-emerald-500 hover:bg-emerald-600" : "border-slate-700"}
          >
            {onlyPending ? "Ver todos" : "Solo pendientes de revisar"}
          </Button>
        </header>

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard label="Base facturada" value={fmt(totals.base)} />
          <StatCard label="IVA repercutido" value={fmt(totals.vat)} />
          <StatCard label="Facturas pendientes" value={String(totals.pending)} />
          <StatCard label="Vencidas (>60 d)" value={String(totals.overdue)} accent={totals.overdue > 0} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(({ workspace, summary }) => {
            const hasAlert = summary.overduePendingCount > 0;
            return (
              <Card
                key={workspace.id}
                className={
                  "border bg-slate-900/60 transition " +
                  (hasAlert ? "border-rose-500/40" : "border-slate-800")
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br from-indigo-500/30 to-emerald-500/20 text-emerald-300">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{workspace.name}</CardTitle>
                        <div className="text-xs text-slate-500">
                          {workspace.nif || "Sin NIF"}
                        </div>
                      </div>
                    </div>
                    {hasAlert ? (
                      <Badge className="bg-rose-500/20 text-rose-300 hover:bg-rose-500/20">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Revisar
                      </Badge>
                    ) : summary.pendingCount > 0 ? (
                      <Badge className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/20">
                        <Clock className="mr-1 h-3 w-3" /> Pendiente
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Al día
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Row label="Base" value={fmt(summary.invoicedBase)} />
                    <Row label="IVA" value={fmt(summary.vat)} />
                    <Row label="Facturas" value={String(summary.invoicedCount)} />
                    <Row
                      label="Pendientes"
                      value={`${summary.pendingCount}${
                        summary.overduePendingCount > 0 ? ` (${summary.overduePendingCount} >60d)` : ""
                      }`}
                      accent={summary.overduePendingCount > 0}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-slate-700"
                    onClick={() => {
                      setActive(workspace.id);
                      window.location.href = "/accounting";
                    }}
                  >
                    Abrir contabilidad <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={"mt-1 text-lg font-bold " + (accent ? "text-rose-300" : "text-white")}>{value}</div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-slate-950 px-2 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className={"font-mono " + (accent ? "text-rose-300" : "text-slate-200")}>{value}</span>
    </div>
  );
}