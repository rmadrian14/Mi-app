// Motor de reglas fiscales — port TS del HTML de referencia.
// Determina el tratamiento de IVA/IRPF/IGIC/IPSI/OSS según emisor, cliente y factura.

export const IVA_ES = 0.21;
export const IGIC = 0.07;
export const IPSI_TELECOM = 0.08;
export const UMBRAL_OSS = 10000;

export const IVA_OSS: Record<string, number> = {
  AT: 0.2, BE: 0.21, BG: 0.2, CY: 0.19, CZ: 0.21, DE: 0.19, DK: 0.25,
  EE: 0.24, EL: 0.24, GR: 0.24, ES: 0.21, FI: 0.255, FR: 0.2, HR: 0.25,
  HU: 0.27, IE: 0.23, IT: 0.22, LT: 0.21, LU: 0.17, LV: 0.21, MT: 0.18,
  NL: 0.21, PL: 0.23, PT: 0.23, RO: 0.21, SE: 0.25, SI: 0.22, SK: 0.23,
};

export const PAISES_UE = [
  'AT','BE','BG','CY','CZ','DE','DK','EE','EL','GR','ES','FI',
  'FR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
];

export type Naturaleza = 'servicio_digital' | 'servicio_profesional' | 'bien_fisico' | 'telecomunicaciones';
export type TipoCliente = 'particular' | 'empresa' | 'autonomo';
export type CategoriaIrpf = 'profesional' | 'agricola' | 'arrendamiento' | 'derechos_imagen' | 'mediador_seguros' | 'modulos_agro' | 'empresarial';
export type TerritorioEmisor = 'peninsula_baleares' | 'canarias' | 'ceuta' | 'melilla';

const PROD_RETIENE: Record<Naturaleza, boolean> = {
  servicio_profesional: true,
  bien_fisico: false,
  servicio_digital: false,
  telecomunicaciones: false,
};

const CFG_IRPF_CAT: Record<CategoriaIrpf, { ret: boolean; pct?: number; permiteReducido?: boolean }> = {
  profesional: { ret: true, pct: 0.15, permiteReducido: true },
  agricola: { ret: true, pct: 0.02, permiteReducido: false },
  arrendamiento: { ret: true, pct: 0.19, permiteReducido: false },
  derechos_imagen: { ret: true, pct: 0.24, permiteReducido: false },
  mediador_seguros: { ret: true, pct: 0.07, permiteReducido: false },
  modulos_agro: { ret: true, pct: 0.01, permiteReducido: false },
  empresarial: { ret: false },
};

export type Emisor = {
  tipoActividad: 'profesional' | 'empresarial';
  categoriaIRPF: CategoriaIrpf;
  territorioEmisor: TerritorioEmisor;
  fechaAlta: string | null;
  renunciarReducido: boolean;
  acogidoOSS: boolean;
  ventasUEAcumuladas: number;
};

export type Cliente = {
  tipo: TipoCliente;
  pais: string | null;
  provincia: string | null;
  nombre: string;
  nif: string;
  direccion: string;
  nifIva: string | null;
  nifIvaVies?: { valido: boolean } | null;
};

export type Linea = { concepto: string; c: number; p: number; d: number };

export type Factura = {
  fecha: string;
  naturaleza: Naturaleza;
  tipoIvaEsp: number;
  lineas: Linea[];
};

export function ueQ(p: string | null | undefined) {
  return !!p && PAISES_UE.includes(String(p).toUpperCase());
}

export function territorio(prov: string | null | undefined): TerritorioEmisor {
  if (!prov) return 'peninsula_baleares';
  const raw = String(prov).trim();
  const p = raw.toLowerCase();
  const cp = raw.replace(/\s/g, '');
  if (/^3[58]\d{0,3}/.test(cp) ||
      /las palmas|gran canaria|lanzarote|fuerteventura|canari[ae]/.test(p) ||
      /santa cruz de tenerife|tenerife|la palma|la gomera|el hierro/.test(p))
    return 'canarias';
  if (/^51\d{0,3}/.test(cp) || p === 'ceuta') return 'ceuta';
  if (/^52\d{0,3}/.test(cp) || p === 'melilla') return 'melilla';
  return 'peninsula_baleares';
}

