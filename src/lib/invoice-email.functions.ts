import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

// Dev-phase placeholder sender. Replace when the real domain is configured.
const TEST_FROM = 'facturas@test-veract.com';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const uploadInvoicePdfAndSend = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    projectId: string;
    filename: string;
    pdfBase64: string;
    recipientEmail: string;
    customerName?: string;
    invoiceNumber?: string;
    totalAmount?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const bytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${data.projectId}-${Date.now()}-${safeName}`;

    const { error: upErr } = await supabase.storage
      .from('invoice-pdfs')
      .upload(path, bytes, { contentType: 'application/pdf', upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: signed, error: signErr } = await supabase.storage
      .from('invoice-pdfs')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signErr || !signed) throw new Error(`Signed URL failed: ${signErr?.message}`);

    // DEV PHASE: email infra not yet configured. Log a simulated send so the
    // full client → upload → signed link flow can be tested end-to-end.
    console.info('[invoice-email:simulated]', {
      from: TEST_FROM,
      to: data.recipientEmail,
      subject: `Factura ${data.invoiceNumber ?? ''} disponible`,
      customer: data.customerName,
      total: data.totalAmount,
      downloadUrl: signed.signedUrl,
      expiresInDays: 7,
    });

    return {
      ok: true,
      simulated: true,
      from: TEST_FROM,
      to: data.recipientEmail,
      signedUrl: signed.signedUrl,
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
    };
  });