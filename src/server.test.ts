import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// Ejecuta scheduled() como lo haría Cloudflare y espera a lo que registre en waitUntil.
async function dispararTarea() {
  const pendientes: Promise<unknown>[] = [];
  await worker.scheduled({}, {}, { waitUntil: (p) => void pendientes.push(p) });
  await Promise.all(pendientes);
}

describe("tarea programada del Worker (keep-alive de Supabase)", () => {
  it("hace una consulta pública a Supabase con la URL y la clave del entorno", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://ejemplo.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "clave-publica");
    const peticiones: { url: string; clave: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      peticiones.push({ url: String(url), clave: (init.headers as Record<string, string>).apikey });
      return new Response("[]", { status: 200 });
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await dispararTarea();
    expect(peticiones).toEqual([{ url: "https://ejemplo.supabase.co/rest/v1/fiscal_deadlines?select=id&limit=1", clave: "clave-publica" }]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[keepalive] OK (200)"));
  });

  it("si Supabase falla, lo deja en el log y no revienta el Worker", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://ejemplo.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "clave-publica");
    vi.stubGlobal("fetch", async () => {
      throw new Error("sin red");
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(dispararTarea()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[keepalive] FALLO"));
  });
});
