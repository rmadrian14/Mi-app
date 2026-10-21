import { describe, expect, it } from "vitest";
import { SEED_BASE, SEED_FOODS, SEED_PLATOS } from "./food-seed";
import { SEED_ESPANA } from "./food-seed-espana";
import { RECETAS, platosDesdeRecetas } from "./food-recetas";

const base = [...SEED_BASE, ...SEED_ESPANA];

describe("platos típicos calculados desde su receta", () => {
  it("todos los ingredientes existen en la biblioteca", () => {
    expect(platosDesdeRecetas(RECETAS, base).faltan).toEqual([]);
  });

  it("hay un plato por receta y sin nombres repetidos en toda la biblioteca", () => {
    expect(SEED_PLATOS).toHaveLength(RECETAS.length);
    const nombres = SEED_FOODS.map((s) => s.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("las recetas son coherentes: pesos, cantidades y valores razonables", () => {
    for (const r of RECETAS) {
      expect(r.raciones, r.nombre).toBeGreaterThan(0);
      expect(r.pesoFinal, r.nombre).toBeGreaterThan(50);
      const crudo = r.ingredientes.reduce((s, [, g]) => s + g, 0);
      // El plato terminado no puede pesar mucho más que lo que se pesó en crudo (solo el agua que absorben legumbres, arroz y pasta, o el caldo)
      expect(r.pesoFinal, `${r.nombre}: ${r.pesoFinal} g finales de ${crudo} g crudos`).toBeLessThanOrEqual(crudo * 4);
      for (const [n, g] of r.ingredientes) expect(g, `${r.nombre}: ${n}`).toBeGreaterThan(0);
    }
    for (const p of SEED_PLATOS) {
      expect(p.kcal_100, p.nombre).toBeGreaterThan(10);
      expect(p.kcal_100, p.nombre).toBeLessThan(450);
      expect(p.proteina_100 + p.grasa_100 + p.hidratos_100, p.nombre).toBeLessThanOrEqual(100);
      expect(p.comidas, p.nombre).toEqual([]);
      expect(p.gramos_unidad, p.nombre).toBeGreaterThan(0);
      expect(p.porcion_max_g, p.nombre).toBeGreaterThanOrEqual(p.gramos_unidad!);
    }
  });

  it("salmorejo: kcal y macros de la receta (tomate, pan, aceite y ajo)", () => {
    const f = (n: string) => base.find((b) => b.nombre === n)!;
    const kcal = (f("Tomate").kcal_100 * 1000 + f("Pan blanco").kcal_100 * 200 + f("Aceite de oliva virgen extra (AOVE)").kcal_100 * 100 + f("Ajo (crudo)").kcal_100 * 5) / 100;
    const s = SEED_PLATOS.find((p) => p.nombre.startsWith("Salmorejo cordobés"))!;
    expect(s.kcal_100).toBe(Math.round((kcal * 100) / 1300));
    expect(s.kcal_100).toBeGreaterThan(110);
    expect(s.kcal_100).toBeLessThan(140);
    expect(s.unidad_nombre).toBe("ración");
  });

  it("cafés y combinados: kcal por taza o vaso, con el alcohol contado", () => {
    const por = (prefijo: string) => {
      const p = SEED_PLATOS.find((x) => x.nombre.startsWith(prefijo))!;
      return { kcal: (p.kcal_100 * p.gramos_unidad!) / 100, p };
    };
    const entera = por("Café con leche, leche entera");
    expect(entera.kcal).toBeGreaterThan(50);
    expect(entera.kcal).toBeLessThan(75);
    expect(entera.p.unidad_nombre).toBe("taza");
    expect(por("Café con leche, leche desnatada").kcal).toBeLessThan(entera.kcal);
    const gin = por("Gin-tonic");
    expect(gin.kcal).toBeGreaterThan(140);
    expect(gin.kcal).toBeLessThan(190);
    expect(gin.p.alcohol_100, "el alcohol de la ginebra pasa al combinado").toBeGreaterThan(5);
    expect(por("Tinto de verano").p.contiene).toContain("sulfitos");
  });

  it("croquetas: se cuentan por unidades y heredan los alérgenos de sus ingredientes", () => {
    const c = SEED_PLATOS.find((p) => p.nombre.startsWith("Croquetas de jamón"))!;
    expect(c.unidad_nombre).toBe("croqueta");
    expect(c.gramos_unidad).toBe(35);
    for (const m of ["gluten", "lacteos", "huevo", "carne", "cerdo"]) expect(c.contiene, m).toContain(m);
    // una croqueta casera de jamón: unas 70-110 kcal
    const kcalUnidad = (c.kcal_100 * 35) / 100;
    expect(kcalUnidad).toBeGreaterThan(70);
    expect(kcalUnidad).toBeLessThan(110);
  });

  it("lentejas, tortilla y paella dan valores en el rango esperable por ración", () => {
    const por = (prefijo: string) => {
      const p = SEED_PLATOS.find((x) => x.nombre.startsWith(prefijo))!;
      return (p.kcal_100 * p.gramos_unidad!) / 100;
    };
    expect(por("Lentejas estofadas con chorizo")).toBeGreaterThan(330);
    expect(por("Lentejas estofadas con chorizo")).toBeLessThan(550);
    expect(por("Tortilla de patatas con cebolla")).toBeGreaterThan(250);
    expect(por("Tortilla de patatas con cebolla")).toBeLessThan(400);
    expect(por("Paella valenciana")).toBeGreaterThan(650);
    expect(por("Paella valenciana")).toBeLessThan(950);
  });
});
