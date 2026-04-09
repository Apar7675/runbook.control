DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'mobile_pin_salt_base64'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN mobile_pin_salt_base64 text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'mobile_pin_hash_base64'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN mobile_pin_hash_base64 text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'workstation_access_enabled'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN workstation_access_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_timeclock'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_timeclock boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_dashboard_view'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_dashboard_view boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_jobs_module'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_jobs_module boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_inspection_entry'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_inspection_entry boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_camera_view'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_camera_view boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'workstation_session_timeout_minutes'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN workstation_session_timeout_minutes integer NOT NULL DEFAULT 15;
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS ix_employees_shop_workstation_access
  ON public.employees (shop_id, workstation_access_enabled, is_active);
