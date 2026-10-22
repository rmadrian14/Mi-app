// «Hoy»: lo que importa del día en un solo vistazo, juntando Entrenamiento, Alimentación y
// Organización. Funciones puras: reciben lo leído de la base de datos y devuelven el resumen.
import {
  diasEntre,
  expandir,
  fechaDe,
  fechaConDia,
  horaDe,
  sumarDias,
  type EventoRow,
  type Fecha,
  type FechaHora,
  type Ocurrencia,
} from "./calendar";

export type HabitoTipo = "movilidad" | "caminata";

export type DatosHoy = {
  fecha: Fecha;
  ahora: FechaHora;
  // Entrenamiento
  dia: { nombre_dia: string; es_dia_entreno: boolean; ejercicios: number; habitos: HabitoTipo[] } | null; // null: sin rutina
  sesionesHoy: { completado: boolean; es_extra: boolean }[];
  habitosHechos: HabitoTipo[];
  // Alimentación
  perfil: { kcal_objetivo: number; proteina_g: number; grasa_g: number; hidratos_g: number } | null;
  comidasHoy: { kcal: number; proteina_g: number; grasa_g: number; hidratos_g: number }[];
  ultimoPeso: { fecha: Fecha; peso_kg: number } | null;
  // Organización
  eventos: EventoRow[]; // series y eventos sueltos que tocan hoy
  pendientes: EventoRow[]; // tareas sueltas sin hacer, de cualquier fecha
};

export type EstadoEntreno = "sin_rutina" | "descanso" | "pendiente" | "hecho" | "extra_hecho";

export type ResumenEntreno = {
  estado: EstadoEntreno;
  titulo: string;
  detalle: string;
  habitos: { tipo: HabitoTipo; hecho: boolean }[];
};

export type Barra = { objetivo: number; consumido: number; restante: number };
export type ResumenComida = {
  conPerfil: boolean;
  registrado: boolean;
  kcal: Barra;
  proteina: Barra;
  porcentaje: number; // 0-100+ de las kcal
  mensaje: string;
  avisoPeso: string | null;
};

export type ResumenAgenda = {
  eventos: Ocurrencia[]; // de hoy, por hora (primero los de todo el día)
  tareas: Ocurrencia[]; // de hoy, las pendientes primero
  atrasadas: number; // tareas sueltas de días anteriores sin hacer
  siguiente: Ocurrencia | null; // el próximo evento con hora que aún no ha terminado
};

export type ResumenHoy = {
  fecha: Fecha;
  titulo: string; // "Jueves, 22 de octubre"
  saludo: string; // "Buenas tardes"
  entreno: ResumenEntreno;
  comida: ResumenComida;
  agenda: ResumenAgenda;
};

const r0 = (n: number) => Math.round(n);
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const miles = (n: number) => r0(n).toLocaleString("es-ES");

export function saludoDe(ahora: FechaHora): string {
  const h = +ahora.slice(11, 13);
  return h < 6 ? "Buenas noches" : h < 13 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
}

export function resumenEntreno(d: DatosHoy): ResumenEntreno {
  const hechos = (t: HabitoTipo) => d.habitosHechos.includes(t);
  const habitos = (d.dia?.habitos ?? []).map((tipo) => ({ tipo, hecho: hechos(tipo) }));
  if (!d.dia) return { estado: "sin_rutina", titulo: "Aún no tienes rutina", detalle: "Crea tu semana en Entrenamiento.", habitos: [] };
  const completa = d.sesionesHoy.some((s) => s.completado && !s.es_extra);
  const extra = d.sesionesHoy.some((s) => s.completado && s.es_extra);
  if (!d.dia.es_dia_entreno) {
    return extra
      ? { estado: "extra_hecho", titulo: "Día de descanso", detalle: "Has hecho un entrenamiento extra.", habitos }
      : { estado: "descanso", titulo: "Hoy toca descanso", detalle: habitos.length ? "Aprovecha para movilidad y caminar." : "Recupera con calma.", habitos };
  }
  if (completa) return { estado: "hecho", titulo: `${d.dia.nombre_dia} completado`, detalle: "Entreno de hoy hecho. ¡Bien!", habitos };
  return { estado: "pendiente", titulo: `Hoy toca ${d.dia.nombre_dia}`, detalle: d.dia.ejercicios > 0 ? plural(d.dia.ejercicios, "ejercicio", "ejercicios") : "Sin ejercicios en este día", habitos };
}

