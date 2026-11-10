-- =====================================================================
-- Cataleya Cup kao službena aplikacija za sve turnire:
--   * klubovi kroz sve turnire (momčad pripada klubu)
--   * PIN organizacije: jedan pristup za sve turnire (novi turnir, klubovi)
--   * zaključavanje turnira (PIN-ovi terena prestaju vrijediti)
--   * obavijesti za praćene klubove, bez obzira na turnir
-- Pokreće se nakon schema.sql. Može se pokrenuti i na postojećoj bazi.
-- =====================================================================

-- Klubovi -------------------------------------------------------------

create table if not exists public.clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  short_name  text,
  city        text,
  logo_path   text,
  created_at  timestamptz not null default now()
);
create unique index if not exists clubs_name on public.clubs (lower(name));

alter table public.teams add column if not exists club_id uuid references public.clubs (id) on delete set null;
create index if not exists teams_club on public.teams (club_id);

alter table public.clubs enable row level security;
revoke insert, update, delete, truncate on public.clubs from anon, authenticated;
drop policy if exists "svi čitaju" on public.clubs;
create policy "svi čitaju" on public.clubs for select using (true);
grant select on public.clubs to anon, authenticated;

-- Naziv kluba iz naziva momčadi: bez boje dresa ("NK Rudeš plavi" → "NK Rudeš").
create or replace function public.club_name_of(p_team text)
returns text
language sql immutable
as $$
  select btrim(regexp_replace(
    regexp_replace(p_team, '\s+(bijeli|plavi|crveni|crni|žuti|narančasti|zeleni|rumeni|modri)(?=\s|$)', '', 'gi'),
    '\s+', ' ', 'g'))
$$;

-- Postojeće momčadi dobiju klub.
insert into public.clubs (name)
select distinct public.club_name_of(t.name) from public.teams t
on conflict do nothing;

update public.teams t
set club_id = c.id
from public.clubs c
where t.club_id is null and lower(c.name) = lower(public.club_name_of(t.name));

-- Zaključani turnir -------------------------------------------------------

alter table public.tournaments add column if not exists closed_at timestamptz;

-- PIN organizacije -----------------------------------------------------

create table if not exists public.org_pins (
  id          uuid primary key default gen_random_uuid(),
  label       text not null unique,
  pin_hash    text not null,
  updated_at  timestamptz not null default now()
);
alter table public.org_pins enable row level security;
revoke all on public.org_pins from anon, authenticated;

create or replace function public.set_org_pin(p_label text, p_pin text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'PIN mora imati 4 do 8 znamenki.' using errcode = '22023';
  end if;
  if exists (select 1 from public.org_pins where label <> p_label and pin_hash = crypt(p_pin, pin_hash)) then
    raise exception 'Taj PIN već koristi netko drugi.' using errcode = '23505';
  end if;
  insert into public.org_pins (label, pin_hash) values (p_label, crypt(p_pin, gen_salt('bf', 8)))
  on conflict (label) do update set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;

create or replace function public.check_org_pin(p_pin text)
returns table (id uuid, label text, updated_at timestamptz)
language sql stable security definer set search_path = public, extensions
as $$
  select o.id, o.label, o.updated_at from public.org_pins o where o.pin_hash = crypt(p_pin, o.pin_hash)
$$;

revoke all on function public.set_org_pin(text, text) from public, anon, authenticated;
revoke all on function public.check_org_pin(text) from public, anon, authenticated;
grant execute on function public.set_org_pin(text, text) to service_role;
grant execute on function public.check_org_pin(text) to service_role;

-- Obavijesti za klubove ---------------------------------------------------

alter table public.push_subscriptions alter column tournament_id drop not null;
alter table public.push_subscriptions add column if not exists club_ids uuid[] not null default '{}';
create index if not exists push_subscriptions_clubs on public.push_subscriptions using gin (club_ids);
