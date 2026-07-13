-- Don Döner – Upgrade von Schema v4 auf v5:
-- Favoriten, Stadt-Spalte (Bestenliste + Dönerpreis-Index) und Übersichts-Views
-- für das regionale Laden. Im Supabase SQL Editor ausführen.

-- Stadt-Spalte + Indizes
alter table public.shops add column city text;
create index shops_lat_lon_idx on public.shops (latitude, longitude);
create index shops_city_idx on public.shops (city);

-- Stadt aus bestehenden Adressen ableiten (Format "Straße Nr, PLZ Stadt")
update public.shops
set city = nullif(trim(regexp_replace(address, '^.*\d{5}\s*', '')), '')
where city is null and address ~ '\d{5}';

-- Favoriten („Meine Stammläden")
create table public.favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  shop_id    uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

alter table public.favorites enable row level security;

create policy "favorites_select_own" on public.favorites
  for select to authenticated using (user_id = auth.uid());

create policy "favorites_insert_own" on public.favorites
  for insert to authenticated with check (user_id = auth.uid());

create policy "favorites_delete_own" on public.favorites
  for delete to authenticated using (user_id = auth.uid());

-- Kombinierte Übersicht: Laden + Bewertungsschnitt + bestätigte Besonderheiten
create view public.shops_overview
with (security_invoker = true) as
select
  s.*,
  coalesce(rs.rating_count, 0)     as rating_count,
  rs.avg_geschmack,
  rs.avg_freundlichkeit,
  rs.avg_sauberkeit,
  rs.avg_preis_leistung,
  rs.avg_wartezeit,
  rs.avg_gesamt,
  coalesce(fs.features_confirmed, '{}'::text[]) as features_confirmed
from public.shops s
left join public.shop_rating_summary rs on rs.shop_id = s.id
left join (
  select shop_id, array_agg(feature) as features_confirmed
  from public.shop_feature_summary
  where score > 0
  group by shop_id
) fs on fs.shop_id = s.id;

-- Stadt-Statistik für Bestenliste und Dönerpreis-Index
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
