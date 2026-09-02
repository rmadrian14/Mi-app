import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  resolver, calcularImportes, nuevaLinea, ueQ,
  type Emisor, type Cliente, type Factura, type Linea, type Naturaleza, type TipoCliente,
  type ResolveResult,
} from "@/lib/fiscal-engine";

export type FinalizeState = {
  cliente: Cliente;
  factura: Factura;
  descuentoGlobal: number;
  resultado: ResolveResult | null;
  importes: { base: number; iva: number; ret: number; total: number } | null;
};

export function defaultFinalizeState(seed?: {
  nombre?: string; nif?: string; direccion?: string; precio?: number; iva?: number;
  tipo?: TipoCliente; pais?: string; provincia?: string; nifIva?: string;
}): FinalizeState {
  return {
    cliente: {
      tipo: seed?.tipo ?? "empresa",
      pais: seed?.pais ?? "ES",
      provincia: seed?.provincia ?? null,
      nombre: seed?.nombre ?? "",
      nif: seed?.nif ?? "",
      direccion: seed?.direccion ?? "",
      nifIva: seed?.nifIva ?? null,
    },
    factura: {
      fecha: new Date().toISOString().slice(0, 10),
      naturaleza: "servicio_digital",
      tipoIvaEsp: seed?.iva ?? 0.21,
      lineas: [seed?.precio ? { concepto: "Servicio", c: 1, p: seed.precio, d: 0 } : nuevaLinea()],
    },
    descuentoGlobal: 0,
    resultado: null,
    importes: null,
  };
}

