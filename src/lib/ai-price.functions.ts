import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const Input = z.object({
  messages: z.array(Message).min(1).max(10).optional(),
  description: z.string().min(1).max(4000).optional(),
  experience: z.enum(["junior", "mid", "senior"]),
  companySize: z.enum(["micro", "pyme", "grande"]),
  /** Number of clarification turns already used (0..2). When >=2 the IA MUST finalize. */
  turn: z.number().int().min(0).max(3).optional(),
  /** Absolute minimum hourly rate (€/h) the AI must never go below. */
  floorHourlyRate: z.coerce.number().min(0).max(1000).optional(),
});

const Output = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("needs_info"),
    question: z.string().min(1).max(500),
  }),
  z.object({
    status: z.literal("done"),
    estimatedHours: z.coerce.number(),
    hourlyRate: z.coerce.number(),
    baseAmount: z.coerce.number(),
    toolsCost: z.coerce.number(),
    toolsBreakdown: z
      .array(z.object({ name: z.string(), cost: z.coerce.number() }))
      .optional()
      .default([]),
    priceWithVat: z.coerce.number(),
    reasoning: z.string(),
  }),
]);

export const estimateProjectPrice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");

    // Backward-compat: accept legacy { description } payloads from stale clients.
    const messages =
      data.messages ??
      (data.description
        ? [
            {
              role: "user" as const,
              content: `Descripción del proyecto: """${data.description}"""\n\nExperiencia: ${data.experience}. Cliente: ${data.companySize}.`,
            },
          ]
        : null);
    if (!messages) throw new Error("Faltan datos del proyecto.");
    const turn = data.turn ?? 0;
    const mustFinalize = turn >= 2;
    const floor = data.floorHourlyRate && data.floorHourlyRate > 0 ? data.floorHourlyRate : 0;

    const system = `Eres un asistente experto en presupuestos para freelancers y autónomos en España en 2026.

Tu trabajo: analizar la descripción del proyecto y devolver un presupuesto realista.

FLUJO CONVERSACIONAL (máx 3 interacciones totales):
- Si la descripción es suficientemente clara, devuelve directamente el presupuesto.
- Si faltan datos CLAVE sobre los ENTREGABLES (nº de páginas, si incluye diseño + desarrollo, nº de revisiones, formato final, etc.), haz UNA pregunta breve y concreta. Máximo 2 preguntas en total.
- Esta es la interacción nº ${turn + 1} de 3. ${mustFinalize ? "OBLIGATORIO: ya NO puedes preguntar más, debes devolver el presupuesto final, asumiendo lo razonable." : ""}

TARIFA HORARIA DINÁMICA (€/h):
- Determina la tarifa cruzando: experiencia del profesional, tamaño del cliente y complejidad técnica REAL extraída del texto (integraciones, dependencias, urgencia).
- Rangos orientativos: junior 20-45€/h · mid 35-75€/h · senior 60-130€/h. Clientes "grande" o tareas muy complejas tiran al alza; ejecuciones simples para "micro" tiran a la baja.
- SUELO ABSOLUTO: la tarifa NUNCA puede ser inferior a ${floor.toFixed(2)} €/h (calculado a partir de los costes fijos y objetivo de ingresos del usuario). Si tu tarifa de mercado calculada queda por debajo, súbela hasta este suelo.
- Profesional: ${data.experience}. Cliente: ${data.companySize}.

FILTRO DE SENSATEZ EN HORAS:
- Valida que las horas casen con los entregables descritos. Rangos de referencia: logo simple 3-8h · landing 15-40h · web completa 120-400h · estrategia SEO 40-100h · branding 25-80h.
- Si el usuario sugiere horas absurdas (muy por encima o por debajo), CORRIGE silenciosamente hacia el rango de mercado realista y explica brevemente la corrección en "reasoning".

HERRAMIENTAS Y GASTOS DIRECTOS (regla estricta):
- NUNCA inventes ni asumas costes de software, licencias, plugins, hosting o herramientas.
- Solo añade un coste en "toolsBreakdown" si el usuario ha escrito EXPLÍCITAMENTE el nombre Y el importe en la descripción (ej: "Figma 15€/mes", "plugin X 80€"). Si no hay nada explícito, "toolsCost" = 0 y "toolsBreakdown" = [].

FISCALIDAD (estricto):
- NO apliques IRPF ni retenciones. El único impuesto es el IVA 21% sobre (baseAmount + toolsCost).
- baseAmount = hourlyRate * estimatedHours (sin impuestos, sin herramientas).
- priceWithVat = redondeado a múltiplos de 10€ = (baseAmount + toolsCost) * 1.21.

Devuelve ESTRICTAMENTE un JSON válido con UNA de estas formas y NADA más:

Si necesitas más info (solo si turn < 2):
{"status": "needs_info", "question": "<pregunta breve en español sobre entregables>"}

Si ya puedes estimar:
{"status": "done", "estimatedHours": <int>, "hourlyRate": <€/h>, "baseAmount": <€ sin IVA, sin herramientas>, "toolsCost": <€, 0 si no se mencionan>, "toolsBreakdown": [{"name":"<nombre>","cost":<€>}], "priceWithVat": <€ total con IVA>, "reasoning": "<1-2 frases>"}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          ...messages,
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Límite de uso de IA alcanzado. Inténtalo en unos minutos.");
      if (res.status === 402) throw new Error("Créditos de IA agotados. Añade créditos en Settings.");
      throw new Error(`Error IA (${res.status}): ${text.slice(0, 120)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }
    // Safety: if the model tried to ask another question when it shouldn't, force a basic estimate fallback.
    if (mustFinalize && (parsed as { status?: string })?.status !== "done") {
      throw new Error("La IA no pudo finalizar la estimación. Reformula la descripción.");
    }
    // Sanitize numeric fields the model may emit as locale-formatted strings ("1.500", "1,500 €").
    const p = parsed as Record<string, unknown>;
    const toNum = (v: unknown): number => {
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const cleaned = v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
        const n = parseFloat(cleaned);
        return Number.isFinite(n) ? n : NaN;
      }
      return NaN;
    };
    if (p.status === "done") {
      const price = toNum(p.priceWithVat);
      const hours = toNum(p.estimatedHours);
      let rate = toNum(p.hourlyRate);
      let baseAmount = toNum(p.baseAmount);
      const toolsCost = Number.isFinite(toNum(p.toolsCost)) ? Math.max(0, toNum(p.toolsCost)) : 0;
      // If the model returned "done" but without valid numbers, treat as an
      // intermediate clarification turn instead of failing validation.
      if (!Number.isFinite(price) || !Number.isFinite(hours) || price <= 0 || hours <= 0) {
        if (!mustFinalize) {
          return Output.parse({
            status: "needs_info",
            question:
              typeof p.question === "string" && p.question.length > 0
                ? p.question
                : "¿Puedes detallar un poco más los entregables principales del proyecto?",
          });
        }
        throw new Error("La IA no devolvió un precio válido. Reformula la descripción.");
      }
      // Derive missing fields and enforce the hourly floor server-side.
      if (!Number.isFinite(rate) || rate <= 0) {
        rate = Math.max(((price / 1.21) - toolsCost) / Math.max(hours, 1), 0);
      }
      if (floor > 0 && rate < floor) rate = floor;
      if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
        baseAmount = rate * hours;
      }
      // Recompute final price from authoritative parts and round to multiples of 10.
      const recomputed = Math.round(((baseAmount + toolsCost) * 1.21) / 10) * 10;
      p.priceWithVat = recomputed;
      p.estimatedHours = hours;
      p.hourlyRate = Math.round(rate * 100) / 100;
      p.baseAmount = Math.round(baseAmount * 100) / 100;
      p.toolsCost = Math.round(toolsCost * 100) / 100;
      if (!Array.isArray(p.toolsBreakdown)) p.toolsBreakdown = [];
    }
    return Output.parse(parsed);
  });