import { describe, expect, it } from "vitest";
import { mantenerSupabaseActivo } from "./supabase-keepalive";

const respuesta = (status: number) => (async () => new Response("[]", { status })) as unknown as typeof fetch;

describe("mantenerSupabaseActivo", () => {
  it("hace una consulta mínima a la API de datos con la clave pública", async () => {
    let visto: { url: string; cabeceras: Record<string, string> } | null = null;
    const fetchFn = (async (url: string, init: RequestInit) => {
      visto = { url, cabeceras: init.headers as Record<string, string> };
      return new Response("[]", { status: 200 });
    }) as unknown as typeof fetch;
    const r = await mantenerSupabaseActivo({ url: "https://abc.supabase.co/", clave: "clave-publica", fetchFn });
    expect(r).toMatchObject({ ok: true, estado: 200 });
    expect(visto!.url).toBe("https://abc.supabase.co/rest/v1/fiscal_deadlines?select=id&limit=1");
    expect(visto!.cabeceras).toEqual({ apikey: "clave-publica", Authorization: "Bearer clave-publica" });
  });

  it("avisa si Supabase responde con error", async () => {
    const r = await mantenerSupabaseActivo({ url: "https://abc.supabase.co", clave: "k", fetchFn: respuesta(503) });
    expect(r).toMatchObject({ ok: false, estado: 503 });
  });

  it("no lanza si falla la red", async () => {
    const fetchFn = (async () => {
      throw new Error("sin red");
    }) as unknown as typeof fetch;
    const r = await mantenerSupabaseActivo({ url: "https://abc.supabase.co", clave: "k", fetchFn });
    expect(r.ok).toBe(false);
    expect(r.detalle).toContain("sin red");
  });

  it("sin URL o sin clave no llama a nada", async () => {
    let llamadas = 0;
    const fetchFn = (async () => {
      llamadas++;
      return new Response("[]");
    }) as unknown as typeof fetch;
    expect((await mantenerSupabaseActivo({ clave: "k", fetchFn })).ok).toBe(false);
    expect((await mantenerSupabaseActivo({ url: "https://x.co", fetchFn })).ok).toBe(false);
    expect(llamadas).toBe(0);
  });
});
