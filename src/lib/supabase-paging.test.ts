import { describe, expect, it } from "vitest";
import { TAMANO_PAGINA, leerTodo } from "./supabase-paging";

// Simula PostgREST: devuelve como mucho `tope` filas por petición, igual que
// el ajuste «Max rows» de Supabase, sea cual sea el rango pedido.
function servidor(total: number, tope = 1000) {
  const filas = Array.from({ length: total }, (_, i) => ({ id: i }));
  let peticiones = 0;
  const pagina = async (desde: number, hasta: number) => {
    peticiones++;
    const pedidas = filas.slice(desde, hasta + 1);
    return { data: pedidas.slice(0, tope), error: null };
  };
  return { pagina, peticiones: () => peticiones };
}

describe("leerTodo (paginación contra el tope de 1.000 filas)", () => {
  it("sin paginar, una consulta de 2.500 filas se corta en 1.000 (el fallo que se corrige)", async () => {
    const s = servidor(2500);
    const sinPaginar = await s.pagina(0, 9999);
    expect(sinPaginar.data).toHaveLength(1000);
  });

  it("lee las 2.500 filas completas, sin repetir ni perder ninguna", async () => {
    const s = servidor(2500);
    const { data, error } = await leerTodo(s.pagina);
    expect(error).toBeNull();
    expect(data).toHaveLength(2500);
    expect(new Set(data.map((f) => f.id)).size).toBe(2500);
    expect(data.map((f) => f.id)).toEqual(Array.from({ length: 2500 }, (_, i) => i));
    expect(s.peticiones()).toBe(3); // 1.000 + 1.000 + 500
  });

  it("con una tabla pequeña hace una sola petición", async () => {
    const s = servidor(34);
    const { data } = await leerTodo(s.pagina);
    expect(data).toHaveLength(34);
    expect(s.peticiones()).toBe(1);
  });

  it("tabla vacía", async () => {
    const s = servidor(0);
    const { data, error } = await leerTodo(s.pagina);
    expect(data).toEqual([]);
    expect(error).toBeNull();
    expect(s.peticiones()).toBe(1);
  });

  it("justo en el límite (2.000 filas) pide una página más y termina", async () => {
    const s = servidor(2000);
    const { data } = await leerTodo(s.pagina);
    expect(data).toHaveLength(2000);
    expect(s.peticiones()).toBe(3); // 1.000 + 1.000 + página vacía
  });

  it("si una página falla devuelve el error y lo ya leído, sin seguir pidiendo", async () => {
    let n = 0;
    const { data, error } = await leerTodo(async () => {
      n++;
      if (n === 2) return { data: null, error: { message: "boom" } };
      return { data: Array.from({ length: TAMANO_PAGINA }, (_, i) => ({ id: i })), error: null };
    });
    expect(error?.message).toBe("boom");
    expect(data).toHaveLength(TAMANO_PAGINA);
    expect(n).toBe(2);
  });

  it("respeta un tamaño de página personalizado", async () => {
    const s = servidor(25, 10);
    const { data } = await leerTodo(s.pagina, 10);
    expect(data).toHaveLength(25);
    expect(s.peticiones()).toBe(3);
  });
});
