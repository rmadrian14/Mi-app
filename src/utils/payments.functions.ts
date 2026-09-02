import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from '@/lib/stripe.server';

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };
type OverageResult = { charged: boolean; blockIndex?: number; error?: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error('Invalid userId');
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const c = existing.data[0];
      if (options.userId && c.metadata?.userId !== options.userId) {
        await stripe.customers.update(c.id, {
          metadata: { ...c.metadata, userId: options.userId },
        });
      }
      return c.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error('Invalid priceId');
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const { userId, supabase } = context;
      const { data: { user } } = await supabase.auth.getUser();
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error('Price not found');
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === 'recurring';

      const customerId = await resolveOrCreateCustomer(stripe, {
        email: user?.email ?? undefined,
        userId,
      });

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? 'subscription' : 'payment',
        ui_mode: 'embedded_page',
        return_url: data.returnUrl,
        customer: customerId,
        automatic_tax: { enabled: true },
        customer_update: { address: 'auto', name: 'auto' },
        metadata: { userId },
        ...(isRecurring && { subscription_data: { metadata: { userId } } }),
      });

      return { clientSecret: session.client_secret ?? '' };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    try {
      const { supabase, userId } = context;
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .eq('environment', data.environment)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub?.stripe_customer_id) return { error: 'No tienes ninguna suscripción activa.' };
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Carga un bloque fijo de 2,00€ por cada 500 facturas por encima del
 * límite del plan Pro (2500). Se llama justo antes de enviar a la AEAT
 * cuando el contador entra en un nuevo bloque (2501, 3001, 3501, ...).
 * Idempotente: la tabla pro_overage_blocks evita duplicados.
 */
export const chargeProOverageIfNeeded = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { invoiceNumberInPeriod: number; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<OverageResult> => {
    try {
      const { supabase, userId } = context;
      const PRO_LIMIT = 2500;
      const BLOCK_SIZE = 500;
      const BLOCK_PRICE_CENTS = 200;

      if (data.invoiceNumberInPeriod <= PRO_LIMIT) return { charged: false };
      const over = data.invoiceNumberInPeriod - PRO_LIMIT;
      // Bloques 1-indexed: factura 2501 -> bloque 1, 3001 -> bloque 2 ...
      const blockIndex = Math.ceil(over / BLOCK_SIZE);
      // Solo cargar la PRIMERA factura del bloque (2501, 3001, 3501, ...)
      const isFirstOfBlock = (over - 1) % BLOCK_SIZE === 0;
      if (!isFirstOfBlock) return { charged: false };

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id, stripe_subscription_id, current_period_start, price_id')
        .eq('user_id', userId)
        .eq('environment', data.environment)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub || sub.price_id !== 'pro_monthly') {
        return { charged: false, error: 'Plan Pro no activo' };
      }

      const periodStart = sub.current_period_start ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      // Idempotencia: ¿ya cobrado este bloque en este periodo?
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: existing } = await supabaseAdmin
        .from('pro_overage_blocks')
        .select('id')
        .eq('user_id', userId)
        .eq('billing_period_start', periodStart)
        .eq('block_index', blockIndex)
        .eq('environment', data.environment)
        .maybeSingle();
      if (existing) return { charged: false, blockIndex };

      const stripe = createStripeClient(data.environment);
      const item = await stripe.invoiceItems.create({
        customer: sub.stripe_customer_id,
        subscription: sub.stripe_subscription_id,
        amount: BLOCK_PRICE_CENTS,
        currency: 'eur',
        description: `Bloque de exceso #${blockIndex} (500 facturas) sobre Plan Pro`,
      });

      await supabaseAdmin.from('pro_overage_blocks').insert({
        user_id: userId,
        billing_period_start: periodStart,
        block_index: blockIndex,
        invoice_count_at_charge: data.invoiceNumberInPeriod,
        stripe_invoice_item_id: item.id,
        environment: data.environment,
      });

      return { charged: true, blockIndex };
    } catch (error) {
      return { charged: false, error: getStripeErrorMessage(error) };
    }
  });