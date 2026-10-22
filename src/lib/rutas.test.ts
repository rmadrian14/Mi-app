import { describe, expect, it } from "vitest";
import { mostrarBarraDeNegocio } from "./rutas";

describe("menú lateral de Negocio", () => {
  it("no sale en la portada ni en los módulos propios", () => {
    for (const r of ["/", "/auth", "/invite/abc", "/training", "/nutrition", "/planning", "/organization"]) {
      expect(mostrarBarraDeNegocio(r), r).toBe(false);
    }
  });

  it("no sale en las pantallas de dentro de esos módulos", () => {
    expect(mostrarBarraDeNegocio("/nutrition/algo")).toBe(false);
    expect(mostrarBarraDeNegocio("/organization/semana")).toBe(false);
  });

  it("sí sale en Negocio", () => {
    for (const r of ["/accounting", "/projects", "/radar", "/clients", "/company", "/settings", "/portfolio", "/workspaces", "/accounting/facturas"]) {
      expect(mostrarBarraDeNegocio(r), r).toBe(true);
    }
  });

  it("no se confunde con rutas que solo empiezan igual", () => {
    expect(mostrarBarraDeNegocio("/organizations-demo")).toBe(true);
    expect(mostrarBarraDeNegocio("/training-plan")).toBe(true);
  });
});
