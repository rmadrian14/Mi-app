import { describe, expect, it } from "vitest";
import {
  buscarAlimentos,
  diaSemanaLunes,
  entradaDesdeAlimento,
  entradaManual,
  entradasDesdeMenu,
  escalarEntrada,
  etiquetaDia,
  gramosDesdeUnidades,
  parseNumero,
  recientes,
  restante,
  sumarDias,
  totalesDelDia,
  unidadesDesdeGramos,
  validarEntradaManual,
  type EntradaDiario,
} from "./food-log";

const pollo = { id: "f1", nombre: "Pechuga de pollo (cruda)", kcal_100: 112, proteina_100: 22.5, grasa_100: 1.9, hidratos_100: 0, gramos_unidad: null, comidas: ["comida", "cena"] };
const huevo = { id: "f2", nombre: "Huevo entero", kcal_100: 148, proteina_100: 12.4, grasa_100: 10, hidratos_100: 1, gramos_unidad: 50, comidas: ["desayuno", "comida", "cena"] };
const arroz = { id: "f3", nombre: "Arroz blanco (crudo)", kcal_100: 370, proteina_100: 7, grasa_100: 1, hidratos_100: 80.3, gramos_unidad: null, comidas: ["comida", "cena"] };

const entrada = (p: Partial<EntradaDiario> = {}): EntradaDiario => ({
  id: "e1", fecha: "2026-10-20", comida: "comida", food_id: "f1", nombre: pollo.nombre, gramos: 200,
  kcal: 224, proteina_g: 45, grasa_g: 3.8, hidratos_g: 0, orden: 0, ...p,
});

describe("entradaDesdeAlimento: kcal y macros se rellenan solos", () => {
  it("200 g de pechuga de pollo", () => {
    const e = entradaDesdeAlimento(pollo, 200, "comida", "2026-10-20", 2);
    expect(e).toMatchObject({ food_id: "f1", nombre: pollo.nombre, gramos: 200, comida: "comida", fecha: "2026-10-20", orden: 2 });
    expect(e.kcal).toBe(224);
    expect(e.proteina_g).toBe(45);
    expect(e.grasa_g).toBe(3.8);
    expect(e.hidratos_g).toBe(0);
  });

  it("redondea a 1 decimal", () => {
    const e = entradaDesdeAlimento(arroz, 123.4, "cena", "2026-10-20");
    expect(e.hidratos_g).toBe(99.1); // 80,3 × 1,234 = 99,09
    expect(e.kcal).toBe(456.6); // 370 × 1,234 = 456,58
  });

  it("unidades ↔ gramos (2 huevos = 100 g)", () => {
    expect(gramosDesdeUnidades(2, 50)).toBe(100);
    expect(gramosDesdeUnidades(1.5, 50)).toBe(75);
    expect(unidadesDesdeGramos(125, 50)).toBe(2.5);
    const e = entradaDesdeAlimento(huevo, gramosDesdeUnidades(2, 50), "desayuno", "2026-10-20");
    expect(e.gramos).toBe(100);
    expect(e.kcal).toBe(148);
  });
});

describe("escalarEntrada: cambiar los gramos mantiene la proporción", () => {
  it("de 200 g a 150 g", () => {
    const e = escalarEntrada(entrada(), 150)!;
    expect(e.gramos).toBe(150);
    expect(e.kcal).toBe(168);
    expect(e.proteina_g).toBe(33.8);
  });

  it("usa la foto guardada, no el valor actual del alimento (el historial no cambia)", () => {
    // La entrada se guardó con valores antiguos (200 g = 300 kcal); el alimento ya vale otra cosa.
    const e = escalarEntrada(entrada({ kcal: 300 }), 100)!;
    expect(e.kcal).toBe(150);
  });

  it("no escala entradas a mano ni cantidades no válidas", () => {
    expect(escalarEntrada(entrada({ gramos: null, food_id: null }), 100)).toBeNull();
    expect(escalarEntrada(entrada(), 0)).toBeNull();
    expect(escalarEntrada(entrada(), -5)).toBeNull();
    expect(escalarEntrada(entrada(), NaN)).toBeNull();
  });
});

