// Formularios de evento y tarea: el borrador que se edita en pantalla, sus valores por defecto,
// la validación y su conversión a un evento guardable. Funciones puras.
import {
  combinar,
  diaSemana,
  diasEntre,
  esFecha,
  esHora,
  fechaDe,
  horaDe,
  minutosEntre,
  posicionEnMes,
  primeraOcurrencia,
  sumarDias,
  sumarMinutos,
  textoRepeticion,
  type CambiosEvento,
  type ColorKey,
  type EventoRow,
  type Fecha,
  type FechaHora,
  type Ocurrencia,
  type Prioridad,
  type Repeticion,
  type TipoEvento,
} from "./calendar";
import type { Interpretado } from "./calendar-quick";

export type BorradorEvento = {
  tipo: TipoEvento;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  todoElDia: boolean;
  fechaIni: Fecha;
  horaIni: string;
  fechaFin: Fecha; // en los de todo el día, el último día (incluido)
  horaFin: string;
  conHora: boolean; // solo tareas: si tienen hora o son de todo el día
  color: ColorKey;
  prioridad: Prioridad | null;
  repeticion: Repeticion | null;
  recordatorioMin: number | null;
  hecho: boolean;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

// La hora redonda siguiente a "ahora" (para crear algo sin elegir hora).
export function siguienteHoraRedonda(ahora: FechaHora): { fecha: Fecha; hora: string } {
  const h = +ahora.slice(11, 13);
  if (h >= 23) return { fecha: sumarDias(fechaDe(ahora), 1), hora: "00:00" };
  return { fecha: fechaDe(ahora), hora: `${pad2(h + 1)}:00` };
}

export function borradorNuevo(o: {
  fecha: Fecha;
  hora?: string | null;
  duracionMin?: number;
  tipo?: TipoEvento;
  todoElDia?: boolean;
  fechaFin?: Fecha;
  horaFin?: string;
  titulo?: string;
}): BorradorEvento {
  const hora = o.hora ?? "09:00";
  const dur = o.duracionMin ?? 60;
  const fin = sumarMinutos(combinar(o.fecha, hora), dur);
  const tipo = o.tipo ?? "evento";
  return {
    tipo,
    titulo: o.titulo ?? "",
    descripcion: "",
    ubicacion: "",
    todoElDia: o.todoElDia ?? false,
    fechaIni: o.fecha,
    horaIni: hora,
    fechaFin: o.fechaFin ?? fechaDe(fin),
    horaFin: o.horaFin ?? horaDe(fin),
    conHora: o.hora != null && !o.todoElDia,
    color: tipo === "tarea" ? "esmeralda" : "azul",
    prioridad: null,
    repeticion: null,
    recordatorioMin: null,
    hecho: false,
  };
}

// Para una ocurrencia de una serie, "maestro" es la fila de la serie: de ella sale la repetición que se edita.
export function borradorDesdeOcurrencia(oc: Ocurrencia, maestro?: Pick<EventoRow, "repeticion"> | null): BorradorEvento {
  const e = oc.evento;
  const ultimoDia = oc.todoElDia ? sumarDias(fechaDe(oc.fin), -1) : fechaDe(oc.fin);
  return {
    tipo: oc.tipo,
    titulo: oc.titulo,
    descripcion: e.descripcion ?? "",
    ubicacion: e.ubicacion ?? "",
    todoElDia: oc.todoElDia,
    fechaIni: fechaDe(oc.inicio),
    horaIni: oc.todoElDia ? "09:00" : horaDe(oc.inicio),
    fechaFin: ultimoDia < fechaDe(oc.inicio) ? fechaDe(oc.inicio) : ultimoDia,
    horaFin: oc.todoElDia ? "10:00" : horaDe(oc.fin),
    conHora: oc.tipo === "tarea" && !oc.todoElDia,
    color: oc.color,
    prioridad: oc.prioridad,
    repeticion: maestro?.repeticion ?? e.repeticion,
    recordatorioMin: e.recordatorio_min,
    hecho: oc.hecho,
  };
}

// Al cambiar la hora o el día de inicio, el final se mueve con él y la duración se mantiene.
export function moverInicio(b: BorradorEvento, fechaIni: Fecha, horaIni: string): BorradorEvento {
  const antes = combinar(b.fechaIni, b.horaIni);
  const despues = combinar(fechaIni, horaIni);
  if (!esFecha(fechaIni) || !esHora(horaIni)) return { ...b, fechaIni, horaIni };
  if (b.todoElDia) {
    const dias = diasEntre(b.fechaIni, b.fechaFin);
    return { ...b, fechaIni, horaIni, fechaFin: sumarDias(fechaIni, Math.max(0, dias)) };
  }
  const dur = Math.max(0, minutosEntre(antes, combinar(b.fechaFin, b.horaFin)));
  const fin = sumarMinutos(despues, dur);
  return { ...b, fechaIni, horaIni, fechaFin: fechaDe(fin), horaFin: horaDe(fin) };
}

export function validarBorrador(b: BorradorEvento): string | null {
  if (!b.titulo.trim()) return "Ponle un título.";
  if (b.titulo.trim().length > 200) return "El título es demasiado largo (máximo 200 caracteres).";
  if (b.descripcion.length > 4000) return "La descripción es demasiado larga (máximo 4.000 caracteres).";
  if (b.ubicacion.length > 200) return "La ubicación es demasiado larga (máximo 200 caracteres).";
  if (!esFecha(b.fechaIni)) return "La fecha de inicio no es válida.";
  const conHoras = b.tipo === "evento" ? !b.todoElDia : b.conHora;
  if (conHoras && !esHora(b.horaIni)) return "La hora de inicio no es válida.";
  if (b.tipo === "evento") {
    if (!esFecha(b.fechaFin)) return "La fecha de fin no es válida.";
    if (b.todoElDia) {
      if (b.fechaFin < b.fechaIni) return "El último día no puede ser anterior al primero.";
    } else {
      if (!esHora(b.horaFin)) return "La hora de fin no es válida.";
      if (combinar(b.fechaFin, b.horaFin) <= combinar(b.fechaIni, b.horaIni)) return "El final tiene que ser posterior al inicio.";
    }
  }
  const r = b.repeticion;
  if (r) {
    if (r.intervalo != null && (r.intervalo < 1 || r.intervalo > 99)) return "Repetir cada: entre 1 y 99.";
    if (r.frecuencia === "semanal" && r.dias && r.dias.length === 0) return "Elige al menos un día de la semana.";
    if (r.hasta && !esFecha(r.hasta)) return "La fecha en que termina la repetición no es válida.";
    if (r.hasta && r.hasta < b.fechaIni) return "La repetición termina antes de empezar.";
    if (r.veces != null && (r.veces < 1 || r.veces > 999)) return "Número de repeticiones: entre 1 y 999.";
  }
  return null;
}

// Lo que se guarda: horas locales, fin exclusivo en los de todo el día, tareas sin duración y,
// en las series semanales, el inicio movido a la primera ocurrencia real.
export function borradorACambios(b: BorradorEvento): CambiosEvento {
  let todo: boolean;
  let inicio: FechaHora;
  let fin: FechaHora;
  if (b.tipo === "tarea") {
    todo = !b.conHora;
    inicio = combinar(b.fechaIni, todo ? "00:00" : b.horaIni);
    fin = todo ? combinar(sumarDias(b.fechaIni, 1), "00:00") : inicio;
  } else if (b.todoElDia) {
    todo = true;
    inicio = combinar(b.fechaIni, "00:00");
    fin = combinar(sumarDias(b.fechaFin < b.fechaIni ? b.fechaIni : b.fechaFin, 1), "00:00");
  } else {
    todo = false;
    inicio = combinar(b.fechaIni, b.horaIni);
    fin = combinar(b.fechaFin, b.horaFin);
  }
  if (b.repeticion) {
    const primera = primeraOcurrencia(inicio, b.repeticion);
    const dias = diasEntre(fechaDe(inicio), primera);
    if (dias > 0) {
      inicio = combinar(primera, horaDe(inicio));
      fin = combinar(sumarDias(fechaDe(fin), dias), horaDe(fin));
    }
  }
  const color = b.color;
  return {
    tipo: b.tipo,
    titulo: b.titulo.trim(),
    descripcion: b.descripcion.trim() || null,
    ubicacion: b.ubicacion.trim() || null,
    todo_el_dia: todo,
    inicio,
    fin,
    color,
    prioridad: b.tipo === "tarea" ? b.prioridad : null,
    hecho: b.tipo === "tarea" ? b.hecho : false,
    repeticion: b.repeticion,
    recordatorio_min: b.recordatorioMin,
  };
}

/* ------------------------------ Repetición: opciones del desplegable ------------------------------ */

export type OpcionRepeticion = { clave: string; etiqueta: string; repeticion: Repeticion | null };

const ORDINAL: Record<number, string> = { 1: "primer", 2: "segundo", 3: "tercer", 4: "cuarto", [-1]: "último" };
const DIA_LARGO = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Lo que ofrece Google según el día elegido: no se repite, cada día, cada semana ese día,
// cada mes ese día / ese "cuarto jueves", cada año, de lunes a viernes.
export function opcionesRepeticion(fecha: Fecha): OpcionRepeticion[] {
  const dow = diaSemana(fecha);
  const dia = +fecha.slice(8, 10);
  const mes = MES_LARGO[+fecha.slice(5, 7) - 1];
  const n = posicionEnMes(`${fecha}`);
  return [
    { clave: "no", etiqueta: "No se repite", repeticion: null },
    { clave: "diaria", etiqueta: "Todos los días", repeticion: { frecuencia: "diaria" } },
    { clave: "semanal", etiqueta: `Todas las semanas el ${DIA_LARGO[dow]}`, repeticion: { frecuencia: "semanal", dias: [dow] } },
    { clave: "mensual_dia", etiqueta: `Todos los meses el día ${dia}`, repeticion: { frecuencia: "mensual", por: "dia" } },
    { clave: "mensual_semana", etiqueta: `Todos los meses el ${ORDINAL[n]} ${DIA_LARGO[dow]}`, repeticion: { frecuencia: "mensual", por: "semana" } },
    { clave: "anual", etiqueta: `Todos los años el ${dia} de ${mes}`, repeticion: { frecuencia: "anual" } },
    { clave: "laborables", etiqueta: "De lunes a viernes", repeticion: { frecuencia: "semanal", dias: [0, 1, 2, 3, 4] } },
  ];
}

const mismos = (a: number[] | null | undefined, b: number[] | null | undefined) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());

