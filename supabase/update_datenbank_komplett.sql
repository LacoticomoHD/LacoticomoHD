-- ============================================================================
-- Don Döner – KOMPLETT-UPDATE der Datenbank (idempotent)
-- Bringt jede Datenbank auf den aktuellen Stand (v14), egal welcher Stand
-- vorher da war. Kann gefahrlos mehrfach ausgeführt werden – vorhandene
-- Objekte und Daten bleiben unangetastet. Ersetzt alle upgrade_vX_zu_vY.sql.
-- Im Supabase SQL Editor ausführen.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Spalten nachrüsten
-- ---------------------------------------------------------------------------
alter table public.shops   add column if not exists doener_preis  numeric(5, 2);
alter table public.shops   add column if not exists dueruem_preis numeric(5, 2);
alter table public.shops   add column if not exists city          text;
alter table public.shops   add column if not exists preis_bestaetigt_am timestamptz;
alter table public.shops   add column if not exists kartenzahlung boolean;
-- Automatisch ausgeblendet ab 3 Meldungen "dauerhaft geschlossen" (Trigger unten)
alter table public.shops   add column if not exists ausgeblendet  boolean not null default false;
alter table public.ratings add column if not exists verified      boolean not null default false;
alter table public.reports add column if not exists status        text not null default 'offen';

-- Neue Bewertungskriterien: Fleisch- und Soßenqualität.
-- Fleischqualität ist OPTIONAL (vegetarisch/vegan) → darf NULL bleiben; deshalb
-- kein Backfill (sonst würden bewusst leere Angaben bei erneutem Lauf überschrieben).
-- Soßenqualität ist Pflicht; bestehende Bewertungen einmalig aus dem Geschmack ableiten.
alter table public.ratings add column if not exists fleischqualitaet smallint;
alter table public.ratings add column if not exists sossenqualitaet  smallint;
update public.ratings set sossenqualitaet = geschmack where sossenqualitaet is null;
alter table public.ratings alter column fleischqualitaet drop not null;
alter table public.ratings alter column sossenqualitaet  set not null;
alter table public.ratings drop constraint if exists ratings_fleischqualitaet_check;
alter table public.ratings add  constraint ratings_fleischqualitaet_check check (fleischqualitaet is null or fleischqualitaet between 1 and 5);
alter table public.ratings drop constraint if exists ratings_sossenqualitaet_check;
alter table public.ratings add  constraint ratings_sossenqualitaet_check check (sossenqualitaet between 1 and 5);

-- Läden bleiben bei Kontolöschung erhalten (created_by darf leer sein)
alter table public.shops alter column created_by drop not null;
alter table public.shops drop constraint if exists shops_created_by_fkey;
alter table public.shops
  add constraint shops_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

-- Besonderheiten-Liste auf den aktuellen Stand (12 Merkmale)
alter table public.shops drop constraint if exists valid_features;
alter table public.shops add constraint valid_features check (
  features <@ array['kalb', 'haehnchen', 'pute', 'lamm', 'oktopus', 'vegetarisch', 'vegan', 'halal', 'hausgemachtes_brot', 'joghurtsosse', 'knoblauchsosse', 'scharfe_sosse', 'cocktailsosse', 'ayran_hausgemacht']::text[]
);

-- Meldegründe auf den aktuellen Stand
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check check (
  reason in ('falsche_adresse', 'falsche_oeffnungszeiten', 'falscher_preis', 'dauerhaft_geschlossen', 'duplikat', 'sonstiges')
);

-- ---------------------------------------------------------------------------
-- 2) Tabellen nachrüsten
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  shop_id    uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

