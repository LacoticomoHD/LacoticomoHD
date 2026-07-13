-- Don Döner – Upgrade von Schema v6 auf v7:
-- Vor-Ort-verifizierte Bewertungen + Preis-Leistungs-Score.
-- Im Supabase SQL Editor ausführen.

-- Verifizierungs-Flag: true, wenn der Nutzer beim Bewerten in Ladennähe war
-- (die App prüft die Distanz; gespeichert wird nur ja/nein, nie der Standort).
alter table public.ratings add column verified boolean not null default false;

-- Views neu aufbauen (shops_overview hängt von shop_rating_summary ab)
drop view public.shops_overview;
drop view public.shop_rating_summary;

create view public.shop_rating_summary
with (security_invoker = true) as
select
  shop_id,
  count(*)::int                                as rating_count,
  (count(*) filter (where verified))::int      as verifiziert_count,
  round(avg(geschmack)::numeric, 2)::float8      as avg_geschmack,
  round(avg(freundlichkeit)::numeric, 2)::float8 as avg_freundlichkeit,
  round(avg(sauberkeit)::numeric, 2)::float8     as avg_sauberkeit,
  round(avg(preis_leistung)::numeric, 2)::float8 as avg_preis_leistung,
  round(avg(wartezeit)::numeric, 2)::float8      as avg_wartezeit,
  round(
    avg((geschmack + freundlichkeit + sauberkeit + preis_leistung + wartezeit) / 5.0)::numeric,
    2
  )::float8 as avg_gesamt
from public.ratings
group by shop_id;

create view public.shops_overview
with (security_invoker = true) as
select
  s.*,
  coalesce(rs.rating_count, 0)     as rating_count,
  coalesce(rs.verifiziert_count, 0) as verifiziert_count,
  rs.avg_geschmack,
  rs.avg_freundlichkeit,
  rs.avg_sauberkeit,
  rs.avg_preis_leistung,
  rs.avg_wartezeit,
  rs.avg_gesamt,
  -- Preis-Leistungs-Score: Sterne pro Euro (nur mit Preis und Bewertung)
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
) fs on fs.shop_id = s.id;