describe("totales y lo que falta", () => {
  const objetivo = { kcal: 2900, proteina: 160, grasa: 97, hidratos: 350 };
  it("suma el día", () => {
    const t = totalesDelDia([entrada(), entrada({ id: "e2", kcal: 600, proteina_g: 30, grasa_g: 20, hidratos_g: 70 })]);
    expect(t).toEqual({ kcal: 824, proteina: 75, grasa: 23.8, hidratos: 70 });
  });
  it("un día vacío son ceros", () => {
    expect(totalesDelDia([])).toEqual({ kcal: 0, proteina: 0, grasa: 0, hidratos: 0 });
  });
  it("lo que queda y lo que te has pasado (negativo)", () => {
    const r = restante(objetivo, { kcal: 3000, proteina: 100, grasa: 50, hidratos: 350 });
    expect(r).toEqual({ kcal: -100, proteina: 60, grasa: 47, hidratos: 0 });
  });
});

describe("recientes", () => {
  it("sin repetir, el más reciente primero, con la última cantidad", () => {
    const r = recientes([
      entrada({ id: "a", fecha: "2026-10-18", food_id: "f1", gramos: 150 }),
      entrada({ id: "b", fecha: "2026-10-20", food_id: "f2", nombre: "Huevo entero", gramos: 100 }),
      entrada({ id: "c", fecha: "2026-10-19", food_id: "f1", gramos: 250 }),
      entrada({ id: "d", fecha: "2026-10-20", food_id: null, gramos: null, nombre: "A mano" }),
    ]);
    expect(r.map((x) => [x.food_id, x.gramos])).toEqual([["f2", 100], ["f1", 250]]);
  });
  it("respeta el máximo y el desempate por hora de creación", () => {
    const e = [1, 2, 3, 4].map((i) => entrada({ id: "x" + i, food_id: "f" + i, created_at: `2026-10-20T10:0${i}:00Z` }));
    expect(recientes(e, 2).map((x) => x.food_id)).toEqual(["f4", "f3"]);
  });
});

describe("buscarAlimentos", () => {
  const foods = [pollo, huevo, arroz, { ...pollo, id: "f4", nombre: "Muslo de pollo sin piel (crudo)", comidas: ["comida"] }, { ...huevo, id: "f5", nombre: "Claras de huevo", comidas: ["desayuno"] }];

  it("sin texto no devuelve nada", () => {
    expect(buscarAlimentos(foods, "  ", "comida")).toEqual([]);
  });
  it("busca sin importar tildes ni mayúsculas, por todas las palabras", () => {
    expect(buscarAlimentos(foods, "POLLO", "comida").map((f) => f.id).sort()).toEqual(["f1", "f4"]);
    expect(buscarAlimentos(foods, "pollo sin", "comida").map((f) => f.id)).toEqual(["f4"]);
    expect(buscarAlimentos(foods, "arroz blanco", "comida").map((f) => f.id)).toEqual(["f3"]);
  });
  it("primero los que empiezan por lo escrito", () => {
    expect(buscarAlimentos(foods, "huevo", "desayuno").map((f) => f.id)[0]).toBe("f2"); // "Huevo entero" antes que "Claras de huevo"
  });
  it("a igualdad, primero los que encajan en esa comida", () => {
    const r = buscarAlimentos(foods, "pollo", "comida");
    expect(r[0].id).toBe("f1");
  });
  it("respeta el máximo", () => {
    expect(buscarAlimentos(foods, "o", "comida", 2)).toHaveLength(2);
  });
  it("cada palabra empieza una palabra del nombre: «pollo» no encuentra «Repollo»", () => {
    const con = [...foods, { ...pollo, id: "f6", nombre: "Repollo", comidas: ["comida"] }];
    expect(buscarAlimentos(con, "pollo", "comida").map((f) => f.id)).not.toContain("f6");
  });
  it("si así no sale nada, admite la coincidencia en mitad de la palabra", () => {
    expect(buscarAlimentos(foods, "rroz", "comida").map((f) => f.id)).toEqual(["f3"]);
  });
  it("entiende plurales y palabras de uso común: huevos, macarrones, judías, nuez", () => {
    const pasta = { ...arroz, id: "f6", nombre: "Pasta (cruda)" };
    const alubias = { ...arroz, id: "f7", nombre: "Alubias blancas (cocidas, escurridas)" };
    const nueces = { ...arroz, id: "f8", nombre: "Nueces" };
    const todos = [...foods, pasta, alubias, nueces];
    expect(buscarAlimentos(todos, "huevos", "desayuno").map((f) => f.id)[0]).toBe("f2");
    expect(buscarAlimentos(todos, "macarrones", "comida").map((f) => f.id)).toEqual(["f6"]);
    expect(buscarAlimentos(todos, "espaguetis", "comida").map((f) => f.id)).toEqual(["f6"]);
    expect(buscarAlimentos(todos, "judías blancas", "comida").map((f) => f.id)).toEqual(["f7"]);
    expect(buscarAlimentos(todos, "nuez", "merienda").map((f) => f.id)).toEqual(["f8"]);
  });
  it("la palabra exacta va antes que una que solo empieza igual (pan antes que panceta)", () => {
    const pan = { ...arroz, id: "f9", nombre: "Pan de barra / baguette" };
    const panceta = { ...arroz, id: "f10", nombre: "Panceta" };
    expect(buscarAlimentos([panceta, pan], "pan", "desayuno").map((f) => f.id)).toEqual(["f9", "f10"]);
  });
  it("las palabras pueden venir en cualquier orden y con tildes", () => {
    expect(buscarAlimentos(foods, "CRUDO arroz", "comida").map((f) => f.id)).toEqual(["f3"]);
  });
});

