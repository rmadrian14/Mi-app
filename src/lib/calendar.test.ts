import { describe, expect, it } from "vitest";
import {
  alinearSeries,
  aplicarPlan,
  avisosPendientes,
  barrasDeSemana,
  colocarSolapes,
  contarAntes,
  cuadriculaMes,
  diasQueOcupa,
  diaSemana,
  etiquetaDia,
  expandir,
  fechasDeSerie,
  inversoDe,
  inicioSemana,
  minutosEntre,
  momentoDeAviso,
  moverVista,
  nuevoEvento,
  ocurrenciaExterna,
  planEditar,
  planEliminar,
  primeraOcurrencia,
  rangoVista,
  segmentoDelDia,
  sumarDias,
  sumarMeses,
  sumarMinutos,
  textoCuando,
  textoRepeticion,
  tituloVista,
  type ContextoOcurrencia,
  type EventoRow,
  type Plan,
  type Repeticion,
} from "./calendar";

let contador = 0;
const id = () => `id-${++contador}`;
const ev = (p: Partial<EventoRow> = {}): EventoRow => ({
  id: id(), user_id: "u", tipo: "evento", titulo: "Evento", descripcion: null, ubicacion: null, todo_el_dia: false,
  inicio: "2026-10-22T10:00", fin: "2026-10-22T11:00", color: "azul", prioridad: null, hecho: false, repeticion: null,
  omitidas: [], serie_id: null, serie_original: null, recordatorio_min: null, ...p,
});

describe("fechas", () => {
  it("sumar días y meses cruzando meses, años y bisiestos", () => {
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(sumarDias("2026-01-01", -1)).toBe("2025-12-31");
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMeses("2027-01-31", 1)).toBe("2027-02-28");
    expect(sumarMeses("2026-12-15", 1)).toBe("2027-01-15");
    expect(sumarMeses("2026-01-15", -1)).toBe("2025-12-15");
  });

  it("día de la semana (0 = lunes) y comienzo de semana", () => {
    expect(diaSemana("2026-10-19")).toBe(0);
    expect(diaSemana("2026-10-22")).toBe(3);
    expect(diaSemana("2026-10-25")).toBe(6);
    expect(inicioSemana("2026-10-22")).toBe("2026-10-19");
    expect(inicioSemana("2026-10-25")).toBe("2026-10-19");
    expect(inicioSemana("2026-10-19")).toBe("2026-10-19");
  });

  it("minutos entre horas y suma de minutos sin que el cambio de hora afecte", () => {
    expect(minutosEntre("2026-10-22T10:00", "2026-10-22T11:30")).toBe(90);
    expect(minutosEntre("2026-10-22T23:00", "2026-10-23T01:00")).toBe(120);
    expect(sumarMinutos("2026-03-28T23:30", 120)).toBe("2026-03-29T01:30"); // noche del cambio de hora: es hora local, no se mueve
    expect(sumarMinutos("2026-10-24T23:30", 120)).toBe("2026-10-25T01:30");
    expect(sumarMinutos("2026-10-22T10:00:00", 30)).toBe("2026-10-22T10:30");
  });

  it("cuadrícula del mes: semanas completas de lunes a domingo", () => {
    const oct = cuadriculaMes("2026-10-15");
    expect(oct).toHaveLength(5);
    expect(oct[0][0]).toBe("2026-09-28");
    expect(oct[4][6]).toBe("2026-11-01");
    expect(oct.every((s) => s.length === 7)).toBe(true);
    expect(cuadriculaMes("2027-02-10")).toHaveLength(4); // febrero de 2027 empieza en lunes y tiene 28 días
    expect(cuadriculaMes("2026-08-10")).toHaveLength(6); // agosto de 2026 empieza en sábado y tiene 31
  });

  it("rango, navegación y título de cada vista", () => {
    expect(rangoVista("dia", "2026-10-22")).toEqual({ desde: "2026-10-22", hasta: "2026-10-23" });
    expect(rangoVista("semana", "2026-10-22")).toEqual({ desde: "2026-10-19", hasta: "2026-10-26" });
    expect(rangoVista("mes", "2026-10-22")).toEqual({ desde: "2026-09-28", hasta: "2026-11-02" });
    expect(rangoVista("agenda", "2026-10-22")).toEqual({ desde: "2026-10-22", hasta: "2026-11-21" });
    expect(moverVista("dia", "2026-10-22", 1)).toBe("2026-10-23");
    expect(moverVista("semana", "2026-10-22", -1)).toBe("2026-10-15");
    expect(moverVista("mes", "2026-01-31", 1)).toBe("2026-02-28");
    expect(tituloVista("dia", "2026-10-22")).toBe("Jueves, 22 de octubre de 2026");
    expect(tituloVista("semana", "2026-10-22")).toBe("19 – 25 de octubre de 2026");
    expect(tituloVista("semana", "2026-10-29")).toBe("26 oct – 1 nov 2026");
    expect(tituloVista("semana", "2026-12-31")).toBe("28 dic 2026 – 3 ene 2027");
    expect(tituloVista("mes", "2026-10-22")).toBe("Octubre de 2026");
  });

  it("etiqueta de día", () => {
    expect(etiquetaDia("2026-10-22", "2026-10-22")).toBe("Hoy");
    expect(etiquetaDia("2026-10-23", "2026-10-22")).toBe("Mañana");
    expect(etiquetaDia("2026-10-24", "2026-10-22")).toBe("Sábado 24 oct");
  });
});

