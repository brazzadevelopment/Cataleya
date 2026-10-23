-- =====================================================================
-- Turnir: shema baze za Supabase (Postgres 15+)
--
-- Pokretanje: Supabase → SQL Editor → zalijepi cijelu datoteku → Run.
--
-- Načela:
--   * Svi čitaju objavljene turnire (gledatelji nemaju račun).
--   * Organizator (Supabase Auth) piše samo u svoje turnire.
--   * Zapisničar nema račun. Rezultat šalje serverskoj funkciji
--     (Vercel, api/), koja provjeri PIN terena i piše ključem service_role.
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
  'placement'       -- utakmice za plasman (5. – 8. mjesto i sl.)
);

create type public.match_status as enum ('scheduled', 'live', 'finished', 'cancelled');

create type public.competition_format as enum (
  'groups_knockout',  -- skupine pa ispadanje
  'groups_only',      -- samo skupine
  'knockout_only',    -- samo ispadanje
  'league'            -- svatko sa svakim, jedna tablica
);

-- ---------------------------------------------------------------------
-- Turnir i organizatori
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
  color_primary    text not null default '#0f5132' check (color_primary ~ '^#[0-9a-fA-F]{6}$'),
  color_secondary  text not null default '#f5c400' check (color_secondary ~ '^#[0-9a-fA-F]{6}$'),
  description      text,
  rules            text,
  points_win       smallint not null default 3,
  points_draw      smallint not null default 1,
  points_loss      smallint not null default 0,
  -- Redoslijed kod jednakih bodova (bodovi su uvijek prvi kriterij).
  tiebreakers      text[] not null default array['head_to_head', 'goal_difference', 'goals_for', 'lot'],
  scorers_enabled  boolean not null default false,  -- faza 2, organizator uključi sam
  is_published     boolean not null default false,
  created_by       uuid not null default auth.uid() references auth.users (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_date >= start_date),
  check (tiebreakers <@ array['head_to_head', 'goal_difference', 'goals_for',
                              'wins', 'fewer_goals_against', 'lot']::text[])
);