describe("entradasDesdeMenu", () => {
  it("convierte el día del menú en entradas con sus macros y omite alimentos borrados", () => {
    const mapa = new Map([[pollo.id, pollo], [arroz.id, arroz]]);
    const r = entradasDesdeMenu(
      [
        { comida: "comida", food_id: "f1", gramos: 200, orden: 0 },
        { comida: "comida", food_id: "f3", gramos: 100, orden: 1 },
        { comida: "cena", food_id: "borrado", gramos: 50, orden: 0 },
      ],
      mapa,
      "2026-10-21",
    );
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ fecha: "2026-10-21", comida: "comida", food_id: "f1", kcal: 224 });
    expect(r[1]).toMatchObject({ food_id: "f3", hidratos_g: 80.3, orden: 1 });
  });
});

describe("entradas a mano", () => {
  const ok = (o: Partial<Record<"nombre" | "kcal" | "proteina" | "grasa" | "hidratos", string>> = {}) =>
    validarEntradaManual({ nombre: "Menú del restaurante", kcal: "850", proteina: "35", grasa: "40", hidratos: "80", ...o });

  it("acepta datos válidos, con coma decimal, y deja macros vacíos en 0", () => {
    const r = ok({ kcal: "850,5", grasa: "", hidratos: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toEqual({ nombre: "Menú del restaurante", kcal: 850.5, proteina: 35, grasa: 0, hidratos: 0 });
  });
  it("avisa (sin rechazar) si los macros no cuadran con las kcal", () => {
    const r = ok({ kcal: "300" }); // los macros suman 820 kcal
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.aviso).toMatch(/suman 820/);
    const bien = ok();
    if (bien.ok) expect(bien.aviso).toBeUndefined(); // 35·4 + 40·9 + 80·4 = 820 ≈ 850
  });
  it("rechaza nombre vacío, kcal inválidas o macros negativos", () => {
    for (const malo of [{ nombre: "  " }, { kcal: "" }, { kcal: "-5" }, { kcal: "abc" }, { kcal: "25000" }, { proteina: "-1" }, { grasa: "x" }, { hidratos: "3000" }]) {
      expect(ok(malo).ok, JSON.stringify(malo)).toBe(false);
    }
  });
  it("entradaManual no lleva alimento ni gramos", () => {
    const e = entradaManual({ nombre: "Tarta", kcal: 400, proteina: 5, grasa: 20, hidratos: 50 }, "merienda", "2026-10-20", 3);
    expect(e).toMatchObject({ food_id: null, gramos: null, comida: "merienda", kcal: 400, orden: 3 });
  });
  it("parseNumero", () => {
    expect(parseNumero("1,5")).toBe(1.5);
    expect(parseNumero(" 2.25 ")).toBe(2.25);
    expect(parseNumero("")).toBeNull();
    expect(parseNumero("abc")).toBeNull();
  });
});

describe("fechas", () => {
  it("sumarDias cruza meses y años", () => {
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(sumarDias("2026-01-01", -1)).toBe("2025-12-31");
    expect(sumarDias("2024-02-28", 1)).toBe("2024-02-29");
  });
  it("diaSemanaLunes: 0 = lunes … 6 = domingo", () => {
    expect(diaSemanaLunes("2026-10-19")).toBe(0); // lunes
    expect(diaSemanaLunes("2026-10-25")).toBe(6); // domingo
  });
  it("etiquetaDia", () => {
    expect(etiquetaDia("2026-10-20", "2026-10-20")).toBe("Hoy");
    expect(etiquetaDia("2026-10-19", "2026-10-20")).toBe("Ayer");
    expect(etiquetaDia("2026-10-21", "2026-10-20")).toBe("Mañana");
    expect(etiquetaDia("2026-10-15", "2026-10-20")).toMatch(/^Jueves, 15 de octubre/);
  });
});