describe("repeticiones", () => {
  const dia = (inicio: string, rep: Repeticion, desde: string, hasta: string) => fechasDeSerie(inicio, rep, desde, hasta);

  it("diaria: cada N días y límites (hasta incluido, número de veces)", () => {
    expect(dia("2026-10-01T09:00", { frecuencia: "diaria", intervalo: 2 }, "2026-10-01", "2026-10-11")).toEqual(["2026-10-01", "2026-10-03", "2026-10-05", "2026-10-07", "2026-10-09"]);
    expect(dia("2026-10-01T09:00", { frecuencia: "diaria", hasta: "2026-10-03" }, "2026-10-01", "2026-10-30")).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(dia("2026-10-01T09:00", { frecuencia: "diaria", veces: 3 }, "2026-10-01", "2026-10-30")).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(dia("2026-10-10T09:00", { frecuencia: "diaria" }, "2026-10-01", "2026-10-12")).toEqual(["2026-10-10", "2026-10-11"]); // no hay antes del inicio
  });

  it("semanal: por defecto el día en que empieza; con varios días y cada 2 semanas", () => {
    expect(dia("2026-10-05T19:00", { frecuencia: "semanal" }, "2026-10-01", "2026-10-30")).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(dia("2026-10-05T19:00", { frecuencia: "semanal", dias: [0, 2] }, "2026-10-01", "2026-10-20")).toEqual(["2026-10-05", "2026-10-07", "2026-10-12", "2026-10-14", "2026-10-19"]);
    expect(dia("2026-10-05T19:00", { frecuencia: "semanal", intervalo: 2, dias: [0, 4] }, "2026-10-01", "2026-11-10")).toEqual(["2026-10-05", "2026-10-09", "2026-10-19", "2026-10-23", "2026-11-02", "2026-11-06"]);
    expect(dia("2026-10-05T19:00", { frecuencia: "semanal", dias: [0, 2], veces: 3 }, "2026-10-01", "2026-12-30")).toEqual(["2026-10-05", "2026-10-07", "2026-10-12"]);
  });

  it("semanal: si el día de inicio no está entre los elegidos, la primera es la siguiente coincidencia", () => {
    const rep: Repeticion = { frecuencia: "semanal", dias: [2, 4] }; // miércoles y viernes
    expect(primeraOcurrencia("2026-10-05T19:00", rep)).toBe("2026-10-07"); // el lunes 5 no cuenta
    expect(dia("2026-10-05T19:00", rep, "2026-10-01", "2026-10-12")).toEqual(["2026-10-07", "2026-10-09"]);
  });

  it("mensual por día del mes: los meses sin ese día se saltan", () => {
    expect(dia("2026-01-31T09:00", { frecuencia: "mensual" }, "2026-01-01", "2026-06-30")).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]);
    expect(dia("2026-01-15T09:00", { frecuencia: "mensual", intervalo: 3 }, "2026-01-01", "2026-12-31")).toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
  });

  it("mensual por día de la semana: el cuarto jueves y el último viernes", () => {
    // 22 oct 2026 es el cuarto jueves
    expect(dia("2026-10-22T09:00", { frecuencia: "mensual", por: "semana" }, "2026-10-01", "2027-01-31")).toEqual(["2026-10-22", "2026-11-26", "2026-12-24", "2027-01-28"]);
    // 30 oct 2026 es el último viernes
    expect(dia("2026-10-30T09:00", { frecuencia: "mensual", por: "semana" }, "2026-10-01", "2027-01-31")).toEqual(["2026-10-30", "2026-11-27", "2026-12-25", "2027-01-29"]);
  });

  it("anual: el 29 de febrero solo en años bisiestos", () => {
    expect(dia("2024-02-29T09:00", { frecuencia: "anual" }, "2024-01-01", "2033-01-01")).toEqual(["2024-02-29", "2028-02-29", "2032-02-29"]);
    expect(dia("2026-03-15T09:00", { frecuencia: "anual", intervalo: 2 }, "2026-01-01", "2032-01-01")).toEqual(["2026-03-15", "2028-03-15", "2030-03-15"]);
  });

  it("el salto rápido a una ventana lejana da lo mismo que generar todo desde el principio", () => {
    const series: { inicio: string; rep: Repeticion }[] = [
      { inicio: "2020-01-01T09:00", rep: { frecuencia: "diaria" } },
      { inicio: "2020-01-01T09:00", rep: { frecuencia: "diaria", intervalo: 3 } },
      { inicio: "2020-03-04T09:00", rep: { frecuencia: "semanal", dias: [0, 3, 5] } },
      { inicio: "2020-03-04T09:00", rep: { frecuencia: "semanal", intervalo: 3, dias: [2, 6] } },
      { inicio: "2019-01-31T09:00", rep: { frecuencia: "mensual" } },
      { inicio: "2019-05-17T09:00", rep: { frecuencia: "mensual", intervalo: 2, por: "semana" } },
      { inicio: "2016-02-29T09:00", rep: { frecuencia: "anual" } },
      { inicio: "2021-07-10T09:00", rep: { frecuencia: "anual", intervalo: 2, hasta: "2027-01-01" } },
    ];
    const ventanas: [string, string][] = [["2026-10-19", "2026-10-26"], ["2026-09-28", "2026-11-02"], ["2024-02-25", "2024-03-03"], ["2026-12-01", "2027-02-01"]];
    for (const { inicio, rep } of series) {
      const todas = fechasDeSerie(inicio, rep, "1900-01-01", "2030-01-01");
      for (const [d, h] of ventanas) {
        expect(fechasDeSerie(inicio, rep, d, h), `${JSON.stringify(rep)} ${d}..${h}`).toEqual(todas.filter((f) => f >= d && f < h));
      }
    }
  });

  it("contar ocurrencias anteriores a un día (para dividir una serie con límite de veces)", () => {
    expect(contarAntes("2026-10-05T19:00", { frecuencia: "semanal", dias: [0, 2] }, "2026-10-19")).toBe(4); // 5, 7, 12, 14
    expect(contarAntes("2026-10-05T19:00", { frecuencia: "diaria" }, "2026-10-05")).toBe(0);
  });
});

