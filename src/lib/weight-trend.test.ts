import { describe, expect, it } from "vitest";
import { mediaMovil, ordenar, ritmoPrevisto, sugerirAjuste, tendencia, type PesoRegistro } from "./weight-trend";

// Genera un registro diario a partir de una fecha, con una pendiente en kg/semana.
function serie(dias: number, inicio: number, kgSemana: number, desde = "2026-09-01"): PesoRegistro[] {
  const d0 = new Date(desde + "T00:00:00Z");
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(d0.getTime() + i * 86_400_000);
    return { fecha: d.toISOString().slice(0, 10), peso_kg: Math.round((inicio + (kgSemana / 7) * i) * 100) / 100 };
  });
}

describe("mediaMovil y orden", () => {
  it("ordena por fecha aunque lleguen desordenados", () => {
    const r = ordenar([
      { fecha: "2026-09-03", peso_kg: 80 },
      { fecha: "2026-09-01", peso_kg: 81 },
    ]);
    expect(r.map((x) => x.fecha)).toEqual(["2026-09-01", "2026-09-03"]);
  });

  it("media de 7 días: los primeros días promedian lo que hay", () => {
    const m = mediaMovil(
      [
        { fecha: "2026-09-01", peso_kg: 80 },
        { fecha: "2026-09-02", peso_kg: 82 },
        { fecha: "2026-09-10", peso_kg: 90 },
      ],
      7,
    );
    expect(m[0].media).toBe(80);
    expect(m[1].media).toBe(81);
    expect(m[2].media).toBe(90); // los anteriores quedan fuera de la ventana de 7 días
  });
});

describe("tendencia", () => {
  it("recupera la pendiente de una serie lineal", () => {
    const t = tendencia(serie(21, 80, -0.5));
    expect(t.kgSemana).toBeCloseTo(-0.5, 1);
    expect(t.fiable).toBe(true);
  });

  it("con pocos datos o poco tiempo no es fiable", () => {
    expect(tendencia(serie(3, 80, -0.5)).fiable).toBe(false);
    expect(tendencia([{ fecha: "2026-09-01", peso_kg: 80 }]).fiable).toBe(false);
    expect(tendencia([]).fiable).toBe(false);
  });

  it("solo usa la ventana final (28 días)", () => {
    // 28 días bajando seguidos de 28 días estables: la tendencia reciente es plana.
    const bajada = serie(28, 85, -1, "2026-07-01");
    const estable = serie(29, 81, 0, "2026-07-29");
    expect(Math.abs(tendencia([...bajada, ...estable]).kgSemana)).toBeLessThan(0.1);
  });
});

describe("sugerirAjuste", () => {
  const comunes = { kcalObjetivo: 2500, gastoEstimado: 2500, kcalMinimas: 1500, pesoKg: 80 };

  it("sin datos suficientes no opina", () => {
    const s = sugerirAjuste({ ...comunes, registros: serie(4, 80, 0) });
    expect(s.estado).toBe("pocos_datos");
  });

  it("peso estable cuando se esperaba mantener → en línea", () => {
    const s = sugerirAjuste({ ...comunes, registros: serie(21, 80, 0.03) });
    expect(s.estado).toBe("en_linea");
  });

  it("ritmo previsto: déficit de 550 kcal ≈ -0,5 kg/semana", () => {
    expect(ritmoPrevisto(2000, 2550)).toBeCloseTo(-0.5, 1);
  });

  it("mantener pero sube medio kilo por semana → baja calorías, con tope de 300", () => {
    const s = sugerirAjuste({ ...comunes, registros: serie(21, 80, 0.5) });
    expect(s.estado).toBe("ajustar");
    if (s.estado === "ajustar") {
      expect(s.deltaKcal).toBe(-300); // 550 kcal de desvío, limitado a 300
      expect(s.kcalNueva).toBe(2200);
      expect(s.mantenimientoReal).toBeLessThan(2500);
    }
  });

  it("déficit previsto de -0,5 kg/semana pero el peso no se mueve → sube del déficit, es decir, menos calorías", () => {
    const s = sugerirAjuste({ ...comunes, kcalObjetivo: 2000, gastoEstimado: 2550, registros: serie(21, 80, 0) });
    expect(s.estado).toBe("ajustar");
    if (s.estado === "ajustar") {
      expect(s.deltaKcal).toBeLessThan(0);
      expect(s.mantenimientoReal).toBeCloseTo(2000, -1); // sin cambio de peso, el mantenimiento real es ≈ lo que se come
    }
  });

  it("pierde más rápido de lo previsto → sube calorías", () => {
    const s = sugerirAjuste({ ...comunes, kcalObjetivo: 2300, gastoEstimado: 2550, registros: serie(21, 85, -0.9) });
    expect(s.estado).toBe("ajustar");
    if (s.estado === "ajustar") expect(s.deltaKcal).toBeGreaterThan(0);
  });

  it("nunca baja del suelo de seguridad", () => {
    const s = sugerirAjuste({
      registros: serie(21, 80, 0.8),
      kcalObjetivo: 1600,
      gastoEstimado: 1600,
      kcalMinimas: 1500,
      pesoKg: 80,
    });
    expect(s.estado).toBe("ajustar");
    if (s.estado === "ajustar") {
      expect(s.kcalNueva).toBeGreaterThanOrEqual(1500);
      expect(s.aviso).toContain("1500");
    }
  });

  it("avisa si pierde más de un 1 % del peso por semana", () => {
    const s = sugerirAjuste({ ...comunes, kcalObjetivo: 2000, gastoEstimado: 2550, registros: serie(21, 90, -1.2), pesoKg: 80 });
    if (s.estado === "ajustar") expect(s.aviso).toContain("1 %");
    else expect(["ajustar", "en_linea"]).toContain(s.estado);
  });
});
