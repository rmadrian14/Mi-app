import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { resolveActiveWorkspaceId } from '@/hooks/use-workspace';
import { useSubscription } from '@/hooks/use-subscription';
import { PaywallView } from '@/components/paywall-view';
import { chargeProOverageIfNeeded } from '@/utils/payments.functions';
import { getStripeEnvironment } from '@/lib/stripe';
import { uploadInvoicePdfAndSend } from '@/lib/invoice-email.functions';
import { toast } from 'sonner';
import { FiscalFinalizeDialog, defaultFinalizeState, type FinalizeState } from '@/components/fiscal-finalize-dialog';
import type { Emisor } from '@/lib/fiscal-engine';
import { territorio as territorioFromProvincia } from '@/lib/fiscal-engine';

export const Route = createFileRoute('/_authenticated/projects')({
  component: ProjectsPage,
});

type IvaOption = '21' | '10' | '4' | 'exento';
type TipoFactura = 'F1' | 'F2' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
type Project = {
  id: string;
  titulo: string;
  descripcion: string;
  precio: number;
  iva: IvaOption;
  estado: 'abierto' | 'cerrado';
  // Datos fiscales opcionales
  nifReceptor?: string;
  nombreReceptor?: string;
  direccionFiscal?: string;
  numeroFactura?: string;
  fechaOperacion?: string;
  tipoFactura?: TipoFactura;
  regimenIva?: string;
  irpf?: number;
  // Para borrado en cascada en Contabilidad
  invoiceId?: string;
  invoiceStatus?: 'pending' | 'sent_to_aeat' | 'error';
  hashVerifactu?: string;
  fechaEmision?: string;
  isRectifyingOf?: string;
  clientId?: string;
  // Paso 2 — snapshot del motor fiscal
  finalizado?: boolean;
  finalizeState?: FinalizeState;
};

const IVA_LABEL: Record<IvaOption, string> = {
  '21': '21%', '10': '10%', '4': '4%', exento: 'Exento',
};

const REGIMENES = [
  { v: '01', l: '01 — Régimen general' },
  { v: '02', l: '02 — Exportación' },
  { v: '03', l: '03 — Bienes usados / arte' },
  { v: '04', l: '04 — Oro de inversión' },
  { v: '05', l: '05 — Agencias de viajes' },
  { v: '06', l: '06 — Grupo de entidades' },
  { v: '07', l: '07 — Criterio de caja' },
];

const emptyForm = {
  titulo: '', descripcion: '', precio: '', iva: '' as IvaOption | '',
  nombreReceptor: '', nifReceptor: '',
};

type NuevoClienteExtra = {
  tipo: 'particular' | 'empresa' | 'autonomo';
  nifIva: string;
  pais: string;
  provincia: string;
  direccion: string;
  cp: string;
  ciudad: string;
  email: string;
};

const emptyNuevoCliente: NuevoClienteExtra = {
  tipo: 'empresa',
  nifIva: '',
  pais: 'ES',
  provincia: '',
  direccion: '',
  cp: '',
  ciudad: '',
  email: '',
};

type ClienteGuardado = {
  id: string;
  name: string;
  nif: string;
  tipo: 'particular' | 'empresa' | 'autonomo';
  nif_iva: string | null;
  country: string | null;
  province: string | null;
  address: string | null;
};

function ivaRate(iva: IvaOption): number {
  return iva === 'exento' ? 0 : Number(iva);
}