describe("expandir", () => {
  it("eventos sueltos: solo los que tocan la ventana, incluidos los de varios días que empezaron antes", () => {
    const dentro = ev({ titulo: "dentro", inicio: "2026-10-22T10:00", fin: "2026-10-22T11:00" });
    const fuera = ev({ titulo: "fuera", inicio: "2026-10-30T10:00", fin: "2026-10-30T11:00" });
    const largo = ev({ titulo: "viaje", todo_el_dia: true, inicio: "2026-10-18T00:00", fin: "2026-10-23T00:00" });
    const justoAntes = ev({ titulo: "antes", inicio: "2026-10-21T22:00", fin: "2026-10-22T00:00" });
    const r = expandir([dentro, fuera, largo, justoAntes], "2026-10-22", "2026-10-29");
    expect(r.map((o) => o.titulo).sort()).toEqual(["dentro", "viaje"]);
  });

  it("una tarea sin duración cuenta si cae en la ventana", () => {
    const t = ev({ tipo: "tarea", titulo: "t", inicio: "2026-10-22T09:00", fin: "2026-10-22T09:00" });
    expect(expandir([t], "2026-10-22", "2026-10-23")).toHaveLength(1);
    expect(expandir([t], "2026-10-23", "2026-10-24")).toHaveLength(0);
  });

  it("series: ocurrencias en la ventana con la misma hora y duración, sin las omitidas", () => {
    const s = ev({ titulo: "Gimnasio", inicio: "2026-10-05T19:00", fin: "2026-10-05T20:30", repeticion: { frecuencia: "semanal", dias: [0, 2] }, omitidas: ["2026-10-14"] });
    const r = expandir([s], "2026-10-12", "2026-10-19");
    expect(r.map((o) => o.inicio)).toEqual(["2026-10-12T19:00"]); // el miércoles 14 está omitido
    expect(r[0].fin).toBe("2026-10-12T20:30");
    expect(r[0].repite).toBe(true);
    expect(r[0].serieId).toBe(s.id);
    expect(r[0].fechaOriginal).toBe("2026-10-12");
  });

  it("una ocurrencia que empieza antes de la ventana pero dura hasta ella también aparece", () => {
    const s = ev({ titulo: "Guardia", inicio: "2026-10-01T22:00", fin: "2026-10-02T06:00", repeticion: { frecuencia: "diaria" } });
    const r = expandir([s], "2026-10-10", "2026-10-11");
    expect(r.map((o) => o.inicio)).toEqual(["2026-10-09T22:00", "2026-10-10T22:00"]);
  });

  it("excepciones: aparecen en su propio sitio y marcan el día original; las horas con segundos se normalizan", () => {
    const s = ev({ titulo: "Serie", inicio: "2026-10-05T19:00", fin: "2026-10-05T20:00", repeticion: { frecuencia: "semanal" }, omitidas: ["2026-10-12"] });
    const x = ev({ titulo: "Movida", inicio: "2026-10-13T08:00:00", fin: "2026-10-13T09:00:00", serie_id: s.id, serie_original: "2026-10-12" });
    const r = expandir([s, x], "2026-10-12", "2026-10-19");
    expect(r.map((o) => `${o.titulo} ${o.inicio}`)).toEqual(["Movida 2026-10-13T08:00"]);
    expect(r[0].esExcepcion).toBe(true);
    expect(r[0].fechaOriginal).toBe("2026-10-12");
    expect(r[0].serieId).toBe(s.id);
  });

  it("orden: por hora, después los más largos y por título", () => {
    const a = ev({ titulo: "B", inicio: "2026-10-22T10:00", fin: "2026-10-22T10:30" });
    const b = ev({ titulo: "A", inicio: "2026-10-22T10:00", fin: "2026-10-22T12:00" });
    const c = ev({ titulo: "C", inicio: "2026-10-22T09:00", fin: "2026-10-22T09:30" });
    expect(expandir([a, b, c], "2026-10-22", "2026-10-23").map((o) => o.titulo)).toEqual(["C", "A", "B"]);
  });

  it("días que ocupa un evento y si va en la franja de todo el día", () => {
    expect(diasQueOcupa({ inicio: "2026-10-22T00:00", fin: "2026-10-23T00:00" })).toEqual(["2026-10-22"]);
    expect(diasQueOcupa({ inicio: "2026-10-22T22:00", fin: "2026-10-23T02:00" })).toEqual(["2026-10-22", "2026-10-23"]);
    expect(diasQueOcupa({ inicio: "2026-10-22T09:00", fin: "2026-10-22T09:00" })).toEqual(["2026-10-22"]);
    expect(diasQueOcupa({ inicio: "2026-10-22T00:00", fin: "2026-10-25T00:00" })).toEqual(["2026-10-22", "2026-10-23", "2026-10-24"]);
  });
});

