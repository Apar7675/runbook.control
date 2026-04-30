CREATE TABLE IF NOT EXISTS public.rb_ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  user_id uuid,
  device_id uuid,
  feature text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  response_id text NOT NULL DEFAULT '',
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  page_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_rb_ai_usage_events_shop_created
  ON public.rb_ai_usage_events (shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_rb_ai_usage_events_device_created
  ON public.rb_ai_usage_events (device_id, created_at DESC);
