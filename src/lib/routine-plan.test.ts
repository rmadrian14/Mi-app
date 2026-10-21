import { describe, expect, it } from "vitest";
import { describirIntercambio, describirSustitucion, entrenamientosParaCopiar, type DiaPlan } from "./routine-plan";

const ej = (n: number) => Array.from({ length: n }, (_, i) => ({ id: "e" + i }));
const semana: DiaPlan[] = [
  { dia_semana: 0, nombre_dia: "Push", es_dia_entreno: true, ejercicios: ej(5) },
  { dia_semana: 1, nombre_dia: "Pull", es_dia_entreno: true, ejercicios: ej(4) },
  { dia_semana: 2, nombre_dia: "Legs", es_dia_entreno: true, ejercicios: ej(6) },
  { dia_semana: 3, nombre_dia: "Brazo", es_dia_entreno: true, ejercicios: ej(1) },
  { dia_semana: 4, nombre_dia: "Descanso", es_dia_entreno: false, ejercicios: [] },
  { dia_semana: 5, nombre_dia: "Descanso", es_dia_entreno: false, ejercicios: [] },
  { dia_semana: 6, nombre_dia: "Descanso", es_dia_entreno: false, ejercicios: [] },
];

describe("describirIntercambio", () => {
  it("mover un entrenamiento a un día de descanso", () => {
    const c = describirIntercambio(semana, 0, 4)!;
    expect(c.titulo).toBe("¿Mover «Push» al viernes?");
    expect(c.descripcion).toContain("«Push» pasará del lunes al viernes.");
    expect(c.descripcion).toContain("El descanso del viernes pasará al lunes.");
    expect(c.descripcion).toContain("ejercicios, hábitos e historial");
  });

  it("intercambiar dos entrenamientos", () => {
    const c = describirIntercambio(semana, 1, 2)!;
    expect(c.descripcion).toContain("«Pull» pasará del martes al miércoles.");
    expect(c.descripcion).toContain("«Legs» pasará del miércoles al martes.");
  });

  it("mover un descanso a un día de entreno", () => {
    const c = describirIntercambio(semana, 5, 0)!;
    expect(c.titulo).toBe("¿Mover el descanso al lunes?");
    expect(c.descripcion).toContain("El descanso pasará del sábado al lunes.");
    expect(c.descripcion).toContain("«Push» pasará del lunes al sábado.");
  });

  it("no hay nada que describir con el mismo día o un día que no existe", () => {
    expect(describirIntercambio(semana, 2, 2)).toBeNull();
    expect(describirIntercambio(semana, 2, 9)).toBeNull();
  });
});

describe("entrenamientosParaCopiar", () => {
  it("solo días de entreno con ejercicios, de otro día y en orden de la semana", () => {
    const l = entrenamientosParaCopiar(semana, 4).map((d) => d.nombre_dia);
    expect(l).toEqual(["Push", "Pull", "Legs", "Brazo"]);
    expect(entrenamientosParaCopiar(semana, 0).map((d) => d.nombre_dia)).toEqual(["Pull", "Legs", "Brazo"]);
  });

  it("un día de entreno sin ejercicios todavía no se ofrece", () => {
    const vacio: DiaPlan[] = [...semana.slice(0, 3), { dia_semana: 3, nombre_dia: "Nuevo", es_dia_entreno: true, ejercicios: [] }, ...semana.slice(4)];
    expect(entrenamientosParaCopiar(vacio, 6).map((d) => d.nombre_dia)).toEqual(["Push", "Pull", "Legs"]);
  });
});

describe("describirSustitucion", () => {
  it("sobre un descanso: el día pasa a ser de entreno", () => {
    const c = describirSustitucion(semana, 4, 1)!;
    expect(c.titulo).toBe("¿Poner «Pull» el viernes?");
    expect(c.descripcion).toBe("El viernes pasará a ser un día de entreno con una copia de «Pull» del martes (4 ejercicios, con sus series, repeticiones y pesos).");
  });

  it("sobre un entrenamiento: avisa de lo que se quita y de que el historial se conserva", () => {
    const c = describirSustitucion(semana, 3, 0)!;
    expect(c.descripcion).toContain("Se quitará de la rutina el ejercicio actual de «Brazo»");
    expect(c.descripcion).toContain("una copia de «Push» del lunes (5 ejercicios");
    expect(c.descripcion).toContain("El historial de series ya registradas se conserva.");
    expect(describirSustitucion(semana, 0, 2)!.descripcion).toContain("Se quitarán de la rutina los 5 ejercicios actuales de «Push»");
  });

  it("no se puede copiar un descanso ni un día sobre sí mismo", () => {
    expect(describirSustitucion(semana, 0, 4)).toBeNull();
    expect(describirSustitucion(semana, 2, 2)).toBeNull();
  });
});