// Qué opción del desplegable corresponde a una repetición (o "personalizada").
export function claveDeRepeticion(rep: Repeticion | null | undefined, fecha: Fecha): string {
  if (!rep) return "no";
  const simple = !rep.hasta && rep.veces == null && (rep.intervalo ?? 1) === 1;
  if (!simple) return "personalizada";
  const dow = diaSemana(fecha);
  if (rep.frecuencia === "diaria") return "diaria";
  if (rep.frecuencia === "semanal") {
    if (!rep.dias || mismos(rep.dias, [dow])) return "semanal";
    if (mismos(rep.dias, [0, 1, 2, 3, 4])) return "laborables";
    return "personalizada";
  }
  if (rep.frecuencia === "mensual") return rep.por === "semana" ? "mensual_semana" : "mensual_dia";
  if (rep.frecuencia === "anual") return "anual";
  return "personalizada";
}

/* ------------------------------ Frase escrita -> borrador ------------------------------ */

// Pasa al borrador lo que se entendió de la frase (día, hora, repetición, tipo), manteniendo el
// resto. Si solo hay hora de inicio, el final se pone una hora después.
export function aplicarInterpretacion(b: BorradorEvento, i: Interpretado): BorradorEvento {
  let r: BorradorEvento = { ...b, titulo: i.titulo || b.titulo };
  if (i.tipo) r = { ...r, tipo: i.tipo, color: i.tipo === "tarea" && b.color === "azul" ? "esmeralda" : r.color };
  const fecha = i.fecha ?? r.fechaIni;
  if (i.todoElDia) {
    r = { ...r, todoElDia: true, fechaIni: fecha, fechaFin: fecha, conHora: false };
  } else if (i.horaInicio) {
    const fin = i.horaFin ? combinar(fecha, i.horaFin) : sumarMinutos(combinar(fecha, i.horaInicio), 60);
    const finAjustado = fin <= combinar(fecha, i.horaInicio) ? sumarMinutos(fin, 1440) : fin;
    r = { ...r, todoElDia: false, fechaIni: fecha, horaIni: i.horaInicio, fechaFin: fechaDe(finAjustado), horaFin: horaDe(finAjustado), conHora: true };
  } else if (i.fecha) {
    r = moverInicio({ ...r, fechaIni: r.fechaIni }, fecha, r.horaIni);
  }
  if (i.repeticion) r = { ...r, repeticion: i.repeticion };
  return r;
}

// Lo que se entendió de una frase, para enseñárselo al usuario: ["Mañana, 23 oct", "10:30 – 11:30", "Todas las semanas los lunes"].
export function describirInterpretacion(i: Interpretado, hoy: Fecha): string[] {
  const out: string[] = [];
  if (i.tipo === "tarea") out.push("Tarea");
  if (i.fecha) {
    const dif = diasEntre(hoy, i.fecha);
    const nombre = dif === 0 ? "Hoy" : dif === 1 ? "Mañana" : DIA_LARGO[diaSemana(i.fecha)].replace(/^./, (c) => c.toUpperCase());
    out.push(`${nombre}, ${+i.fecha.slice(8, 10)} ${MES_LARGO[+i.fecha.slice(5, 7) - 1].slice(0, 3)}`);
  }
  if (i.todoElDia) out.push("Todo el día");
  else if (i.horaInicio) out.push(i.horaFin ? `${i.horaInicio} – ${i.horaFin}` : i.horaInicio);
  if (i.repeticion) out.push(textoRepeticion(i.repeticion, `${i.fecha ?? hoy}T00:00`));
  return out;
}
