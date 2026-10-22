import { describe, expect, it } from "vitest";
import { SEED_FOODS } from "./food-seed";
import { comidaProxima, comidasPendientes, objetivoDeLaComida, platoEncaja, sugerirCombos, sugerirPlatos, totalDeCombo, type PlatoQ } from "./que-como";
import { comidasDelDia, type Macros } from "./nutrition";

const foods: PlatoQ[] = SEED_FOODS.map((s, i) => ({
  id: "f" + i,
  nombre: s.nombre,
  categoria: s.categoria,
  kcal_100: s.kcal_100,
  proteina_100: s.proteina_100,
  grasa_100: s.grasa_100,
  hidratos_100: s.hidratos_100,
  gramos_unidad: s.gramos_unidad,
  unidad_nombre: s.unidad_nombre,
  porcion_min_g: s.porcion_min_g,
  porcion_max_g: s.porcion_max_g,
  comidas: s.comidas,
  contiene: s.contiene,
  frecuencia: s.frecuencia,
}));
const combinables = foods.filter((f) => f.comidas.length > 0);
const platos = foods.filter((f) => f.comidas.length === 0 && f.gramos_unidad);

const kcalDe = (m: Macros) => m.kcal;

describe("qué comida toca y cuánto le corresponde", () => {
  it("la próxima comida según la hora", () => {
    const tres = comidasDelDia(3);
    expect(comidaProxima(8, tres)).toBe("desayuno");
    expect(comidaProxima(11, tres)).toBe("comida");
    expect(comidaProxima(14.5, tres)).toBe("comida");
    expect(comidaProxima(17, tres)).toBe("cena");
    expect(comidaProxima(23, tres)).toBe("cena");
    const cinco = comidasDelDia(5);
    expect(comidaProxima(11, cinco)).toBe("media_manana");
    expect(comidaProxima(17, cinco)).toBe("merienda");
  });

  it("las comidas que quedan incluyen la actual y las siguientes", () => {
    expect(comidasPendientes(comidasDelDia(5), "comida")).toEqual(["comida", "merienda", "cena"]);
    expect(comidasPendientes(comidasDelDia(3), "cena")).toEqual(["cena"]);
    expect(comidasPendientes(comidasDelDia(3), "merienda")).toEqual(["merienda", "cena"]); // una comida que no es del plan también cuenta
  });

  it("reparte lo que falta entre las comidas que quedan, con macros que suman las calorías", () => {
    const resto: Macros = { kcal: 1500, proteina: 100, grasa: 50, hidratos: 160 };
    const o = objetivoDeLaComida(resto, "comida", ["comida", "merienda", "cena"])!;
    // la comida pesa 0,35 de los 0,75 que quedan
    expect(o.kcal).toBeCloseTo((1500 * 0.35) / 0.75, 5);
    expect(4 * o.proteina + 9 * o.grasa + 4 * o.hidratos).toBeCloseTo(o.kcal, 3);
    expect(o.proteina).toBeCloseTo((100 * 0.35) / 0.75, 5);
    // si solo queda la cena, le toca todo
    expect(objetivoDeLaComida(resto, "cena", ["cena"])!.kcal).toBe(1500);
  });

  it("no pide macros negativos ni imposibles si ya te has pasado de algo", () => {
    const o = objetivoDeLaComida({ kcal: 600, proteina: -20, grasa: -15, hidratos: 90 }, "cena", ["cena"])!;
    expect(o.proteina).toBe(0);
    expect(o.grasa).toBe(0);
    expect(o.hidratos).toBeCloseTo(150, 5);
    const poco = objetivoDeLaComida({ kcal: 600, proteina: 300, grasa: 200, hidratos: 0 }, "cena", ["cena"])!;
    expect(poco.hidratos).toBeGreaterThan(0);
    expect(4 * poco.proteina + 9 * poco.grasa + 4 * poco.hidratos).toBeCloseTo(600, 3);
  });

  it("una sola comida no se lleva medio día: se limita a 1,4 veces lo normal y se avisa", () => {
    const resto: Macros = { kcal: 1840, proteina: 159, grasa: 50, hidratos: 189 };
    const normal = { kcalDia: 2360, comidasDelDia: comidasDelDia(3) };
    const o = objetivoDeLaComida(resto, "cena", ["cena"], normal)!;
    expect(o.kcal).toBeCloseTo(1.4 * (0.3 / 0.9) * 2360, 5); // la cena pesa 0,30 de los 0,90 de tres comidas
    expect(o.recortada).toBe(true);
    expect(4 * o.proteina + 9 * o.grasa + 4 * o.hidratos).toBeCloseTo(o.kcal, 3);
    // sin llegar al tope no se toca nada
    const poco = objetivoDeLaComida({ kcal: 700, proteina: 50, grasa: 20, hidratos: 80 }, "cena", ["cena"], normal)!;
    expect(poco.kcal).toBe(700);
    expect(poco.recortada).toBe(false);
    // y repartiendo entre varias comidas tampoco se recorta
    expect(objetivoDeLaComida({ kcal: 2000, proteina: 150, grasa: 60, hidratos: 220 }, "comida", ["comida", "cena"], normal)!.recortada).toBe(false);
  });

  it("con el día cubierto no hay nada que sugerir", () => {
    expect(objetivoDeLaComida({ kcal: 80, proteina: 5, grasa: 2, hidratos: 10 }, "cena", ["cena"])).toBeNull();
    expect(objetivoDeLaComida({ kcal: -200, proteina: 0, grasa: 0, hidratos: 0 }, "cena", ["cena"])).toBeNull();
  });
});

