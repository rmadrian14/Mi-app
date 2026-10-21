import { describe, expect, it } from "vitest";
import { SEED_FOODS } from "./food-seed";
import {
  actualizarMemoria,
  ajustarRaciones,
  errorPonderado,
  generarDia,
  memoriaVacia,
  type GenFood,
} from "./nutrition-generator";
import { alimentoPermitido, calcularObjetivos, comidasDelDia, macrosDe, sumarMacros, type Macros } from "./nutrition";

const CATEGORIAS = ["proteina", "hidrato", "verdura", "fruta", "lacteo", "grasa", "legumbre", "otro"];
const COMIDAS_VALIDAS = ["desayuno", "media_manana", "comida", "merienda", "cena"];
const MARCAS_CONOCIDAS = new Set([
  "gluten", "crustaceos", "huevo", "pescado", "cacahuetes", "soja", "lacteos", "frutos_secos", "apio",
  "mostaza", "sesamo", "sulfitos", "altramuces", "moluscos", "carne", "cerdo", "miel",
]);

const foods: GenFood[] = SEED_FOODS.map((s, i) => ({
  id: "f" + i,
  nombre: s.nombre,
  categoria: s.categoria,
  kcal_100: s.kcal_100,
  proteina_100: s.proteina_100,
  grasa_100: s.grasa_100,
  hidratos_100: s.hidratos_100,
  gramos_unidad: s.gramos_unidad,
  porcion_min_g: s.porcion_min_g,
  porcion_max_g: s.porcion_max_g,
  comidas: s.comidas,
  contiene: s.contiene,
  frecuencia: s.frecuencia,
}));
const porId = new Map(foods.map((f) => [f.id, f]));
const esAceite = (f: GenFood) => f.categoria === "grasa" && f.kcal_100 >= 800;

const perfil = calcularObjetivos({
  sexo: "hombre", edad: 28, pesoKg: 80, alturaCm: 178, nivelActividad: "ligero", diasEntreno: 4,
  objetivo: "recomposicion", ritmo: "moderado",
});
const target: Macros = { kcal: perfil.kcal, proteina: perfil.proteina_g, grasa: perfil.grasa_g, hidratos: perfil.hidratos_g };

function totalDe(items: { foodId: string; gramos: number }[]): Macros {
  return sumarMacros(items.map((i) => macrosDe(porId.get(i.foodId)!, i.gramos)));
}

