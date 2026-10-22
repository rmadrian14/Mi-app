// Escribir y que se entienda (como "Añadir rápido" de Google Calendar), en español: de una frase
// como «Dentista mañana a las 10:30» o «Gimnasio todos los lunes y miércoles 19:00» saca el
// título, el día, la hora y la repetición. Función pura: no usa el reloj del navegador, se le
// pasa "ahora".
import {
  aFecha,
  diaSemana,
  diasDelMes,
  esFecha,
  primeraOcurrencia,
  sumarDias,
  sumarMeses,
  type Fecha,
  type Repeticion,
  type TipoEvento,
} from "./calendar";

export type Reconocido = { texto: string; clase: "tipo" | "fecha" | "hora" | "repeticion" };

export type Interpretado = {
  titulo: string;
  fecha: Fecha | null;
  horaInicio: string | null;
  horaFin: string | null;
  todoElDia: boolean;
  repeticion: Repeticion | null;
  tipo: TipoEvento | null;
  reconocido: Reconocido[];
};

const DIAS = "lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?";
const MESES = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";
const quitarAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const NOMBRES_DIA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const indiceDia = (s: string) => {
  const n = quitarAcentos(s);
  const i = NOMBRES_DIA.indexOf(n);
  return i >= 0 ? i : NOMBRES_DIA.indexOf(n.replace(/s$/, "")); // sábados, domingos
};
const indiceMes = (s: string) => {
  const m = quitarAcentos(s);
  return m === "setiembre" ? 8 : NOMBRES_MES.indexOf(m);
};
const pad2 = (n: number) => String(n).padStart(2, "0");

const hora = (h: number, m = 0): string | null => (h >= 0 && h <= 23 && m >= 0 && m <= 59 ? `${pad2(h)}:${pad2(m)}` : null);

// Convierte "5 de la tarde" en 17:00 y "9 de la noche" en 21:00.
function conMomento(h: number, momento: string | undefined): number {
  const m = momento ? quitarAcentos(momento) : "";
  if ((m === "tarde" || m === "noche") && h < 12) return h + 12;
  return h;
}

function listaDias(texto: string): number[] {
  const dias = [...texto.matchAll(new RegExp(`(${DIAS})`, "gi"))].map((x) => indiceDia(x[1]));
  return [...new Set(dias)].sort((a, b) => a - b);
}

