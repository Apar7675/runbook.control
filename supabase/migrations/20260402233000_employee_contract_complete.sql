-- Complete catch-up migration for the current employees table contract used by Desktop HR,
-- Control provisioning, and the employee directory API.
--
-- This migration is intentionally idempotent so it can be applied safely whether or not
-- 20260402190000_employee_profile_sync.sql was deployed previously.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN full_name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'preferred_name'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN preferred_name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'username'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN username text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN email text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN phone text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'department'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN department text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'job_title'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN job_title text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN company_name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN status text NOT NULL DEFAULT 'Active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'home_address_1'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN home_address_1 text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'home_address_2'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN home_address_2 text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'home_city'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN home_city text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'home_state'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN home_state text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'home_postal_code'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN home_postal_code text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'social_security_number'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN social_security_number text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'runbook_access_enabled'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN runbook_access_enabled boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'mobile_access_enabled'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN mobile_access_enabled boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'workstation_access_enabled'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN workstation_access_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_dashboard'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_dashboard boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_po_entry'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_po_entry boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_components'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_components boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_ballooning'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_ballooning boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_inspection'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_inspection boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_gcoding'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_gcoding boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_routing_db'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_routing_db boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_work_orders'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_work_orders boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_messaging'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_messaging boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_library'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_library boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_hr_department'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_hr_department boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'can_settings'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN can_settings boolean NOT NULL DEFAULT false;
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
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'avatar_url_256'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN avatar_url_256 text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'avatar_url_512'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN avatar_url_512 text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'avatar_updated_at'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN avatar_updated_at timestamptz NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'source_device_id'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN source_device_id text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'source_local_employee_id'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN source_local_employee_id integer NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ix_employees_shop_source_local
  ON public.employees (shop_id, source_device_id, source_local_employee_id)
  WHERE source_device_id <> '' AND source_local_employee_id IS NOT NULL;

UPDATE public.employees
SET
  full_name = COALESCE(NULLIF(full_name, ''), display_name),
  preferred_name = COALESCE(NULLIF(preferred_name, ''), display_name),
  status = CASE WHEN COALESCE(is_active, false) THEN 'Active' ELSE COALESCE(NULLIF(status, ''), 'Inactive') END,
  workstation_session_timeout_minutes = CASE
    WHEN COALESCE(workstation_session_timeout_minutes, 0) < 1 THEN 15
    ELSE workstation_session_timeout_minutes
  END,
  avatar_updated_at = CASE
    WHEN avatar_updated_at IS NULL AND (NULLIF(avatar_url_256, '') IS NOT NULL OR NULLIF(avatar_url_512, '') IS NOT NULL)
      THEN NOW()
    ELSE avatar_updated_at
  END
WHERE
  full_name = ''
  OR preferred_name = ''
  OR status = ''
  OR COALESCE(workstation_session_timeout_minutes, 0) < 1
  OR (avatar_updated_at IS NULL AND (NULLIF(avatar_url_256, '') IS NOT NULL OR NULLIF(avatar_url_512, '') IS NOT NULL));