function terr(prov: string | null | undefined): 'canarias' | 'ceuta' | 'melilla' | 'peninsula' {
  const t = territorio(prov);
  if (t === 'peninsula_baleares') return 'peninsula';
  return t;
}

function esNuevo(alta: string | null, fecha: string) {
  if (!alta) return false;
  const a = new Date(alta).getFullYear();
  const b = new Date(fecha || Date.now()).getFullYear();
  return !isNaN(a) && !isNaN(b) && b >= a && b - a <= 2;
}

export function sumar(ls: Linea[]) {
  return (ls || []).reduce((acc, l) => acc + ((l.c || 0) * (l.p || 0)) - (l.d || 0), 0);
}

export function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function irpf(e: Emisor | null, cl: Cliente, f: Factura) {
  if (cl.pais !== 'ES' || cl.tipo === 'particular') return { ok: false as const };
  if (!e || e.tipoActividad !== 'profesional') return { ok: false as const };
  const cat = e.categoriaIRPF || 'profesional';
  const cfg = CFG_IRPF_CAT[cat] || CFG_IRPF_CAT.profesional;
  if (!cfg.ret) return { ok: false as const };
  if (cat === 'profesional' && !PROD_RETIENE[f.naturaleza || 'servicio_digital']) return { ok: false as const };
  let p = cfg.pct!;
  if (cfg.permiteReducido && esNuevo(e.fechaAlta, f.fecha) && !e.renunciarReducido) p = 0.07;
  if (e.territorioEmisor === 'ceuta' || e.territorioEmisor === 'melilla') {
    p = Math.round((p * 0.4 + Number.EPSILON) * 10000) / 10000;
  }
  return { ok: true as const, pct: p };
}

type RuleResult = {
  esc: string;
  iva?: boolean;
  tipo?: number;
  pais?: string;
  usaIvaEsp?: boolean;
  isp?: boolean;
  oss?: boolean;
  igicInfo?: number;
  ipsiReq?: boolean;
  nifIvaVisible?: boolean;
  texto?: string;
  ref?: string | null;
};
type Rule = {
  id: string;
  c: (e: Emisor | null, cl: Cliente, f: Factura) => boolean;
  r: (e: Emisor | null, cl: Cliente, f: Factura) => RuleResult;
};