describe("colocación en pantalla", () => {
  it("solapes: los que se pisan se reparten el ancho; los que no, ocupan todo", () => {
    const r = colocarSolapes([{ n: "a", ini: 60, fin: 120 }, { n: "b", ini: 90, fin: 150 }, { n: "c", ini: 200, fin: 260 }]);
    const por = Object.fromEntries(r.map((x) => [x.n, x]));
    expect(por.a.columnas).toBe(2);
    expect(por.b.columnas).toBe(2);
    expect(por.a.columna).toBe(0);
    expect(por.b.columna).toBe(1);
    expect(por.c.columnas).toBe(1);
    expect(por.c.columna).toBe(0);
  });

  it("solapes en cadena comparten columnas y reutilizan la libre", () => {
    const r = colocarSolapes([{ n: "a", ini: 0, fin: 60 }, { n: "b", ini: 30, fin: 90 }, { n: "c", ini: 60, fin: 120 }]);
    const por = Object.fromEntries(r.map((x) => [x.n, x]));
    expect(por.c.columna).toBe(0); // a ya terminó
    expect(r.every((x) => x.columnas === 2)).toBe(true);
  });

  it("tres a la vez: tres columnas", () => {
    const r = colocarSolapes([{ ini: 0, fin: 60 }, { ini: 10, fin: 70 }, { ini: 20, fin: 80 }]);
    expect(r.map((x) => x.columna).sort()).toEqual([0, 1, 2]);
    expect(r.every((x) => x.columnas === 3)).toBe(true);
  });

  it("parte de un evento en un día, con un mínimo de 15 minutos", () => {
    expect(segmentoDelDia({ inicio: "2026-10-22T10:00", fin: "2026-10-22T11:30" }, "2026-10-22")).toEqual({ ini: 600, fin: 690 });
    expect(segmentoDelDia({ inicio: "2026-10-22T22:00", fin: "2026-10-23T02:00" }, "2026-10-22")).toEqual({ ini: 1320, fin: 1440 });
    expect(segmentoDelDia({ inicio: "2026-10-22T22:00", fin: "2026-10-23T02:00" }, "2026-10-23")).toEqual({ ini: 0, fin: 120 });
    expect(segmentoDelDia({ inicio: "2026-10-22T09:00", fin: "2026-10-22T09:00" }, "2026-10-22")).toEqual({ ini: 540, fin: 555 });
  });

  it("barras de la semana: los eventos de varios días son una barra y se apilan sin pisarse", () => {
    const semana = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
    const viaje = ev({ titulo: "viaje", todo_el_dia: true, inicio: "2026-10-20T00:00", fin: "2026-10-23T00:00" });
    const otro = ev({ titulo: "otro", todo_el_dia: true, inicio: "2026-10-21T00:00", fin: "2026-10-22T00:00" });
    const largo = ev({ titulo: "largo", todo_el_dia: true, inicio: "2026-10-17T00:00", fin: "2026-10-21T00:00" });
    const { barras } = barrasDeSemana(expandir([viaje, otro, largo], "2026-10-19", "2026-10-26"), semana);
    const b = Object.fromEntries(barras.map((x) => [x.oc.titulo, x]));
    expect(b.viaje).toMatchObject({ col: 1, span: 3, contIzq: false });
    expect(b.largo).toMatchObject({ col: 0, span: 2, contIzq: true });
    expect(b.otro.fila).not.toBe(b.viaje.fila); // se solapan en el miércoles
    expect(b.largo.fila).not.toBe(b.viaje.fila); // se solapan en el martes
  });

  it("si no caben, se cuentan como ocultas en cada día", () => {
    const semana = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
    const cinco = Array.from({ length: 5 }, (_, i) => ev({ titulo: "e" + i, inicio: "2026-10-21T0" + (i + 1) + ":00", fin: "2026-10-21T0" + (i + 1) + ":30" }));
    const { barras, ocultas } = barrasDeSemana(expandir(cinco, "2026-10-19", "2026-10-26"), semana, 3);
    expect(barras).toHaveLength(3);
    expect(ocultas[2]).toBe(2);
    expect(ocultas.reduce((a, b) => a + b, 0)).toBe(2);
  });
});

