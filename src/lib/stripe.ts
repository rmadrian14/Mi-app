import { loadStripe, Stripe } from '@stripe/stripe-js';

export type StripeEnv = 'sandbox' | 'live';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith('pk_test_')) return 'sandbox';
  if (clientToken?.startsWith('pk_live_')) return 'live';
  throw new Error(
    'Stripe payments are not configured for this build. Completa la activación de pagos para habilitar el cobro.',
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}

export function isPaymentsConfigured(): boolean {
  return clientToken?.startsWith('pk_test_') || clientToken?.startsWith('pk_live_') || false;
}

export const PLAN_CATALOG = {
  basico_monthly:    { tier: 'basic',  name: 'Plan Básico',     price: '5,99 €/mes',  limit: 50,   productId: 'plan_basico' },
  intermedio_monthly:{ tier: 'medium', name: 'Plan Intermedio', price: '11,99 €/mes', limit: 250,  productId: 'plan_intermedio' },
  pro_monthly:       { tier: 'pro',    name: 'Plan Pro',        price: '19,99 €/mes', limit: 2500, productId: 'plan_pro' },
} as const;

export type PlanPriceId = keyof typeof PLAN_CATALOG;
export type PlanTier = (typeof PLAN_CATALOG)[PlanPriceId]['tier'];

export function planFromPriceId(priceId?: string | null): PlanPriceId | null {
  if (!priceId) return null;
  return priceId in PLAN_CATALOG ? (priceId as PlanPriceId) : null;
}