const REGLAS: Rule[] = [
  { id: 'CAN_BIEN', c: (_e, cl, f) => cl.pais === 'ES' && terr(cl.provincia) === 'canarias' && f.naturaleza === 'bien_fisico',
    r: () => ({ esc: 'CANARIAS_BIEN_FISICO', iva: false, texto: 'Entrega de bien a Canarias, territorio excluido del IVA peninsular. Exenta por art. 21 LIVA. El comprador canario liquidará el IGIC en aduana.', ref: 'Art. 21 LIVA' }) },
  { id: 'CAN_DIG_B2B', c: (_e, cl, f) => cl.pais === 'ES' && terr(cl.provincia) === 'canarias' && f.naturaleza === 'servicio_digital' && cl.tipo !== 'particular',
    r: () => ({ esc: 'CANARIAS_DIGITAL_B2B', iva: false, isp: true, texto: 'Servicio digital a empresa o autónomo en Canarias. No sujeto a IVA peninsular (art. 69.Uno LIVA). El destinatario autodeclara el IGIC.', ref: 'Art. 69.Uno LIVA' }) },
  { id: 'CAN_DIG_B2C', c: (_e, cl, f) => cl.pais === 'ES' && terr(cl.provincia) === 'canarias' && f.naturaleza === 'servicio_digital' && cl.tipo === 'particular',
    r: () => ({ esc: 'CANARIAS_DIGITAL_B2C', iva: false, igicInfo: IGIC, texto: 'Servicio digital a particular en Canarias. No sujeto a IVA peninsular (art. 70.Uno.8º LIVA). Tributa en Canarias por IGIC (tipo general 7%).', ref: 'Art. 70.Uno.8º LIVA – Ley 20/1991 IGIC' }) },
  { id: 'CAN_PROF_B2B', c: (_e, cl, f) => cl.pais === 'ES' && terr(cl.provincia) === 'canarias' && f.naturaleza === 'servicio_profesional' && cl.tipo !== 'particular',
    r: () => ({ esc: 'CANARIAS_PROF_B2B', iva: false, isp: true, texto: 'Servicio profesional a empresa o autónomo en Canarias. No sujeto a IVA peninsular por localización B2B (art. 69.Uno LIVA). El cliente autodeclara el IGIC.', ref: 'Art. 69.Uno LIVA' }) },
  { id: 'CAN_PROF_B2C', c: (_e, cl, f) => cl.pais === 'ES' && terr(cl.provincia) === 'canarias' && f.naturaleza === 'servicio_profesional' && cl.tipo === 'particular',
    r: () => ({ esc: 'CANARIAS_PROF_B2C', iva: true, tipo: IVA_ES, pais: 'ES', usaIvaEsp: true, texto: 'Servicio profesional a particular en Canarias. Regla general B2C (art. 69.Dos LIVA): tributa donde está el prestador. IVA español.', ref: 'Art. 69.Dos LIVA' }) },
  { id: 'CAN_TEL_B2B', c: (_e, cl, f) => cl.pais === 'ES' && terr(cl.provincia) === 'canarias' && f.naturaleza === 'telecomunicaciones' && cl.tipo !== 'particular',
    r: () => ({ esc: 'CANARIAS_TELECOM_B2B', iva: false, isp: true, texto: 'Telecomunicaciones a empresa/autónomo en Canarias. Localización B2B en destino (art. 69.Uno LIVA). El cliente autodeclara el IGIC.', ref: 'Art. 69.Uno LIVA' }) },
  { id: 'CAN_TEL_B2C', c: (_e, cl, f) => cl.pais === 'ES' && terr(cl.provincia) === 'canarias' && f.naturaleza === 'telecomunicaciones' && cl.tipo === 'particular',
    r: () => ({ esc: 'CANARIAS_TELECOM_B2C', iva: false, igicInfo: IGIC, texto: 'Telecomunicaciones a particular en Canarias. No sujeto a IVA peninsular (art. 70.Uno.4º LIVA). Tributa en Canarias por IGIC (7%).', ref: 'Art. 70.Uno.4º LIVA – Ley 20/1991 IGIC' }) },

  { id: 'CM_BIEN', c: (_e, cl, f) => cl.pais === 'ES' && ['ceuta','melilla'].includes(terr(cl.provincia)) && f.naturaleza === 'bien_fisico',
    r: (_e, cl) => { const c = terr(cl.provincia) === 'ceuta' ? 'Ceuta' : 'Melilla'; return { esc: 'CEUTAMEL_BIEN_FISICO', iva: false, texto: `Entrega de bien a ${c}, excluido del IVA (art. 21 LIVA). El comprador liquidará el IPSI en aduana.`, ref: 'Art. 21 LIVA' }; } },
  { id: 'CM_PROF_B2C', c: (_e, cl, f) => cl.pais === 'ES' && ['ceuta','melilla'].includes(terr(cl.provincia)) && f.naturaleza === 'servicio_profesional' && cl.tipo === 'particular',
    r: (_e, cl) => { const c = terr(cl.provincia) === 'ceuta' ? 'Ceuta' : 'Melilla'; return { esc: 'CEUTAMEL_PROF_B2C', iva: true, tipo: IVA_ES, pais: 'ES', usaIvaEsp: true, texto: `Servicio profesional a particular en ${c}. Regla general B2C (art. 69.Dos LIVA). IVA español.`, ref: 'Art. 69.Dos LIVA' }; } },
  { id: 'CM_PROF_B2B', c: (_e, cl, f) => cl.pais === 'ES' && ['ceuta','melilla'].includes(terr(cl.provincia)) && f.naturaleza === 'servicio_profesional' && cl.tipo !== 'particular',
    r: (_e, cl) => { const c = terr(cl.provincia) === 'ceuta' ? 'Ceuta' : 'Melilla'; return { esc: 'CEUTAMEL_PROF_B2B', iva: false, texto: `Servicio profesional a empresa/autónomo en ${c}. Regla general B2B (art. 69.Uno.1º LIVA): se localiza en ${c}. El cliente liquidará el IPSI.`, ref: 'Art. 69.Uno.1º LIVA' }; } },
  { id: 'CM_DIG_B2B', c: (_e, cl, f) => cl.pais === 'ES' && ['ceuta','melilla'].includes(terr(cl.provincia)) && f.naturaleza === 'servicio_digital' && cl.tipo !== 'particular',
    r: (_e, cl) => { const c = terr(cl.provincia) === 'ceuta' ? 'Ceuta' : 'Melilla'; return { esc: 'CEUTAMEL_DIGITAL_B2B', iva: false, isp: true, texto: `Servicio digital a empresa/autónomo en ${c}. Localización B2B en destino. El destinatario autodeclara el IPSI.`, ref: 'Art. 69.Uno LIVA' }; } },
  { id: 'CM_DIG_B2C', c: (_e, cl, f) => cl.pais === 'ES' && ['ceuta','melilla'].includes(terr(cl.provincia)) && f.naturaleza === 'servicio_digital' && cl.tipo === 'particular',
    r: (_e, cl) => { const c = terr(cl.provincia) === 'ceuta' ? 'Ceuta' : 'Melilla'; return { esc: 'CEUTAMEL_DIGITAL_B2C', iva: true, tipo: IVA_ES, pais: 'ES', usaIvaEsp: true, texto: `Servicio digital a particular en ${c}. Regla general B2C (art. 69.Dos LIVA). IVA español.`, ref: 'Art. 69.Dos LIVA' }; } },
  { id: 'CM_TEL_B2B', c: (_e, cl, f) => cl.pais === 'ES' && ['ceuta','melilla'].includes(terr(cl.provincia)) && f.naturaleza === 'telecomunicaciones' && cl.tipo !== 'particular',
    r: (_e, cl) => { const c = terr(cl.provincia) === 'ceuta' ? 'Ceuta' : 'Melilla'; return { esc: 'CEUTAMEL_TELECOM_B2B', iva: false, isp: true, texto: `Telecomunicaciones a empresa en ${c}. Localización B2B en destino. El destinatario autodeclara el IPSI.`, ref: 'Art. 69.Uno LIVA' }; } },
  { id: 'CM_TEL_B2C', c: (_e, cl, f) => cl.pais === 'ES' && ['ceuta','melilla'].includes(terr(cl.provincia)) && f.naturaleza === 'telecomunicaciones' && cl.tipo === 'particular',
    r: (_e, cl) => { const c = terr(cl.provincia) === 'ceuta' ? 'Ceuta' : 'Melilla'; return { esc: 'CEUTAMEL_TELECOM_B2C', iva: false, ipsiReq: true, texto: `Telecomunicaciones a particular en ${c}. Único caso en que el proveedor peninsular debe aplicar IPSI (~${(IPSI_TELECOM*100).toFixed(0)}%). Requiere registro ante la Hacienda de ${c}.`, ref: 'Ley 8/1991 – IPSI' }; } },

  { id: 'PART_ES', c: (_e, cl) => cl.tipo === 'particular' && cl.pais === 'ES',
    r: () => ({ esc: 'PARTICULAR_ES', iva: true, tipo: IVA_ES, pais: 'ES', usaIvaEsp: true }) },
  { id: 'EMP_ES', c: (_e, cl) => cl.tipo === 'empresa' && cl.pais === 'ES',
    r: () => ({ esc: 'EMPRESA_ES', iva: true, tipo: IVA_ES, pais: 'ES', usaIvaEsp: true }) },
  { id: 'AUT_ES', c: (_e, cl) => cl.tipo === 'autonomo' && cl.pais === 'ES',
    r: () => ({ esc: 'AUTONOMO_ES', iva: true, tipo: IVA_ES, pais: 'ES', usaIvaEsp: true }) },

  { id: 'EMP_UE_NIF', c: (_e, cl) => (cl.tipo === 'empresa' || cl.tipo === 'autonomo') && ueQ(cl.pais) && cl.pais !== 'ES' && cl.nifIvaVies?.valido === true,
    r: () => ({ esc: 'EMPRESA_UE_NIF_VALIDO', iva: false, isp: true, nifIvaVisible: true, texto: 'Operación exenta de IVA por inversión del sujeto pasivo, conforme al art. 84.Uno.2º LIVA.', ref: 'Art. 84.Uno.2º LIVA' }) },
  { id: 'EMP_UE_NONIF', c: (_e, cl) => (cl.tipo === 'empresa' || cl.tipo === 'autonomo') && ueQ(cl.pais) && cl.pais !== 'ES' && !(cl.nifIvaVies?.valido === true),
    r: (_e, cl) => ({ esc: 'EMPRESA_UE_SIN_NIF', iva: true, tipo: IVA_ES, pais: 'ES', nifIvaVisible: true, usaIvaEsp: true, texto: cl.nifIvaVies ? 'NIF-IVA verificado contra VIES: no válido. Se aplica IVA español.' : 'NIF-IVA pendiente de verificación en VIES. Se aplica IVA español por defecto.', ref: null }) },
  { id: 'PART_UE_PROF', c: (_e, cl, f) => cl.tipo === 'particular' && ueQ(cl.pais) && cl.pais !== 'ES' && f.naturaleza === 'servicio_profesional',
    r: () => ({ esc: 'PARTICULAR_UE_PROFESIONAL', iva: true, tipo: IVA_ES, pais: 'ES', usaIvaEsp: true, texto: 'Servicio profesional a particular en otro Estado miembro UE. Regla B2C del art. 69.Dos LIVA: sede del prestador (España). IVA español.', ref: 'Art. 69.Dos LIVA' }) },
  { id: 'PART_UE', c: (_e, cl) => cl.tipo === 'particular' && ueQ(cl.pais) && cl.pais !== 'ES',
    r: (e, cl, f) => {
      const tot = sumar(f.lineas);
      const acum = e?.ventasUEAcumuladas || 0;
      const supera = (acum + tot) > UMBRAL_OSS;
      const vol = e?.acogidoOSS === true;
      if (!supera && !vol) return { esc: 'PARTICULAR_UE_BAJO', iva: true, tipo: IVA_ES, pais: 'ES', usaIvaEsp: true, texto: `Ventas B2C a la UE acumuladas (${r2(acum+tot)} €) por debajo del umbral de ${UMBRAL_OSS} €. IVA español.`, ref: 'Art. 73 LIVA' };
      const t = IVA_OSS[cl.pais!] || IVA_ES;
      return { esc: 'PARTICULAR_UE_OSS', iva: true, tipo: t, pais: cl.pais!, oss: true, texto: 'Régimen OSS. Se aplica el tipo de IVA del país de residencia del consumidor final.', ref: 'Régimen OSS' };
    } },
  { id: 'EXTRA', c: (_e, cl) => !ueQ(cl.pais),
    r: (_e, _cl, f) => {
      const esBien = f.naturaleza === 'bien_fisico';
      return { esc: 'EXTRACOMUNITARIO', iva: false, texto: esBien ? 'Exportación de bienes fuera de la UE. Exenta de IVA (art. 21.1º LIVA).' : 'Prestación de servicios a destinatario fuera de la UE. No sujeta a IVA español (art. 21 LIVA).', ref: 'Art. 21 LIVA' };
    } },
];

