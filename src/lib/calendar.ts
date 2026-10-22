// Lógica del calendario (como Google Calendar): fechas, repeticiones, solapes y cambios sobre
// una ocurrencia de una serie ("solo este", "este y los siguientes", "todos"). Funciones puras,
// sin acceso a datos ni al navegador.
//
// Las horas son LOCALES y sin zona horaria, tal como se ven en el calendario:
//   Fecha      "AAAA-MM-DD"
//   FechaHora  "AAAA-MM-DDTHH:mm"  (se aceptan segundos, que se descartan)
// Los cálculos usan Date.UTC solo como calculadora de días y minutos, así que el cambio de hora
// de verano no mueve ningún evento. En los eventos de todo el día, "fin" es el día siguiente a
// las 00:00 (fin exclusivo).

export type Fecha = string;
export type FechaHora = string;

export const DIAS_CORTOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
export const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export type Vista = "dia" | "semana" | "mes" | "agenda";
export type TipoEvento = "evento" | "tarea";
export type Prioridad = "urgente" | "importante" | "rutinaria";
export const COLORES = ["azul", "esmeralda", "rojo", "ambar", "violeta", "rosa", "cian", "gris"] as const;
export type ColorKey = (typeof COLORES)[number];

export type Frecuencia = "diaria" | "semanal" | "mensual" | "anual";
export type Repeticion = {
  frecuencia: Frecuencia;
  intervalo?: number | null; // cada N días / semanas / meses / años (1 por defecto)
  dias?: number[] | null; // semanal: días de la semana (0 = lunes ... 6 = domingo)
  por?: "dia" | "semana" | null; // mensual: el día N del mes, o "el segundo jueves"
  hasta?: Fecha | null; // último día (incluido)
  veces?: number | null; // número total de ocurrencias
};

export type EventoRow = {
  id: string;
  user_id: string;
  tipo: TipoEvento;
  titulo: string;
  descripcion: string | null;
  ubicacion: string | null;
  todo_el_dia: boolean;
  inicio: FechaHora;
  fin: FechaHora;
  color: ColorKey;
  prioridad: Prioridad | null;
  hecho: boolean;
  repeticion: Repeticion | null;
  omitidas: Fecha[];
  serie_id: string | null;
  serie_original: Fecha | null;
  recordatorio_min: number | null;
};

// Una aparición concreta en el calendario: un evento suelto, una ocurrencia de una serie o una
// excepción (ocurrencia de una serie que se cambió).
export type Ocurrencia = {
  clave: string; // única en pantalla
  id: string; // fila de la que sale (la serie o la excepción)
  serieId: string | null; // serie a la que pertenece, si repite
  fechaOriginal: Fecha; // día que ocupa en la serie (el original, aunque se haya movido)
  esExcepcion: boolean;
  repite: boolean;
  tipo: TipoEvento;
  titulo: string;
  todoElDia: boolean;
  inicio: FechaHora;
  fin: FechaHora;
  color: ColorKey;
  hecho: boolean;
  prioridad: Prioridad | null;
  evento: EventoRow;
  soloLectura?: boolean; // viene de otra capa (plazos fiscales...) y no se puede editar
  capa?: string;
};

/* ------------------------------ Fechas ------------------------------ */

const DIA_MS = 86_400_000;
const MIN_MS = 60_000;
const pad2 = (n: number) => String(n).padStart(2, "0");
const norm = (dt: string): FechaHora => dt.slice(0, 16).replace(" ", "T");
const utcDia = (f: Fecha) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
const utcDT = (dt: FechaHora) => Date.UTC(+dt.slice(0, 4), +dt.slice(5, 7) - 1, +dt.slice(8, 10), +dt.slice(11, 13), +dt.slice(14, 16));
const fechaDeUtc = (ms: number): Fecha => new Date(ms).toISOString().slice(0, 10);

