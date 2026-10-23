-- =====================================================================
-- Turnir: shema baze za Supabase (Postgres 15+)
--
-- Pokretanje: Supabase → SQL Editor → zalijepi cijelu datoteku → Run.
--
-- Načela:
--   * Svi čitaju (gledatelji nemaju račun ni prijavu).
--   * Nitko ne piše izravno u bazu. Sve izmjene idu preko serverskih
--     funkcije (Supabase Edge Function `api`), koja provjeri PIN i piše
--     ključem service_role.
--   * PIN-ovi:
--       glavni PIN   = uređivanje svega u turniru (organizator)
--       PIN terena   = upis rezultata samo za utakmice na tom terenu
--   * Tablice skupina se NE spremaju, računaju se iz utakmica.
--   * Nema osobnih podataka djece.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tipovi
-- ---------------------------------------------------------------------

create type public.match_stage as enum (
  'group',          -- skupina
  'round_of_16',    -- osmina finala
  'quarterfinal',   -- četvrtfinale
  'semifinal',      -- polufinale
  'third_place',    -- za 3. mjesto
  'final',          -- finale
  'placement'       -- utakmice za plasman
);

create type public.match_status as enum ('scheduled', 'live', 'finished', 'cancelled');

create type public.pin_role as enum ('admin', 'field');

-- ---------------------------------------------------------------------
-- Turnir
-- ---------------------------------------------------------------------

create table public.tournaments (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name             text not null check (length(name) between 2 and 120),
  place            text,                       -- npr. 'Privlaka, Zadar'
  venue            text,                       -- npr. 'prirodni teren'
  start_date       date not null,
  end_date         date not null,
  timezone         text not null default 'Europe/Zagreb',
  logo_path        text,                       -- put u Storage bucketu 'logos'
  cover_path       text,                       -- naslovna slika (plakat turnira)
  color_primary    text not null default '#0f3d24' check (color_primary ~ '^#[0-9a-fA-F]{6}$'),
  color_secondary  text not null default '#f2c230' check (color_secondary ~ '^#[0-9a-fA-F]{6}$'),
  description      text,
  rules            text,                       -- pravila turnira, upisuje organizator
  points_win       smallint not null default 3,
  points_draw      smallint not null default 1,
  points_loss      smallint not null default 0,
  -- Redoslijed kod jednakih bodova (bodovi su uvijek prvi kriterij).
  tiebreakers      text[] not null default array['head_to_head', 'goal_difference', 'goals_for', 'lot'],
  scorers_enabled  boolean not null default false,  -- faza 2, organizator uključi sam
  is_published     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_date >= start_date),
  check (tiebreakers <@ array['head_to_head', 'goal_difference', 'goals_for',
                              'wins', 'fewer_goals_against', 'fewer_cards', 'lot']::text[])
);

-- ---------------------------------------------------------------------
-- Kategorije, tereni, momčadi, skupine
-- Svaka tablica nosi tournament_id; složeni strani ključevi jamče da se
-- podaci ne miješaju između turnira.
-- ---------------------------------------------------------------------

create table public.categories (
  id                uuid primary key default gen_random_uuid(),
  tournament_id     uuid not null references public.tournaments (id) on delete cascade,
  name              text not null,              -- npr. '2019. – U8'
  birth_year        smallint,
  match_minutes     smallint not null default 25 check (match_minutes between 1 and 120),
  players_on_field  smallint check (players_on_field between 1 and 11),
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  unique (tournament_id, name),
  unique (id, tournament_id)
);

create table public.fields (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  name           text not null,                 -- 'Arbanasi 1'
  venue          text,                          -- lokacija, npr. 'Arbanasi'
  maps_url       text check (maps_url is null or maps_url ~ '^https://'),
  sort_order     smallint not null default 0,
  unique (tournament_id, name),
  unique (id, tournament_id)
);

create table public.teams (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null,
  category_id    uuid not null,
  name           text not null,                 -- 'NK Zadarnova bijeli'
  short_name     text,
  logo_path      text,
  created_at     timestamptz not null default now(),
  foreign key (category_id, tournament_id)
    references public.categories (id, tournament_id) on delete cascade,
  unique (category_id, name),
  unique (id, category_id)
);

create table public.groups (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null,
  category_id    uuid not null,
  name           text not null check (name ~ '^[A-Z]{1,2}$'),  -- 'A', 'B', ...
  sort_order     smallint not null default 0,
  foreign key (category_id, tournament_id)
    references public.categories (id, tournament_id) on delete cascade,
  unique (category_id, name),
  unique (id, category_id)
);