describe("biblioteca de alimentos (semilla)", () => {
  it("tiene un buen número de alimentos y todas las categorías", () => {
    expect(SEED_FOODS.length).toBeGreaterThanOrEqual(400);
    for (const c of CATEGORIAS) expect(SEED_FOODS.some((s) => s.categoria === c)).toBe(true);
  });

  it("nombres únicos y datos válidos", () => {
    const nombres = new Set<string>();
    for (const s of SEED_FOODS) {
      expect(nombres.has(s.nombre), `duplicado: ${s.nombre}`).toBe(false);
      nombres.add(s.nombre);
      expect(CATEGORIAS, s.nombre).toContain(s.categoria);
      expect(s.kcal_100, s.nombre).toBeGreaterThanOrEqual(0);
      expect(s.kcal_100, s.nombre).toBeLessThanOrEqual(900);
      expect(s.proteina_100 + s.grasa_100 + s.hidratos_100, s.nombre).toBeLessThanOrEqual(100.5);
      expect(s.porcion_min_g, s.nombre).toBeGreaterThan(0);
      expect(s.porcion_max_g, s.nombre).toBeGreaterThanOrEqual(s.porcion_min_g);
      for (const c of s.comidas) expect(COMIDAS_VALIDAS, s.nombre).toContain(c);
      for (const m of s.contiene) expect(MARCAS_CONOCIDAS.has(m), `${s.nombre}: marca desconocida ${m}`).toBe(true);
      expect(s.frecuencia, s.nombre).toBeGreaterThanOrEqual(0.1);
      expect(s.frecuencia, s.nombre).toBeLessThanOrEqual(3);
      if (s.factor_cocinado != null) expect(s.factor_cocinado, s.nombre).toBeGreaterThan(0);
      if (s.gramos_unidad != null) expect(s.unidad_nombre, s.nombre).toBeTruthy();
    }
  });

  it("las calorías declaradas cuadran con 4P + 4H + 9G (±15 % o ±25 kcal)", () => {
    for (const s of SEED_FOODS) {
      const atwater = 4 * s.proteina_100 + 4 * s.hidratos_100 + 9 * s.grasa_100 + 7 * (s.alcohol_100 ?? 0);
      const tolerancia = Math.max(25, s.kcal_100 * 0.15);
      expect(Math.abs(atwater - s.kcal_100), `${s.nombre}: ${s.kcal_100} vs ${atwater.toFixed(0)}`).toBeLessThanOrEqual(tolerancia);
    }
  });

  it("el generador de menús tiene de dónde elegir en cada categoría (comidas vacías = solo diario)", () => {
    const elegibles = SEED_FOODS.filter((s) => s.comidas.length > 0);
    expect(elegibles.length).toBeGreaterThanOrEqual(240);
    for (const c of ["proteina", "hidrato", "verdura", "fruta", "lacteo", "grasa", "legumbre"]) {
      expect(elegibles.filter((s) => s.categoria === c).length, c).toBeGreaterThanOrEqual(8);
    }
    // Lo que no conviene en un menú automático queda fuera: embutidos grasos, bollería, dulces, bebidas y platos.
    const fuera = ["Chorizo", "Sobrasada", "Croissant", "Churros", "Cerveza (con alcohol)", "Salmorejo cordobés (receta casera)", "Bacón (crudo)"];
    for (const n of fuera) expect(SEED_FOODS.find((s) => s.nombre === n)?.comidas, n).toEqual([]);
  });

  it("incluye los cortes concretos y los genéricos de la cocina española", () => {
    const nombres = new Set(SEED_FOODS.map((s) => s.nombre));
    for (const n of [
      "Contramuslo de pollo sin piel (crudo)", "Contramuslo de pollo con piel (crudo)", "Muslo de pollo (jamoncito) con piel (crudo)",
      "Magro de cerdo (pierna, crudo, sin grasa visible)", "Lomo de cerdo magro (crudo, sin grasa visible)", "Pescado blanco (genérico, crudo)",
      "Jamón serrano", "Queso manchego", "Rape (crudo)", "Lubina (cruda)", "Aceite de oliva virgen extra (AOVE)",
    ]) expect(nombres.has(n), n).toBe(true);
    // El nombre antiguo (impreciso) ya no existe
    expect(nombres.has("Muslo de pollo sin piel (crudo)")).toBe(false);
  });

  it("los alimentos con unidad la tienen dentro de su rango de ración", () => {
    for (const s of SEED_FOODS) {
      if (s.gramos_unidad != null) expect(s.gramos_unidad, s.nombre).toBeLessThanOrEqual(s.porcion_max_g);
    }
  });

  it("las raciones máximas de hidrato seco son razonables (≤ 130 g crudo)", () => {
    for (const s of SEED_FOODS) {
      if (s.categoria === "hidrato" && s.kcal_100 > 300 && !s.gramos_unidad) {
        expect(s.porcion_max_g, s.nombre).toBeLessThanOrEqual(130);
      }
    }
  });

  it("hay opciones veganas de proteína (tofu, tempeh, soja texturizada, legumbres)", () => {
    const veganos = SEED_FOODS.filter(
      (s) => s.categoria === "proteina" && !s.contiene.some((m) => ["carne", "pescado", "huevo", "lacteos", "crustaceos", "moluscos"].includes(m)),
    );
    expect(veganos.length).toBeGreaterThanOrEqual(5);
  });
});

