-- Subscriptions table fed by Stripe webhook
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Pro overage blocks (2€ per 500 invoices above 2500)
CREATE TABLE public.pro_overage_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  billing_period_start timestamptz NOT NULL,
  block_index integer NOT NULL,
  invoice_count_at_charge integer NOT NULL,
  stripe_invoice_item_id text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, billing_period_start, block_index, environment)
);

CREATE INDEX idx_overage_user_period ON public.pro_overage_blocks(user_id, billing_period_start);

GRANT SELECT ON public.pro_overage_blocks TO authenticated;
GRANT ALL ON public.pro_overage_blocks TO service_role;

ALTER TABLE public.pro_overage_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own overage"
  ON public.pro_overage_blocks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages overage"
  ON public.pro_overage_blocks FOR ALL
  USING (auth.role() = 'service_role');

-- Helper to gate features server-side
CREATE OR REPLACE FUNCTION public.has_active_subscription(
  user_uuid uuid,
  check_env text DEFAULT 'sandbox'
) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        (status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, service_role;