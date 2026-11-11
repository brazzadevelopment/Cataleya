-- =====================================================================
-- Cataleya Cup kao aplikacija organizacije (ne samo rezultati):
--   * serija turnira (Indoor, Proljeće, Jesen) za kartice u donjem izborniku
--   * vijesti, galerija, video (YouTube), sponzori
--   * tekstovi stranica (O nama, Impresum, Kontakt) u site_settings
--   * poruke s kontakt forme (čita ih samo organizacija, preko servera)
-- Svi čitaju sve osim poruka; piše samo server (PIN organizacije).
-- Može se pokrenuti više puta.
-- =====================================================================

alter table public.tournaments add column if not exists series text;
alter table public.tournaments drop constraint if exists tournaments_series_check;
alter table public.tournaments add constraint tournaments_series_check
  check (series is null or series in ('indoor', 'proljece', 'jesen'));

create table if not exists public.news (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (length(title) between 1 and 200),
  summary       text,
  body          text,
  image_path    text,
  published_at  timestamptz not null default now(),
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists news_published on public.news (published_at desc);

create table if not exists public.gallery (
  id             uuid primary key default gen_random_uuid(),
  image_path     text not null,
  caption        text,
  tournament_id  uuid references public.tournaments (id) on delete set null,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists public.videos (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (length(title) between 1 and 200),
  youtube_id    text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  is_live       boolean not null default false,
  published_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table if not exists public.sponsors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 120),
  logo_path   text,
  url         text check (url is null or url ~ '^https?://'),
  tier        text not null default 'partner' check (tier in ('glavni', 'zlatni', 'partner')),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.site_settings (
  key         text primary key check (key ~ '^[a-z_]{1,40}$'),
  value       text not null default '',
  updated_at  timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 120),
  email       text not null check (length(email) between 3 and 200),
  phone       text check (phone is null or length(phone) <= 40),
  message     text not null check (length(message) between 1 and 4000),
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists contact_messages_created on public.contact_messages (created_at desc);

-- Prava -----------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['news', 'gallery', 'videos', 'sponsors', 'site_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    execute format('drop policy if exists "svi čitaju" on public.%I', t);
    execute format('create policy "svi čitaju" on public.%I for select using (true)', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- Skice vijesti (is_published = false) aplikacija ne prikazuje gledateljima; nisu tajne.

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;

-- Početni tekstovi (ne prepisuju ono što je organizacija već upisala).
insert into public.site_settings (key, value) values
  ('about', 'Cataleya Cup je međunarodni nogometni turnir za mlade nogometaše koji se u Zadru održava od 2022. godine.

Svake godine igra se više turnira: zimski Indoor u dvorani u Svetom Filipu i Jakovu, proljetni i jesenski turnir na otvorenom. Na njima se natječu dječje momčadi iz Hrvatske i inozemstva, po godištima.

Cilj turnira je da djeca igraju puno utakmica protiv novih protivnika, upoznaju druge klubove i provedu lijep vikend u Zadru i okolici.'),
  ('instagram', 'https://www.instagram.com/cataleya.cup/'),
  ('website', 'https://cataleya-cup.com'),
  ('publisher', 'Cataleya Cup'),
  ('address', 'Zadar, Hrvatska')
on conflict (key) do nothing;