export type ResolveResult = {
  err?: string;
  esc?: string;
  aplicaIva?: boolean;
  tipoIva?: number | null;
  paisIva?: string | null;
  oss?: boolean;
  isp?: boolean;
  igicInfo?: number | null;
  ipsiReq?: boolean;
  aplicaIrpf?: boolean;
  tipoIrpf?: number | null;
  texto?: string | null;
  ref?: string | null;
  faltantes?: string[];
  avisos?: string[];
  puedeEmitirse?: boolean;
};

export function resolver(emisor: Emisor | null, cliente: Cliente, factura: Factura): ResolveResult {
  if (!cliente?.pais) return { err: 'País del cliente obligatorio.' };
  if (!['particular','empresa','autonomo'].includes(cliente.tipo)) return { err: 'Tipo de cliente no válido.' };
  const regla = REGLAS.find(r => r.c(emisor, cliente, factura));
  if (!regla) return { err: 'No se encontró una regla fiscal aplicable.' };
  const p = regla.r(emisor, cliente, factura);
  if (p.usaIvaEsp && isFinite(factura.tipoIvaEsp)) p.tipo = factura.tipoIvaEsp;

  const ret = irpf(emisor, cliente, factura);
  const faltantes: string[] = [];
  if (!cliente.nombre) faltantes.push('Nombre o razón social del cliente');
  if (!cliente.nif) faltantes.push('NIF / CIF del cliente');
  if (!cliente.direccion) faltantes.push('Dirección del cliente');
  if (p.nifIvaVisible && !cliente.nifIva) faltantes.push('NIF-IVA intracomunitario');

  const avisos: string[] = [];
  if (p.igicInfo) avisos.push(`Factura sin IVA peninsular. El servicio tributa por IGIC (${(p.igicInfo*100).toFixed(0)}%) en Canarias.`);
  if (p.ipsiReq) avisos.push('Telecomunicaciones a particular en Ceuta/Melilla: debes estar registrado para IPSI (~8%).');
  if (p.esc === 'EMPRESA_UE_SIN_NIF' && !cliente.nifIvaVies) avisos.push('El NIF-IVA se verificará contra VIES al emitir.');
  if (p.esc === 'PARTICULAR_UE_BAJO') avisos.push('Actualiza el acumulado de ventas UE B2C en tu perfil tras emitir.');
  if (ret.ok && ret.pct === 0.07) avisos.push('Retención al 7% aplicada por ser autónomo nuevo (año de alta + 2 siguientes).');

  return {
    esc: p.esc, aplicaIva: !!p.iva, tipoIva: p.tipo ?? null,
    paisIva: p.pais || null, oss: !!p.oss, isp: !!p.isp,
    igicInfo: p.igicInfo || null, ipsiReq: !!p.ipsiReq,
    aplicaIrpf: ret.ok, tipoIrpf: ret.ok ? ret.pct : null,
    texto: p.texto || null, ref: p.ref || null,
    faltantes, avisos, puedeEmitirse: faltantes.length === 0,
  };
}

export function calcularImportes(lineas: Linea[], res: ResolveResult, dto = 0) {
  const base = r2(Math.max(0, sumar(lineas) - dto));
  const iva = res.aplicaIva ? r2(base * (res.tipoIva || 0)) : 0;
  const ret = res.aplicaIrpf ? r2(base * (res.tipoIrpf || 0)) : 0;
  return { base, iva, ret, total: r2(base + iva - ret) };
}

export function nuevaLinea(): Linea {
  return { concepto: '', c: 1, p: 0, d: 0 };
}
