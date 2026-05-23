alter table public.rb_software_releases
  add column if not exists package_url text null,
  add column if not exists package_file_name text null,
  add column if not exists package_sha256 text null,
  add column if not exists package_size_bytes bigint null,
  add column if not exists package_uploaded_at timestamptz null;

alter table public.rb_software_releases
  drop constraint if exists rb_software_releases_package_sha256_check;

alter table public.rb_software_releases
  add constraint rb_software_releases_package_sha256_check
  check (package_sha256 is null or package_sha256 ~ '^[0-9A-Fa-f]{64}$');

alter table public.rb_software_releases
  drop constraint if exists rb_software_releases_package_size_bytes_check;

alter table public.rb_software_releases
  add constraint rb_software_releases_package_size_bytes_check
  check (package_size_bytes is null or package_size_bytes > 0);