function formatearFechaDDMMYYYY(fechaISO: string): string {
  const d = new Date(fechaISO);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function fiscalComplete(p: Project): boolean {
  return !!(p.nifReceptor && p.nombreReceptor && p.direccionFiscal &&
    p.fechaOperacion && p.tipoFactura && p.regimenIva);
}

function ProjectsPage() {
  const { user } = useAuth();
  const { status: subStatus, tier, monthlyCount, planLimit, atVerifactuLimit, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [saveClient, setSaveClient] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState<NuevoClienteExtra>(emptyNuevoCliente);
  const [clientsList, setClientsList] = useState<ClienteGuardado[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [closeId, setCloseId] = useState<string | null>(null);
  const [previewProject, setPreviewProject] = useState<Project | null>(null);
  const [missingFiscalWarn, setMissingFiscalWarn] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [aeatErrorId, setAeatErrorId] = useState<string | null>(null);
  const [emailSendingId, setEmailSendingId] = useState<string | null>(null);
  const [emisorNif, setEmisorNif] = useState<string>('');
  const [emisor, setEmisor] = useState<Emisor | null>(null);
  const [finalizeFor, setFinalizeFor] = useState<Project | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState<null | { fromTier: 'basic' | 'medium'; suggestedPriceId: string; suggestedLabel: string }>(null);
  const [rectifyFor, setRectifyFor] = useState<Project | null>(null);
  const [rectifyAmount, setRectifyAmount] = useState<string>('');
  const [rectifying, setRectifying] = useState(false);
  const [rectifyMotivo, setRectifyMotivo] = useState<'R1' | 'R2' | 'R3' | 'R4' | 'R5'>('R4');
  const a4Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (supabase.from('company_settings') as any).select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }: { data: any }) => {
        if (!data) return;
        if (data.nif) setEmisorNif(data.nif);
        setEmisor({
          tipoActividad: (data.tipo_actividad ?? 'profesional') as 'profesional' | 'empresarial',
          categoriaIRPF: (data.categoria_irpf ?? 'profesional') as any,
          territorioEmisor: territorioFromProvincia(data.province ?? null),
          fechaAlta: data.fecha_alta ?? null,
          renunciarReducido: !!data.renunciar_reducido,
          acogidoOSS: !!data.acogido_oss,
          ventasUEAcumuladas: Number(data.ventas_ue_acumuladas ?? 0),
        });
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const workspace_id = await resolveActiveWorkspaceId(user.id);
      const { data } = await supabase.from('clients').select('*')
        .eq('workspace_id', workspace_id).order('name');
      setClientsList((data as any) ?? []);
    })();
  }, [user]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSaveClient(false);
    setNuevoCliente(emptyNuevoCliente);
    setSelectedClientId(null);
    setFormOpen(true);
  };
  const openEdit = (p: Project) => {
    setEditingId(p.id);
    setForm({
      titulo: p.titulo, descripcion: p.descripcion, precio: String(p.precio), iva: p.iva,
      nombreReceptor: p.nombreReceptor ?? '', nifReceptor: p.nifReceptor ?? '',
    });
    setSaveClient(false);
    setNuevoCliente(emptyNuevoCliente);
    setSelectedClientId(null);
    setFormOpen(true);
  };

  const canSave = !!(
    form.titulo.trim() && form.descripcion.trim() &&
    form.precio !== '' && !isNaN(Number(form.precio)) &&
    form.iva !== '' && form.nombreReceptor.trim() && form.nifReceptor.trim()
  );

  const handleSave = async () => {
    if (!canSave) return;
    const baseFields = {
      nombreReceptor: form.nombreReceptor.trim(),
      nifReceptor: form.nifReceptor.trim().toUpperCase(),
    };
    if (editingId) {
      setProjects(prev => prev.map(p => p.id === editingId
        ? { ...p, titulo: form.titulo, descripcion: form.descripcion, precio: Number(form.precio), iva: form.iva as IvaOption, ...baseFields, clientId: selectedClientId ?? p.clientId }
        : p));
    } else {
      setProjects(prev => [...prev, {
        id: crypto.randomUUID(),
        titulo: form.titulo, descripcion: form.descripcion,
        precio: Number(form.precio), iva: form.iva as IvaOption, estado: 'abierto',
        ...baseFields,
        clientId: selectedClientId ?? undefined,
      }]);
    }

    if (saveClient && user) {
      try {
        const workspace_id = await resolveActiveWorkspaceId(user.id);
        const { error } = await supabase.from('clients').insert({
          workspace_id,
          user_id: user.id,
          name: baseFields.nombreReceptor,
          nif: baseFields.nifReceptor,
          tipo: nuevoCliente.tipo,
          nif_iva: nuevoCliente.nifIva.trim() || null,
          country: (nuevoCliente.pais || 'ES').toUpperCase(),
          province: nuevoCliente.provincia.trim() || null,
          address: nuevoCliente.direccion.trim() || null,
          postal_code: nuevoCliente.cp.trim() || null,
          city: nuevoCliente.ciudad.trim() || null,
          email: nuevoCliente.email.trim() || null,
        } as any);
        if (error) {
          toast.error('No se pudo guardar el cliente: ' + error.message);
        } else {
          toast.success('Cliente guardado en tu lista.');
        }
      } catch (e: any) {
        toast.error('No se pudo guardar el cliente: ' + (e?.message ?? 'error desconocido'));
      }
    }

    setFormOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const proj = projects.find(p => p.id === deleteId);
    if (proj?.invoiceId) {
      const { error } = await supabase.from('invoices').delete().eq('id', proj.invoiceId);
      if (error) toast.error('No se pudo borrar la factura en Contabilidad: ' + error.message);
      else toast.success('Proyecto y factura asociada eliminados.');
    }
    setProjects(prev => prev.filter(p => p.id !== deleteId));
    setDeleteId(null);
  };

  const openFinalize = (p: Project) => {
    setFinalizeFor(p);
  };

  const initialFinalizeState = React.useMemo<FinalizeState | null>(() => {
    if (!finalizeFor) return null;
    if (finalizeFor.finalizeState) return finalizeFor.finalizeState;
    const ivaRateDec = finalizeFor.iva === 'exento' ? 0 : Number(finalizeFor.iva) / 100;
    const clienteGuardado = finalizeFor.clientId
      ? clientsList.find(c => c.id === finalizeFor.clientId)
      : undefined;
    return defaultFinalizeState({
      nombre: finalizeFor.nombreReceptor,
      nif: finalizeFor.nifReceptor,
      direccion: finalizeFor.direccionFiscal ?? clienteGuardado?.address ?? undefined,
      precio: finalizeFor.precio,
      iva: ivaRateDec,
      tipo: clienteGuardado?.tipo as any,
      pais: clienteGuardado?.country ?? undefined,
      provincia: clienteGuardado?.province ?? undefined,
      nifIva: clienteGuardado?.nif_iva ?? undefined,
    });
  }, [finalizeFor, clientsList]);

  const handleFinalizeSave = async (state: FinalizeState) => {
    if (!finalizeFor || !user || !state.resultado || !state.importes) return;
    const p = finalizeFor;
    const rate = (state.resultado.tipoIva ?? 0) * 100;
    const irpfPct = (state.resultado.tipoIrpf ?? 0) * 100;

    const nowIso = new Date().toISOString();
    // La factura NO se inserta aquí: el número y la huella se asignan de forma
    // atómica en el servidor al pulsar "Enviar a la AEAT".
    setProjects(prev => prev.map(x => x.id === p.id ? {
      ...x,
      estado: 'cerrado',
      finalizado: true,
      finalizeState: state,
      invoiceStatus: 'pending',
      fechaEmision: nowIso,
      nifReceptor: state.cliente.nif,
      nombreReceptor: state.cliente.nombre,
      direccionFiscal: state.cliente.direccion,
      fechaOperacion: state.factura.fecha,
      tipoFactura: 'F1',
      regimenIva: '01',
      irpf: irpfPct,
    } : x));
    toast.success('Propuesta preparada. Ya puedes enviarla a la AEAT.');
    setFinalizeFor(null);
  };

  const confirmClose = async () => {
    if (!closeId) return;
    const proj = projects.find(p => p.id === closeId);
    if (!proj) { setCloseId(null); return; }

    if (!fiscalComplete(proj)) {
      setCloseId(null);
      setMissingFiscalWarn(true);
      return;
    }
    if (!user) {
      toast.error('Debes estar autenticado para traspasar a Contabilidad.');
      setCloseId(null);
      return;
    }

    const rate = ivaRate(proj.iva);
    const base = proj.precio;
    const irpf = proj.irpf ?? 0;
    const total = +(base * (1 + rate / 100) - base * (irpf / 100)).toFixed(2);

    const workspace_id = await resolveActiveWorkspaceId(user.id);
    const { data, error } = await supabase.from('invoices').insert({
      usuario_id: user.id,
      workspace_id,
      numero_factura: proj.numeroFactura ?? '',
      fecha_emision: new Date().toISOString(),
      fecha_operacion: proj.fechaOperacion!,
      tipo_factura: proj.tipoFactura!,
      regimen_iva: proj.regimenIva!,
      nif_receptor: proj.nifReceptor!.slice(0, 9),
      nombre_receptor: proj.nombreReceptor!,
      base_imponible: base,
      iva_porcentaje: rate,
      irpf_porcentaje: irpf,
      total_factura: total,
      status: 'pending',
    }).select('id').single();

    if (error) {
      toast.error('Error al traspasar: ' + error.message);
      setCloseId(null);
      return;
    }

    setProjects(prev => prev.map(p => p.id === closeId
      ? { ...p, estado: 'cerrado', invoiceId: data!.id, invoiceStatus: 'pending', fechaEmision: new Date().toISOString() }
      : p));
    toast.success('Proyecto cerrado y enviado a Contabilidad.');
    setCloseId(null);
  };

  const aeatReady = (p: Project) =>
    !!(p.nifReceptor && p.direccionFiscal && (p.finalizeState || p.numeroFactura));

  const sendToAeat = async (p: Project) => {
    if (!aeatReady(p)) {
      setAeatErrorId(p.id);
      return;
    }
    // Bloqueo por plan: básico (50) → modal upgrade a Intermedio, intermedio (250) → modal upgrade a Pro.
    if (tier === 'basic' && monthlyCount >= 50) {
      setUpgradeOpen({ fromTier: 'basic', suggestedPriceId: 'intermedio_monthly', suggestedLabel: 'Plan Intermedio (11,99 €/mes · 250 facturas)' });
      return;
    }
    if (tier === 'medium' && monthlyCount >= 250) {
      setUpgradeOpen({ fromTier: 'medium', suggestedPriceId: 'pro_monthly', suggestedLabel: 'Plan Pro (19,99 €/mes · 2.500 facturas)' });
      return;
    }
    if (atVerifactuLimit) {
      toast.error('Has alcanzado el límite mensual de tu plan. Gestiona tu suscripción.');
      return;
    }
    setSendingId(p.id);

    // Plan Pro: cargar bloque fijo de 2€ si esta factura inicia un nuevo bloque de 500 sobre 2500.
    if (tier === 'pro') {
      try {
        const env = getStripeEnvironment();
        const result = await chargeProOverageIfNeeded({
          data: { invoiceNumberInPeriod: monthlyCount + 1, environment: env },
        });
        if (result.charged) {
          toast.info(`Cargo de 2,00 € aplicado por el bloque de exceso #${result.blockIndex}.`);
        }
      } catch (e) {
        console.warn('Overage charge skipped:', e);
      }
    }

    const workspace_id = await resolveActiveWorkspaceId(user!.id);
    const state = p.finalizeState;
    const rateSend = state?.resultado?.tipoIva != null ? state.resultado.tipoIva * 100 : ivaRate(p.iva);
    const irpfSend = state?.resultado?.tipoIrpf != null ? state.resultado.tipoIrpf * 100 : (p.irpf ?? 0);
    const baseSend = state?.importes?.base ?? p.precio;
    const totalSend = state?.importes?.total
      ?? +(p.precio * (1 + rateSend / 100) - p.precio * (irpfSend / 100)).toFixed(2);

    const { data: inv, error } = await (supabase.rpc as any)('emitir_factura', {
      _workspace_id: workspace_id,
      _tipo_factura: p.tipoFactura ?? 'F1',
      _regimen_iva: p.regimenIva ?? '01',
      _nif_receptor: (state?.cliente.nif ?? p.nifReceptor ?? '').slice(0, 9),
      _nombre_receptor: state?.cliente.nombre ?? p.nombreReceptor ?? '',
      _base_imponible: baseSend,
      _iva_porcentaje: rateSend,
      _irpf_porcentaje: irpfSend,
      _total_factura: totalSend,
      _fecha_operacion: state?.factura.fecha ?? p.fechaOperacion ?? new Date().toISOString(),
    });

    setSendingId(null);
    if (error || !inv) {
      toast.error('No se pudo emitir la factura: ' + (error?.message ?? 'error desconocido'));
      return;
    }
    setProjects(prev => prev.map(x => x.id === p.id
      ? {
          ...x,
          invoiceId: inv.id,
          invoiceStatus: 'sent_to_aeat',
          numeroFactura: inv.numero_factura,
          hashVerifactu: inv.hash_verifactu ?? undefined,
          fechaEmision: inv.fecha_emision,
        }
      : x));
    toast.success(`Factura ${inv.numero_factura} emitida con huella VeriFactu encadenada.`);
  };

  const openRectify = (p: Project) => {
    const rate = ivaRate(p.iva);
    const irpf = p.irpf ?? 0;
    const originalTotal = +(p.precio * (1 + rate / 100) - p.precio * (irpf / 100)).toFixed(2);
    setRectifyAmount((-originalTotal).toFixed(2));
    setRectifyMotivo('R4');
    setRectifyFor(p);
  };

  const confirmRectify = async () => {
    if (!rectifyFor || !user) return;
    const newTotal = Number(rectifyAmount);
    if (isNaN(newTotal)) { toast.error('Importe inválido'); return; }
    const rate = ivaRate(rectifyFor.iva);
    const irpf = rectifyFor.irpf ?? 0;
    // Reverse-derive base imponible so that base*(1+iva/100)-base*(irpf/100) === newTotal
    const factor = 1 + rate / 100 - irpf / 100;
    const newBase = factor !== 0 ? +(newTotal / factor).toFixed(2) : newTotal;
    setRectifying(true);
    try {
      const workspace_id = await resolveActiveWorkspaceId(user.id);
      const { data: inv, error } = await (supabase.rpc as any)('emitir_factura', {
        _workspace_id: workspace_id,
        _tipo_factura: rectifyMotivo,
        _regimen_iva: rectifyFor.regimenIva ?? '01',
        _nif_receptor: (rectifyFor.nifReceptor ?? '').slice(0, 9),
        _nombre_receptor: rectifyFor.nombreReceptor ?? '',
        _base_imponible: newBase,
        _iva_porcentaje: rate,
        _irpf_porcentaje: irpf,
        _total_factura: newTotal,
        _fecha_operacion: new Date().toISOString(),
        _is_rectifying_of: rectifyFor.invoiceId,
      });

      if (error || !inv) {
        toast.error('No se pudo crear la rectificativa: ' + (error?.message ?? 'error desconocido'));
        setRectifying(false);
        return;
      }
      const numero = inv.numero_factura as string;

      // Add a sibling project so the existing "Enviar a la AEAT" flow works.
      setProjects(prev => [...prev, {
        id: crypto.randomUUID(),
        titulo: `Rectificativa de ${rectifyFor.titulo}`,
        descripcion: `Factura rectificativa (serie R) de la factura ${rectifyFor.numeroFactura}.`,
        precio: newBase,
        iva: rectifyFor.iva,
        estado: 'cerrado',
        nifReceptor: rectifyFor.nifReceptor,
        nombreReceptor: rectifyFor.nombreReceptor,
        direccionFiscal: rectifyFor.direccionFiscal,
        numeroFactura: numero,
        fechaOperacion: new Date().toISOString().slice(0, 10),
        tipoFactura: rectifyMotivo,
        regimenIva: rectifyFor.regimenIva,
        irpf,
        invoiceId: inv.id,
        invoiceStatus: 'sent_to_aeat',
        hashVerifactu: inv.hash_verifactu ?? undefined,
        fechaEmision: inv.fecha_emision,
        isRectifyingOf: rectifyFor.invoiceId,
      }]);
      toast.success(`Rectificativa ${numero} emitida con huella VeriFactu encadenada.`);
      setRectifyFor(null);
    } finally {
      setRectifying(false);
    }
  };

  const sendByEmail = async (p: Project) => {
    const recipient = window.prompt(
      'Email del cliente para enviar la factura:',
      '',
    );
    if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) {
      if (recipient !== null) toast.error('Email no válido');
      return;
    }
    setEmailSendingId(p.id);
    try {
      // Render A4 invoice so we can capture it.
      setPreviewProject(p);
      await new Promise((r) => setTimeout(r, 350));
      if (!a4Ref.current) throw new Error('No se pudo renderizar la factura');

      const html2pdf = (await import('html2pdf.js')).default;
      const pdfBlob: Blob = await html2pdf()
        .set({
          margin: 0,
          filename: `factura-${p.numeroFactura || p.titulo}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(a4Ref.current)
        .outputPdf('blob');

      const buf = await pdfBlob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + chunk)),
        );
      }
      const pdfBase64 = btoa(binary);

      const rate = ivaRate(p.iva);
      const total = +(p.precio + p.precio * rate / 100 - p.precio * (p.irpf ?? 0) / 100).toFixed(2);

      const res = await uploadInvoicePdfAndSend({
        data: {
          projectId: p.id,
          filename: `factura-${p.numeroFactura || p.titulo}.pdf`,
          pdfBase64,
          recipientEmail: recipient,
          customerName: p.nombreReceptor,
          invoiceNumber: p.numeroFactura,
          totalAmount: total,
        },
      });

      setPreviewProject(null);
      toast.success(
        `Envío simulado a ${res.to} (from ${res.from}). Enlace firmado válido 7 días generado.`,
        { duration: 8000, description: res.signedUrl },
      );
    } catch (e: any) {
      toast.error('Error al preparar el envío: ' + (e?.message ?? e));
    } finally {
      setEmailSendingId(null);
    }
  };

  const downloadPdfForProject = async (p: Project) => {
    setPreviewProject(p);
    // wait for render
    await new Promise(r => setTimeout(r, 250));
    await downloadPdf();
  };

  const downloadPdf = async () => {
    if (!a4Ref.current) return;
    const html2pdf = (await import('html2pdf.js')).default;
    await html2pdf().set({
      margin: 0,
      filename: `propuesta-${previewProject?.numeroFactura || previewProject?.titulo || 'factura'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(a4Ref.current).save();
  };

  if (!subLoading && subStatus === 'inactive') {
    return <PaywallView feature="Gestión de Proyectos" />;
  }

  return (
    <div className="p-8 text-slate-200 space-y-6">
      {tier !== 'none' && planLimit > 0 && tier !== 'pro' && monthlyCount >= planLimit * 0.9 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          Has emitido {monthlyCount}/{planLimit} facturas este mes. Cerca del límite de tu plan.
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gestión de Proyectos</h1>
        <Button onClick={openCreate}>Crear Nuevo Proyecto</Button>
      </div>

      {projects.length === 0 ? (
        <p className="text-slate-400">Aún no has creado ningún proyecto.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(p => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{p.titulo}</CardTitle>
                  <Badge variant={p.estado === 'cerrado' ? 'secondary' : 'default'}>
                    {p.estado === 'cerrado' ? 'Cerrado' : 'Abierto'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{p.descripcion}</p>
                <div className="flex justify-between text-sm">
                  <span>Precio: <strong>{p.precio.toFixed(2)} €</strong></span>
                  <span>IVA: <strong>{IVA_LABEL[p.iva]}</strong></span>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {p.invoiceStatus === 'sent_to_aeat' ? (
                    <Button size="sm" variant="secondary" onClick={() => setPreviewProject(p)}>Propuesta de Factura</Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline"
                        onClick={() => openEdit(p)}>Editar</Button>
                      <Button size="sm" variant="secondary" onClick={() => setPreviewProject(p)}>Propuesta de Factura</Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleteId(p.id)}>Borrar</Button>
                      <Button size="sm"
                        variant={p.finalizado ? 'outline' : 'default'}
                        onClick={() => openFinalize(p)}>
                        {p.finalizado ? 'Editar preparación AEAT' : 'Preparar para AEAT'}
                      </Button>
                    </>
                  )}
                </div>
                {p.estado === 'cerrado' && p.invoiceId && (
                  <div className="pt-2">
                    {p.invoiceStatus === 'sent_to_aeat' ? (
                      <div className="space-y-2">
                        <span className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">
                          Huella VeriFactu generada (SHA-256 encadenado) · Pendiente de validar contra el entorno de pruebas de la AEAT antes de usar en producción
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => downloadPdfForProject(p)}>
                            Descargar PDF
                          </Button>
                          <Button size="sm" variant="secondary"
                            disabled={emailSendingId === p.id}
                            onClick={() => sendByEmail(p)}>
                            {emailSendingId === p.id ? 'Enviando PDF al cliente...' : 'Enviar por Email'}
                          </Button>
                          {!p.isRectifyingOf && !p.tipoFactura?.startsWith('R') && (
                            <Button size="sm" variant="outline"
                              className="border-amber-500/60 text-amber-200 hover:bg-amber-500/10"
                              onClick={() => openRectify(p)}>
                              Emitir Factura Rectificativa
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={!aeatReady(p) || sendingId === p.id}
                          onClick={() => sendToAeat(p)}
                        >
                          {sendingId === p.id
                            ? 'Firmando digitalmente y comunicando con la AEAT...'
                            : 'Enviar a la AEAT'}
                        </Button>
                        {!aeatReady(p) && (
                          <p className="mt-2 text-xs text-destructive">
                            Faltan datos fiscales obligatorios. Edita el proyecto para añadirlos antes de enviar a la AEAT
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar proyecto' : 'Nuevo proyecto'}</DialogTitle>
            <DialogDescription>
              Los datos fiscales son opcionales. Podrás guardar la propuesta solo con título y precio,
              pero serán obligatorios para traspasarla a Contabilidad.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título del proyecto</Label>
              <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Precio (€)</Label>
                <Input type="number" step="0.01" value={form.precio}
                  onChange={e => setForm({ ...form, precio: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>IVA aplicable</Label>
                <Select value={form.iva} onValueChange={(v) => setForm({ ...form, iva: v as IvaOption })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona IVA" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="21">21%</SelectItem>
                    <SelectItem value="10">10%</SelectItem>
                    <SelectItem value="4">4%</SelectItem>
                    <SelectItem value="exento">Exento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-2 border-t border-border space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Cliente (mínimo)</h3>
              {clientsList.length > 0 && (
                <div className="space-y-2">
                  <Label>Cliente existente (opcional)</Label>
                  <Select
                    value={selectedClientId ?? '__nuevo__'}
                    onValueChange={(v) => {
                      if (v === '__nuevo__') {
                        setSelectedClientId(null);
                        return;
                      }
                      const c = clientsList.find(x => x.id === v);
                      if (!c) return;
                      setSelectedClientId(v);
                      setForm(f => ({ ...f, nombreReceptor: c.name, nifReceptor: c.nif }));
                      setSaveClient(false);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__nuevo__">— Cliente nuevo (escribir a mano) —</SelectItem>
                      {clientsList.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.nif})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nombre / Razón social *</Label>
                  <Input value={form.nombreReceptor}
                    onChange={e => setForm({ ...form, nombreReceptor: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>NIF / CIF *</Label>
                  <Input maxLength={12} value={form.nifReceptor}
                    onChange={e => setForm({ ...form, nifReceptor: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                El resto de datos fiscales (país, provincia, IRPF, IGIC/IPSI, OSS, líneas detalladas…)
                se rellenan en el paso "Preparar para AEAT" antes de emitir.
              </p>

              {!editingId && !selectedClientId && (
                <div className="pt-3 border-t border-border/60 space-y-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={saveClient}
                      onChange={e => setSaveClient(e.target.checked)}
                    />
                    <span className="font-medium">+ Guardar este cliente en mi lista de clientes</span>
                  </label>

                  {saveClient && (
                    <div className="grid grid-cols-2 gap-3 rounded-md border border-border/60 bg-muted/30 p-3">
                      <div className="space-y-2">
                        <Label>Tipo de cliente</Label>
                        <Select
                          value={nuevoCliente.tipo}
                          onValueChange={(v) => setNuevoCliente({ ...nuevoCliente, tipo: v as NuevoClienteExtra['tipo'] })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="particular">Particular</SelectItem>
                            <SelectItem value="empresa">Empresa</SelectItem>
                            <SelectItem value="autonomo">Autónomo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>NIF-IVA intracomunitario</Label>
                        <Input
                          placeholder="Ej: FR40303265045"
                          value={nuevoCliente.nifIva}
                          onChange={e => setNuevoCliente({ ...nuevoCliente, nifIva: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>País (ISO 2 letras)</Label>
                        <Input
                          maxLength={2}
                          value={nuevoCliente.pais}
                          onChange={e => setNuevoCliente({ ...nuevoCliente, pais: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Provincia</Label>
                        <Input
                          placeholder="Ej: Las Palmas, Tenerife, Ceuta, Melilla…"
                          value={nuevoCliente.provincia}
                          onChange={e => setNuevoCliente({ ...nuevoCliente, provincia: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Dirección</Label>
                        <Input
                          value={nuevoCliente.direccion}
                          onChange={e => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Código postal</Label>
                        <Input
                          value={nuevoCliente.cp}
                          onChange={e => setNuevoCliente({ ...nuevoCliente, cp: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ciudad</Label>
                        <Input
                          value={nuevoCliente.ciudad}
                          onChange={e => setNuevoCliente({ ...nuevoCliente, ciudad: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={nuevoCliente.email}
                          onChange={e => setNuevoCliente({ ...nuevoCliente, email: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button disabled={!canSave} onClick={handleSave}>
              {editingId ? 'Confirmar cambios' : 'Guardar proyecto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de que quieres eliminar este proyecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si el proyecto fue traspasado a Contabilidad,
              su factura también se eliminará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={closeId !== null} onOpenChange={(o) => !o && setCloseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deseas cerrar el proyecto y enviar estos datos fiscales a Contabilidad?</AlertDialogTitle>
            <AlertDialogDescription>El proyecto quedará marcado como cerrado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose}>Confirmar traspaso</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={missingFiscalWarn} onOpenChange={setMissingFiscalWarn}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Faltan datos fiscales</AlertDialogTitle>
            <AlertDialogDescription>
              Para traspasar este proyecto a Contabilidad y poder enviarlo a la AEAT,
              primero debes rellenar los datos fiscales editando el proyecto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setMissingFiscalWarn(false)}>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={aeatErrorId !== null} onOpenChange={(o) => !o && setAeatErrorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Faltan datos fiscales obligatorios</AlertDialogTitle>
            <AlertDialogDescription>
              Faltan datos fiscales obligatorios. Edita el proyecto para añadirlos antes de enviar a la AEAT.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAeatErrorId(null)}>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={upgradeOpen !== null} onOpenChange={(o) => !o && setUpgradeOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Has alcanzado el límite de tu plan</AlertDialogTitle>
            <AlertDialogDescription>
              {upgradeOpen?.fromTier === 'basic'
                ? 'Tu Plan Básico permite hasta 50 facturas/mes. '
                : 'Tu Plan Intermedio permite hasta 250 facturas/mes. '}
              Sube al {upgradeOpen?.suggestedLabel} para seguir enviando facturas a la AEAT.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Más tarde</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setUpgradeOpen(null); navigate({ to: '/pricing' }); }}>
              Mejorar plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewProject !== null} onOpenChange={(o) => !o && setPreviewProject(null)}>
        <DialogContent className="max-w-[230mm] max-h-[95vh] overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle>Propuesta de Factura</DialogTitle>
          </DialogHeader>
          {previewProject && <A4Invoice ref={a4Ref} project={previewProject} emisorNif={emisorNif} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewProject(null)}>Cerrar</Button>
            <Button onClick={downloadPdf}>Descargar Propuesta PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {initialFinalizeState && (
        <FiscalFinalizeDialog
          open={finalizeFor !== null}
          onOpenChange={(o) => !o && setFinalizeFor(null)}
          emisor={emisor ?? {
            tipoActividad: 'profesional',
            categoriaIRPF: 'profesional',
            territorioEmisor: 'peninsula_baleares',
            fechaAlta: null,
            renunciarReducido: false,
            acogidoOSS: false,
            ventasUEAcumuladas: 0,
          }}
          initial={initialFinalizeState}
          onSave={handleFinalizeSave}
        />
      )}

      <Dialog open={rectifyFor !== null} onOpenChange={(o) => !o && !rectifying && setRectifyFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Emitir Factura Rectificativa</DialogTitle>
            <DialogDescription>
              Esta acción generará una factura rectificativa con serie especial (R) para anular o corregir
              la factura original de acuerdo con la normativa de la AEAT. ¿Deseas continuar?
            </DialogDescription>
          </DialogHeader>
          {rectifyFor && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1">
                <div><span className="text-muted-foreground">Factura original:</span> <strong>{rectifyFor.numeroFactura}</strong></div>
                <div><span className="text-muted-foreground">Cliente:</span> {rectifyFor.nombreReceptor}</div>
              </div>
              <div className="space-y-2">
                <Label>Motivo de la rectificación</Label>
                <Select value={rectifyMotivo} onValueChange={(v) => setRectifyMotivo(v as typeof rectifyMotivo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R1">R1 — Error de derecho / corrección de errores</SelectItem>
                    <SelectItem value="R2">R2 — Concurso de acreedores del cliente</SelectItem>
                    <SelectItem value="R3">R3 — Crédito total o parcialmente incobrable</SelectItem>
                    <SelectItem value="R4">R4 — Descuentos, devoluciones u otras causas</SelectItem>
                    <SelectItem value="R5">R5 — Rectificación de factura simplificada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Importe total de la rectificativa (€)</Label>
                <Input type="number" step="0.01" value={rectifyAmount}
                  onChange={e => setRectifyAmount(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Por defecto se invierte el signo del total original para anular el impacto contable.
                  Puedes editarlo si se trata de una corrección parcial.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={rectifying} onClick={() => setRectifyFor(null)}>Cancelar</Button>
            <Button disabled={rectifying} onClick={confirmRectify}>
              {rectifying ? 'Creando rectificativa...' : 'Confirmar y crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const A4Invoice = React.forwardRef<HTMLDivElement, { project: Project; emisorNif?: string }>(({ project, emisorNif }, ref) => {
  const rate = ivaRate(project.iva);
  const base = project.precio;
  const irpf = project.irpf ?? 0;
  const ivaImporte = +(base * rate / 100).toFixed(2);
  const irpfImporte = +(base * irpf / 100).toFixed(2);
  const total = +(base + ivaImporte - irpfImporte).toFixed(2);
  const blank = (v?: string) => v && v.trim() ? v : '—';
  const isSent = project.invoiceStatus === 'sent_to_aeat' && !!project.hashVerifactu;
  const [qrUrl, setQrUrl] = React.useState<string>('');
  React.useEffect(() => {
    if (!isSent) { setQrUrl(''); return; }
    const fechaExp = (project.fechaEmision || new Date().toISOString()).slice(0, 10);
    const params = new URLSearchParams({
      nif: emisorNif || '',
      numserie: project.numeroFactura || '',
      fecha: fechaExp,
      importe: total.toFixed(2),
      hash: project.hashVerifactu || '',
    });
    const url = `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?${params.toString()}`;
    QRCode.toDataURL(url, { margin: 0, width: 256 }).then(setQrUrl).catch(() => setQrUrl(''));
  }, [isSent, emisorNif, project.numeroFactura, project.fechaEmision, project.hashVerifactu, total]);

  return (
    <div
      ref={ref}
      style={{
        width: '210mm', minHeight: '297mm', padding: '15mm',
        background: '#ffffff', color: '#0f172a', fontFamily: 'Arial, sans-serif',
        fontSize: '11pt', boxSizing: 'border-box', position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '8mm' }}>
        <div>
          <h1 style={{ fontSize: '20pt', margin: 0, fontWeight: 700 }}>FACTURA</h1>
          <p style={{ margin: '2mm 0 0', color: '#64748b' }}>Propuesta</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><strong>Nº:</strong> {blank(project.numeroFactura)}</div>
          <div><strong>Tipo:</strong> {blank(project.tipoFactura)}</div>
          <div><strong>Fecha op.:</strong> {blank(project.fechaOperacion)}</div>
          <div><strong>Régimen IVA:</strong> {blank(project.regimenIva)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm', marginTop: '10mm' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '10pt', color: '#64748b', textTransform: 'uppercase' }}>Cliente</h3>
          <p style={{ margin: '2mm 0' }}><strong>{blank(project.nombreReceptor)}</strong></p>
          <p style={{ margin: '1mm 0' }}>NIF: {blank(project.nifReceptor)}</p>
          <p style={{ margin: '1mm 0' }}>{blank(project.direccionFiscal)}</p>
        </div>
      </div>

      <div style={{ marginTop: '12mm' }}>
        <h3 style={{ fontSize: '10pt', color: '#64748b', textTransform: 'uppercase' }}>Concepto</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '3mm' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ textAlign: 'left', padding: '3mm', border: '1px solid #cbd5e1' }}>Descripción</th>
              <th style={{ textAlign: 'right', padding: '3mm', border: '1px solid #cbd5e1', width: '35mm' }}>Importe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '3mm', border: '1px solid #cbd5e1' }}>
                <div><strong>{project.titulo}</strong></div>
                <div style={{ color: '#64748b', fontSize: '9pt' }}>{project.descripcion}</div>
              </td>
              <td style={{ padding: '3mm', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                {base.toFixed(2)} €
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '8mm', display: 'flex', justifyContent: 'flex-end' }}>
        <table style={{ minWidth: '80mm', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '2mm 4mm' }}>Base imponible</td>
              <td style={{ padding: '2mm 4mm', textAlign: 'right' }}>{base.toFixed(2)} €</td>
            </tr>
            <tr>
              <td style={{ padding: '2mm 4mm' }}>IVA ({rate}%)</td>
              <td style={{ padding: '2mm 4mm', textAlign: 'right' }}>{ivaImporte.toFixed(2)} €</td>
            </tr>
            {irpf > 0 && (
              <tr>
                <td style={{ padding: '2mm 4mm' }}>IRPF (-{irpf}%)</td>
                <td style={{ padding: '2mm 4mm', textAlign: 'right' }}>-{irpfImporte.toFixed(2)} €</td>
              </tr>
            )}
            <tr style={{ borderTop: '2px solid #0f172a', fontWeight: 700 }}>
              <td style={{ padding: '3mm 4mm' }}>TOTAL</td>
              <td style={{ padding: '3mm 4mm', textAlign: 'right' }}>{total.toFixed(2)} €</td>
            </tr>
          </tbody>
        </table>
      </div>

      {isSent ? (
        <div style={{
          position: 'absolute', left: '15mm', right: '15mm', bottom: '12mm',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid #cbd5e1', paddingTop: '5mm', gap: '8mm',
        }}>
          <div style={{ fontSize: '9pt', color: '#334155', maxWidth: '120mm' }}>
            <strong>Factura verificable en la sede electrónica de la AEAT</strong>
            <div style={{ marginTop: '2mm', color: '#64748b', fontSize: '8pt' }}>
              Sistema VeriFactu · Hash: {project.hashVerifactu?.slice(0, 16)}…
            </div>
          </div>
          {qrUrl
            ? <img src={qrUrl} alt="QR VeriFactu" style={{ width: '35mm', height: '35mm' }} />
            : <div style={{ width: '35mm', height: '35mm', border: '1px dashed #94a3b8' }} />}
        </div>
      ) : (
        <div style={{
          position: 'absolute', right: '15mm', bottom: '15mm',
          width: '35mm', height: '35mm', border: '1px dashed #94a3b8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#94a3b8', fontSize: '8pt', textAlign: 'center',
        }}>
          QR Verifactu<br />(35×35 mm)
        </div>
      )}
    </div>
  );
});
A4Invoice.displayName = 'A4Invoice';
