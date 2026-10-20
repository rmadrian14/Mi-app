// Validación de los datos que recibe la función de servidor que sube una factura
// en PDF y genera el enlace para enviarla (src/lib/invoice-email.functions.ts).
// Antes aceptaba cualquier cosa: un id con "../", datos que no eran un PDF o un
// archivo de cientos de MB. La función ya exige sesión; esto limita lo que una
// sesión válida puede mandar. Es una función pura, sin dependencias.

export type EnvioFactura = {
  projectId: string;
  filename: string;
  pdfBase64: string;
  recipientEmail: string;
  customerName?: string;
  invoiceNumber?: string;
  totalAmount?: number;
};

// Tamaño máximo del PDF ya decodificado (los PDF de factura pesan unos pocos MB).
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil(MAX_PDF_BYTES / 3) * 4;

const ID_PROYECTO = /^[A-Za-z0-9_-]{1,80}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function texto(valor: unknown, nombre: string, max: number, obligatorio: boolean): string | undefined {
  if (valor === undefined || valor === null || valor === "") {
    if (obligatorio) throw new Error(`Falta ${nombre}.`);
    return undefined;
  }
  if (typeof valor !== "string") throw new Error(`${nombre} no es válido.`);
  if (valor.length > max) throw new Error(`${nombre} es demasiado largo (máximo ${max} caracteres).`);
  return valor;
}

export function validarEnvioFactura(entrada: unknown): EnvioFactura {
  if (!entrada || typeof entrada !== "object") throw new Error("Los datos de la factura no son válidos.");
  const d = entrada as Record<string, unknown>;

  const projectId = texto(d.projectId, "El identificador del proyecto", 80, true)!;
  if (!ID_PROYECTO.test(projectId)) throw new Error("El identificador del proyecto no es válido.");

  const filename = texto(d.filename, "El nombre del archivo", 255, true)!;

  const pdfBase64 = texto(d.pdfBase64, "El PDF", MAX_BASE64_CHARS, true)!;
  if (pdfBase64.length % 4 !== 0 || !BASE64.test(pdfBase64)) throw new Error("El PDF no tiene un formato válido.");
  // Todo PDF empieza por "%PDF": se decodifican solo los primeros bytes para comprobarlo.
  if (!atob(pdfBase64.slice(0, 8)).startsWith("%PDF")) throw new Error("El archivo no es un PDF.");

  const recipientEmail = texto(d.recipientEmail, "El email del destinatario", 254, true)!.trim();
  if (!EMAIL.test(recipientEmail)) throw new Error("El email del destinatario no es válido.");

  const customerName = texto(d.customerName, "El nombre del cliente", 200, false);
  const invoiceNumber = texto(d.invoiceNumber, "El número de factura", 100, false);

  let totalAmount: number | undefined;
  if (d.totalAmount !== undefined && d.totalAmount !== null) {
    if (typeof d.totalAmount !== "number" || !Number.isFinite(d.totalAmount) || Math.abs(d.totalAmount) > 1e9) {
      throw new Error("El importe total no es válido.");
    }
    totalAmount = d.totalAmount;
  }

  return { projectId, filename, pdfBase64, recipientEmail, customerName, invoiceNumber, totalAmount };
}