function fmt(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function pct(n: number) {
  const v = Math.round(n * 1000) / 10;
  return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + " %";
}

export function FiscalFinalizeDialog({
  open,
  onOpenChange,
  emisor,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  emisor: Emisor;
  initial: FinalizeState;
  onSave: (state: FinalizeState) => void;
}) {
  const [state, setState] = useState<FinalizeState>(initial);

  useEffect(() => {
    if (open) setState(initial);
  }, [open, initial]);

  const esUEEmp = useMemo(
    () => (state.cliente.tipo === "empresa" || state.cliente.tipo === "autonomo")
      && ueQ(state.cliente.pais) && state.cliente.pais !== "ES",
    [state.cliente.tipo, state.cliente.pais],
  );

  function calcular() {
    const res = resolver(emisor, state.cliente, state.factura);
    if (res.err) {
      setState(s => ({ ...s, resultado: { err: res.err }, importes: null }));
      return;
    }
    const imp = calcularImportes(state.factura.lineas, res, state.descuentoGlobal);
    setState(s => ({ ...s, resultado: res, importes: imp }));
  }

  const canSave = state.resultado?.puedeEmitirse;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalizar propuesta para AEAT</DialogTitle>
          <DialogDescription>
            Rellena los datos fiscales. El motor calcula IVA, IRPF y régimen aplicable
            (Canarias/IGIC, Ceuta·Melilla/IPSI, inversión sujeto pasivo, OSS UE, extracomunitario).
            Podrás seguir editando después.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-4">
          <div className="space-y-4">
            <section className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Datos del cliente
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de cliente</Label>
                  <Select value={state.cliente.tipo}
                    onValueChange={(v) => setState(s => ({ ...s, cliente: { ...s.cliente, tipo: v as TipoCliente } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="particular">Particular</SelectItem>
                      <SelectItem value="empresa">Empresa</SelectItem>
                      <SelectItem value="autonomo">Autónomo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">País (ISO)</Label>
                  <Input maxLength={2} value={state.cliente.pais ?? ""}
                    onChange={(e) => setState(s => ({ ...s, cliente: { ...s.cliente, pais: e.target.value.toUpperCase().slice(0, 2) || null } }))} />
                </div>
              </div>
              {state.cliente.pais === "ES" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Provincia (solo si Canarias, Ceuta o Melilla)</Label>
                  <Input value={state.cliente.provincia ?? ""}
                    placeholder="Ej: Las Palmas, Tenerife, Ceuta, Melilla…"
                    onChange={(e) => setState(s => ({ ...s, cliente: { ...s.cliente, provincia: e.target.value || null } }))} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre o razón social</Label>
                <Input value={state.cliente.nombre}
                  onChange={(e) => setState(s => ({ ...s, cliente: { ...s.cliente, nombre: e.target.value } }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">NIF / CIF</Label>
                  <Input value={state.cliente.nif}
                    onChange={(e) => setState(s => ({ ...s, cliente: { ...s.cliente, nif: e.target.value.toUpperCase() } }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dirección</Label>
                  <Input value={state.cliente.direccion}
                    onChange={(e) => setState(s => ({ ...s, cliente: { ...s.cliente, direccion: e.target.value } }))} />
                </div>
              </div>
              {esUEEmp && (
                <div className="space-y-1.5">
                  <Label className="text-xs">NIF-IVA intracomunitario</Label>
                  <Input placeholder="Ej: FR40303265045" value={state.cliente.nifIva ?? ""}
                    onChange={(e) => setState(s => ({ ...s, cliente: { ...s.cliente, nifIva: e.target.value || null } }))} />
                  <p className="text-[11px] text-muted-foreground">
                    Necesario para aplicar inversión del sujeto pasivo. Se verificará contra VIES al emitir.
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Líneas de factura
              </h3>
              <div className="grid grid-cols-[1fr_60px_100px_80px_36px] gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Concepto</span><span>Cant.</span><span>P. Unit €</span><span>Dto. €</span><span></span>
              </div>
              {state.factura.lineas.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_60px_100px_80px_36px] gap-2 items-center">
                  <Input value={l.concepto} placeholder="Suscripción mensual…"
                    onChange={(e) => setState(s => ({ ...s, factura: { ...s.factura, lineas: s.factura.lineas.map((x, j) => j === i ? { ...x, concepto: e.target.value } : x) } }))} />
                  <Input type="number" min={0} value={l.c}
                    onChange={(e) => setState(s => ({ ...s, factura: { ...s.factura, lineas: s.factura.lineas.map((x, j) => j === i ? { ...x, c: parseFloat(e.target.value) || 0 } : x) } }))} />
                  <Input type="number" min={0} step="0.01" value={l.p}
                    onChange={(e) => setState(s => ({ ...s, factura: { ...s.factura, lineas: s.factura.lineas.map((x, j) => j === i ? { ...x, p: parseFloat(e.target.value) || 0 } : x) } }))} />
                  <Input type="number" min={0} step="0.01" value={l.d}
                    onChange={(e) => setState(s => ({ ...s, factura: { ...s.factura, lineas: s.factura.lineas.map((x, j) => j === i ? { ...x, d: parseFloat(e.target.value) || 0 } : x) } }))} />
                  <Button variant="ghost" size="icon" onClick={() => setState(s => ({ ...s, factura: { ...s.factura, lineas: s.factura.lineas.filter((_, j) => j !== i) } }))}>✕</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full border-dashed"
                onClick={() => setState(s => ({ ...s, factura: { ...s.factura, lineas: [...s.factura.lineas, nuevaLinea()] } }))}>
                + Añadir línea
              </Button>
            </section>

            <section className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Opciones adicionales
              </h3>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de producto o servicio</Label>
                <Select value={state.factura.naturaleza}
                  onValueChange={(v) => setState(s => ({ ...s, factura: { ...s.factura, naturaleza: v as Naturaleza } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="servicio_digital">Software / SaaS / venta digital</SelectItem>
                    <SelectItem value="servicio_profesional">Servicio profesional (consultoría, auditoría, ingeniería…)</SelectItem>
                    <SelectItem value="bien_fisico">Bien o producto físico</SelectItem>
                    <SelectItem value="telecomunicaciones">Telecomunicaciones / TV / radio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de IVA aplicable (cuando corresponda)</Label>
                <Select value={String(state.factura.tipoIvaEsp)}
                  onValueChange={(v) => setState(s => ({ ...s, factura: { ...s.factura, tipoIvaEsp: parseFloat(v) } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.21">21 % — General</SelectItem>
                    <SelectItem value="0.1">10 % — Reducido</SelectItem>
                    <SelectItem value="0.04">4 % — Superreducido</SelectItem>
                    <SelectItem value="0">0 % — Exento art. 20 LIVA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Descuento global (€)</Label>
                  <Input type="number" min={0} step="0.01" value={state.descuentoGlobal}
                    onChange={(e) => setState(s => ({ ...s, descuentoGlobal: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha</Label>
                  <Input type="date" value={state.factura.fecha}
                    onChange={(e) => setState(s => ({ ...s, factura: { ...s.factura, fecha: e.target.value } }))} />
                </div>
              </div>
              <Button className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 text-slate-900 font-bold hover:opacity-90"
                onClick={calcular}>
                Calcular factura
              </Button>
            </section>
          </div>

          <aside className="rounded-lg border border-border p-4 space-y-3 h-fit sticky top-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Resumen</h3>
            {!state.resultado ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <div className="text-2xl opacity-30 mb-2">🧾</div>
                Rellena los datos y pulsa <br />"Calcular factura"
              </div>
            ) : state.resultado.err ? (
              <div className="rounded-md bg-destructive/10 border border-destructive/25 p-3 text-xs text-destructive">
                {state.resultado.err}
              </div>
            ) : (
              <ResumenPanel state={state} />
            )}
          </aside>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!canSave} onClick={() => onSave(state)}>
            Guardar y preparar para AEAT
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResumenPanel({ state }: { state: FinalizeState }) {
  const res = state.resultado!;
  const imp = state.importes;
  const listo = res.puedeEmitirse;
  return (
    <div className="space-y-2 text-sm">
      <Badge
        variant={listo ? "default" : "destructive"}
        className={listo ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : ""}
      >
        {listo ? "● Listo para emitir" : "● Datos incompletos"}
      </Badge>

      <div className="flex justify-between py-2 border-b border-border">
        <span className="text-muted-foreground">Base imponible</span>
        <strong>{fmt(imp?.base ?? 0)}</strong>
      </div>

      <div className="flex justify-between py-2 border-b border-border">
        <div className="flex flex-col">
          <span>
            {res.aplicaIva
              ? res.oss ? `IVA OSS — ${res.paisIva}` : res.isp ? "IVA (ISP)" : "IVA"
              : "IVA"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {res.aplicaIva
              ? res.tipoIva != null ? pct(res.tipoIva) : ""
              : res.igicInfo ? `No sujeto — cliente paga IGIC ${(res.igicInfo * 100).toFixed(0)}%`
              : res.ipsiReq ? "Sujeto a IPSI — registro local"
              : res.esc === "EXTRACOMUNITARIO" ? "No sujeto — fuera UE"
              : "No sujeto / Exento"}
          </span>
        </div>
        <span>{res.aplicaIva ? `+ ${fmt(imp?.iva ?? 0)}` : "0,00 €"}</span>
      </div>

      {res.aplicaIrpf && res.tipoIrpf != null && (
        <div className="flex justify-between py-2 border-b border-border">
          <div className="flex flex-col">
            <span>Retención IRPF</span>
            <span className="text-[10px] text-muted-foreground">{pct(res.tipoIrpf)} — lo ingresa el cliente</span>
          </div>
          <span className="text-destructive">− {fmt(imp?.ret ?? 0)}</span>
        </div>
      )}

      <div className="flex justify-between pt-3 text-base font-bold">
        <span>TOTAL</span>
        <span className="text-emerald-400">{fmt(imp?.total ?? 0)}</span>
      </div>

      {res.texto && (
        <div className="mt-3 p-3 rounded-md bg-muted/40 border border-border text-[11px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground block mb-1">Marco legal</strong>
          {res.texto}
          {res.ref && <span className="block mt-1 text-emerald-400 text-[10px]">{res.ref}</span>}
        </div>
      )}

      {res.faltantes && res.faltantes.length > 0 && (
        <div className="mt-2 p-3 rounded-md bg-destructive/10 border border-destructive/25 text-[11px] text-destructive">
          <strong className="block mb-1">Faltan datos</strong>
          <ul className="list-disc pl-4">
            {res.faltantes.map(f => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}

      {res.avisos && res.avisos.length > 0 && (
        <div className="mt-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-400">
          <strong className="block mb-1">Avisos</strong>
          <ul className="list-disc pl-4">
            {res.avisos.map(f => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
