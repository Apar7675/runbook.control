-- clean migration (no BOM)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rb_shops' AND column_name = 'billing_status'
  ) THEN
    ALTER TABLE public.rb_shops ADD COLUMN billing_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rb_shops' AND column_name = 'trial_started_at'
  ) THEN
    ALTER TABLE public.rb_shops ADD COLUMN trial_started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rb_shops' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE public.rb_shops ADD COLUMN trial_ends_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rb_shops' AND column_name = 'billing_current_period_end'
  ) THEN
    ALTER TABLE public.rb_shops ADD COLUMN billing_current_period_end timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rb_shops' AND column_name = 'grace_ends_at'
  ) THEN
    ALTER TABLE public.rb_shops ADD COLUMN grace_ends_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rb_shops' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.rb_shops ADD COLUMN stripe_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rb_shops' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE public.rb_shops ADD COLUMN stripe_subscription_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rb_shops' AND column_name = 'subscription_plan'
  ) THEN
    ALTER TABLE public.rb_shops ADD COLUMN subscription_plan text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rb_shops' AND column_name = 'entitlement_override'
  ) THEN
    ALTER TABLE public.rb_shops ADD COLUMN entitlement_override text;
  END IF;
END
$$;

UPDATE public.rb_shops
SET billing_status = COALESCE(NULLIF(lower(trim(billing_status)), ''), 'trialing')
WHERE billing_status IS NULL OR trim(billing_status) = '';

ALTER TABLE public.rb_shops
  ALTER COLUMN billing_status SET DEFAULT 'trialing';

ALTER TABLE public.rb_shops
  ALTER COLUMN billing_status SET NOT NULL;

ALTER TABLE public.rb_shops
  DROP CONSTRAINT IF EXISTS rb_shops_billing_status_check;

ALTER TABLE public.rb_shops
  ADD CONSTRAINT rb_shops_billing_status_check
  CHECK (billing_status IN ('trialing', 'active', 'past_due', 'canceled', 'expired'));

UPDATE public.rb_shops
SET entitlement_override = NULL
WHERE entitlement_override IS NOT NULL
  AND lower(trim(entitlement_override)) NOT IN ('allow', 'restricted');

ALTER TABLE public.rb_shops
  DROP CONSTRAINT IF EXISTS rb_shops_entitlement_override_check;

ALTER TABLE public.rb_shops
  ADD CONSTRAINT rb_shops_entitlement_override_check
  CHECK (entitlement_override IS NULL OR entitlement_override IN ('allow', 'restricted'));
