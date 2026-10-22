import { describe, expect, it } from "vitest";
import { interpretarTexto } from "./calendar-quick";

// Jueves 22 de octubre de 2026, 10:00
const AHORA = new Date(2026, 9, 22, 10, 0);
const q = (t: string) => interpretarTexto(t, AHORA);

describe("interpretarTexto: fechas y horas", () => {
  it("«Dentista mañana 10:30»", () => {
    expect(q("Dentista mañana 10:30")).toMatchObject({ titulo: "Dentista", fecha: "2026-10-23", horaInicio: "10:30", horaFin: null, todoElDia: false, repeticion: null, tipo: null });
  });

  it("hoy, mañana y pasado mañana", () => {
    expect(q("Comprar pan hoy").fecha).toBe("2026-10-22");
    expect(q("Comprar pan mañana").fecha).toBe("2026-10-23");
    expect(q("Pasado mañana dentista")).toMatchObject({ fecha: "2026-10-24", titulo: "Dentista" });
  });

  it("día de la semana: el próximo (si es hoy, el de la semana que viene)", () => {
    expect(q("Reunión el lunes").fecha).toBe("2026-10-26");
    expect(q("Reunión el jueves").fecha).toBe("2026-10-29");
    expect(q("Reunión el próximo viernes").fecha).toBe("2026-10-23");
    expect(q("Reunión el domingo").fecha).toBe("2026-10-25");
  });

  it("rango de horas: «de 16 a 17» y «16-17h» y «de 16:00 a 17:30»", () => {
    expect(q("Reunión el lunes de 16 a 17")).toMatchObject({ titulo: "Reunión", fecha: "2026-10-26", horaInicio: "16:00", horaFin: "17:00" });
    expect(q("Clase 16-17h")).toMatchObject({ titulo: "Clase", horaInicio: "16:00", horaFin: "17:00" });
    expect(q("Reunión de 16:00 a 17:30")).toMatchObject({ horaInicio: "16:00", horaFin: "17:30" });
  });

  it("«a las 10», «a las 17:45» y las horas de la tarde o la noche", () => {
    expect(q("Cita a las 10").horaInicio).toBe("10:00");
    expect(q("Cita a las 17:45").horaInicio).toBe("17:45");
    expect(q("Cena a las 9 de la noche")).toMatchObject({ titulo: "Cena", horaInicio: "21:00" });
    expect(q("Merienda a las 5 de la tarde").horaInicio).toBe("17:00");
    expect(q("Desayuno a las 8 de la mañana")).toMatchObject({ titulo: "Desayuno", horaInicio: "08:00", fecha: null });
    expect(q("Médico 9h").horaInicio).toBe("09:00");
  });

  it("«por la mañana» no se confunde con el día de mañana", () => {
    expect(q("Correr por la mañana")).toMatchObject({ titulo: "Correr", fecha: null, horaInicio: "09:00" });
    expect(q("Correr mañana por la mañana")).toMatchObject({ fecha: "2026-10-23", horaInicio: "09:00" });
    expect(q("Cine por la noche").horaInicio).toBe("21:00");
    expect(q("Comer al mediodía").horaInicio).toBe("12:00");
  });

  it("con el mes escrito: «el 30 de octubre», «20 de enero» (si ya pasó, el año que viene)", () => {
    expect(q("Comida con Ana el 30 de octubre a las 14")).toMatchObject({ titulo: "Comida con Ana", fecha: "2026-10-30", horaInicio: "14:00" });
    expect(q("Pagar IVA 20 de enero")).toMatchObject({ titulo: "Pagar IVA", fecha: "2027-01-20" });
    expect(q("Fiesta 24 de diciembre de 2026").fecha).toBe("2026-12-24");
    expect(q("Vacaciones 1 de setiembre").fecha).toBe("2027-09-01");
  });

  it("fechas numéricas: 15/03, 5/11, 24/12/2026", () => {
    expect(q("Cumpleaños de Marta 15/03 todo el día")).toMatchObject({ titulo: "Cumpleaños de Marta", fecha: "2027-03-15", todoElDia: true, horaInicio: null });
    expect(q("Evento 5/11").fecha).toBe("2026-11-05");
    expect(q("Fiesta 24/12/2026").fecha).toBe("2026-12-24");
    expect(q("Fiesta 24/12/26").fecha).toBe("2026-12-24");
  });

  it("«el 5»: el día 5 de este mes o, si ya pasó, del siguiente", () => {
    expect(q("Revisión el 25").fecha).toBe("2026-10-25");
    expect(q("Revisión el 5").fecha).toBe("2026-11-05");
  });

  it("«en 3 días», «dentro de 2 semanas», «en 1 mes»", () => {
    expect(q("Vuelo en 3 días").fecha).toBe("2026-10-25");
    expect(q("Revisión dentro de 2 semanas")).toMatchObject({ titulo: "Revisión", fecha: "2026-11-05" });
    expect(q("Renovar en 1 mes").fecha).toBe("2026-11-22");
  });

  it("fechas imposibles no se aceptan", () => {
    expect(q("Cosa 31 de noviembre").fecha).toBeNull();
    expect(q("Cosa 30/02").fecha).toBeNull();
  });
});