export function avisoPeso(ultimo: DatosHoy["ultimoPeso"], hoy: Fecha): string | null {
  if (!ultimo) return "Aún no has registrado tu peso.";
  const dias = diasEntre(ultimo.fecha, hoy);
  return dias >= 7 ? `Hace ${dias} días que no te pesas.` : null;
}

export function resumenComida(d: DatosHoy): ResumenComida {
  const suma = (f: (c: DatosHoy["comidasHoy"][number]) => number) => d.comidasHoy.reduce((s, c) => s + f(c), 0);
  const kcalC = suma((c) => c.kcal);
  const protC = suma((c) => c.proteina_g);
  const registrado = d.comidasHoy.length > 0;
  if (!d.perfil) {
    return {
      conPerfil: false,
      registrado,
      kcal: { objetivo: 0, consumido: kcalC, restante: 0 },
      proteina: { objetivo: 0, consumido: protC, restante: 0 },
      porcentaje: 0,
      mensaje: registrado ? `Llevas ${miles(kcalC)} kcal hoy.` : "Calcula tus objetivos en Alimentación.",
      avisoPeso: null,
    };
  }
  const kcal: Barra = { objetivo: d.perfil.kcal_objetivo, consumido: kcalC, restante: d.perfil.kcal_objetivo - kcalC };
  const proteina: Barra = { objetivo: d.perfil.proteina_g, consumido: protC, restante: d.perfil.proteina_g - protC };
  const margen = kcal.objetivo * 0.05;
  let mensaje: string;
  if (!registrado) mensaje = "Aún no has registrado nada hoy.";
  else if (kcal.restante > margen) mensaje = `Te quedan ${miles(kcal.restante)} kcal y ${r0(Math.max(0, proteina.restante))} g de proteína.`;
  else if (kcal.restante >= -margen) mensaje = proteina.restante > 10 ? `Calorías cubiertas. Faltan ${r0(proteina.restante)} g de proteína.` : "Objetivo de hoy cumplido.";
  else mensaje = `Te has pasado ${miles(-kcal.restante)} kcal del objetivo.`;
  return {
    conPerfil: true,
    registrado,
    kcal,
    proteina,
    porcentaje: kcal.objetivo > 0 ? Math.round((kcalC / kcal.objetivo) * 100) : 0,
    mensaje,
    avisoPeso: avisoPeso(d.ultimoPeso, d.fecha),
  };
}

export function resumenAgenda(d: DatosHoy): ResumenAgenda {
  const hoy = d.fecha;
  const ocs = expandir(d.eventos, hoy, sumarDias(hoy, 1));
  const eventos = ocs.filter((o) => o.tipo === "evento").sort((a, b) => Number(b.todoElDia) - Number(a.todoElDia) || a.inicio.localeCompare(b.inicio));
  const tareas = ocs.filter((o) => o.tipo === "tarea").sort((a, b) => Number(a.hecho) - Number(b.hecho) || a.inicio.localeCompare(b.inicio));
  const atrasadas = d.pendientes.filter((t) => fechaDe(t.inicio) < hoy).length;
  const siguiente = eventos.find((e) => !e.todoElDia && e.fin > d.ahora) ?? null;
  return { eventos, tareas, atrasadas, siguiente };
}

export function construirHoy(d: DatosHoy): ResumenHoy {
  return {
    fecha: d.fecha,
    titulo: mayus(fechaConDia(d.fecha)),
    saludo: saludoDe(d.ahora),
    entreno: resumenEntreno(d),
    comida: resumenComida(d),
    agenda: resumenAgenda(d),
  };
}

// «10:00», «Todo el día», «hasta 12:30» para una fila de la agenda de hoy.
export function horaDeAgenda(o: Pick<Ocurrencia, "inicio" | "fin" | "todoElDia" | "tipo">, hoy: Fecha): string {
  if (o.todoElDia) return "Todo el día";
  if (fechaDe(o.inicio) < hoy) return `hasta ${horaDe(o.fin)}`;
  return horaDe(o.inicio);
}
