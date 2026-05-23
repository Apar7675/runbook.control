alter table public.rb_software_releases
  add column if not exists release_intent text not null default 'optional';

update public.rb_software_releases
set release_intent = 'required'
where required = true
  and (release_intent is null or release_intent = 'optional');

alter table public.rb_software_releases
  drop constraint if exists rb_software_releases_release_intent_check;

alter table public.rb_software_releases
  add constraint rb_software_releases_release_intent_check
  check (release_intent = any (array['optional'::text, 'recommended'::text, 'required'::text]));