describe("interpretarTexto: repeticiones", () => {
  it("todos los días / cada N días", () => {
    expect(q("Tomar vitamina todos los días a las 9")).toMatchObject({ titulo: "Tomar vitamina", repeticion: { frecuencia: "diaria" }, horaInicio: "09:00", fecha: "2026-10-22" });
    expect(q("Regar cada 3 días").repeticion).toEqual({ frecuencia: "diaria", intervalo: 3 });
  });

  it("varios días de la semana: la primera fecha es la primera coincidencia", () => {
    expect(q("Gimnasio todos los lunes y miércoles a las 19:00")).toMatchObject({
      titulo: "Gimnasio", repeticion: { frecuencia: "semanal", dias: [0, 2] }, fecha: "2026-10-26", horaInicio: "19:00",
    });
    expect(q("Yoga los martes y jueves 18:30")).toMatchObject({ repeticion: { frecuencia: "semanal", dias: [1, 3] }, fecha: "2026-10-22", horaInicio: "18:30" }); // hoy es jueves
    expect(q("Fútbol cada sábado").repeticion).toEqual({ frecuencia: "semanal", dias: [5] });
  });

  it("cada 2 semanas el martes, de lunes a viernes, fines de semana", () => {
    expect(q("Yoga cada 2 semanas el martes")).toMatchObject({ titulo: "Yoga", repeticion: { frecuencia: "semanal", intervalo: 2, dias: [1] }, fecha: "2026-10-27" });
    expect(q("Trabajar de lunes a viernes 9h").repeticion).toEqual({ frecuencia: "semanal", dias: [0, 1, 2, 3, 4] });
    expect(q("Paseo los fines de semana").repeticion).toEqual({ frecuencia: "semanal", dias: [5, 6] });
  });

  it("mensual y anual, con su día", () => {
    expect(q("Pagar alquiler cada mes el 1")).toMatchObject({ titulo: "Pagar alquiler", repeticion: { frecuencia: "mensual" }, fecha: "2026-11-01" });
    expect(q("Cumple de mamá todos los años el 3 de mayo todo el día")).toMatchObject({ repeticion: { frecuencia: "anual" }, fecha: "2027-05-03", todoElDia: true, titulo: "Cumple de mamá" });
  });

  it("hasta una fecha o un número de veces", () => {
    expect(q("Clase todos los lunes hasta el 30 de noviembre")).toMatchObject({ titulo: "Clase", repeticion: { frecuencia: "semanal", dias: [0], hasta: "2026-11-30" } });
    expect(q("Pastilla todos los días 10 veces").repeticion).toEqual({ frecuencia: "diaria", veces: 10 });
  });
});

describe("interpretarTexto: tareas y título", () => {
  it("«tarea: …» crea una tarea", () => {
    expect(q("tarea: comprar pan mañana")).toMatchObject({ tipo: "tarea", titulo: "Comprar pan", fecha: "2026-10-23" });
    expect(q("Recordatorio llamar al banco el lunes")).toMatchObject({ tipo: "tarea", titulo: "Llamar al banco", fecha: "2026-10-26" });
  });

  it("conserva mayúsculas, tildes y nombres propios del título", () => {
    expect(q("Reunión con Ángel mañana a las 12")).toMatchObject({ titulo: "Reunión con Ángel", fecha: "2026-10-23", horaInicio: "12:00" });
  });

  it("limpia conectores sueltos al principio y al final", () => {
    expect(q("Comprar regalo hasta el 24 de diciembre").titulo).toBe("Comprar regalo");
    expect(q("el lunes dentista").titulo).toBe("Dentista");
  });

  it("sin nada reconocible, todo es título", () => {
    expect(q("Pensar en las vacaciones")).toMatchObject({ titulo: "Pensar en las vacaciones", fecha: null, horaInicio: null, repeticion: null, reconocido: [] });
  });

  it("solo una fecha: sin título", () => {
    expect(q("mañana")).toMatchObject({ titulo: "", fecha: "2026-10-23" });
  });

  it("devuelve lo reconocido para mostrarlo al usuario", () => {
    const r = q("Dentista mañana a las 10:30");
    expect(r.reconocido.map((x) => x.clase).sort()).toEqual(["fecha", "hora"]);
  });
});