create table if not exists public.shop_feature_votes (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  feature    text not null check (
    feature in ('kalb', 'haehnchen', 'pute', 'lamm', 'oktopus', 'vegetarisch', 'vegan', 'halal', 'hausgemachtes_brot', 'joghurtsosse', 'knoblauchsosse', 'scharfe_sosse', 'cocktailsosse', 'ayran_hausgemacht')
  ),
  vote       smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, user_id, feature)
);

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.price_history (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  preis       numeric(5, 2) not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.hours_votes (
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  vote       smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

-- Änderungshistorie: Wer hat wann was an einem Laden geändert? Ermöglicht das
-- Zurückrollen von Vandalismus (offenes Bearbeiten bleibt erlaubt).
create table if not exists public.shop_edits (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  vorher     jsonb,
  nachher    jsonb
);
create index if not exists shop_edits_shop_idx on public.shop_edits (shop_id, changed_at desc);

-- Besonderheiten-Liste auch in der (ggf. schon vorhandenen) Abstimmungs-Tabelle aktualisieren
alter table public.shop_feature_votes drop constraint if exists shop_feature_votes_feature_check;
alter table public.shop_feature_votes add constraint shop_feature_votes_feature_check check (
  feature in ('kalb', 'haehnchen', 'pute', 'lamm', 'oktopus', 'vegetarisch', 'vegan', 'halal', 'hausgemachtes_brot', 'joghurtsosse', 'knoblauchsosse', 'scharfe_sosse', 'cocktailsosse', 'ayran_hausgemacht')
);

create index if not exists ratings_shop_id_idx        on public.ratings (shop_id);
create index if not exists shops_created_by_idx       on public.shops (created_by);
create index if not exists shops_lat_lon_idx          on public.shops (latitude, longitude);
create index if not exists shops_city_idx             on public.shops (city);
create index if not exists reports_shop_id_idx        on public.reports (shop_id);
create index if not exists feature_votes_shop_id_idx  on public.shop_feature_votes (shop_id);
create index if not exists price_history_shop_idx     on public.price_history (shop_id, recorded_at);

-- ---------------------------------------------------------------------------
-- 3) Views komplett neu aufbauen (immer aktuellste Definition)
-- ---------------------------------------------------------------------------
drop view if exists public.shops_overview;
drop view if exists public.shop_rating_summary;
drop view if exists public.shop_feature_summary;
drop view if exists public.hours_vote_summary;
drop view if exists public.city_stats;
drop view if exists public.shop_closure_reports;

create view public.shop_rating_summary
with (security_invoker = true) as
select
  shop_id,
  count(*)::int                                as rating_count,
  (count(*) filter (where verified))::int      as verifiziert_count,
  round(avg(geschmack)::numeric, 2)::float8      as avg_geschmack,
  round(avg(fleischqualitaet)::numeric, 2)::float8 as avg_fleischqualitaet,
  round(avg(sossenqualitaet)::numeric, 2)::float8  as avg_sossenqualitaet,
  round(avg(freundlichkeit)::numeric, 2)::float8 as avg_freundlichkeit,
  round(avg(sauberkeit)::numeric, 2)::float8     as avg_sauberkeit,
  round(avg(preis_leistung)::numeric, 2)::float8 as avg_preis_leistung,
  round(avg(wartezeit)::numeric, 2)::float8      as avg_wartezeit,
  -- Fleischqualität ist optional: fehlt sie, zählt der Schnitt aus 6 statt 7 Kriterien.
  round(
    avg(
      case
        when fleischqualitaet is null
          then (geschmack + sossenqualitaet + freundlichkeit + sauberkeit + preis_leistung + wartezeit) / 6.0
        else (geschmack + fleischqualitaet + sossenqualitaet + freundlichkeit + sauberkeit + preis_leistung + wartezeit) / 7.0
      end
    )::numeric,
    2
  )::float8 as avg_gesamt
from public.ratings
group by shop_id;

create view public.shop_feature_summary
with (security_invoker = true) as
select
  shop_id,
  feature,
  (count(*) filter (where vote = 1))::int  as bestaetigt,
  (count(*) filter (where vote = -1))::int as widersprochen,
  coalesce(sum(vote), 0)::int              as score
from public.shop_feature_votes
group by shop_id, feature;

create view public.hours_vote_summary
with (security_invoker = true) as
select
  shop_id,
  (count(*) filter (where vote = 1))::int  as bestaetigt,
  (count(*) filter (where vote = -1))::int as veraltet,
  coalesce(sum(vote), 0)::int              as score
from public.hours_votes
group by shop_id;

create view public.city_stats
with (security_invoker = true) as
select
  city,
  count(*)::int as laeden,
  round(avg(doener_preis)::numeric, 2)::float8 as preis_schnitt,
  count(doener_preis)::int as preis_anzahl
from public.shops
where city is not null
group by city;

create view public.shops_overview
with (security_invoker = true) as
select
  s.*,
  coalesce(rs.rating_count, 0)      as rating_count,
  coalesce(rs.verifiziert_count, 0) as verifiziert_count,
  rs.avg_geschmack,
  rs.avg_fleischqualitaet,
  rs.avg_sossenqualitaet,
  rs.avg_freundlichkeit,
  rs.avg_sauberkeit,
  rs.avg_preis_leistung,
  rs.avg_wartezeit,
  rs.avg_gesamt,
  case
    when s.doener_preis is not null and s.doener_preis > 0 and rs.avg_gesamt is not null
    then round((rs.avg_gesamt / s.doener_preis)::numeric, 3)::float8
  end as value_score,
  coalesce(fs.features_confirmed, '{}'::text[]) as features_confirmed
from public.shops s
left join public.shop_rating_summary rs on rs.shop_id = s.id
left join (
  select shop_id, array_agg(feature) as features_confirmed
  from public.shop_feature_summary
  where score > 0
  group by shop_id
) fs on fs.shop_id = s.id
-- Ab 3 unabhängigen "dauerhaft geschlossen"-Meldungen wird der Laden aus
-- Karte und Liste ausgeblendet (nicht gelöscht) – das Kennzeichen pflegt der
-- Trigger reports_hidden_sync weiter unten.
where not s.ausgeblendet;

-- Lesezugriff für Gäste (ohne Anmeldung) und angemeldete Nutzer
grant select on public.shops_overview        to anon, authenticated;
grant select on public.shop_rating_summary   to anon, authenticated;
grant select on public.shop_feature_summary  to anon, authenticated;
grant select on public.hours_vote_summary    to anon, authenticated;
grant select on public.city_stats            to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Funktionen und Trigger
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

create or replace function public.log_price_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.doener_preis is not null
     and (tg_op = 'INSERT' or new.doener_preis is distinct from old.doener_preis) then
    insert into public.price_history (shop_id, preis) values (new.id, new.doener_preis);
  end if;
  return new;
end;
$$;

drop trigger if exists shops_price_log on public.shops;
create trigger shops_price_log
  after insert or update of doener_preis on public.shops
  for each row execute function public.log_price_change();

-- Jede Änderung an einem Laden protokollieren (für Rückrollen bei Vandalismus)
create or replace function public.log_shop_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nur echte Inhaltsänderungen protokollieren, damit automatische Anpassungen
  -- (Ausblenden, Preisbestätigung) die Historie nicht zumüllen.
  if (new.name, new.address, new.latitude, new.longitude, new.opening_hours,
      new.features, new.doener_preis, new.dueruem_preis, new.city, new.kartenzahlung)
     is distinct from
     (old.name, old.address, old.latitude, old.longitude, old.opening_hours,
      old.features, old.doener_preis, old.dueruem_preis, old.city, old.kartenzahlung)
  then
    insert into public.shop_edits (shop_id, user_id, vorher, nachher)
    values (new.id, auth.uid(), to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;

-- Kennzeichen "ausgeblendet" pflegen (ab 3 unabhängigen Schließungs-Meldungen)
create or replace function public.refresh_shop_hidden()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  sid := coalesce(new.shop_id, old.shop_id);
  update public.shops s
     set ausgeblendet = (
       select count(distinct r.user_id) >= 3
       from public.reports r
       where r.shop_id = sid
         and r.reason = 'dauerhaft_geschlossen'
         and r.status = 'offen'
     )
   where s.id = sid;
  return coalesce(new, old);
end;
$$;

drop trigger if exists reports_hidden_sync on public.reports;
create trigger reports_hidden_sync
  after insert or update or delete on public.reports
  for each row execute function public.refresh_shop_hidden();

-- Trigger-Funktionen sollen nicht als API-Endpunkt aufrufbar sein
revoke execute on function public.log_price_change()    from public, anon, authenticated;
revoke execute on function public.log_shop_edit()       from public, anon, authenticated;
revoke execute on function public.refresh_shop_hidden() from public, anon, authenticated;

create index if not exists shops_ausgeblendet_idx on public.shops (ausgeblendet) where ausgeblendet;

drop trigger if exists shops_edit_log on public.shops;
create trigger shops_edit_log
  after update on public.shops
  for each row execute function public.log_shop_edit();

-- ---------------------------------------------------------------------------
-- 5) Row-Level-Security: alle Regeln auf den aktuellen Stand
-- ---------------------------------------------------------------------------
alter table public.shops              enable row level security;
alter table public.ratings            enable row level security;
alter table public.reports            enable row level security;
alter table public.favorites          enable row level security;
alter table public.shop_feature_votes enable row level security;
alter table public.app_admins         enable row level security;
alter table public.price_history      enable row level security;
alter table public.hours_votes        enable row level security;
alter table public.shop_edits         enable row level security;

-- Shops
drop policy if exists "shops_select"     on public.shops;
drop policy if exists "shops_insert"     on public.shops;
drop policy if exists "shops_update_own" on public.shops;
drop policy if exists "shops_update_any" on public.shops;
drop policy if exists "shops_delete_own" on public.shops;
create policy "shops_select" on public.shops
  for select to anon, authenticated using (true);
create policy "shops_insert" on public.shops
  for insert to authenticated with check (created_by = auth.uid());
create policy "shops_update_any" on public.shops
  for update to authenticated using (true);
create policy "shops_delete_own" on public.shops
  for delete to authenticated using (created_by = auth.uid());

-- Ratings
drop policy if exists "ratings_select"     on public.ratings;
drop policy if exists "ratings_insert_own" on public.ratings;
drop policy if exists "ratings_update_own" on public.ratings;
drop policy if exists "ratings_delete_own" on public.ratings;
create policy "ratings_select" on public.ratings
  for select to anon, authenticated using (true);
create policy "ratings_insert_own" on public.ratings
  for insert to authenticated with check (user_id = auth.uid());
create policy "ratings_update_own" on public.ratings
  for update to authenticated using (user_id = auth.uid());
create policy "ratings_delete_own" on public.ratings
  for delete to authenticated using (user_id = auth.uid());

-- Reports
drop policy if exists "reports_insert_own"   on public.reports;
drop policy if exists "reports_select_own"   on public.reports;
drop policy if exists "reports_select_admin" on public.reports;
drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert to authenticated with check (user_id = auth.uid());
create policy "reports_select_own" on public.reports
  for select to authenticated using (user_id = auth.uid());
create policy "reports_select_admin" on public.reports
  for select to authenticated using (
    exists (select 1 from public.app_admins a where a.user_id = auth.uid())
  );
create policy "reports_update_admin" on public.reports
  for update to authenticated using (
    exists (select 1 from public.app_admins a where a.user_id = auth.uid())
  );

-- Favoriten
drop policy if exists "favorites_select_own" on public.favorites;
drop policy if exists "favorites_insert_own" on public.favorites;
drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_select_own" on public.favorites
  for select to authenticated using (user_id = auth.uid());
create policy "favorites_insert_own" on public.favorites
  for insert to authenticated with check (user_id = auth.uid());
create policy "favorites_delete_own" on public.favorites
  for delete to authenticated using (user_id = auth.uid());

-- Besonderheiten-Stimmen (nur Bewerter dürfen abstimmen)
drop policy if exists "feature_votes_select"     on public.shop_feature_votes;
drop policy if exists "feature_votes_insert_own" on public.shop_feature_votes;
drop policy if exists "feature_votes_update_own" on public.shop_feature_votes;
drop policy if exists "feature_votes_delete_own" on public.shop_feature_votes;
create policy "feature_votes_select" on public.shop_feature_votes
  for select to anon, authenticated using (true);
create policy "feature_votes_insert_own" on public.shop_feature_votes
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.ratings r
      where r.shop_id = shop_feature_votes.shop_id and r.user_id = auth.uid()
    )
  );
