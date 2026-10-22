import { describe, expect, it } from "vitest";
import { nuevoEvento, type EventoRow } from "./calendar";
import { avisoPeso, construirHoy, horaDeAgenda, resumenAgenda, resumenComida, resumenEntreno, saludoDe, type DatosHoy } from "./hoy";

// Jueves 22 de octubre de 2026, 10:00
const base = (p: Partial<DatosHoy> = {}): DatosHoy => ({
  fecha: "2026-10-22",
  ahora: "2026-10-22T10:00",
  dia: { nombre_dia: "Brazo", es_dia_entreno: true, ejercicios: 6, habitos: ["movilidad", "caminata"] },
  sesionesHoy: [],
  habitosHechos: [],
  perfil: { kcal_objetivo: 2900, proteina_g: 160, grasa_g: 97, hidratos_g: 350 },
  comidasHoy: [],
  ultimoPeso: { fecha: "2026-10-20", peso_kg: 80 },
  eventos: [],
  pendientes: [],
  ...p,
});
const ev = (o: Partial<EventoRow> & { titulo: string; inicio: string }) => nuevoEvento("u", o.titulo, o);

describe("saludo", () => {
  it("según la hora", () => {
    expect(saludoDe("2026-10-22T05:59")).toBe("Buenas noches");
    expect(saludoDe("2026-10-22T09:00")).toBe("Buenos días");
    expect(saludoDe("2026-10-22T13:00")).toBe("Buenas tardes");
    expect(saludoDe("2026-10-22T21:00")).toBe("Buenas noches");
  });
});

describe("entrenamiento de hoy", () => {
  it("día de entreno sin hacer", () => {
    expect(resumenEntreno(base())).toMatchObject({ estado: "pendiente", titulo: "Hoy toca Brazo", detalle: "6 ejercicios" });
    expect(resumenEntreno(base({ dia: { nombre_dia: "Pull", es_dia_entreno: true, ejercicios: 1, habitos: [] } })).detalle).toBe("1 ejercicio");
  });

  it("ya hecho", () => {
    expect(resumenEntreno(base({ sesionesHoy: [{ completado: true, es_extra: false }] }))).toMatchObject({ estado: "hecho", titulo: "Brazo completado" });
  });

  it("una sesión sin terminar no cuenta como hecha", () => {
    expect(resumenEntreno(base({ sesionesHoy: [{ completado: false, es_extra: false }] })).estado).toBe("pendiente");
  });

  it("día de descanso, con o sin entreno extra", () => {
    const d = { nombre_dia: "Descanso", es_dia_entreno: false, ejercicios: 0, habitos: ["caminata" as const] };
    expect(resumenEntreno(base({ dia: d }))).toMatchObject({ estado: "descanso", titulo: "Hoy toca descanso" });
    expect(resumenEntreno(base({ dia: d, sesionesHoy: [{ completado: true, es_extra: true }] })).estado).toBe("extra_hecho");
  });

  it("sin rutina", () => {
    expect(resumenEntreno(base({ dia: null }))).toMatchObject({ estado: "sin_rutina", habitos: [] });
  });

  it("hábitos del día con su estado", () => {
    const r = resumenEntreno(base({ habitosHechos: ["caminata"] }));
    expect(r.habitos).toEqual([{ tipo: "movilidad", hecho: false }, { tipo: "caminata", hecho: true }]);
  });
});

describe("comidas de hoy", () => {
  const c = (kcal: number, p = 0) => ({ kcal, proteina_g: p, grasa_g: 0, hidratos_g: 0 });

  it("sin registrar nada", () => {
    expect(resumenComida(base())).toMatchObject({ registrado: false, mensaje: "Aún no has registrado nada hoy.", porcentaje: 0 });
  });

  it("lo que queda", () => {
    const r = resumenComida(base({ comidasHoy: [c(1200, 60), c(500, 25)] }));
    expect(r.kcal).toEqual({ objetivo: 2900, consumido: 1700, restante: 1200 });
    expect(r.proteina.restante).toBe(75);
    expect(r.porcentaje).toBe(59);
    expect(r.mensaje).toBe("Te quedan 1200 kcal y 75 g de proteína.");
  });

  it("calorías cubiertas pero falta proteína", () => {
    expect(resumenComida(base({ comidasHoy: [c(2850, 120)] })).mensaje).toBe("Calorías cubiertas. Faltan 40 g de proteína.");
  });

  it("objetivo cumplido", () => {
    expect(resumenComida(base({ comidasHoy: [c(2900, 158)] })).mensaje).toBe("Objetivo de hoy cumplido.");
  });

  it("pasarse de calorías", () => {
    expect(resumenComida(base({ comidasHoy: [c(3300, 170)] })).mensaje).toBe("Te has pasado 400 kcal del objetivo.");
  });

  it("sin objetivos calculados", () => {
    expect(resumenComida(base({ perfil: null })).mensaje).toBe("Calcula tus objetivos en Alimentación.");
    expect(resumenComida(base({ perfil: null, comidasHoy: [c(800)] })).mensaje).toBe("Llevas 800 kcal hoy.");
  });

  it("aviso de peso: cada semana como mucho", () => {
    expect(avisoPeso({ fecha: "2026-10-16", peso_kg: 80 }, "2026-10-22")).toBeNull(); // hace 6 días
    expect(avisoPeso({ fecha: "2026-10-15", peso_kg: 80 }, "2026-10-22")).toBe("Hace 7 días que no te pesas.");
    expect(avisoPeso(null, "2026-10-22")).toBe("Aún no has registrado tu peso.");
    expect(resumenComida(base({ ultimoPeso: { fecha: "2026-10-01", peso_kg: 81 } })).avisoPeso).toBe("Hace 21 días que no te pesas.");
    expect(resumenComida(base({ perfil: null, ultimoPeso: null })).avisoPeso).toBeNull(); // sin objetivos no se molesta
  });
});