export function interpretarTexto(texto: string, ahora: Date = new Date()): Interpretado {
  const hoy = aFecha(ahora);
  let resto = ` ${texto.trim()} `;
  const reconocido: Reconocido[] = [];
  let tipo: TipoEvento | null = null;
  let fecha: Fecha | null = null;
  let horaInicio: string | null = null;
  let horaFin: string | null = null;
  let todoElDia = false;
  let repeticion: Repeticion | null = null;

  // Busca y quita lo que coincide, dejando un espacio.
  const tomar = (re: RegExp, clase: Reconocido["clase"]): RegExpMatchArray | null => {
    const m = resto.match(re);
    if (!m || m.index === undefined) return null;
    resto = resto.slice(0, m.index) + " " + resto.slice(m.index + m[0].length);
    reconocido.push({ texto: m[0].trim(), clase });
    return m;
  };

  // ---- Tipo
  if (tomar(/^\s*(?:tarea|recordatorio)\s*[:\-]?\s+/i, "tipo")) tipo = "tarea";

  // "por la mañana" / "de la mañana" se quita antes de buscar fechas: no es el día de mañana
  const esManana = !!tomar(/\b(?:por|de|en) la ma[ñn]ana\b/i, "hora");

  // ---- Fechas con mes escrito, numéricas y relativas (se leen antes que las horas)
  const fechaConMes = (dia: number, mes: number, anyo?: number): Fecha | null => {
    if (mes < 0 || mes > 11 || dia < 1) return null;
    const y = anyo ?? +hoy.slice(0, 4);
    if (dia > diasDelMes(y, mes + 1)) return null;
    let f = `${y}-${pad2(mes + 1)}-${pad2(dia)}`;
    if (anyo === undefined && f < hoy) {
      if (dia > diasDelMes(y + 1, mes + 1)) return null;
      f = `${y + 1}-${pad2(mes + 1)}-${pad2(dia)}`;
    }
    return esFecha(f) ? f : null;
  };
  const anyoDe = (s: string | undefined) => (s ? (s.length === 2 ? 2000 + +s : +s) : undefined);

  const leerFecha = (): void => {
    let m: RegExpMatchArray | null;
    if ((m = tomar(new RegExp(`\\b(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?(${MESES})(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`, "i"), "fecha"))) {
      fecha = fechaConMes(+m[1], indiceMes(m[2]), anyoDe(m[3]));
    } else if ((m = tomar(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, "fecha"))) {
      fecha = fechaConMes(+m[1], +m[2] - 1, anyoDe(m[3]));
    } else if ((m = tomar(/\b(?:en|dentro de)\s+(\d{1,3})\s+(d[ií]as?|semanas?|mes(?:es)?)\b/i, "fecha"))) {
      const n = +m[1];
      const u = quitarAcentos(m[2]);
      fecha = u.startsWith("dia") ? sumarDias(hoy, n) : u.startsWith("semana") ? sumarDias(hoy, 7 * n) : sumarMeses(hoy, n);
    } else if (tomar(/\bpasado\s+ma[ñn]ana\b/i, "fecha")) {
      fecha = sumarDias(hoy, 2);
    } else if (tomar(/\bma[ñn]ana\b/i, "fecha")) {
      fecha = sumarDias(hoy, 1);
    } else if (tomar(/\bhoy\b/i, "fecha")) {
      fecha = hoy;
    } else if ((m = tomar(new RegExp(`\\b(?:el\\s+|este\\s+|pr[oó]ximo\\s+|el\\s+pr[oó]ximo\\s+)?(${DIAS})\\b`, "i"), "fecha"))) {
      // El próximo de ese día de la semana (si hoy es ese día, el de la semana que viene)
      const dif = (indiceDia(m[1]) - diaSemana(hoy) + 7) % 7 || 7;
      fecha = sumarDias(hoy, dif);
    } else if ((m = tomar(/\bel\s+(\d{1,2})\b/i, "fecha"))) {
      const d = +m[1];
      const y = +hoy.slice(0, 4);
      const mes = +hoy.slice(5, 7) - 1;
      const esteMes = d <= diasDelMes(y, mes + 1) ? `${y}-${pad2(mes + 1)}-${pad2(d)}` : null;
      fecha = esteMes && esteMes >= hoy ? esteMes : sumarMesesDia(hoy, d);
    }
  };

  // ---- Repetición (antes que la fecha para que "cada lunes" no se tome como un día suelto)
  const hastaTexto = (): Fecha | null => {
    const m = tomar(new RegExp(`\\bhasta\\s+(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?(${MESES})(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`, "i"), "repeticion");
    return m ? fechaConMes(+m[1], indiceMes(m[2]), anyoDe(m[3])) : null;
  };
  let m: RegExpMatchArray | null;
  if ((m = tomar(/\b(?:todos los d[ií]as|cada d[ií]a|a diario|diariamente)\b/i, "repeticion"))) repeticion = { frecuencia: "diaria" };
  else if ((m = tomar(/\bcada\s+(\d{1,2})\s+d[ií]as\b/i, "repeticion"))) repeticion = { frecuencia: "diaria", intervalo: +m[1] };
  else if ((m = tomar(/\bcada\s+(\d{1,2})\s+semanas\b/i, "repeticion"))) repeticion = { frecuencia: "semanal", intervalo: +m[1] };
  else if ((m = tomar(/\bcada\s+(\d{1,2})\s+meses\b/i, "repeticion"))) repeticion = { frecuencia: "mensual", intervalo: +m[1] };
  else if ((m = tomar(/\bcada\s+(\d{1,2})\s+a[ñn]os\b/i, "repeticion"))) repeticion = { frecuencia: "anual", intervalo: +m[1] };
  else if (tomar(/\b(?:todas las semanas|cada semana|semanalmente)\b/i, "repeticion")) repeticion = { frecuencia: "semanal" };
  else if (tomar(/\b(?:todos los meses|cada mes|mensualmente)\b/i, "repeticion")) repeticion = { frecuencia: "mensual" };
  else if (tomar(/\b(?:todos los a[ñn]os|cada a[ñn]o|anualmente)\b/i, "repeticion")) repeticion = { frecuencia: "anual" };
  else if (tomar(/\bde lunes a viernes\b|\bentre semana\b|\blos d[ií]as laborables\b/i, "repeticion")) repeticion = { frecuencia: "semanal", dias: [0, 1, 2, 3, 4] };
  else if (tomar(/\b(?:los )?fines de semana\b/i, "repeticion")) repeticion = { frecuencia: "semanal", dias: [5, 6] };
  else if ((m = tomar(new RegExp(`\\b(?:todos los|todas las|cada|los)\\s+((?:${DIAS})(?:\\s*(?:,|y|e)\\s*(?:${DIAS}))*)\\b`, "i"), "repeticion"))) {
    repeticion = { frecuencia: "semanal", dias: listaDias(m[1]) };
  }

  // "cada 2 semanas el martes": el día suelto fija los días de la semana de la repetición
  const veces = repeticion ? tomar(/\b(\d{1,3})\s+veces\b/i, "repeticion") : null;
  const hasta = repeticion ? hastaTexto() : null;
  if (repeticion && veces) repeticion = { ...repeticion, veces: +veces[1] };
  if (repeticion && hasta) repeticion = { ...repeticion, hasta };

  leerFecha();

  if (repeticion?.frecuencia === "semanal" && !repeticion.dias && fecha) repeticion = { ...repeticion, dias: [diaSemana(fecha)] };

  // ---- Todo el día
  if (tomar(/\btodo el d[ií]a\b/i, "hora")) todoElDia = true;

  // ---- Horas
  const mm = (s: string | undefined) => (s ? +s : 0);
  if ((m = tomar(/\bde\s+(\d{1,2})(?:[:.h](\d{2}))?\s*(?:h|horas)?\s*(?:a|-|–|hasta)\s*(?:las\s+)?(\d{1,2})(?:[:.h](\d{2}))?\s*(?:h|horas)?(?=\s|$|[,.;])/i, "hora"))) {
    horaInicio = hora(+m[1], mm(m[2]));
    horaFin = hora(+m[3], mm(m[4]));
  } else if ((m = tomar(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(?:h|horas)?\s*[-–]\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:h|horas)\b/i, "hora"))) {
    horaInicio = hora(+m[1], mm(m[2]));
    horaFin = hora(+m[3], mm(m[4]));
  } else if ((m = tomar(/\ba\s+las?\s+(\d{1,2})(?:[:.h](\d{2}))?\s*(?:h|horas)?(?:\s*(?:de la|por la|de)\s+(ma[ñn]ana|tarde|noche))?(?=\s|$|[,.;])/i, "hora"))) {
    horaInicio = hora(conMomento(+m[1], m[3]), mm(m[2]));
  } else if ((m = tomar(/\b(\d{1,2}):(\d{2})\s*(?:h|horas)?(?:\s*(?:de la|por la)\s+(tarde|noche))?(?=\s|$|[,.;])/i, "hora"))) {
    horaInicio = hora(conMomento(+m[1], m[3]), +m[2]);
  } else if ((m = tomar(/\b(\d{1,2})\s*(?:h|horas)\b/i, "hora"))) {
    horaInicio = hora(+m[1]);
  } else if (tomar(/\b(?:al\s+)?mediod[ií]a\b/i, "hora")) {
    horaInicio = "12:00";
  } else if (tomar(/\bmedianoche\b/i, "hora")) {
    horaInicio = "00:00";
  } else if ((m = tomar(/\bpor la\s+(tarde|noche)\b/i, "hora"))) {
    horaInicio = quitarAcentos(m[1]) === "tarde" ? "16:00" : "21:00";
  } else if (esManana) {
    horaInicio = "09:00";
  }
  if (todoElDia) {
    horaInicio = null;
    horaFin = null;
  }

  // ---- Fecha por defecto de una repetición semanal: la primera coincidencia desde hoy
  if (repeticion && !fecha) {
    const base = `${hoy}T${horaInicio ?? "00:00"}`;
    fecha = repeticion.frecuencia === "semanal" ? primeraDesde(base, repeticion, hoy) : hoy;
  }

  // ---- Título: lo que queda, sin conectores sueltos
  const sueltas = /^(?:(?:el|la|los|las|a|al|de|del|en|para|y|e|hasta|desde|;|,|-|–|:|·)\s+)+|(?:\s+(?:el|la|los|las|a|al|de|del|en|para|y|e|hasta|desde|por|;|,|-|–|:|·))+$/i;
  let titulo = resto.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) titulo = titulo.replace(sueltas, "").replace(/^[,;:\-–·\s]+|[,;:\-–·\s]+$/g, "").trim();
  if (titulo) titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);

  return { titulo, fecha, horaInicio, horaFin, todoElDia, repeticion, tipo, reconocido };
}

// El día D del mes siguiente (o el primer mes que lo tenga).
function sumarMesesDia(hoy: Fecha, d: number): Fecha {
  for (let k = 1; k <= 12; k++) {
    const f = sumarMeses(`${hoy.slice(0, 8)}01`, k);
    if (d <= diasDelMes(+f.slice(0, 4), +f.slice(5, 7))) return `${f.slice(0, 8)}${pad2(d)}`;
  }
  return hoy;
}

function primeraDesde(base: string, rep: Repeticion, hoy: Fecha): Fecha {
  // Primer día elegido a partir de hoy (incluido si coincide)
  for (let k = 0; k < 7; k++) {
    const f = sumarDias(hoy, k);
    if ((rep.dias ?? []).includes(diaSemana(f))) return f;
  }
  return primeraOcurrencia(base, rep);
}
