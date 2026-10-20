import { describe, expect, it } from "vitest";
import { MAX_PDF_BYTES, validarEnvioFactura } from "./invoice-email-validation";

const pdf = (extra = "") => btoa("%PDF-1.4\n" + "x".repeat(40) + extra);
const valido = () => ({
  projectId: "3f8c1c0e-2d4a-4f6b-9a77-0c5d1e2f3a4b",
  filename: "factura-2026-001.pdf",
  pdfBase64: pdf(),
  recipientEmail: "cliente@empresa.es",
  customerName: "Empresa S.L.",
  invoiceNumber: "2026-001",
  totalAmount: 1210.5,
});
const falla = (cambio: Record<string, unknown>, mensaje: RegExp) =>
  expect(() => validarEnvioFactura({ ...valido(), ...cambio })).toThrow(mensaje);

describe("validarEnvioFactura", () => {
  it("acepta una petición correcta y la devuelve tal cual", () => {
    const v = valido();
    expect(validarEnvioFactura(v)).toEqual(v);
  });

  it("los campos opcionales pueden faltar o venir vacíos (la pantalla puede enviar '')", () => {
    const r = validarEnvioFactura({ ...valido(), customerName: undefined, invoiceNumber: "", totalAmount: undefined });
    expect(r.customerName).toBeUndefined();
    expect(r.invoiceNumber).toBeUndefined();
    expect(r.totalAmount).toBeUndefined();
  });

  it("rechaza lo que no es un objeto", () => {
    for (const x of [null, undefined, "texto", 42, []]) {
      if (Array.isArray(x)) continue; // un array es un objeto y falla por faltar campos
      expect(() => validarEnvioFactura(x)).toThrow(/no son válidos/);
    }
    expect(() => validarEnvioFactura([])).toThrow();
  });

  it("rechaza ids de proyecto con rutas o caracteres raros", () => {
    falla({ projectId: "../../otro-usuario" }, /identificador del proyecto/);
    falla({ projectId: "a/b" }, /identificador del proyecto/);
    falla({ projectId: "a b" }, /identificador del proyecto/);
    falla({ projectId: "x".repeat(81) }, /demasiado largo/);
    falla({ projectId: "" }, /Falta/);
    falla({ projectId: 12 }, /no es válido/);
  });

  it("exige nombre de archivo", () => {
    falla({ filename: "" }, /Falta/);
    falla({ filename: "x".repeat(256) }, /demasiado largo/);
  });

  it("solo admite PDFs: base64 válido y cabecera %PDF", () => {
    falla({ pdfBase64: "" }, /Falta/);
    falla({ pdfBase64: "no es base64!!" }, /formato válido/);
    falla({ pdfBase64: "AAA" }, /formato válido/); // longitud no múltiplo de 4
    falla({ pdfBase64: btoa("GIF89a-esto-no-es-un-pdf") }, /no es un PDF/);
    falla({ pdfBase64: "AAAA" }, /no es un PDF/);
  });

  it("rechaza PDFs de más de 10 MB sin llegar a decodificarlos", () => {
    const enorme = "A".repeat(Math.ceil(MAX_PDF_BYTES / 3) * 4 + 4);
    falla({ pdfBase64: enorme }, /demasiado largo/);
  });

  it("valida el email del destinatario", () => {
    for (const malo of ["", "sin-arroba", "a@b", "a b@c.d", "@x.com", "x".repeat(250) + "@a.es"]) {
      expect(() => validarEnvioFactura({ ...valido(), recipientEmail: malo }), malo.slice(0, 20)).toThrow();
    }
    expect(validarEnvioFactura({ ...valido(), recipientEmail: "  yo@dominio.com " }).recipientEmail).toBe("yo@dominio.com");
  });

  it("limita los textos opcionales y valida el importe", () => {
    falla({ customerName: "x".repeat(201) }, /demasiado largo/);
    falla({ invoiceNumber: "x".repeat(101) }, /demasiado largo/);
    falla({ customerName: 5 }, /no es válido/);
    falla({ totalAmount: NaN }, /importe/);
    falla({ totalAmount: Infinity }, /importe/);
    falla({ totalAmount: "100" }, /importe/);
    falla({ totalAmount: 2e9 }, /importe/);
    expect(validarEnvioFactura({ ...valido(), totalAmount: 0 }).totalAmount).toBe(0);
  });
});
