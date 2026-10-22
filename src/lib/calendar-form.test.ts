import { describe, expect, it } from "vitest";
import { expandir, nuevoEvento } from "./calendar";
import {
  aplicarInterpretacion,
  borradorACambios,
  borradorDesdeOcurrencia,
  borradorNuevo,
  claveDeRepeticion,
  describirInterpretacion,
  moverInicio,
  opcionesRepeticion,
  siguienteHoraRedonda,
  validarBorrador,
} from "./calendar-form";
import { interpretarTexto } from "./calendar-quick";

const AHORA = new Date(2026, 9, 22, 10, 0); // jueves 22 de octubre de 2026

describe("borrador nuevo", () => {
  it("hora redonda siguiente, también cerca de medianoche", () => {
    expect(siguienteHoraRedonda("2026-10-22T10:25")).toEqual({ fecha: "2026-10-22", hora: "11:00" });
    expect(siguienteHoraRedonda("2026-10-22T23:40")).toEqual({ fecha: "2026-10-23", hora: "00:00" });
  });

  it("por defecto dura una hora", () => {
    const b = borradorNuevo({ fecha: "2026-10-22", hora: "14:00" });
    expect(b).toMatchObject({ fechaIni: "2026-10-22", horaIni: "14:00", fechaFin: "2026-10-22", horaFin: "15:00", tipo: "evento", todoElDia: false, color: "azul" });
  });

  it("una hora a las 23:30 termina al día siguiente", () => {
    const b = borradorNuevo({ fecha: "2026-10-22", hora: "23:30" });
    expect(b).toMatchObject({ fechaFin: "2026-10-23", horaFin: "00:30" });
  });

  it("al cambiar el inicio, el final se mueve y se mantiene la duración", () => {
    const b = borradorNuevo({ fecha: "2026-10-22", hora: "10:00", duracionMin: 90 });
    const m = moverInicio(b, "2026-10-23", "15:00");
    expect(m).toMatchObject({ fechaIni: "2026-10-23", horaIni: "15:00", fechaFin: "2026-10-23", horaFin: "16:30" });
    const noche = moverInicio(b, "2026-10-22", "23:00");
    expect(noche).toMatchObject({ fechaFin: "2026-10-23", horaFin: "00:30" });
  });

  it("en un evento de todo el día se mueven los dos días a la vez", () => {
    const b = { ...borradorNuevo({ fecha: "2026-10-22" }), todoElDia: true, fechaFin: "2026-10-24" };
    expect(moverInicio(b, "2026-11-01", b.horaIni)).toMatchObject({ fechaIni: "2026-11-01", fechaFin: "2026-11-03" });
  });
});

describe("validación", () => {
  const ok = () => ({ ...borradorNuevo({ fecha: "2026-10-22", hora: "10:00" }), titulo: "Dentista" });
  it("lo normal es válido", () => expect(validarBorrador(ok())).toBeNull());
  it("título obligatorio", () => {
    expect(validarBorrador({ ...ok(), titulo: "   " })).toBe("Ponle un título.");
    expect(validarBorrador({ ...ok(), titulo: "x".repeat(201) })).toMatch(/demasiado largo/);
  });
  it("el final debe ser posterior al inicio", () => {
    expect(validarBorrador({ ...ok(), horaFin: "10:00" })).toMatch(/posterior/);
    expect(validarBorrador({ ...ok(), horaFin: "09:00" })).toMatch(/posterior/);
    expect(validarBorrador({ ...ok(), fechaFin: "2026-10-21" })).toMatch(/posterior/);
  });
  it("todo el día: el último día no puede ser anterior", () => {
    expect(validarBorrador({ ...ok(), todoElDia: true, fechaFin: "2026-10-21" })).toMatch(/último día/);
    expect(validarBorrador({ ...ok(), todoElDia: true, fechaFin: "2026-10-22" })).toBeNull();
  });
  it("fechas y horas escritas a mano", () => {
    expect(validarBorrador({ ...ok(), fechaIni: "mañana" })).toMatch(/fecha de inicio/);
    expect(validarBorrador({ ...ok(), horaIni: "25:00" })).toMatch(/hora de inicio/);
  });
  it("repeticiones: sin días, termina antes de empezar, demasiadas veces", () => {
    expect(validarBorrador({ ...ok(), repeticion: { frecuencia: "semanal", dias: [] } })).toMatch(/al menos un día/);
    expect(validarBorrador({ ...ok(), repeticion: { frecuencia: "diaria", hasta: "2026-10-01" } })).toMatch(/antes de empezar/);
    expect(validarBorrador({ ...ok(), repeticion: { frecuencia: "diaria", veces: 5000 } })).toMatch(/entre 1 y 999/);
    expect(validarBorrador({ ...ok(), repeticion: { frecuencia: "diaria", intervalo: 0 } })).toMatch(/entre 1 y 99/);
  });
  it("una tarea sin hora no pide hora ni final", () => {
    const t = { ...ok(), tipo: "tarea" as const, conHora: false, horaIni: "", horaFin: "", fechaFin: "" };
    expect(validarBorrador(t)).toBeNull();
  });
});

