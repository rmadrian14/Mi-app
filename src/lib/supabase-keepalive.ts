// Los proyectos gratuitos de Supabase se pausan tras una semana sin actividad
// (y reanudarlos es un paso manual). Una tarea programada del Worker (ver
// "triggers" en wrangler.jsonc y `scheduled` en src/server.ts) llama a esta
// función una vez al día: hace una consulta mínima a la API de datos con la clave
// pública, que no necesita sesión ni devuelve datos de nadie (la tabla pide
// sesión, así que con la clave pública responde 200 con una lista vacía).

export type ResultadoKeepAlive = { ok: boolean; estado: number; detalle: string };

export async function mantenerSupabaseActivo(
  opciones: { url?: string; clave?: string; fetchFn?: typeof fetch } = {},
): Promise<ResultadoKeepAlive> {
  const { url, clave, fetchFn = fetch } = opciones;
  if (!url || !clave) {
    return { ok: false, estado: 0, detalle: "Faltan la URL o la clave pública de Supabase." };
  }
  try {
    const res = await fetchFn(`${url.replace(/\/$/, "")}/rest/v1/fiscal_deadlines?select=id&limit=1`, {
      headers: { apikey: clave, Authorization: `Bearer ${clave}` },
    });
    return { ok: res.ok, estado: res.status, detalle: res.ok ? "Supabase responde." : `Respuesta inesperada (${res.status}).` };
  } catch (e) {
    return { ok: false, estado: 0, detalle: `No se pudo contactar con Supabase: ${(e as Error).message}` };
  }
}