describe("combinaciones de alimentos", () => {
  const objetivo: Macros = { kcal: 700, proteina: 50, grasa: 22, hidratos: 75 };

  it("devuelve varias opciones distintas que cuadran con lo que falta", () => {
    const c = sugerirCombos({ foods: combinables, objetivo, comida: "comida", semilla: 1 });
    expect(c.length).toBeGreaterThanOrEqual(2);
    for (const x of c) {
      expect(x.error).toBeLessThanOrEqual(0.2);
      expect(Math.abs(kcalDe(x.total) - 700) / 700).toBeLessThan(0.15);
      expect(x.items.length).toBeGreaterThanOrEqual(2);
      expect(totalDeCombo(x.items).kcal).toBeCloseTo(x.total.kcal, 0);
      for (const i of x.items) expect(i.food.comidas).toContain("comida");
    }
    const claves = c.map((x) => x.items.map((i) => i.food.id).sort().join());
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("es determinista con la misma semilla y cambia con otra", () => {
    const a = sugerirCombos({ foods: combinables, objetivo, comida: "cena", semilla: 5 });
    const b = sugerirCombos({ foods: combinables, objetivo, comida: "cena", semilla: 5 });
    const c = sugerirCombos({ foods: combinables, objetivo, comida: "cena", semilla: 99 });
    expect(a.map((x) => x.items.map((i) => i.food.id))).toEqual(b.map((x) => x.items.map((i) => i.food.id)));
    expect(a.map((x) => x.items.map((i) => i.food.id))).not.toEqual(c.map((x) => x.items.map((i) => i.food.id)));
  });

  it("para un desayuno propone cosas de desayuno", () => {
    const c = sugerirCombos({ foods: combinables, objetivo: { kcal: 450, proteina: 30, grasa: 14, hidratos: 50 }, comida: "desayuno", semilla: 3 });
    expect(c.length).toBeGreaterThan(0);
    for (const x of c) for (const i of x.items) expect(i.food.comidas).toContain("desayuno");
  });
});

describe("platos típicos", () => {
  it("la ración que encaja: lentejas o similares para una comida de ~600 kcal", () => {
    const r = sugerirPlatos({ platos, objetivo: { kcal: 600, proteina: 35, grasa: 20, hidratos: 70 }, comida: "comida" });
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) {
      expect(Math.abs(x.total.kcal - 600) / 600).toBeLessThan(0.5);
      expect(x.gramos).toBeGreaterThanOrEqual(x.food.porcion_min_g - 1e-6);
      expect(x.gramos).toBeLessThanOrEqual(x.food.porcion_max_g + 1e-6);
      expect(x.food.comidas).toHaveLength(0);
    }
    for (let i = 1; i < r.length; i++) expect(r[i].error).toBeGreaterThanOrEqual(r[i - 1].error);
  });

  it("incluye las berenjenas rellenas por tamaño y las pone en una comida o cena", () => {
    const r = sugerirPlatos({ platos, objetivo: { kcal: 560, proteina: 28, grasa: 40, hidratos: 28 }, comida: "cena", cuantas: 20 });
    expect(r.some((x) => x.food.nombre.startsWith("Berenjenas rellenas"))).toBe(true);
  });

  it("en el desayuno solo platos ligeros, sin alcohol ni lentejas", () => {
    const r = sugerirPlatos({ platos, objetivo: { kcal: 350, proteina: 15, grasa: 10, hidratos: 50 }, comida: "desayuno", cuantas: 20 });
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) expect(platoEncaja(x.food.nombre, "desayuno"), x.food.nombre).toBe(true);
    expect(r.some((x) => /lentejas|paella|cocido madrileño/i.test(x.food.nombre))).toBe(false);
  });

  it("nunca sugiere bebidas alcohólicas ni cafés para una comida o cena", () => {
    for (const comida of ["comida", "cena"] as const) {
      const r = sugerirPlatos({ platos, objetivo: { kcal: 200, proteina: 5, grasa: 5, hidratos: 25 }, comida, cuantas: 50 });
      for (const x of r) {
        expect(/gin-tonic|whisky|cubata|calimocho|tinto de verano|clara \(/i.test(x.food.nombre), x.food.nombre).toBe(false);
        expect(/café|capuchino|cortado/i.test(x.food.nombre), x.food.nombre).toBe(false);
      }
    }
    expect(platoEncaja("Gin-tonic", "merienda")).toBe(false);
    expect(platoEncaja("Tostada con tomate y aceite (receta casera)", "desayuno")).toBe(true);
    expect(platoEncaja("Café con leche, leche entera (taza)", "cena")).toBe(false);
  });

  it("las piezas (croquetas) se cuentan en unidades enteras", () => {
    const r = sugerirPlatos({ platos, objetivo: { kcal: 450, proteina: 15, grasa: 25, hidratos: 40 }, comida: "cena", cuantas: 40 });
    const cro = r.find((x) => x.food.nombre.startsWith("Croquetas"));
    if (cro) expect(Number.isInteger(cro.unidades)).toBe(true);
  });
});