create policy "feature_votes_update_own" on public.shop_feature_votes
  for update to authenticated using (user_id = auth.uid());
create policy "feature_votes_delete_own" on public.shop_feature_votes
  for delete to authenticated using (user_id = auth.uid());

-- Admins
drop policy if exists "admins_select_self" on public.app_admins;
create policy "admins_select_self" on public.app_admins
  for select to authenticated using (user_id = auth.uid());

-- Änderungshistorie: nur Admins dürfen sie einsehen
drop policy if exists "shop_edits_select_admin" on public.shop_edits;
create policy "shop_edits_select_admin" on public.shop_edits
  for select to authenticated using (
    exists (select 1 from public.app_admins a where a.user_id = auth.uid())
  );

-- Preis-Historie
drop policy if exists "price_history_select" on public.price_history;
create policy "price_history_select" on public.price_history
  for select to anon, authenticated using (true);

-- Öffnungszeiten-Feedback
drop policy if exists "hours_votes_select"       on public.hours_votes;
drop policy if exists "hours_votes_insert_own"   on public.hours_votes;
drop policy if exists "hours_votes_update_own"   on public.hours_votes;
drop policy if exists "hours_votes_delete_own"   on public.hours_votes;
drop policy if exists "hours_votes_delete_owner" on public.hours_votes;
create policy "hours_votes_select" on public.hours_votes
  for select to anon, authenticated using (true);