const aplicar = aplicarPlan;
const resumen = (filas: EventoRow[], desde: string, hasta: string) => expandir(filas, desde, hasta).map((o) => `${o.inicio.slice(5, 16).replace("T", " ")} ${o.titulo}`);
function contexto(filas: EventoRow[], desde: string, hasta: string, fechaOriginal: string, serieId?: string): ContextoOcurrencia {
  const oc = expandir(filas, desde, hasta).find((o) => o.fechaOriginal === fechaOriginal && (!serieId || o.serieId === serieId))!;
  const maestro = oc.serieId ? (filas.find((f) => f.id === oc.serieId) ?? null) : null;
  const hijos = maestro ? filas.filter((f) => f.serie_id === maestro.id) : [];
  return { oc, maestro, hijos };
}

describe("cambiar una ocurrencia de una serie", () => {
  const gimnasio = () => ev({ titulo: "Gimnasio", inicio: "2026-10-05T19:00", fin: "2026-10-05T20:00", repeticion: { frecuencia: "semanal", dias: [0, 2] } });
  const V = ["2026-10-05", "2026-10-26"] as const;

  it("un evento suelto se edita directamente", () => {
    const e = ev({ titulo: "Dentista" });
    const p = planEditar({ oc: expandir([e], "2026-10-22", "2026-10-23")[0], maestro: null, hijos: [] }, { titulo: "Dentista (cambiado)", inicio: "2026-10-22T12:00:00", fin: "2026-10-22T13:00:00" }, "todas", id);
    expect(p.guardar).toHaveLength(1);
    expect(p.guardar[0]).toMatchObject({ id: e.id, titulo: "Dentista (cambiado)", inicio: "2026-10-22T12:00", fin: "2026-10-22T13:00" });
  });

  it("solo esta: cambia el título de una ocurrencia y el resto queda igual", () => {
    const g = gimnasio();
    const ctx = contexto([g], ...V, "2026-10-12");
    const filas = aplicar([g], planEditar(ctx, { titulo: "Gimnasio (piernas)" }, "esta", id));
    const r = resumen(filas, ...V);
    expect(r).toContain("10-12 19:00 Gimnasio (piernas)");
    expect(r.filter((x) => x.endsWith("Gimnasio"))).toHaveLength(5);
    expect(r).toHaveLength(6);
  });

  it("solo esta: mover una ocurrencia a otro día y hora deja el hueco vacío", () => {
    const g = gimnasio();
    const ctx = contexto([g], ...V, "2026-10-14");
    const filas = aplicar([g], planEditar(ctx, { inicio: "2026-10-15T10:00", fin: "2026-10-15T11:00" }, "esta", id));
    const r = resumen(filas, ...V);
    expect(r).toContain("10-15 10:00 Gimnasio");
    expect(r).not.toContain("10-14 19:00 Gimnasio");
    expect(r).toHaveLength(6);
  });

  it("volver a cambiar una excepción solo modifica esa fila", () => {
    const g = gimnasio();
    let filas = aplicar([g], planEditar(contexto([g], ...V, "2026-10-12"), { titulo: "X" }, "esta", id));
    const p = planEditar(contexto(filas, ...V, "2026-10-12"), { titulo: "Y" }, "esta", id);
    expect(p.guardar).toHaveLength(1);
    filas = aplicar(filas, p);
    expect(resumen(filas, ...V)).toContain("10-12 19:00 Y");
    expect(filas.filter((f) => f.serie_id)).toHaveLength(1);
  });

  it("todas: cambiar el título afecta a todas, también a las ya pasadas", () => {
    const g = gimnasio();
    const filas = aplicar([g], planEditar(contexto([g], ...V, "2026-10-19"), { titulo: "Entreno" }, "todas", id));
    expect(resumen(filas, ...V).every((x) => x.endsWith("Entreno"))).toBe(true);
    expect(resumen(filas, ...V)).toHaveLength(6);
  });

  it("todas: mover una ocurrencia una hora más tarde mueve toda la serie una hora", () => {
    const g = gimnasio();
    const filas = aplicar([g], planEditar(contexto([g], ...V, "2026-10-19"), { inicio: "2026-10-19T20:00", fin: "2026-10-19T21:00" }, "todas", id));
    const r = resumen(filas, ...V);
    expect(r.every((x) => x.includes("20:00"))).toBe(true);
    expect(r).toHaveLength(6);
  });

  it("todas: mover una ocurrencia un día después desplaza también los días de la semana elegidos", () => {
    const g = gimnasio();
    // lunes 19 → martes 20: la serie pasa a martes y jueves
    const filas = aplicar([g], planEditar(contexto([g], ...V, "2026-10-19"), { inicio: "2026-10-20T19:00", fin: "2026-10-20T20:00" }, "todas", id));
    const r = resumen(filas, ...V);
    expect(r[0]).toBe("10-06 19:00 Gimnasio"); // el primer lunes (5) pasa al martes 6
    expect(r).toContain("10-08 19:00 Gimnasio");
    expect(r.some((x) => x.startsWith("10-12"))).toBe(false);
  });

  it("todas: estirar la duración cambia el final de todas", () => {
    const g = gimnasio();
    const filas = aplicar([g], planEditar(contexto([g], ...V, "2026-10-12"), { fin: "2026-10-12T21:30" }, "todas", id));
    const o = expandir(filas, ...V);
    expect(o.every((x) => minutosEntre(x.inicio, x.fin) === 150)).toBe(true);
  });

  it("todas: las excepciones se conservan y se mueven con la serie", () => {
    const g = gimnasio();
    let filas = aplicar([g], planEditar(contexto([g], ...V, "2026-10-14"), { titulo: "Especial" }, "esta", id));
    filas = aplicar(filas, planEditar(contexto(filas, ...V, "2026-10-19"), { inicio: "2026-10-20T19:00", fin: "2026-10-20T20:00" }, "todas", id));
    const r = resumen(filas, ...V);
    expect(r.filter((x) => x.endsWith("Especial"))).toHaveLength(1);
    expect(r).toHaveLength(6);
  });

  it("este y los siguientes: la serie se divide y los límites se reparten", () => {
    const g = { ...gimnasio(), repeticion: { frecuencia: "semanal", dias: [0, 2], veces: 6 } as Repeticion }; // 5, 7, 12, 14, 19, 21
    const plan = planEditar(contexto([g], ...V, "2026-10-19"), { titulo: "Nuevo plan" }, "siguientes", id);
    expect(plan.guardar).toHaveLength(2);
    const [antiguo, nueva] = plan.guardar;
    expect(antiguo.repeticion).toMatchObject({ hasta: "2026-10-18", veces: null });
    expect(nueva.repeticion).toMatchObject({ veces: 2 }); // 6 menos las 4 anteriores
    expect(nueva.id).not.toBe(g.id);
    const r = resumen(aplicar([g], plan), "2026-10-05", "2026-11-30");
    expect(r).toEqual(["10-05 19:00 Gimnasio", "10-07 19:00 Gimnasio", "10-12 19:00 Gimnasio", "10-14 19:00 Gimnasio", "10-19 19:00 Nuevo plan", "10-21 19:00 Nuevo plan"]);
  });

  it("este y los siguientes: las excepciones posteriores pasan a la serie nueva y las omitidas se reparten", () => {
    const g = gimnasio();
    let filas = aplicar([g], planEditar(contexto([g], ...V, "2026-10-21"), { titulo: "Excepción" }, "esta", id));
    filas = aplicar(filas, planEliminar(contexto(filas, ...V, "2026-10-14"), "esta"));
    const plan = planEditar(contexto(filas, ...V, "2026-10-19"), { titulo: "Nuevo" }, "siguientes", id);
    filas = aplicar(filas, plan);
    const nueva = plan.guardar.find((f) => f.titulo === "Nuevo")!;
    expect(filas.find((f) => f.titulo === "Excepción")!.serie_id).toBe(nueva.id);
    const r = resumen(filas, ...V);
    expect(r).not.toContain("10-14 19:00 Gimnasio"); // sigue omitida en la serie antigua
    expect(r).toContain("10-21 19:00 Excepción");
    expect(r).toContain("10-19 19:00 Nuevo");
  });

  it("este y los siguientes desde la primera ocurrencia equivale a todas", () => {
    const g = gimnasio();
    const plan = planEditar(contexto([g], ...V, "2026-10-05"), { titulo: "Todo" }, "siguientes", id);
    expect(plan.guardar).toHaveLength(1);
    expect(plan.guardar[0].id).toBe(g.id);
  });

  it("tarea repetida: marcar una como hecha no marca las demás", () => {
    const t = ev({ tipo: "tarea", titulo: "Tomar vitamina", inicio: "2026-10-19T09:00", fin: "2026-10-19T09:00", repeticion: { frecuencia: "diaria" } });
    let filas = aplicar([t], planEditar(contexto([t], "2026-10-19", "2026-10-23", "2026-10-20"), { hecho: true }, "esta", id));
    const o = expandir(filas, "2026-10-19", "2026-10-23");
    expect(o.map((x) => x.hecho)).toEqual([false, true, false, false]);
    filas = aplicar(filas, planEditar(contexto(filas, "2026-10-19", "2026-10-23", "2026-10-20"), { hecho: false }, "esta", id));
    expect(expandir(filas, "2026-10-19", "2026-10-23").map((x) => x.hecho)).toEqual([false, false, false, false]);
  });
});

