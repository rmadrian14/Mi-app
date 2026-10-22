import { describe, expect, it } from "vitest";
import { desfaseDelMenu, diaMontado, UMBRAL_DESFASE_MENU } from "./menu-desfase";

describe("menú desfasado respecto al objetivo", () => {
  it("el caso real: menú de ~3.050 kcal y objetivo de 2.360", () => {
    const d = desfaseDelMenu([3050, 3020, 3080, 3040, 3060, 3010, 3050], 2360);
    expect(d).toEqual({ kcalMenu: 3044, kcalObjetivo: 2360, diferenciaPct: 29 });
  });

  it("si encaja (dentro del 8 %), no avisa", () => {
    expect(desfaseDelMenu([2300, 2420, 2380], 2360)).toBeNull();
    expect(desfaseDelMenu([2360 * (1 + UMBRAL_DESFASE_MENU)], 2360)).toBeNull();
  });

  it("también avisa cuando el menú se queda corto", () => {
    expect(desfaseDelMenu([2000, 2100], 2600)).toMatchObject({ diferenciaPct: -21 });
  });

  it("usa la media de los días, no un día suelto", () => {
    // un día pasado y otros ajustados: la media queda dentro
    expect(desfaseDelMenu([2900, 2300, 2300, 2300, 2300], 2400)).toBeNull();
  });

  it("sin días montados o sin objetivo no hay nada que comparar", () => {
    expect(desfaseDelMenu([], 2360)).toBeNull();
    expect(desfaseDelMenu([3000], 0)).toBeNull();
  });

  it("un día cuenta si tiene al menos dos comidas", () => {
    expect(diaMontado([])).toBe(false);
    expect(diaMontado([{ comida: "desayuno" }, { comida: "desayuno" }])).toBe(false);
    expect(diaMontado([{ comida: "desayuno" }, { comida: "comida" }])).toBe(true);
  });
});