create table public.tournament_admins (
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  role           text not null default 'editor' check (role in ('owner', 'editor')),
  created_at     timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

create index on public.tournament_admins (user_id);

-- ---------------------------------------------------------------------
-- Kategorije, tereni, momčadi, skupine
-- Svaka tablica nosi tournament_id radi jednostavnih RLS pravila;
-- složeni strani ključevi jamče da se podaci ne miješaju između turnira.
-- ---------------------------------------------------------------------

create table public.categories (
  id                uuid primary key default gen_random_uuid(),
  tournament_id     uuid not null references public.tournaments (id) on delete cascade,
  name              text not null,              -- npr. '2019. – U8'
  birth_year        smallint,
  match_minutes     smallint not null default 25 check (match_minutes between 5 and 120),
  players_on_field  smallint check (players_on_field between 3 and 11),
  format            public.competition_format not null default 'groups_knockout',
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  unique (tournament_id, name),
  unique (id, tournament_id)
);

create table public.fields (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  name           text not null,                 -- 'Teren 1'
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
  short_name     text,                          -- 'Zadarnova B'
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
  -- Ručni ždrijeb: kad svi kriteriji ne razdvoje momčadi, organizator
  -- upiše redoslijed (1 = bolji). Prazno dok ne treba.
  lot_rank       smallint check (lot_rank > 0),
  primary key (group_id, team_id),
  unique (team_id),                             -- momčad je u jednoj skupini
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
-- Pravilo prolaska je upisano u mjesto (slot) utakmice:
--   home_source / away_source:
--     '1A'      = 1. u skupini A
--     '2B'      = 2. u skupini B
--     'W:ČF1'   = pobjednik utakmice s oznakom ČF1
--     'L:PF2'   = poraženi u utakmici PF2
-- Kad su uvjeti ispunjeni, serverska funkcija upiše momčad u
-- home_team_id / away_team_id (osim ako je teams_locked = true).
--
-- winner_place / loser_place daju konačni poredak:
--   finale 1/2, za 3. mjesto 3/4, za 5. mjesto 5/6 ...
-- ---------------------------------------------------------------------

create table public.matches (
  id                uuid primary key default gen_random_uuid(),
  tournament_id     uuid not null,
  category_id       uuid not null,
  stage             public.match_stage not null default 'group',
  group_id          uuid,
  code              text check (code ~ '^[[:alnum:]_.-]{1,12}$'),  -- 'ČF1', 'PF1', 'F', '3M'
  label             text,                                          -- 'Četvrtfinale 1'
  home_team_id      uuid,
  away_team_id      uuid,
  home_source       text check (home_source ~ '^([1-9][0-9]?[A-Z]{1,2}|[WL]:[[:alnum:]_.-]{1,12})$'),
  away_source       text check (away_source ~ '^([1-9][0-9]?[A-Z]{1,2}|[WL]:[[:alnum:]_.-]{1,12})$'),
  field_id          uuid,
  starts_at         timestamptz,                -- prazno = termin još nije poznat
  duration_minutes  smallint check (duration_minutes between 5 and 120),  -- prazno = iz kategorije
  home_score        smallint check (home_score >= 0),
  away_score        smallint check (away_score >= 0),
  home_penalties    smallint check (home_penalties >= 0),
  away_penalties    smallint check (away_penalties >= 0),
  status            public.match_status not null default 'scheduled',
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
  check (stage <> 'group' or group_id is not null),
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id),
  check ((home_score is null) = (away_score is null)),
  check ((home_penalties is null) = (away_penalties is null)),
  -- Raspucavanje samo u eliminaciji, samo kod neriješenog, i mora imati pobjednika.
  check (home_penalties is null or
         (stage <> 'group' and home_score = away_score and home_penalties <> away_penalties)),
  check (status <> 'finished' or home_score is not null)
);

create index on public.matches (tournament_id, starts_at);
create index on public.matches (category_id, stage);
create index on public.matches (field_id, starts_at);
create index on public.matches (home_team_id);
create index on public.matches (away_team_id);

-- ---------------------------------------------------------------------
-- PIN-ovi terena (samo hash, nitko ih ne čita izravno)
-- ---------------------------------------------------------------------

create table public.field_pins (
  field_id       uuid primary key references public.fields (id) on delete cascade,
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  pin_hash       text not null,
  updated_at     timestamptz not null default now()
);

-- Pokušaji upisa PIN-a, za ograničenje pogađanja (piše samo server).
create table public.pin_attempts (
  id          bigint generated always as identity primary key,
  field_id    uuid not null references public.fields (id) on delete cascade,
  client_key  text not null,                    -- hash IP adrese, ne sama adresa
  success     boolean not null,
  created_at  timestamptz not null default now()
);

create index on public.pin_attempts (field_id, client_key, created_at);

-- ---------------------------------------------------------------------
-- Pomoćne funkcije
-- ---------------------------------------------------------------------

create function public.is_tournament_admin(t uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tournament_admins
    where tournament_id = t and user_id = auth.uid()
  );
$$;

create function public.is_tournament_owner(t uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tournament_admins
    where tournament_id = t and user_id = auth.uid() and role = 'owner'
  );
$$;

create function public.can_read_tournament(t uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.tournaments where id = t and is_published)
         or public.is_tournament_admin(t);
$$;

-- Tko napravi turnir, postaje njegov vlasnik.
create function public.add_tournament_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.tournament_admins (tournament_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger tournaments_add_owner
  after insert on public.tournaments
  for each row execute function public.add_tournament_owner();

create function public.touch_updated_at()
returns trigger
language plpgsql
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

-- Organizator postavlja PIN terena. PIN se sprema samo kao bcrypt hash.
create function public.set_field_pin(p_field_id uuid, p_pin text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  t uuid;
begin
  select tournament_id into t from public.fields where id = p_field_id;
  if t is null or not public.is_tournament_admin(t) then
    raise exception 'Nemaš ovlasti za ovaj teren.' using errcode = '42501';
  end if;
  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'PIN mora imati 4 do 8 znamenki.' using errcode = '22023';
  end if;
  insert into public.field_pins (field_id, tournament_id, pin_hash)
  values (p_field_id, t, crypt(p_pin, gen_salt('bf', 8)))
  on conflict (field_id) do update
    set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;

-- Koji tereni imaju PIN (organizator vidi "PIN postavljen", ne sam PIN).
create function public.fields_with_pin(p_tournament_id uuid)
returns table (field_id uuid, updated_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select fp.field_id, fp.updated_at
  from public.field_pins fp
  where fp.tournament_id = p_tournament_id
    and public.is_tournament_admin(p_tournament_id);
$$;

-- Provjera PIN-a. Smije je zvati samo serverska funkcija (service_role).
create function public.verify_field_pin(p_field_id uuid, p_pin text)
returns boolean
language sql stable security definer set search_path = public, extensions
as $$
  select exists (
    select 1 from public.field_pins
    where field_id = p_field_id and pin_hash = crypt(p_pin, pin_hash)
  );
$$;

revoke all on function public.set_field_pin(uuid, text)     from public, anon;
revoke all on function public.fields_with_pin(uuid)         from public, anon;
revoke all on function public.verify_field_pin(uuid, text)  from public, anon, authenticated;
revoke all on function public.add_tournament_owner()        from public, anon, authenticated;
grant execute on function public.set_field_pin(uuid, text)    to authenticated;
grant execute on function public.fields_with_pin(uuid)        to authenticated;
grant execute on function public.verify_field_pin(uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.tournaments        enable row level security;
alter table public.tournament_admins  enable row level security;
alter table public.categories         enable row level security;
alter table public.fields             enable row level security;
alter table public.teams              enable row level security;
alter table public.groups             enable row level security;
alter table public.group_teams        enable row level security;
alter table public.matches            enable row level security;
alter table public.field_pins         enable row level security;
alter table public.pin_attempts       enable row level security;

-- PIN-ovi i pokušaji: bez ijednog pravila = nedostupno svima osim service_role.
revoke all on public.field_pins, public.pin_attempts from anon, authenticated;

-- Turnir
create policy "turnir: čitanje" on public.tournaments
  for select using (is_published or public.is_tournament_admin(id));
create policy "turnir: novi" on public.tournaments
  for insert to authenticated with check (created_by = auth.uid());
create policy "turnir: uređivanje" on public.tournaments
  for update to authenticated
  using (public.is_tournament_admin(id)) with check (public.is_tournament_admin(id));
create policy "turnir: brisanje (vlasnik)" on public.tournaments
  for delete to authenticated using (public.is_tournament_owner(id));

-- Organizatori turnira: vide ih organizatori; dodaje i briše vlasnik.
create policy "organizatori: čitanje" on public.tournament_admins
  for select to authenticated using (public.is_tournament_admin(tournament_id));
create policy "organizatori: vlasnik upravlja" on public.tournament_admins
  for all to authenticated
  using (public.is_tournament_owner(tournament_id))
  with check (public.is_tournament_owner(tournament_id));

-- Ista pravila za sve tablice turnira: svi čitaju objavljeno, organizator piše.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['categories', 'fields', 'teams', 'groups', 'group_teams', 'matches'] loop
    execute format(
      'create policy "čitanje" on public.%I for select using (public.can_read_tournament(tournament_id))', tbl);
    execute format(
      'create policy "organizator: novo" on public.%I for insert to authenticated
         with check (public.is_tournament_admin(tournament_id))', tbl);
    execute format(
      'create policy "organizator: izmjena" on public.%I for update to authenticated
         using (public.is_tournament_admin(tournament_id))
         with check (public.is_tournament_admin(tournament_id))', tbl);
    execute format(
      'create policy "organizator: brisanje" on public.%I for delete to authenticated
         using (public.is_tournament_admin(tournament_id))', tbl);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Realtime: rezultati uživo
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.matches;

-- ---------------------------------------------------------------------
-- Storage: logotipi (javno čitanje, upis samo organizator)
-- Putanja: <tournament_id>/<ime-datoteke>
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create function public.storage_tournament_id(object_name text)
returns uuid
language plpgsql immutable
as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy "logotipi: upis organizatora" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos'
              and public.is_tournament_admin(public.storage_tournament_id(name)));
create policy "logotipi: izmjena organizatora" on storage.objects
  for update to authenticated
  using (bucket_id = 'logos'
         and public.is_tournament_admin(public.storage_tournament_id(name)));
create policy "logotipi: brisanje organizatora" on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos'
         and public.is_tournament_admin(public.storage_tournament_id(name)));

-- ---------------------------------------------------------------------
-- Faza 2 (ne pokrećemo sada, samo smjer):
--   goals (match_id, team_id, minute, shirt_number)   -- strijelci, bez imena djece po zadanom
--   sponsors (tournament_id, name, logo_path, url, sort_order)
--   push_subscriptions (endpoint, p256dh, auth, team_ids uuid[])  -- piše samo server
-- ---------------------------------------------------------------------