describe("borrar una ocurrencia de una serie", () => {
  const gimnasio = () => ev({ titulo: "Gimnasio", inicio: "2026-10-05T19:00", fin: "2026-10-05T20:00", repeticion: { frecuencia: "semanal", dias: [0, 2] } });
  const V = ["2026-10-05", "2026-10-26"] as const;

  it("un evento suelto se borra", () => {
    const e = ev();
    expect(planEliminar({ oc: expandir([e], "2026-10-22", "2026-10-23")[0], maestro: null, hijos: [] }, "todas")).toEqual({ guardar: [], eliminar: [e.id] });
  });

  it("solo este: la ocurrencia desaparece y las demás siguen", () => {
    const g = gimnasio();
    const filas = aplicar([g], planEliminar(contexto([g], ...V, "2026-10-12"), "esta"));
    expect(resumen(filas, ...V)).toHaveLength(5);
    expect(resumen(filas, ...V)).not.toContain("10-12 19:00 Gimnasio");
  });

  it("este y los siguientes: la serie termina el día anterior y se quitan las excepciones posteriores", () => {
    const g = gimnasio();
    let filas = aplicar([g], planEditar(contexto([g], ...V, "2026-10-21"), { titulo: "Excepción" }, "esta", id));
    const plan = planEliminar(contexto(filas, ...V, "2026-10-19"), "siguientes");
    filas = aplicar(filas, plan);
    expect(resumen(filas, "2026-10-05", "2026-12-01")).toEqual(["10-05 19:00 Gimnasio", "10-07 19:00 Gimnasio", "10-12 19:00 Gimnasio", "10-14 19:00 Gimnasio"]);
    expect(filas.some((f) => f.serie_id)).toBe(false);
  });

  it("todas: se borra la serie y sus excepciones", () => {
    const g = gimnasio();
    let filas = aplicar([g], planEditar(contexto([g], ...V, "2026-10-12"), { titulo: "Excepción" }, "esta", id));
    const plan = planEliminar(contexto(filas, ...V, "2026-10-19"), "todas");
    expect(plan.eliminar).toHaveLength(2);
    filas = aplicar(filas, plan);
    expect(filas).toHaveLength(0);
  });

  it("borrar una excepción: se quita la fila y el día original sigue omitido", () => {
    const g = gimnasio();
    let filas = aplicar([g], planEditar(contexto([g], ...V, "2026-10-12"), { titulo: "Excepción" }, "esta", id));
    filas = aplicar(filas, planEliminar(contexto(filas, ...V, "2026-10-12"), "esta"));
    expect(resumen(filas, ...V)).toHaveLength(5);
    expect(filas).toHaveLength(1);
  });
});