create policy "hours_votes_insert_own" on public.hours_votes
  for insert to authenticated with check (user_id = auth.uid());
create policy "hours_votes_update_own" on public.hours_votes
  for update to authenticated using (user_id = auth.uid());
create policy "hours_votes_delete_own" on public.hours_votes
  for delete to authenticated using (user_id = auth.uid());
create policy "hours_votes_delete_owner" on public.hours_votes
  for delete to authenticated using (
    exists (select 1 from public.shops s where s.id = shop_id and s.created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 6) Daten nachziehen (nur wo nötig)
-- ---------------------------------------------------------------------------
-- Erster registrierter Nutzer (App-Betreiber) wird Admin
insert into public.app_admins (user_id)
select id from auth.users order by created_at limit 1
on conflict do nothing;

-- Stadt aus vorhandenen Adressen ableiten ("Straße Nr, PLZ Stadt")
update public.shops
set city = nullif(trim(regexp_replace(address, '^.*\d{5}\s*', '')), '')
where city is null and address ~ '\d{5}';

-- Alte Besonderheiten (z. B. OSM-Import) einmalig in Erst-Bestätigungen wandeln
insert into public.shop_feature_votes (shop_id, user_id, feature, vote)
select s.id, s.created_by, f.feature, 1
from public.shops s
cross join lateral unnest(s.features) as f(feature)
where s.created_by is not null
on conflict (shop_id, user_id, feature) do nothing;

-- Bestehende Preise als Startpunkt der Preis-Historie erfassen
insert into public.price_history (shop_id, preis)
select s.id, s.doener_preis
from public.shops s
where s.doener_preis is not null
  and not exists (select 1 from public.price_history p where p.shop_id = s.id);

-- ---------------------------------------------------------------------------
-- 7) Supabase-Schema-Cache sofort auffrischen
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