describe("del borrador al evento", () => {
  it("evento con horas", () => {
    const c = borradorACambios({ ...borradorNuevo({ fecha: "2026-10-22", hora: "10:00" }), titulo: "  Dentista  ", ubicacion: " Clínica ", descripcion: "" });
    expect(c).toMatchObject({ tipo: "evento", titulo: "Dentista", ubicacion: "Clínica", descripcion: null, todo_el_dia: false, inicio: "2026-10-22T10:00", fin: "2026-10-22T11:00", prioridad: null });
  });

  it("todo el día: fin exclusivo, a las 00:00 del día siguiente al último", () => {
    const c = borradorACambios({ ...borradorNuevo({ fecha: "2026-10-22" }), titulo: "Viaje", todoElDia: true, fechaFin: "2026-10-24" });
    expect(c).toMatchObject({ todo_el_dia: true, inicio: "2026-10-22T00:00", fin: "2026-10-25T00:00" });
  });

  it("tarea sin hora: todo el día; con hora: sin duración", () => {
    const base = { ...borradorNuevo({ fecha: "2026-10-22", hora: "09:30", tipo: "tarea" }), titulo: "Pagar" };
    expect(borradorACambios({ ...base, conHora: false, prioridad: "urgente" })).toMatchObject({ todo_el_dia: true, inicio: "2026-10-22T00:00", fin: "2026-10-23T00:00", prioridad: "urgente" });
    expect(borradorACambios({ ...base, conHora: true })).toMatchObject({ todo_el_dia: false, inicio: "2026-10-22T09:30", fin: "2026-10-22T09:30" });
  });

  it("una serie semanal cuyo primer día no coincide empieza en la primera ocurrencia real", () => {
    // jueves 22: se repite los lunes y miércoles -> el primero es el lunes 26
    const b = { ...borradorNuevo({ fecha: "2026-10-22", hora: "19:00" }), titulo: "Gimnasio", repeticion: { frecuencia: "semanal" as const, dias: [0, 2] } };
    const c = borradorACambios(b);
    expect(c).toMatchObject({ inicio: "2026-10-26T19:00", fin: "2026-10-26T20:00" });
    const fila = nuevoEvento("u", "x", { titulo: c.titulo!, inicio: c.inicio!, fin: c.fin, repeticion: c.repeticion });
    expect(expandir([fila], "2026-10-22", "2026-10-29").map((o) => o.inicio)).toEqual(["2026-10-26T19:00", "2026-10-28T19:00"]);
  });

  it("ida y vuelta: editar una ocurrencia reproduce el mismo evento", () => {
    const fila = nuevoEvento("u", "x", { titulo: "Cena", inicio: "2026-10-22T21:00", fin: "2026-10-22T22:30", ubicacion: "Casa", color: "rojo", recordatorio_min: 30 });
    const oc = expandir([fila], "2026-10-22", "2026-10-23")[0];
    const c = borradorACambios(borradorDesdeOcurrencia(oc));
    expect(c).toMatchObject({ titulo: "Cena", inicio: fila.inicio, fin: fila.fin, ubicacion: "Casa", color: "rojo", recordatorio_min: 30, todo_el_dia: false });
    const dia = nuevoEvento("u", "y", { titulo: "Viaje", inicio: "2026-10-22T00:00", fin: "2026-10-25T00:00", todo_el_dia: true });
    const oc2 = expandir([dia], "2026-10-22", "2026-10-30")[0];
    const b2 = borradorDesdeOcurrencia(oc2);
    expect(b2).toMatchObject({ todoElDia: true, fechaIni: "2026-10-22", fechaFin: "2026-10-24" });
    expect(borradorACambios(b2)).toMatchObject({ inicio: "2026-10-22T00:00", fin: "2026-10-25T00:00" });
  });

  it("al editar una excepción se muestra la repetición de su serie", () => {
    const serie = nuevoEvento("u", "s", { titulo: "Gimnasio", inicio: "2026-10-05T19:00", repeticion: { frecuencia: "semanal" } });
    const exc = nuevoEvento("u", "e", { titulo: "Gimnasio", inicio: "2026-10-12T18:00", serie_id: "s", serie_original: "2026-10-12" });
    const oc = expandir([serie, exc], "2026-10-12", "2026-10-13")[0];
    expect(borradorDesdeOcurrencia(oc, serie).repeticion).toEqual({ frecuencia: "semanal" });
  });
});