describe("deshacer", () => {
  const gym = () => ev({ titulo: "Gimnasio", inicio: "2026-10-05T19:00", fin: "2026-10-05T20:00", repeticion: { frecuencia: "semanal" } });
  const V = ["2026-10-05", "2026-10-26"] as const;

  it("deshacer borrar un evento suelto lo devuelve", () => {
    const e = ev({ titulo: "Dentista" });
    const plan = planEliminar({ oc: expandir([e], "2026-10-22", "2026-10-23")[0], maestro: null, hijos: [] }, "todas");
    const despues = aplicarPlan([e], plan);
    expect(despues).toHaveLength(0);
    expect(aplicarPlan(despues, inversoDe(plan, [e]))).toEqual([e]);
  });

  it("deshacer cambiar una ocurrencia quita la excepción y deja la serie como estaba", () => {
    const g = gym();
    const plan = planEditar(contexto([g], ...V, "2026-10-12"), { titulo: "Cambiada" }, "esta", id);
    const despues = aplicarPlan([g], plan);
    expect(despues).toHaveLength(2);
    const atras = aplicarPlan(despues, inversoDe(plan, [g]));
    expect(atras).toEqual([g]);
    expect(resumen(atras, ...V).every((x) => x.endsWith("Gimnasio"))).toBe(true);
  });

  it("deshacer borrar una serie con excepciones recupera todo", () => {
    const g = gym();
    const conExc = aplicarPlan([g], planEditar(contexto([g], ...V, "2026-10-12"), { titulo: "Exc" }, "esta", id));
    const plan = planEliminar(contexto(conExc, ...V, "2026-10-19"), "todas");
    const despues = aplicarPlan(conExc, plan);
    expect(despues).toHaveLength(0);
    const atras = aplicarPlan(despues, inversoDe(plan, conExc));
    expect(atras).toHaveLength(2);
    expect(resumen(atras, ...V)).toEqual(resumen(conExc, ...V));
  });

  it("deshacer «este y los siguientes» une otra vez la serie", () => {
    const g = gym();
    const plan = planEditar(contexto([g], ...V, "2026-10-19"), { titulo: "Nuevo" }, "siguientes", id);
    const despues = aplicarPlan([g], plan);
    expect(despues).toHaveLength(2);
    const atras = aplicarPlan(despues, inversoDe(plan, [g]));
    expect(atras).toEqual([g]);
  });
});

describe("alinear series", () => {
  it("una serie que ya no incluye su día de inicio empieza en la primera ocurrencia real", () => {
    const s = ev({ titulo: "Gimnasio", inicio: "2026-10-14T19:00", fin: "2026-10-14T20:30", repeticion: { frecuencia: "semanal", dias: [0] } }); // empieza un miércoles pero solo es lunes
    const [a] = alinearSeries({ guardar: [s], eliminar: [] }).guardar;
    expect(a.inicio).toBe("2026-10-19T19:00");
    expect(a.fin).toBe("2026-10-19T20:30");
    expect(alinearSeries({ guardar: [a], eliminar: [] }).guardar[0]).toEqual(a); // repetirlo no cambia nada
  });
  it("no toca lo que no es una serie ni las excepciones", () => {
    const suelto = ev({});
    const exc = ev({ serie_id: "x", serie_original: "2026-10-12" });
    expect(alinearSeries({ guardar: [suelto, exc], eliminar: ["z"] })).toEqual({ guardar: [suelto, exc], eliminar: ["z"] });
  });
});

describe("capas de solo lectura", () => {
  it("un plazo fiscal se ve como evento de todo el día y no es editable", () => {
    const o = ocurrenciaExterna({ id: "p1", fecha: "2026-10-20", titulo: "Modelo 303", capa: "fiscal", color: "cian", detalle: "IVA 3T" });
    expect(o).toMatchObject({ soloLectura: true, capa: "fiscal", todoElDia: true, titulo: "Modelo 303", inicio: "2026-10-20T00:00", fin: "2026-10-21T00:00" });
    expect(expandir([], "2026-10-19", "2026-10-26")).toEqual([]);
    expect(diasQueOcupa(o)).toEqual(["2026-10-20"]);
  });
});