describe("generarDia", () => {
  it("cuadra con el objetivo (error < 6 %) con 10 semillas distintas", () => {
    for (let s = 1; s <= 10; s++) {
      const d = generarDia({ foods, target, comidas: comidasDelDia(4), semilla: s });
      expect(d.items.length).toBeGreaterThan(0);
      expect(d.error, `semilla ${s}`).toBeLessThan(0.06);
      expect(errorPonderado(totalDe(d.items), target)).toBeCloseTo(d.error, 5);
    }
  });

  it("es determinista: misma semilla, mismo menú", () => {
    const a = generarDia({ foods, target, comidas: comidasDelDia(4), semilla: 42 });
    const b = generarDia({ foods, target, comidas: comidasDelDia(4), semilla: 42 });
    expect(a.items).toEqual(b.items);
  });

  it("las raciones respetan los límites de cada alimento", () => {
    for (let s = 1; s <= 8; s++) {
      const d = generarDia({ foods, target, comidas: comidasDelDia(5), semilla: 100 + s });
      for (const i of d.items) {
        const f = porId.get(i.foodId)!;
        expect(i.gramos, f.nombre).toBeGreaterThanOrEqual(f.porcion_min_g - 1e-6);
        expect(i.gramos, f.nombre).toBeLessThanOrEqual(f.porcion_max_g + 1e-6);
      }
    }
  });

  it("combinaciones naturales: sin frutas ni grasas repetidas en el día, una fruta por tentempié, un solo aceite", () => {
    for (let s = 1; s <= 25; s++) {
      const d = generarDia({ foods, target, comidas: comidasDelDia(5), semilla: 900 + s });
      const veces = new Map<string, number>();
      for (const i of d.items) veces.set(i.foodId, (veces.get(i.foodId) ?? 0) + 1);
      for (const [id, k] of veces) {
        const f = porId.get(id)!;
        if (f.categoria === "fruta" || f.categoria === "otro" || (f.categoria === "grasa" && !esAceite(f))) {
          expect(k, `${f.nombre} repetido (semilla ${s})`).toBe(1);
        }
      }
      for (const comida of ["media_manana", "merienda"] as const) {
        const frutas = d.items.filter((i) => i.comida === comida && porId.get(i.foodId)!.categoria === "fruta");
        expect(frutas.length, `${comida} (semilla ${s})`).toBeLessThanOrEqual(1);
      }
      const aceites = new Set(d.items.filter((i) => esAceite(porId.get(i.foodId)!)).map((i) => i.foodId));
      expect(aceites.size, `aceites (semilla ${s})`).toBeLessThanOrEqual(1);
    }
  });

  it("en comida y cena, una sola fuente de hidrato o legumbre (con calorías normales)", () => {
    for (let s = 1; s <= 20; s++) {
      const d = generarDia({ foods, target, comidas: comidasDelDia(4), semilla: 300 + s });
      for (const comida of ["comida", "cena"] as const) {
        const carbos = d.items.filter(
          (i) => i.comida === comida && ["hidrato", "legumbre"].includes(porId.get(i.foodId)!.categoria),
        );
        expect(carbos.length, `${comida} (semilla ${s})`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("respeta las restricciones: vegano → nada de origen animal ni miel", () => {
    const libVegana = foods.filter((f) => alimentoPermitido(f, ["vegana"], ""));
    const prohibidas = new Set(["carne", "cerdo", "pescado", "crustaceos", "moluscos", "huevo", "lacteos", "miel"]);
    for (let s = 1; s <= 10; s++) {
      const d = generarDia({ foods: libVegana, target, comidas: comidasDelDia(4), semilla: 700 + s });
      expect(d.items.length).toBeGreaterThan(0);
      for (const i of d.items) {
        const f = porId.get(i.foodId)!;
        expect(f.contiene.some((m) => prohibidas.has(m)), f.nombre).toBe(false);
      }
    }
  });

  it("sin gluten: ningún alimento con gluten", () => {
    const lib = foods.filter((f) => alimentoPermitido(f, ["gluten"], ""));
    const d = generarDia({ foods: lib, target, comidas: comidasDelDia(4), semilla: 5 });
    for (const i of d.items) expect(porId.get(i.foodId)!.contiene).not.toContain("gluten");
  });

  it("con muy pocos alimentos avisa en lugar de inventar", () => {
    const d = generarDia({ foods: [], target, comidas: comidasDelDia(4), semilla: 1 });
    expect(d.items).toHaveLength(0);
    expect(d.aviso).toBeTruthy();
  });

  it("una semana con memoria no repite la proteína principal de un día para otro", () => {
    let memoria = memoriaVacia();
    let anterior = new Set<string>();
    let repeticiones = 0;
    for (let dia = 0; dia < 7; dia++) {
      const d = generarDia({ foods, target, comidas: comidasDelDia(4), memoria, semilla: 2000 + dia });
      const principales = new Set(
        d.items
          .filter((i) => (i.comida === "comida" || i.comida === "cena") && porId.get(i.foodId)!.categoria === "proteina")
          .map((i) => i.foodId),
      );
      for (const id of principales) if (anterior.has(id)) repeticiones++;
      anterior = principales;
      memoria = actualizarMemoria(memoria, d.items, porId);
    }
    expect(repeticiones).toBeLessThanOrEqual(1);
  });

  it("regenerar una comida respeta las demás (fijos) y devuelve solo esa comida", () => {
    const completo = generarDia({ foods, target, comidas: comidasDelDia(4), semilla: 11 });
    const fijos = completo.items
      .filter((i) => i.comida !== "cena")
      .map((i) => ({ comida: i.comida, food: porId.get(i.foodId)!, gramos: i.gramos }));
    const cena = generarDia({ foods, target, comidas: ["cena"], fijos, semilla: 12 });
    expect(cena.items.length).toBeGreaterThan(0);
    expect(cena.items.every((i) => i.comida === "cena")).toBe(true);
    const total = sumarMacros([...fijos.map((f) => macrosDe(f.food, f.gramos)), ...cena.items.map((i) => macrosDe(porId.get(i.foodId)!, i.gramos))]);
    expect(Math.abs(total.kcal - target.kcal) / target.kcal).toBeLessThan(0.1);
  });

  it("comidas muy grandes (≈4.100 kcal en 3 comidas) siguen cuadrando", () => {
    const grande = calcularObjetivos({
      sexo: "hombre", edad: 25, pesoKg: 104, alturaCm: 190, nivelActividad: "muy_activo", diasEntreno: 6,
      objetivo: "ganar_musculo", ritmo: "moderado",
    });
    const t: Macros = { kcal: grande.kcal, proteina: grande.proteina_g, grasa: grande.grasa_g, hidratos: grande.hidratos_g };
    const errores = [1, 2, 3, 4, 5].map((s) => generarDia({ foods, target: t, comidas: comidasDelDia(3), semilla: s }).error);
    expect(Math.min(...errores)).toBeLessThan(0.1);
  });
});

describe("ajustarRaciones", () => {
  it("acerca un día manual a los objetivos sin salirse de los límites", () => {
    const pollo = foods.find((f) => f.nombre.startsWith("Pechuga de pollo"))!;
    const arroz = foods.find((f) => f.nombre.startsWith("Arroz blanco"))!;
    const brocoli = foods.find((f) => f.nombre === "Brócoli")!;
    const aceite = foods.find((f) => f.nombre === "Aceite de oliva")!;
    const items = [
      { comida: "comida" as const, food: pollo, gramos: 100 },
      { comida: "comida" as const, food: arroz, gramos: 50 },
      { comida: "cena" as const, food: brocoli, gramos: 100 },
      { comida: "cena" as const, food: aceite, gramos: 10 },
    ];
    const antes = errorPonderado(sumarMacros(items.map((i) => macrosDe(i.food, i.gramos))), target);
    const r = ajustarRaciones(items, target);
    expect(r.error).toBeLessThan(antes);
    r.gramos.forEach((g, i) => {
      expect(g).toBeGreaterThanOrEqual(Math.min(items[i].food.porcion_min_g, items[i].gramos));
      expect(g).toBeLessThanOrEqual(Math.max(items[i].food.porcion_max_g, items[i].gramos));
    });
  });

  it("una lista vacía no rompe nada", () => {
    expect(ajustarRaciones([], target).gramos).toEqual([]);
  });
});