describe("opciones de repetición", () => {
  it("se adaptan al día elegido", () => {
    const o = Object.fromEntries(opcionesRepeticion("2026-10-22").map((x) => [x.clave, x.etiqueta]));
    expect(o.no).toBe("No se repite");
    expect(o.semanal).toBe("Todas las semanas el jueves");
    expect(o.mensual_dia).toBe("Todos los meses el día 22");
    expect(o.mensual_semana).toBe("Todos los meses el cuarto jueves");
    expect(o.anual).toBe("Todos los años el 22 de octubre");
    expect(Object.keys(o)).toContain("laborables");
    expect(opcionesRepeticion("2026-10-30").find((x) => x.clave === "mensual_semana")!.etiqueta).toBe("Todos los meses el último viernes");
  });

  it("de una repetición a su opción, o personalizada", () => {
    const f = "2026-10-22";
    expect(claveDeRepeticion(null, f)).toBe("no");
    expect(claveDeRepeticion({ frecuencia: "diaria" }, f)).toBe("diaria");
    expect(claveDeRepeticion({ frecuencia: "semanal" }, f)).toBe("semanal");
    expect(claveDeRepeticion({ frecuencia: "semanal", dias: [3] }, f)).toBe("semanal");
    expect(claveDeRepeticion({ frecuencia: "semanal", dias: [0, 1, 2, 3, 4] }, f)).toBe("laborables");
    expect(claveDeRepeticion({ frecuencia: "semanal", dias: [0, 2] }, f)).toBe("personalizada");
    expect(claveDeRepeticion({ frecuencia: "mensual", por: "semana" }, f)).toBe("mensual_semana");
    expect(claveDeRepeticion({ frecuencia: "mensual" }, f)).toBe("mensual_dia");
    expect(claveDeRepeticion({ frecuencia: "diaria", intervalo: 2 }, f)).toBe("personalizada");
    expect(claveDeRepeticion({ frecuencia: "diaria", hasta: "2026-12-31" }, f)).toBe("personalizada");
  });
});

describe("de la frase escrita al borrador", () => {
  const aplicar = (frase: string, base = borradorNuevo({ fecha: "2026-10-22", hora: "09:00" })) => aplicarInterpretacion(base, interpretarTexto(frase, AHORA));

  it("«Dentista mañana a las 10:30»", () => {
    expect(aplicar("Dentista mañana a las 10:30")).toMatchObject({ titulo: "Dentista", fechaIni: "2026-10-23", horaIni: "10:30", fechaFin: "2026-10-23", horaFin: "11:30", todoElDia: false });
  });

  it("con rango de horas", () => {
    expect(aplicar("Reunión el lunes de 16 a 17:30")).toMatchObject({ fechaIni: "2026-10-26", horaIni: "16:00", horaFin: "17:30" });
  });

  it("todo el día", () => {
    expect(aplicar("Cumple de Marta 15/03 todo el día")).toMatchObject({ titulo: "Cumple de Marta", todoElDia: true, fechaIni: "2027-03-15", fechaFin: "2027-03-15" });
  });

  it("solo un día: conserva la hora que tenía", () => {
    expect(aplicar("Llamar a Pedro el lunes", borradorNuevo({ fecha: "2026-10-22", hora: "18:00" }))).toMatchObject({ fechaIni: "2026-10-26", horaIni: "18:00", horaFin: "19:00" });
  });

  it("tarea y repetición", () => {
    const b = aplicar("tarea: regar plantas todos los días");
    expect(b).toMatchObject({ tipo: "tarea", titulo: "Regar plantas", repeticion: { frecuencia: "diaria" } });
    expect(aplicar("Gimnasio los lunes y miércoles a las 19").repeticion).toEqual({ frecuencia: "semanal", dias: [0, 2] });
  });

  it("una hora que termina antes pasa al día siguiente", () => {
    expect(aplicar("Turno de 22 a 6")).toMatchObject({ fechaIni: "2026-10-22", horaIni: "22:00", fechaFin: "2026-10-23", horaFin: "06:00" });
  });

  it("sin nada reconocible, deja el borrador como estaba (con el título)", () => {
    const base = borradorNuevo({ fecha: "2026-10-22", hora: "09:00" });
    expect(aplicar("Pensar en las vacaciones")).toMatchObject({ titulo: "Pensar en las vacaciones", fechaIni: base.fechaIni, horaIni: base.horaIni });
  });
});

describe("lo que se ha entendido, para enseñarlo", () => {
  const d = (f: string) => describirInterpretacion(interpretarTexto(f, AHORA), "2026-10-22");
  it("día, hora y repetición en frases cortas", () => {
    expect(d("Dentista mañana 10:30")).toEqual(["Mañana, 23 oct", "10:30"]);
    expect(d("Reunión el lunes de 16 a 17")).toEqual(["Lunes, 26 oct", "16:00 – 17:00"]);
    expect(d("Cumple 15/03 todo el día")).toEqual(["Lunes, 15 mar", "Todo el día"]);
    expect(d("Gimnasio todos los lunes y miércoles a las 19")).toEqual(["Lunes, 26 oct", "19:00", "Todas las semanas los lunes y miércoles"]);
    expect(d("tarea: pagar IVA hoy")).toEqual(["Tarea", "Hoy, 22 oct"]);
    expect(d("Pensar en las vacaciones")).toEqual([]);
  });
});