describe("crear, avisos y textos", () => {
  it("valores por defecto: una hora, todo el día hasta el día siguiente, tareas sin duración", () => {
    const e = nuevoEvento("u", "x", { titulo: "  Comida  ", inicio: "2026-10-22T14:00" });
    expect(e).toMatchObject({ titulo: "Comida", fin: "2026-10-22T15:00", tipo: "evento", color: "azul", hecho: false, repeticion: null });
    const d = nuevoEvento("u", "x", { titulo: "Cumple", inicio: "2026-10-25T09:30", todo_el_dia: true });
    expect(d).toMatchObject({ inicio: "2026-10-25T00:00", fin: "2026-10-26T00:00", todo_el_dia: true });
    const t = nuevoEvento("u", "x", { titulo: "Pagar", inicio: "2026-10-25T09:30", tipo: "tarea" });
    expect(t.fin).toBe(t.inicio);
  });

  it("momento del aviso: antes del inicio; en los de todo el día, desde las 09:00", () => {
    const a = expandir([ev({ inicio: "2026-10-22T10:00", fin: "2026-10-22T11:00", recordatorio_min: 30 })], "2026-10-22", "2026-10-23")[0];
    expect(momentoDeAviso(a)).toBe("2026-10-22T09:30");
    const b = expandir([ev({ todo_el_dia: true, inicio: "2026-10-25T00:00", fin: "2026-10-26T00:00", recordatorio_min: 1440 })], "2026-10-25", "2026-10-26")[0];
    expect(momentoDeAviso(b)).toBe("2026-10-24T09:00");
    expect(momentoDeAviso(expandir([ev()], "2026-10-22", "2026-10-23")[0])).toBeNull();
  });

  it("avisos pendientes en un intervalo, sin tareas ya hechas", () => {
    const e1 = ev({ titulo: "e1", inicio: "2026-10-22T10:00", fin: "2026-10-22T11:00", recordatorio_min: 10 });
    const e2 = ev({ titulo: "e2", inicio: "2026-10-22T10:30", fin: "2026-10-22T11:00", recordatorio_min: 10 });
    const t = ev({ titulo: "t", tipo: "tarea", hecho: true, inicio: "2026-10-22T10:00", fin: "2026-10-22T10:00", recordatorio_min: 10 });
    const ocs = expandir([e1, e2, t], "2026-10-22", "2026-10-23");
    expect(avisosPendientes(ocs, "2026-10-22T09:49", "2026-10-22T09:50").map((o) => o.titulo)).toEqual(["e1"]);
    expect(avisosPendientes(ocs, "2026-10-22T09:50", "2026-10-22T10:20").map((o) => o.titulo)).toEqual(["e2"]); // el límite inferior no se incluye
  });

  it("texto de cuándo", () => {
    const f = (o: Partial<EventoRow>) => expandir([ev(o)], "2026-10-01", "2026-12-01")[0];
    expect(textoCuando(f({}))).toBe("Jueves, 22 de octubre · 10:00 – 11:00");
    expect(textoCuando(f({ todo_el_dia: true, inicio: "2026-10-22T00:00", fin: "2026-10-23T00:00" }))).toBe("Jueves, 22 de octubre");
    expect(textoCuando(f({ todo_el_dia: true, inicio: "2026-10-22T00:00", fin: "2026-10-25T00:00" }))).toBe("22 – 24 de octubre");
    expect(textoCuando(f({ todo_el_dia: true, inicio: "2026-10-30T00:00", fin: "2026-11-03T00:00" }))).toBe("30 oct – 2 nov");
  });

  it("texto de repetición", () => {
    const i = "2026-10-22T10:00";
    expect(textoRepeticion(null, i)).toBe("No se repite");
    expect(textoRepeticion({ frecuencia: "diaria" }, i)).toBe("Todos los días");
    expect(textoRepeticion({ frecuencia: "diaria", intervalo: 3 }, i)).toBe("Cada 3 días");
    expect(textoRepeticion({ frecuencia: "semanal" }, i)).toBe("Todas las semanas los jueves");
    expect(textoRepeticion({ frecuencia: "semanal", dias: [0, 2, 4] }, i)).toBe("Todas las semanas los lunes, miércoles y viernes");
    expect(textoRepeticion({ frecuencia: "semanal", intervalo: 2, dias: [0] }, i)).toBe("Cada 2 semanas los lunes");
    expect(textoRepeticion({ frecuencia: "mensual" }, i)).toBe("Todos los meses, el día 22");
    expect(textoRepeticion({ frecuencia: "mensual", por: "semana" }, i)).toBe("Todos los meses, el cuarto jueves");
    expect(textoRepeticion({ frecuencia: "anual" }, i)).toBe("Todos los años, el 22 de octubre");
    expect(textoRepeticion({ frecuencia: "diaria", hasta: "2026-12-31" }, i)).toBe("Todos los días, hasta el 31 de diciembre de 2026");
    expect(textoRepeticion({ frecuencia: "diaria", veces: 5 }, i)).toBe("Todos los días, 5 veces");
  });
});
