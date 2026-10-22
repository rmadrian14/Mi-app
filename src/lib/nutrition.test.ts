import { describe, expect, it } from "vitest";
import {
  alimentoPermitido,
  calcularObjetivos,
  calcularPal,
  comidasDelDia,
  equivalenteCocinado,
  incoherenciaObjetivo,
  macrosDe,
  mifflinStJeor,
  repartoCalorias,
  type InputObjetivos,
} from "./nutrition";

const base: InputObjetivos = {
  sexo: "hombre",
  edad: 28,
  pesoKg: 80,
  alturaCm: 178,
  nivelActividad: "ligero",
  diasEntreno: 4,
  objetivo: "recomposicion",
  ritmo: "moderado",
};

describe("gasto energético", () => {
  it("Mifflin-St Jeor: hombre de 28 años, 80 kg, 178 cm → 1.777,5 kcal", () => {
    expect(mifflinStJeor({ sexo: "hombre", edad: 28, pesoKg: 80, alturaCm: 178 })).toBeCloseTo(1777.5, 5);
  });

  it("Mifflin-St Jeor: mujer de 30 años, 60 kg, 165 cm → 1.320,25 kcal", () => {
    expect(mifflinStJeor({ sexo: "mujer", edad: 30, pesoKg: 60, alturaCm: 165 })).toBeCloseTo(1320.25, 5);
  });

  it("el PAL sube con los días de entreno y con el nivel de actividad", () => {
    expect(calcularPal("sedentario", 0)).toBeCloseTo(1.4, 5);
    expect(calcularPal("sedentario", 7)).toBeGreaterThan(calcularPal("sedentario", 3));
    expect(calcularPal("activo", 3)).toBeGreaterThan(calcularPal("ligero", 3));
  });

  it("las pesas cuentan ~80 % del ejercicio aeróbico de FAO (+0,16 por hora diaria)", () => {
    expect(calcularPal("ligero", 7) - calcularPal("ligero", 0)).toBeCloseTo(0.16, 5);
  });

  it("el PAL no pasa nunca de 2,4", () => {
    expect(calcularPal("muy_activo", 7)).toBeLessThanOrEqual(2.4);
  });
});

describe("objetivos nutricionales", () => {
  it("perfil de referencia en recomposición: ~2.920 kcal, 2,0 g/kg de proteína, 30 % de grasa", () => {
    const r = calcularObjetivos(base);
    expect(r.tdee).toBeGreaterThan(2880);
    expect(r.tdee).toBeLessThan(2960);
    expect(r.kcal).toBe(2920);
    expect(r.proteina_g).toBe(160);
    expect(r.grasa_g).toBe(97);
    expect(r.hidratos_g).toBe(352);
    expect(r.hidratos_g / base.pesoKg).toBeLessThan(5); // ya no pasa de 5 g/kg
  });

  it("los macros siempre suman las calorías (±12 kcal por redondeo)", () => {
    for (const objetivo of ["perder_grasa", "mantener", "ganar_musculo", "recomposicion"] as const) {
      for (const sexo of ["hombre", "mujer"] as const) {
        for (const nivel of ["sedentario", "ligero", "activo", "muy_activo"] as const) {
          for (const dias of [0, 3, 5, 7]) {
            const r = calcularObjetivos({ ...base, sexo, objetivo, nivelActividad: nivel, diasEntreno: dias });
            const suma = 4 * r.proteina_g + 9 * r.grasa_g + 4 * r.hidratos_g;
            // Si los hidratos llegan a 0 el reparto se desvía a propósito (calorías muy bajas).
            if (r.hidratos_g > 0) expect(Math.abs(suma - r.kcal)).toBeLessThanOrEqual(12);
          }
        }
      }
    }
  });

  it("perder grasa: déficit, proteína alta y nunca por debajo del suelo de seguridad", () => {
    const r = calcularObjetivos({ ...base, objetivo: "perder_grasa", ritmo: "moderado" });
    expect(r.kcal).toBeLessThan(r.tdee);
    expect(r.ajustePct).toBeGreaterThanOrEqual(-25);
    expect(r.proteina_g).toBe(176); // 2,2 g/kg
    expect(r.kcal).toBeGreaterThanOrEqual(1500);

    const extrema = calcularObjetivos({
      sexo: "mujer", edad: 45, pesoKg: 50, alturaCm: 155, nivelActividad: "sedentario", diasEntreno: 0,
      objetivo: "perder_grasa", ritmo: "moderado",
    });
    expect(extrema.kcal).toBeGreaterThanOrEqual(1200);
    expect(extrema.kcal).toBeGreaterThanOrEqual(extrema.tmb);
  });

  it("ganar músculo: superávit de 10 % (suave) y 15 % (moderado)", () => {
    const suave = calcularObjetivos({ ...base, objetivo: "ganar_musculo", ritmo: "suave" });
    const moderado = calcularObjetivos({ ...base, objetivo: "ganar_musculo", ritmo: "moderado" });
    expect(suave.ajustePct).toBeCloseTo(10, 0);
    expect(moderado.ajustePct).toBeCloseTo(15, 0);
    expect(suave.proteina_g).toBe(144); // 1,8 g/kg
  });

  it("mantener: calorías = gasto", () => {
    const r = calcularObjetivos({ ...base, objetivo: "mantener" });
    expect(Math.abs(r.kcal - r.tdee)).toBeLessThanOrEqual(5);
  });

  it("si la persona conoce su mantenimiento, se usa ese en lugar de la estimación", () => {
    const r = calcularObjetivos({ ...base, objetivo: "mantener", kcalMantenimiento: 2500 });
    expect(r.gastoIndicado).toBe(true);
    expect(r.tdee).toBe(2500);
    expect(r.kcal).toBe(2500);
    expect(calcularObjetivos(base).gastoIndicado).toBe(false);
  });

  it("el mantenimiento conocido también marca el déficit", () => {
    const r = calcularObjetivos({ ...base, objetivo: "perder_grasa", ritmo: "suave", kcalMantenimiento: 2800 });
    // 0,5 % de 80 kg/semana = 0,4 kg ≈ 440 kcal/día
    expect(r.kcal).toBeGreaterThan(2300);
    expect(r.kcal).toBeLessThan(2400);
  });

  it("la grasa nunca baja de 0,6 g/kg", () => {
    const r = calcularObjetivos({ ...base, objetivo: "perder_grasa", sexo: "mujer", pesoKg: 90, alturaCm: 160, nivelActividad: "sedentario", diasEntreno: 0 });
    expect(r.grasa_g).toBeGreaterThanOrEqual(Math.round(90 * 0.6) - 1);
  });

  it("detecta calorías guardadas que no encajan con el objetivo", () => {
    // Caso real: hombre de 85 kg, 183 cm, 21 años, nivel ligero y 3 días → gasto ≈ 3065 kcal
    expect(incoherenciaObjetivo("perder_grasa", 3050, 3065)).toBe("sin_deficit");
    expect(incoherenciaObjetivo("perder_grasa", 2600, 3065)).toBeNull();
    expect(incoherenciaObjetivo("ganar_musculo", 3065, 3065)).toBe("sin_superavit");
    expect(incoherenciaObjetivo("ganar_musculo", 3350, 3065)).toBeNull();
    expect(incoherenciaObjetivo("mantener", 3050, 3065)).toBeNull();
    expect(incoherenciaObjetivo("recomposicion", 3050, 3065)).toBeNull();
    expect(incoherenciaObjetivo("perder_grasa", 0, 3065)).toBeNull();
  });

  it("lo que calcula la propia app para perder grasa siempre queda en déficit", () => {
    const r = calcularObjetivos({ ...base, objetivo: "perder_grasa", ritmo: "suave" });
    expect(incoherenciaObjetivo("perder_grasa", r.kcal, r.tdee)).toBeNull();
  });
});