describe("agenda de hoy", () => {
  const reunion = ev({ titulo: "Reunión", inicio: "2026-10-22T09:00", fin: "2026-10-22T09:30" });
  const comida = ev({ titulo: "Comida", inicio: "2026-10-22T14:00", fin: "2026-10-22T15:00" });
  const cena = ev({ titulo: "Cena", inicio: "2026-10-22T21:00", fin: "2026-10-22T22:30" });
  const viaje = ev({ titulo: "Viaje", todo_el_dia: true, inicio: "2026-10-21T00:00", fin: "2026-10-24T00:00" });
  const manana = ev({ titulo: "Mañana", inicio: "2026-10-23T10:00", fin: "2026-10-23T11:00" });

  it("solo lo de hoy, con lo de todo el día primero", () => {
    const r = resumenAgenda(base({ eventos: [cena, manana, comida, viaje, reunion] }));
    expect(r.eventos.map((e) => e.titulo)).toEqual(["Viaje", "Reunión", "Comida", "Cena"]);
  });

  it("el siguiente es el próximo con hora que no ha terminado", () => {
    expect(resumenAgenda(base({ eventos: [reunion, comida, cena] })).siguiente?.titulo).toBe("Comida"); // la reunión ya acabó a las 9:30
    expect(resumenAgenda(base({ ahora: "2026-10-22T14:30", eventos: [reunion, comida, cena] })).siguiente?.titulo).toBe("Comida"); // en curso
    expect(resumenAgenda(base({ ahora: "2026-10-22T23:00", eventos: [reunion, comida, cena] })).siguiente).toBeNull();
    expect(resumenAgenda(base({ eventos: [viaje] })).siguiente).toBeNull(); // un evento de todo el día no es «lo siguiente»
  });

  it("una serie que cae hoy aparece", () => {
    const gym = ev({ titulo: "Gimnasio", inicio: "2026-10-05T19:00", fin: "2026-10-05T20:00", repeticion: { frecuencia: "semanal", dias: [0, 3] } });
    expect(resumenAgenda(base({ eventos: [gym] })).eventos.map((e) => e.titulo)).toEqual(["Gimnasio"]); // jueves
    expect(resumenAgenda(base({ fecha: "2026-10-21", ahora: "2026-10-21T10:00", eventos: [gym] })).eventos).toEqual([]); // miércoles
  });

  it("tareas de hoy: las pendientes antes que las hechas; y las atrasadas se cuentan", () => {
    const t1 = ev({ tipo: "tarea", titulo: "Hecha", hecho: true, todo_el_dia: true, inicio: "2026-10-22T00:00" });
    const t2 = ev({ tipo: "tarea", titulo: "Pendiente", todo_el_dia: true, inicio: "2026-10-22T00:00" });
    const vieja1 = ev({ tipo: "tarea", titulo: "Vieja 1", todo_el_dia: true, inicio: "2026-10-19T00:00" });
    const vieja2 = ev({ tipo: "tarea", titulo: "Vieja 2", todo_el_dia: true, inicio: "2026-10-20T00:00" });
    const futura = ev({ tipo: "tarea", titulo: "Futura", todo_el_dia: true, inicio: "2026-10-25T00:00" });
    const r = resumenAgenda(base({ eventos: [t1, t2], pendientes: [vieja1, vieja2, futura, t2] }));
    expect(r.tareas.map((t) => t.titulo)).toEqual(["Pendiente", "Hecha"]);
    expect(r.atrasadas).toBe(2);
  });

  it("texto de la hora en la fila", () => {
    const o = (e: EventoRow) => resumenAgenda(base({ eventos: [e] })).eventos[0];
    expect(horaDeAgenda(o(reunion), "2026-10-22")).toBe("09:00");
    expect(horaDeAgenda(o(viaje), "2026-10-22")).toBe("Todo el día");
    const noche = ev({ titulo: "Guardia", inicio: "2026-10-21T22:00", fin: "2026-10-22T06:00" });
    expect(horaDeAgenda(o(noche), "2026-10-22")).toBe("hasta 06:00");
  });
});

describe("construirHoy", () => {
  it("junta todo con el título y el saludo", () => {
    const r = construirHoy(base({ comidasHoy: [{ kcal: 500, proteina_g: 30, grasa_g: 10, hidratos_g: 50 }] }));
    expect(r.titulo).toBe("Jueves, 22 de octubre");
    expect(r.saludo).toBe("Buenos días");
    expect(r.entreno.estado).toBe("pendiente");
    expect(r.comida.registrado).toBe(true);
    expect(r.agenda.atrasadas).toBe(0);
  });
});