create table public.group_teams (
  tournament_id  uuid not null,
  category_id    uuid not null,
  group_id       uuid not null,
  team_id        uuid not null,
  -- Ručni ždrijeb: kad kriteriji ne razdvoje momčadi, organizator
  -- upiše redoslijed (1 = bolji). Prazno dok ne treba.
  lot_rank       smallint check (lot_rank > 0),
  primary key (group_id, team_id),
  unique (team_id),
  foreign key (category_id, tournament_id)
    references public.categories (id, tournament_id) on delete cascade,
  foreign key (group_id, category_id)
    references public.groups (id, category_id) on delete cascade,
  foreign key (team_id, category_id)
    references public.teams (id, category_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- Utakmice i pravila prolaska
--
-- Pravilo prolaska organizator upisuje u mjesto (slot) utakmice:
--   '1A'      = 1. u skupini A
--   'W:ČF1'   = pobjednik utakmice ČF1
--   'L:PF2'   = poraženi u utakmici PF2
--   '2#6'     = 6. najbolji drugoplasirani iz svih skupina
-- Kad su uvjeti ispunjeni, server upiše momčad u home_team_id /
-- away_team_id (osim ako je teams_locked = true).
--
-- winner_place / loser_place daju konačni poredak (npr. finale 1/2).
-- ---------------------------------------------------------------------

create table public.matches (
  id                uuid primary key default gen_random_uuid(),
  tournament_id     uuid not null,
  category_id       uuid not null,
  stage             public.match_stage not null default 'group',
  group_id          uuid,
  code              text check (code ~ '^[^[:space:]:]{1,12}$'),  -- 'ČF1', 'PF1', 'F'
  label             text,                                          -- 'Četvrtfinale 1'
  home_team_id      uuid,
  away_team_id      uuid,
  home_source       text check (home_source ~ '^([1-9][0-9]?[A-Z]{1,2}|[1-9]#[1-9][0-9]?|[WL]:[^[:space:]:]{1,12})$'),
  away_source       text check (away_source ~ '^([1-9][0-9]?[A-Z]{1,2}|[1-9]#[1-9][0-9]?|[WL]:[^[:space:]:]{1,12})$'),
  field_id          uuid,
  starts_at         timestamptz,                -- prazno = termin još nije poznat
  duration_minutes  smallint check (duration_minutes between 1 and 120),  -- prazno = iz kategorije
  home_score        smallint check (home_score >= 0),
  away_score        smallint check (away_score >= 0),
  home_penalties    smallint check (home_penalties >= 0),
  away_penalties    smallint check (away_penalties >= 0),
  status            public.match_status not null default 'scheduled',
  home_yellow       smallint not null default 0 check (home_yellow >= 0),
  away_yellow       smallint not null default 0 check (away_yellow >= 0),
  home_red          smallint not null default 0 check (home_red >= 0),
  away_red          smallint not null default 0 check (away_red >= 0),
  bracket           text check (bracket ~ '^[A-Z]{1,2}$'),  -- 'A' ili 'B' turnir
  winner_place      smallint check (winner_place > 0),
  loser_place       smallint check (loser_place > 0),
  teams_locked      boolean not null default false,  -- ručna promjena, automatika ne dira
  updated_at        timestamptz not null default now(),

  foreign key (category_id, tournament_id)
    references public.categories (id, tournament_id) on delete cascade,
  foreign key (group_id, category_id)
    references public.groups (id, category_id) on delete set null (group_id),
  foreign key (home_team_id, category_id)
    references public.teams (id, category_id) on delete set null (home_team_id),
  foreign key (away_team_id, category_id)
    references public.teams (id, category_id) on delete set null (away_team_id),
  foreign key (field_id, tournament_id)
    references public.fields (id, tournament_id) on delete set null (field_id),

  unique (category_id, code),
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id),
  check ((home_score is null) = (away_score is null)),
  check ((home_penalties is null) = (away_penalties is null))
);

create index on public.matches (tournament_id, starts_at);
create index on public.matches (category_id, stage);
create index on public.matches (field_id, starts_at);
create index on public.matches (home_team_id);
create index on public.matches (away_team_id);

-- ---------------------------------------------------------------------
-- PIN-ovi (spremljeni samo kao bcrypt hash, nitko ih ne čita izravno)
--   role = 'admin': glavni PIN turnira, field_id prazan
--   role = 'field': PIN jednog terena
-- ---------------------------------------------------------------------

create table public.pins (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  role           public.pin_role not null,
  field_id       uuid,
  pin_hash       text not null,
  updated_at     timestamptz not null default now(),
  foreign key (field_id, tournament_id)
    references public.fields (id, tournament_id) on delete cascade,
  check ((role = 'admin') = (field_id is null))
);

create unique index pins_one_admin on public.pins (tournament_id) where role = 'admin';
create unique index pins_one_per_field on public.pins (field_id) where role = 'field';

-- Tajna kojom serverska funkcija potpisuje prijavu PIN-om. Nastaje sama,
-- nitko je ne vidi osim servera (service_role).
create table public.app_secrets (
  name   text primary key,
  value  text not null
);
insert into public.app_secrets (name, value)
values ('session', encode(extensions.gen_random_bytes(32), 'hex'));

-- ---------------------------------------------------------------------
-- Funkcije za PIN-ove (smije ih zvati samo server, service_role)
-- ---------------------------------------------------------------------

-- Postavi ili promijeni PIN. p_field_id prazan = glavni PIN.
-- Odbija PIN koji je već u upotrebi u istom turniru, da se iz PIN-a
-- uvijek jasno zna o kojoj se ulozi radi.
create function public.set_pin(p_tournament_id uuid, p_field_id uuid, p_pin text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'PIN mora imati 4 do 8 znamenki.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.pins
    where tournament_id = p_tournament_id
      and field_id is distinct from p_field_id
      and pin_hash = crypt(p_pin, pin_hash)
  ) then
    raise exception 'Taj PIN već koristi netko drugi u ovom turniru.' using errcode = '23505';
  end if;

  if p_field_id is null then
    insert into public.pins (tournament_id, role, pin_hash)
    values (p_tournament_id, 'admin', crypt(p_pin, gen_salt('bf', 8)))
    on conflict (tournament_id) where role = 'admin'
    do update set pin_hash = excluded.pin_hash, updated_at = now();
  else
    insert into public.pins (tournament_id, role, field_id, pin_hash)
    values (p_tournament_id, 'field', p_field_id, crypt(p_pin, gen_salt('bf', 8)))
    on conflict (field_id) where role = 'field'
    do update set pin_hash = excluded.pin_hash, updated_at = now();
  end if;
end;
$$;

-- Koja uloga pripada upisanom PIN-u (prazno ako PIN ne postoji).
create function public.check_pin(p_tournament_id uuid, p_pin text)
returns table (id uuid, role public.pin_role, field_id uuid, updated_at timestamptz)
language sql stable security definer set search_path = public, extensions
as $$
  select p.id, p.role, p.field_id, p.updated_at
  from public.pins p
  where p.tournament_id = p_tournament_id
    and p.pin_hash = crypt(p_pin, p.pin_hash)
  limit 1;
$$;

revoke all on function public.set_pin(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.check_pin(uuid, text)     from public, anon, authenticated;
grant execute on function public.set_pin(uuid, uuid, text) to service_role;
grant execute on function public.check_pin(uuid, text)     to service_role;

create function public.touch_updated_at()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tournaments_touch before update on public.tournaments
  for each row execute function public.touch_updated_at();
create trigger matches_touch before update on public.matches
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- Svi čitaju; pisanja nema (nema pravila za insert/update/delete),
-- osim za server koji koristi service_role i zaobilazi RLS.
-- ---------------------------------------------------------------------

alter table public.tournaments  enable row level security;
alter table public.categories   enable row level security;
alter table public.fields       enable row level security;
alter table public.teams        enable row level security;
alter table public.groups       enable row level security;
alter table public.group_teams  enable row level security;
alter table public.matches      enable row level security;
alter table public.pins         enable row level security;
alter table public.app_secrets  enable row level security;

revoke all on public.pins, public.app_secrets from anon, authenticated;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['tournaments', 'categories', 'fields', 'teams',
                             'groups', 'group_teams', 'matches'] loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', tbl);
    execute format('create policy "svi čitaju" on public.%I for select using (true)', tbl);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Realtime: rezultati uživo
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.matches;

-- ---------------------------------------------------------------------
-- Storage: logotipi i slike (javno čitanje, upis samo preko servera)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 3145728, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Faza 2 (ne pokrećemo sada, samo smjer):
--   goals (match_id, team_id, minute, shirt_number)   -- strijelci, bez imena djece po zadanom
--   sponsors (tournament_id, name, logo_path, url, sort_order)
--   push_subscriptions (endpoint, p256dh, auth, team_ids uuid[])  -- piše samo server
-- ---------------------------------------------------------------------