export const fechaDe = (dt: FechaHora): Fecha => dt.slice(0, 10);
export const horaDe = (dt: FechaHora): string => dt.slice(11, 16);
export const combinar = (f: Fecha, hora: string): FechaHora => `${f}T${hora}`;
export const minutosDelDia = (dt: FechaHora): number => +dt.slice(11, 13) * 60 + +dt.slice(14, 16);
export const aFecha = (d: Date): Fecha => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const hoyFecha = (now: Date = new Date()): Fecha => aFecha(now);
export const fechaHoraADate = (dt: FechaHora): Date => new Date(+dt.slice(0, 4), +dt.slice(5, 7) - 1, +dt.slice(8, 10), +dt.slice(11, 13), +dt.slice(14, 16));
export const ahoraLocal = (now: Date = new Date()): FechaHora => `${aFecha(now)}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
export const esFecha = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && sumarDias(s, 0) === s;
export const esHora = (s: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export function sumarDias(f: Fecha, n: number): Fecha {
  return fechaDeUtc(utcDia(f) + n * DIA_MS);
}
export const diasEntre = (a: Fecha, b: Fecha): number => Math.round((utcDia(b) - utcDia(a)) / DIA_MS);
export const diaSemana = (f: Fecha): number => (new Date(utcDia(f)).getUTCDay() + 6) % 7; // 0 = lunes
export const inicioSemana = (f: Fecha): Fecha => sumarDias(f, -diaSemana(f));
export const inicioMes = (f: Fecha): Fecha => f.slice(0, 8) + "01";
export const diasDelMes = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1-12
const fechaYMD = (y: number, m: number, d: number): Fecha => `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}`;

export function minutosEntre(a: FechaHora, b: FechaHora): number {
  return Math.round((utcDT(norm(b)) - utcDT(norm(a))) / MIN_MS);
}
export function sumarMinutos(dt: FechaHora, n: number): FechaHora {
  return new Date(utcDT(norm(dt)) + n * MIN_MS).toISOString().slice(0, 16);
}

export function sumarMeses(f: Fecha, n: number): Fecha {
  const idx = +f.slice(0, 4) * 12 + (+f.slice(5, 7) - 1) + n;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return fechaYMD(y, m, Math.min(+f.slice(8, 10), diasDelMes(y, m)));
}

// Redondea unos minutos al paso indicado (para ajustar al arrastrar).
export function ajustarMinutos(min: number, paso = 15): number {
  return Math.round(min / paso) * paso;
}

export function diasDeRango(desde: Fecha, hastaExcl: Fecha): Fecha[] {
  const out: Fecha[] = [];
  for (let f = desde; f < hastaExcl; f = sumarDias(f, 1)) out.push(f);
  return out;
}

// Semanas (lunes a domingo) que cubren el mes de la fecha: 5 o 6 filas de 7 días.
export function cuadriculaMes(f: Fecha): Fecha[][] {
  const primero = inicioMes(f);
  const dias = diasDelMes(+f.slice(0, 4), +f.slice(5, 7));
  const filas = Math.ceil((diaSemana(primero) + dias) / 7);
  const inicio = inicioSemana(primero);
  return Array.from({ length: filas }, (_, s) => Array.from({ length: 7 }, (_, d) => sumarDias(inicio, s * 7 + d)));
}

// Días que se cargan para una vista (hasta es exclusivo).
export function rangoVista(vista: Vista, f: Fecha, diasAgenda = 30): { desde: Fecha; hasta: Fecha } {
  if (vista === "dia") return { desde: f, hasta: sumarDias(f, 1) };
  if (vista === "semana") {
    const d = inicioSemana(f);
    return { desde: d, hasta: sumarDias(d, 7) };
  }
  if (vista === "mes") {
    const filas = cuadriculaMes(f);
    return { desde: filas[0][0], hasta: sumarDias(filas[filas.length - 1][6], 1) };
  }
  return { desde: f, hasta: sumarDias(f, diasAgenda) };
}

export function moverVista(vista: Vista, f: Fecha, dir: -1 | 1): Fecha {
  if (vista === "dia") return sumarDias(f, dir);
  if (vista === "semana") return sumarDias(f, 7 * dir);
  if (vista === "mes") return sumarMeses(f, dir);
  return sumarDias(f, 30 * dir);
}

const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function fechaLarga(f: Fecha): string {
  return `${+f.slice(8, 10)} de ${MESES[+f.slice(5, 7) - 1]} de ${f.slice(0, 4)}`;
}
export function fechaCorta(f: Fecha): string {
  return `${+f.slice(8, 10)} ${MESES_CORTOS[+f.slice(5, 7) - 1]}`;
}
export function fechaConDia(f: Fecha): string {
  return `${DIAS_LARGOS[diaSemana(f)]}, ${+f.slice(8, 10)} de ${MESES[+f.slice(5, 7) - 1]}`;
}

export function tituloVista(vista: Vista, f: Fecha): string {
  if (vista === "dia") return mayus(`${fechaConDia(f)} de ${f.slice(0, 4)}`);
  if (vista === "mes") return mayus(`${MESES[+f.slice(5, 7) - 1]} de ${f.slice(0, 4)}`);
  const { desde, hasta } = rangoVista(vista, f);
  const fin = sumarDias(hasta, -1);
  const [y1, m1, y2, m2] = [desde.slice(0, 4), desde.slice(5, 7), fin.slice(0, 4), fin.slice(5, 7)];
  if (y1 === y2 && m1 === m2) return `${+desde.slice(8, 10)} – ${+fin.slice(8, 10)} de ${MESES[+m1 - 1]} de ${y1}`;
  if (y1 === y2) return `${fechaCorta(desde)} – ${fechaCorta(fin)} ${y1}`;
  return `${fechaCorta(desde)} ${y1} – ${fechaCorta(fin)} ${y2}`;
}

export function etiquetaDia(f: Fecha, hoy: Fecha): string {
  const dif = diasEntre(hoy, f);
  if (dif === 0) return "Hoy";
  if (dif === 1) return "Mañana";
  if (dif === -1) return "Ayer";
  return mayus(`${DIAS_LARGOS[diaSemana(f)]} ${+f.slice(8, 10)} ${MESES_CORTOS[+f.slice(5, 7) - 1]}`);
}

/* ------------------------------ Repeticiones ------------------------------ */

type RepNorm = { frecuencia: Frecuencia; intervalo: number; dias: number[] | null; por: "dia" | "semana"; hasta: Fecha | null; veces: number | null };

function normalizarRep(r: Repeticion): RepNorm {
  return {
    frecuencia: r.frecuencia,
    intervalo: Math.max(1, Math.floor(r.intervalo ?? 1)),
    dias: r.dias && r.dias.length ? [...new Set(r.dias)].sort((a, b) => a - b) : null,
    por: r.por ?? "dia",
    hasta: r.hasta ?? null,
    veces: r.veces ?? null,
  };
}

// Día del mes que cae en el N-ésimo día de la semana (n = -1: el último), o null si no existe.
function enesimoDiaSemana(y: number, m: number, dow: number, n: number): Fecha | null {
  const dim = diasDelMes(y, m);
  if (n === -1) {
    const ultimoDow = diaSemana(fechaYMD(y, m, dim));
    return fechaYMD(y, m, dim - ((ultimoDow - dow + 7) % 7));
  }
  const offset = (dow - diaSemana(fechaYMD(y, m, 1)) + 7) % 7;
  const dia = 1 + offset + (n - 1) * 7;
  return dia > dim ? null : fechaYMD(y, m, dia);
}

// "El cuarto jueves" (n = 4) o "el último" (-1) según el día en que empieza la serie.
export function posicionEnMes(f: Fecha): number {
  const d = +f.slice(8, 10);
  return d + 7 > diasDelMes(+f.slice(0, 4), +f.slice(5, 7)) ? -1 : Math.ceil(d / 7);
}

// Genera, en orden, los días de la serie. Sin "veces" salta directamente cerca de "desde".
function* generar(start: Fecha, r: RepNorm, desde: Fecha): Generator<Fecha> {
  const salto = r.veces == null && desde > start;
  let contadas = 0;
  const puede = (f: Fecha) => {
    if (r.hasta && f > r.hasta) return "fin";
    if (r.veces != null && contadas >= r.veces) return "fin";
    return "ok";
  };

  if (r.frecuencia === "diaria") {
    let k = salto ? Math.max(0, Math.floor(diasEntre(start, desde) / r.intervalo) - 1) : 0;
    for (; k < 100_000; k++) {
      const f = sumarDias(start, k * r.intervalo);
      if (puede(f) === "fin") return;
      contadas++;
      yield f;
    }
    return;
  }

  if (r.frecuencia === "semanal") {
    const dias = r.dias ?? [diaSemana(start)];
    const semana0 = inicioSemana(start);
    let w = salto ? Math.max(0, Math.floor(diasEntre(semana0, inicioSemana(desde)) / 7 / r.intervalo) - 1) : 0;
    for (; w < 100_000; w++) {
      const base = sumarDias(semana0, w * 7 * r.intervalo);
      if (r.hasta && base > r.hasta) return;
      for (const d of dias) {
        const f = sumarDias(base, d);
        if (f < start) continue;
        if (puede(f) === "fin") return;
        contadas++;
        yield f;
      }
    }
    return;
  }

  if (r.frecuencia === "mensual") {
    const [y0, m0, d0] = [+start.slice(0, 4), +start.slice(5, 7), +start.slice(8, 10)];
    const dow = diaSemana(start);
    const n = posicionEnMes(start);
    const mesesDesde = (+desde.slice(0, 4) - y0) * 12 + (+desde.slice(5, 7) - m0);
    let k = salto ? Math.max(0, Math.floor(mesesDesde / r.intervalo) - 1) : 0;
    for (; k < 20_000; k++) {
      const idx = y0 * 12 + (m0 - 1) + k * r.intervalo;
      const y = Math.floor(idx / 12);
      const m = (idx % 12) + 1;
      const f = r.por === "semana" ? enesimoDiaSemana(y, m, dow, n) : d0 <= diasDelMes(y, m) ? fechaYMD(y, m, d0) : null;
      if (r.hasta && fechaYMD(y, m, 1) > r.hasta) return;
      if (f === null || f < start) continue; // un mes sin ese día se salta y no cuenta
      if (puede(f) === "fin") return;
      contadas++;
      yield f;
    }
    return;
  }

  // anual
  const [y0, m0, d0] = [+start.slice(0, 4), +start.slice(5, 7), +start.slice(8, 10)];
  let k = salto ? Math.max(0, Math.floor((+desde.slice(0, 4) - y0) / r.intervalo) - 1) : 0;
  for (; k < 5_000; k++) {
    const y = y0 + k * r.intervalo;
    if (r.hasta && fechaYMD(y, 1, 1) > r.hasta) return;
    if (d0 > diasDelMes(y, m0)) continue; // 29 de febrero solo en años bisiestos
    const f = fechaYMD(y, m0, d0);
    if (f < start) continue;
    if (puede(f) === "fin") return;
    contadas++;
    yield f;
  }
}

// Días de inicio de las ocurrencias de una serie dentro de [desde, hasta) (hasta exclusivo).
export function fechasDeSerie(inicio: FechaHora, rep: Repeticion, desde: Fecha, hasta: Fecha): Fecha[] {
  const out: Fecha[] = [];
  for (const f of generar(fechaDe(inicio), normalizarRep(rep), desde)) {
    if (f >= hasta) break;
    if (f >= desde) out.push(f);
  }
  return out;
}

// Cuántas ocurrencias tiene la serie antes de un día (las omitidas también cuentan).
export function contarAntes(inicio: FechaHora, rep: Repeticion, antesDe: Fecha): number {
  let n = 0;
  for (const f of generar(fechaDe(inicio), normalizarRep(rep), fechaDe(inicio))) {
    if (f >= antesDe) break;
    n++;
  }
  return n;
}

// Primer día en que la serie tiene una ocurrencia (si "semanal" no incluye el día de inicio,
// la primera es el siguiente día elegido).
export function primeraOcurrencia(inicio: FechaHora, rep: Repeticion): Fecha {
  for (const f of generar(fechaDe(inicio), normalizarRep(rep), fechaDe(inicio))) return f;
  return fechaDe(inicio);
}

/* ------------------------------ Ocurrencias ------------------------------ */

export function normalizarEvento(e: EventoRow): EventoRow {
  return { ...e, inicio: norm(e.inicio), fin: norm(e.fin), omitidas: (e.omitidas ?? []).map((d) => d.slice(0, 10)), serie_original: e.serie_original ? e.serie_original.slice(0, 10) : null };
}

function aOcurrencia(fila: EventoRow, fechaOriginal: Fecha, inicio: FechaHora, fin: FechaHora): Ocurrencia {
  const esExcepcion = fila.serie_id !== null;
  const serieId = fila.repeticion ? fila.id : fila.serie_id;
  return {
    clave: `${fila.id}@${fechaOriginal}`,
    id: fila.id,
    serieId,
    fechaOriginal,
    esExcepcion,
    repite: serieId !== null,
    tipo: fila.tipo,
    titulo: fila.titulo,
    todoElDia: fila.todo_el_dia,
    inicio,
    fin,
    color: fila.color,
    hecho: fila.hecho,
    prioridad: fila.prioridad,
    evento: fila,
  };
}

// Todas las apariciones que tocan [desde, hasta) (hasta exclusivo): eventos sueltos, ocurrencias
// de series (sin las omitidas) y excepciones.
export function expandir(eventos: EventoRow[], desde: Fecha, hasta: Fecha): Ocurrencia[] {
  const ini = `${desde}T00:00`;
  const fin = `${hasta}T00:00`;
  const toca = (i: FechaHora, f: FechaHora) => i < fin && (f > ini || (f === i && i >= ini));
  const out: Ocurrencia[] = [];
  for (const crudo of eventos) {
    const ev = normalizarEvento(crudo);
    if (ev.repeticion) {
      const dur = minutosEntre(ev.inicio, ev.fin);
      const holgura = Math.ceil(dur / 1440) + 1; // ocurrencias que empiezan antes de la ventana pero la tocan
      const omit = new Set(ev.omitidas);
      for (const f of fechasDeSerie(ev.inicio, ev.repeticion, sumarDias(desde, -holgura), hasta)) {
        if (omit.has(f)) continue;
        const i = combinar(f, horaDe(ev.inicio));
        const fi = sumarMinutos(i, dur);
        if (toca(i, fi)) out.push(aOcurrencia(ev, f, i, fi));
      }
    } else if (toca(ev.inicio, ev.fin)) {
      out.push(aOcurrencia(ev, ev.serie_original ?? fechaDe(ev.inicio), ev.inicio, ev.fin));
    }
  }
  return ordenar(out);
}

export function ordenar(ocs: Ocurrencia[]): Ocurrencia[] {
  return [...ocs].sort(
    (a, b) =>
      a.inicio.localeCompare(b.inicio) ||
      b.fin.localeCompare(a.fin) ||
      a.titulo.localeCompare(b.titulo, "es") ||
      a.clave.localeCompare(b.clave),
  );
}

// Días del calendario que ocupa una aparición (un evento que acaba justo a las 00:00 no ocupa ese día).
export function diasQueOcupa(oc: Pick<Ocurrencia, "inicio" | "fin">): Fecha[] {
  const primero = fechaDe(oc.inicio);
  let ultimo = fechaDe(oc.fin);
  if (oc.fin > oc.inicio && horaDe(oc.fin) === "00:00") ultimo = sumarDias(ultimo, -1);
  if (ultimo < primero) ultimo = primero;
  return diasDeRango(primero, sumarDias(ultimo, 1));
}

export const esMultidia = (oc: Pick<Ocurrencia, "inicio" | "fin">): boolean => diasQueOcupa(oc).length > 1;
// Se dibuja en la franja de "todo el día" (eventos de todo el día y los que duran más de un día).
export const vaEnFranjaDelDia = (oc: Pick<Ocurrencia, "inicio" | "fin" | "todoElDia">): boolean => oc.todoElDia || esMultidia(oc);

export function ocurrenciasDelDia(ocs: Ocurrencia[], f: Fecha): Ocurrencia[] {
  return ocs.filter((o) => diasQueOcupa(o).includes(f));
}

/* ------------------------------ Texto ------------------------------ */

export function rangoHoras(oc: Pick<Ocurrencia, "inicio" | "fin" | "tipo">): string {
  if (oc.tipo === "tarea" || oc.fin === oc.inicio) return horaDe(oc.inicio);
  return `${horaDe(oc.inicio)} – ${horaDe(oc.fin)}`;
}

// "jueves, 22 de octubre · 10:00 – 11:00", "22 – 24 de octubre", "jueves, 22 de octubre"
export function textoCuando(oc: Pick<Ocurrencia, "inicio" | "fin" | "tipo" | "todoElDia">): string {
  const dias = diasQueOcupa(oc);
  const primero = dias[0];
  const ultimo = dias[dias.length - 1];
  if (oc.todoElDia || dias.length > 1) {
    if (dias.length === 1) return mayus(fechaConDia(primero));
    const mismoMes = primero.slice(0, 7) === ultimo.slice(0, 7);
    const horas = oc.todoElDia ? "" : ` · ${horaDe(oc.inicio)} – ${horaDe(oc.fin)}`;
    return mismoMes
      ? `${+primero.slice(8, 10)} – ${+ultimo.slice(8, 10)} de ${MESES[+primero.slice(5, 7) - 1]}${horas}`
      : `${fechaCorta(primero)} – ${fechaCorta(ultimo)}${horas}`;
  }
  return `${mayus(fechaConDia(primero))} · ${rangoHoras(oc)}`;
}

export function textoRepeticion(rep: Repeticion | null, inicio: FechaHora): string {
  if (!rep) return "No se repite";
  const r = normalizarRep(rep);
  let base: string;
  if (r.frecuencia === "diaria") base = r.intervalo === 1 ? "Todos los días" : `Cada ${r.intervalo} días`;
  else if (r.frecuencia === "semanal") {
    const dias = (r.dias ?? [diaSemana(fechaDe(inicio))]).map((d) => DIAS_LARGOS[d]);
    const lista = dias.length === 1 ? `los ${dias[0]}` : `los ${dias.slice(0, -1).join(", ")} y ${dias[dias.length - 1]}`;
    base = r.intervalo === 1 ? (dias.length === 7 ? "Todos los días" : `Todas las semanas ${lista}`) : `Cada ${r.intervalo} semanas ${lista}`;
  } else if (r.frecuencia === "mensual") {
    const f = fechaDe(inicio);
    const n = posicionEnMes(f);
    const ordinales: Record<number, string> = { 1: "primer", 2: "segundo", 3: "tercer", 4: "cuarto", [-1]: "último" };
    const detalle = r.por === "semana" ? `el ${ordinales[n]} ${DIAS_LARGOS[diaSemana(f)]}` : `el día ${+f.slice(8, 10)}`;
    base = r.intervalo === 1 ? `Todos los meses, ${detalle}` : `Cada ${r.intervalo} meses, ${detalle}`;
  } else {
    const f = fechaDe(inicio);
    base = r.intervalo === 1 ? `Todos los años, el ${+f.slice(8, 10)} de ${MESES[+f.slice(5, 7) - 1]}` : `Cada ${r.intervalo} años, el ${+f.slice(8, 10)} de ${MESES[+f.slice(5, 7) - 1]}`;
  }
  if (r.hasta) return `${base}, hasta el ${fechaLarga(r.hasta)}`;
  if (r.veces) return `${base}, ${r.veces} ${r.veces === 1 ? "vez" : "veces"}`;
  return base;
}

/* ------------------------------ Solapes (vistas de horas) ------------------------------ */

export type Colocado<T> = T & { columna: number; columnas: number };

// Reparte en columnas los eventos que coinciden en el tiempo (ini/fin en minutos del día), como
// Google Calendar: cada grupo de eventos que se pisan comparte el ancho.
export function colocarSolapes<T extends { ini: number; fin: number }>(items: T[]): Colocado<T>[] {
  const orden = [...items].sort((a, b) => a.ini - b.ini || b.fin - a.fin);
  const out: Colocado<T>[] = [];
  let grupo: Colocado<T>[] = [];
  let finGrupo = -1;
  const cerrar = () => {
    const columnas = grupo.reduce((m, g) => Math.max(m, g.columna + 1), 0);
    for (const g of grupo) g.columnas = columnas;
    out.push(...grupo);
    grupo = [];
  };
  for (const it of orden) {
    if (grupo.length && it.ini >= finGrupo) cerrar();
    const ocupadas = new Set<number>();
    for (const g of grupo) if (g.fin > it.ini) ocupadas.add(g.columna);
    let col = 0;
    while (ocupadas.has(col)) col++;
    grupo.push({ ...it, columna: col, columnas: 1 });
    finGrupo = grupo.length === 1 ? it.fin : Math.max(finGrupo, it.fin);
  }
  if (grupo.length) cerrar();
  return out;
}

// Parte de un evento que cae en un día concreto, en minutos desde las 00:00 (mínimo 15 para que se vea).
export function segmentoDelDia(oc: Pick<Ocurrencia, "inicio" | "fin">, f: Fecha): { ini: number; fin: number } {
  const ini = fechaDe(oc.inicio) < f ? 0 : minutosDelDia(oc.inicio);
  const fin = fechaDe(oc.fin) > f ? 1440 : minutosDelDia(oc.fin); // acaba otro día: llega hasta el final de este
  return { ini, fin: Math.max(fin, Math.min(ini + 15, 1440)) };
}

/* ------------------------------ Barras (mes y franja de todo el día) ------------------------------ */

export type Barra = { oc: Ocurrencia; col: number; span: number; fila: number; contIzq: boolean; contDer: boolean };

// Coloca en filas las apariciones de una semana de 7 columnas (o de 1 día): las que duran
// varios días forman una barra continua. Lo que no cabe en "maxFilas" se cuenta en "ocultas".
export function barrasDeSemana(ocs: Ocurrencia[], dias: Fecha[], maxFilas = 999): { barras: Barra[]; ocultas: number[] } {
  const n = dias.length;
  const items = ocs
    .map((oc) => {
      const ocupa = diasQueOcupa(oc);
      const colIni = dias.indexOf(ocupa.find((d) => dias.includes(d)) ?? "");
      if (colIni < 0) return null;
      const ultima = [...ocupa].reverse().find((d) => dias.includes(d)) as Fecha;
      const colFin = dias.indexOf(ultima);
      return { oc, colIni, colFin, contIzq: ocupa[0] < dias[0], contDer: ocupa[ocupa.length - 1] > dias[n - 1] };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort(
      (a, b) =>
        a.colIni - b.colIni ||
        b.colFin - b.colIni - (a.colFin - a.colIni) ||
        Number(vaEnFranjaDelDia(b.oc)) - Number(vaEnFranjaDelDia(a.oc)) ||
        a.oc.inicio.localeCompare(b.oc.inicio) ||
        a.oc.titulo.localeCompare(b.oc.titulo, "es"),
    );
  const filas: boolean[][] = [];
  const barras: Barra[] = [];
  const ocultas = Array<number>(n).fill(0);
  for (const it of items) {
    let fila = 0;
    for (;; fila++) {
      filas[fila] ??= Array<boolean>(n).fill(false);
      let libre = true;
      for (let c = it.colIni; c <= it.colFin; c++) if (filas[fila][c]) libre = false;
      if (libre) break;
    }
    if (fila >= maxFilas) {
      for (let c = it.colIni; c <= it.colFin; c++) ocultas[c]++;
      continue;
    }
    for (let c = it.colIni; c <= it.colFin; c++) filas[fila][c] = true;
    barras.push({ oc: it.oc, col: it.colIni, span: it.colFin - it.colIni + 1, fila, contIzq: it.contIzq, contDer: it.contDer });
  }
  return { barras, ocultas };
}

/* ------------------------------ Cambiar, mover y borrar ------------------------------ */

export type Alcance = "esta" | "siguientes" | "todas";

export type CambiosEvento = Partial<
  Pick<EventoRow, "tipo" | "titulo" | "descripcion" | "ubicacion" | "todo_el_dia" | "color" | "prioridad" | "hecho" | "recordatorio_min">
> & { inicio?: FechaHora; fin?: FechaHora; repeticion?: Repeticion | null };

// Lo que hay que escribir: filas completas a guardar (nuevas o modificadas) y ids a borrar.
export type Plan = { guardar: EventoRow[]; eliminar: string[] };

export type ContextoOcurrencia = {
  oc: Ocurrencia;
  maestro: EventoRow | null; // la serie a la que pertenece (null si es un evento suelto)
  hijos: EventoRow[]; // todas las excepciones de esa serie
};

const unicas = (ds: Fecha[]) => [...new Set(ds)].sort();
const sinTiempo = (c: CambiosEvento) => {
  const { inicio: _i, fin: _f, repeticion: _r, ...resto } = c;
  void _i;
  void _f;
  void _r;
  return resto;
};

function girarDias(dias: number[] | null | undefined, delta: number): number[] | null | undefined {
  if (!dias || !dias.length || delta === 0) return dias;
  return [...new Set(dias.map((d) => (((d + delta) % 7) + 7) % 7))].sort((a, b) => a - b);
}

// Cambios sobre una aparición. Para eventos sueltos no hace falta alcance.
export function planEditar(ctx: ContextoOcurrencia, cambios: CambiosEvento, alcance: Alcance, nuevoId: () => string): Plan {
  const { oc } = ctx;
  const fila = normalizarEvento(oc.evento);

  // Evento suelto
  if (!ctx.maestro) return { guardar: [{ ...fila, ...limpiar(cambios) }], eliminar: [] };

  const maestro = normalizarEvento(ctx.maestro);
  const hijos = ctx.hijos.map(normalizarEvento);
  const nuevoInicio = cambios.inicio ? norm(cambios.inicio) : oc.inicio;
  const nuevoFin = cambios.fin ? norm(cambios.fin) : sumarMinutos(nuevoInicio, minutosEntre(oc.inicio, oc.fin));

  if (alcance === "esta") {
    if (oc.esExcepcion) {
      return { guardar: [{ ...fila, ...sinTiempo(cambios), inicio: nuevoInicio, fin: nuevoFin }], eliminar: [] };
    }
    const excepcion: EventoRow = {
      ...maestro,
      ...sinTiempo(cambios),
      id: nuevoId(),
      repeticion: null,
      omitidas: [],
      serie_id: maestro.id,
      serie_original: oc.fechaOriginal,
      inicio: nuevoInicio,
      fin: nuevoFin,
      hecho: cambios.hecho ?? false,
    };
    return { guardar: [{ ...maestro, omitidas: unicas([...maestro.omitidas, oc.fechaOriginal]) }, excepcion], eliminar: [] };
  }

  const primera = fechaDe(maestro.inicio);
  if (alcance === "siguientes" && oc.fechaOriginal > primera) {
    return dividir(maestro, hijos, oc, cambios, nuevoInicio, nuevoFin, nuevoId);
  }

  // "todas" (o "siguientes" desde la primera ocurrencia): se cambia la serie entera
  const deltaMin = cambios.inicio ? minutosEntre(oc.inicio, nuevoInicio) : 0;
  const deltaDias = cambios.inicio ? diasEntre(fechaDe(oc.inicio), fechaDe(nuevoInicio)) : 0;
  const inicio = sumarMinutos(maestro.inicio, deltaMin);
  const durMaestro = cambios.fin ? minutosEntre(nuevoInicio, nuevoFin) : minutosEntre(maestro.inicio, maestro.fin);
  const repeticion =
    cambios.repeticion !== undefined
      ? cambios.repeticion
      : maestro.repeticion
        ? { ...maestro.repeticion, dias: girarDias(maestro.repeticion.dias, deltaDias), hasta: maestro.repeticion.hasta ? sumarDias(maestro.repeticion.hasta, deltaDias) : maestro.repeticion.hasta ?? null }
        : null;
  const actualizado: EventoRow = {
    ...maestro,
    ...sinTiempo(cambios),
    inicio,
    fin: sumarMinutos(inicio, durMaestro),
    repeticion,
    omitidas: deltaDias ? maestro.omitidas.map((d) => sumarDias(d, deltaDias)) : maestro.omitidas,
  };
  const guardar: EventoRow[] = [actualizado];
  if (deltaDias) for (const h of hijos) guardar.push({ ...h, serie_original: h.serie_original ? sumarDias(h.serie_original, deltaDias) : h.serie_original });
  return { guardar, eliminar: [] };
}

// "Este y los siguientes": la serie original termina el día anterior y empieza otra desde esta ocurrencia.
function dividir(maestro: EventoRow, hijos: EventoRow[], oc: Ocurrencia, cambios: CambiosEvento, nuevoInicio: FechaHora, nuevoFin: FechaHora, nuevoId: () => string): Plan {
  const rep = maestro.repeticion as Repeticion;
  const antes = contarAntes(maestro.inicio, rep, oc.fechaOriginal);
  const deltaDias = diasEntre(fechaDe(oc.inicio), fechaDe(nuevoInicio));
  const veces = rep.veces != null ? Math.max(1, rep.veces - antes) : null;
  const repNueva: Repeticion | null =
    cambios.repeticion !== undefined
      ? cambios.repeticion
      : { ...rep, dias: girarDias(rep.dias, deltaDias), veces, hasta: rep.hasta ? sumarDias(rep.hasta, deltaDias) : (rep.hasta ?? null) };
  const antiguo: EventoRow = {
    ...maestro,
    repeticion: { ...rep, hasta: sumarDias(oc.fechaOriginal, -1), veces: null },
    omitidas: maestro.omitidas.filter((d) => d < oc.fechaOriginal),
  };
  const serie: EventoRow = {
    ...maestro,
    ...sinTiempo(cambios),
    id: nuevoId(),
    inicio: nuevoInicio,
    fin: nuevoFin,
    repeticion: repNueva,
    omitidas: maestro.omitidas.filter((d) => d >= oc.fechaOriginal).map((d) => sumarDias(d, deltaDias)),
    serie_id: null,
    serie_original: null,
    hecho: false,
  };
  const trasladadas = hijos
    .filter((h) => (h.serie_original ?? "") >= oc.fechaOriginal)
    .map((h) => ({ ...h, serie_id: serie.id, serie_original: sumarDias(h.serie_original as Fecha, deltaDias) }));
  return { guardar: [antiguo, serie, ...trasladadas], eliminar: [] };
}

const limpiar = (c: CambiosEvento): CambiosEvento => {
  const out: CambiosEvento = { ...c };
  if (out.inicio) out.inicio = norm(out.inicio);
  if (out.fin) out.fin = norm(out.fin);
  return out;
};

export function planEliminar(ctx: ContextoOcurrencia, alcance: Alcance): Plan {
  const { oc } = ctx;
  if (!ctx.maestro) return { guardar: [], eliminar: [oc.id] };
  const maestro = normalizarEvento(ctx.maestro);
  const hijos = ctx.hijos.map(normalizarEvento);

  if (alcance === "esta") {
    if (oc.esExcepcion) return { guardar: [], eliminar: [oc.id] }; // el día queda en "omitidas" de la serie
    return { guardar: [{ ...maestro, omitidas: unicas([...maestro.omitidas, oc.fechaOriginal]) }], eliminar: [] };
  }
  if (alcance === "siguientes" && oc.fechaOriginal > fechaDe(maestro.inicio)) {
    const rep = maestro.repeticion as Repeticion;
    return {
      guardar: [{ ...maestro, repeticion: { ...rep, hasta: sumarDias(oc.fechaOriginal, -1), veces: null }, omitidas: maestro.omitidas.filter((d) => d < oc.fechaOriginal) }],
      eliminar: hijos.filter((h) => (h.serie_original ?? "") >= oc.fechaOriginal).map((h) => h.id),
    };
  }
  return { guardar: [], eliminar: [maestro.id, ...hijos.map((h) => h.id)] };
}

/* ------------------------------ Creación y recordatorios ------------------------------ */

export function nuevoEvento(
  userId: string,
  id: string,
  base: Partial<Omit<EventoRow, "id" | "user_id">> & { titulo: string; inicio: FechaHora },
): EventoRow {
  const tipo = base.tipo ?? "evento";
  const todo = base.todo_el_dia ?? false;
  const inicio = norm(base.inicio);
  const fin = base.fin ? norm(base.fin) : todo ? sumarMinutos(`${fechaDe(inicio)}T00:00`, 1440) : tipo === "tarea" ? inicio : sumarMinutos(inicio, 60);
  return {
    id,
    user_id: userId,
    tipo,
    titulo: base.titulo.trim(),
    descripcion: base.descripcion ?? null,
    ubicacion: base.ubicacion ?? null,
    todo_el_dia: todo,
    inicio: todo ? `${fechaDe(inicio)}T00:00` : inicio,
    fin,
    color: base.color ?? "azul",
    prioridad: base.prioridad ?? null,
    hecho: base.hecho ?? false,
    repeticion: base.repeticion ?? null,
    omitidas: base.omitidas ?? [],
    serie_id: base.serie_id ?? null,
    serie_original: base.serie_original ?? null,
    recordatorio_min: base.recordatorio_min ?? null,
  };
}

// Cuándo avisar: "recordatorio_min" minutos antes del inicio (en los de todo el día, a partir de las 09:00).
export function momentoDeAviso(oc: Pick<Ocurrencia, "inicio" | "todoElDia"> & { evento: Pick<EventoRow, "recordatorio_min"> }): FechaHora | null {
  const min = oc.evento.recordatorio_min;
  if (min == null) return null;
  const base = oc.todoElDia ? combinar(fechaDe(oc.inicio), "09:00") : oc.inicio;
  return sumarMinutos(base, -min);
}

// Avisos que vencen entre "desde" (excluido) y "hasta" (incluido), sin los de tareas ya hechas.
export function avisosPendientes(ocs: Ocurrencia[], desde: FechaHora, hasta: FechaHora): Ocurrencia[] {
  return ocs.filter((o) => {
    if (o.tipo === "tarea" && o.hecho) return false;
    const m = momentoDeAviso(o);
    return m !== null && m > norm(desde) && m <= norm(hasta);
  });
}

export const OPCIONES_RECORDATORIO: { valor: number | null; etiqueta: string }[] = [
  { valor: null, etiqueta: "Sin aviso" },
  { valor: 0, etiqueta: "Al empezar" },
  { valor: 5, etiqueta: "5 minutos antes" },
  { valor: 10, etiqueta: "10 minutos antes" },
  { valor: 30, etiqueta: "30 minutos antes" },
  { valor: 60, etiqueta: "1 hora antes" },
  { valor: 1440, etiqueta: "1 día antes" },
  { valor: 10080, etiqueta: "1 semana antes" },
];

export const COLOR_POR_PRIORIDAD: Record<Prioridad, ColorKey> = { urgente: "rojo", importante: "ambar", rutinaria: "esmeralda" };

/* ------------------------------ Aplicar un plan y capas de solo lectura ------------------------------ */

// Resultado de aplicar un plan a una lista de filas (lo mismo que hará la base de datos): se
// guardan o sustituyen las filas del plan y se borran las indicadas; las excepciones de una
// serie borrada se van con ella. Sirve para que la pantalla responda al instante.
export function aplicarPlan(filas: EventoRow[], plan: Plan): EventoRow[] {
  const mapa = new Map(filas.map((f) => [f.id, f]));
  for (const g of plan.guardar) mapa.set(g.id, g);
  for (const e of plan.eliminar) mapa.delete(e);
  for (const f of [...mapa.values()]) if (f.serie_id && !mapa.has(f.serie_id)) mapa.delete(f.id);
  return [...mapa.values()];
}

// Algo que se enseña en el calendario pero no se puede editar (plazos fiscales, días de entreno...).
export type ItemExterno = { id: string; fecha: Fecha; titulo: string; detalle?: string | null; capa: string; color: ColorKey };

export function ocurrenciaExterna(item: ItemExterno): Ocurrencia {
  const inicio = `${item.fecha}T00:00`;
  const fila: EventoRow = {
    id: `externo:${item.id}`, user_id: "", tipo: "evento", titulo: item.titulo, descripcion: item.detalle ?? null, ubicacion: null,
    todo_el_dia: true, inicio, fin: `${sumarDias(item.fecha, 1)}T00:00`, color: item.color, prioridad: null, hecho: false,
    repeticion: null, omitidas: [], serie_id: null, serie_original: null, recordatorio_min: null,
  };
  return { ...aOcurrencia(fila, item.fecha, fila.inicio, fila.fin), soloLectura: true, capa: item.capa };
}

// El plan que deshace otro: vuelve a guardar las filas tal como estaban antes (también las que se
// borraron) y borra las que el plan había creado. "conocidas" son las filas que se ven en pantalla
// más las excepciones de la serie afectada.
export function inversoDe(plan: Plan, conocidas: EventoRow[]): Plan {
  const previas = new Map(conocidas.map((f) => [f.id, f]));
  const guardar: EventoRow[] = [];
  const vistos = new Set<string>();
  for (const id of [...plan.guardar.map((g) => g.id), ...plan.eliminar]) {
    const previa = previas.get(id);
    if (previa && !vistos.has(id)) {
      guardar.push(previa);
      vistos.add(id);
    }
  }
  // Las excepciones se borran junto con su serie: si se borró la serie, también hay que recuperarlas
  for (const f of conocidas) if (f.serie_id && plan.eliminar.includes(f.serie_id) && !vistos.has(f.id)) {
    guardar.push(f);
    vistos.add(f.id);
  }
  const eliminar = plan.guardar.filter((g) => !previas.has(g.id)).map((g) => g.id);
  return { guardar, eliminar };
}

// Antes de guardar: una serie debe empezar en su primera ocurrencia real. Si se cambian los días
// de una serie semanal ("solo lunes") el inicio se recoloca en el primer lunes, con la misma duración.
export function alinearSeries(plan: Plan): Plan {
  return {
    ...plan,
    guardar: plan.guardar.map((f) => {
      if (!f.repeticion || f.serie_id) return f;
      const fila = normalizarEvento(f);
      const primera = primeraOcurrencia(fila.inicio, fila.repeticion as Repeticion);
      const dias = diasEntre(fechaDe(fila.inicio), primera);
      if (dias <= 0) return fila;
      const inicio = combinar(primera, horaDe(fila.inicio));
      return { ...fila, inicio, fin: sumarMinutos(inicio, minutosEntre(fila.inicio, fila.fin)) };
    }),
  };
}