describe("alimentos y comidas", () => {
  it("macrosDe escala por gramos", () => {
    const m = macrosDe({ kcal_100: 200, proteina_100: 20, grasa_100: 10, hidratos_100: 5 }, 150);
    expect(m).toEqual({ kcal: 300, proteina: 30, grasa: 15, hidratos: 7.5 });
  });

  it("equivalente cocinado: arroz crudo × 2,8 y pollo crudo × 0,75", () => {
    expect(equivalenteCocinado(2.8, 100)).toBe("≈ 280 g cocido");
    expect(equivalenteCocinado(0.75, 200)).toBe("≈ 150 g cocinado");
    expect(equivalenteCocinado(null, 100)).toBeNull();
    expect(equivalenteCocinado(1, 100)).toBeNull();
    expect(equivalenteCocinado(2.8, 0)).toBeNull();
  });

  it("el reparto de calorías suma 1 y respeta las comidas elegidas", () => {
    for (const n of [3, 4, 5]) {
      const comidas = comidasDelDia(n);
      expect(comidas).toHaveLength(n);
      const reparto = repartoCalorias(comidas);
      const suma = Object.values(reparto).reduce((a, b) => a + b, 0);
      expect(suma).toBeCloseTo(1, 10);
    }
  });

  it("restricciones: vegana excluye miel, huevo y lácteos; vegetariana no excluye huevo", () => {
    const miel = { nombre: "Miel", contiene: ["miel"] };
    const huevo = { nombre: "Huevo entero", contiene: ["huevo"] };
    const pollo = { nombre: "Pechuga", contiene: ["carne"] };
    expect(alimentoPermitido(miel, ["vegana"], null)).toBe(false);
    expect(alimentoPermitido(huevo, ["vegana"], null)).toBe(false);
    expect(alimentoPermitido(huevo, ["vegetariana"], null)).toBe(true);
    expect(alimentoPermitido(pollo, ["vegetariana"], null)).toBe(false);
    expect(alimentoPermitido(pollo, [], null)).toBe(true);
  });

  it("alimentos excluidos por texto: sin importar mayúsculas ni tildes", () => {
    const f = { nombre: "Atún al natural (lata)", contiene: ["pescado"] };
    expect(alimentoPermitido(f, [], "atun, coliflor")).toBe(false);
    expect(alimentoPermitido(f, [], "COLIFLOR")).toBe(true);
  });
});
