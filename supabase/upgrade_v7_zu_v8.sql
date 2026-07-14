-- Don Döner – Upgrade von Schema v7 auf v8 (Feedback-Runde 1):
-- Dürüm-Preis + Läden für alle bearbeitbar. Im Supabase SQL Editor ausführen.

-- Zweiter Preis: Dürüm/Yufka
alter table public.shops
  add column dueruem_preis numeric(5, 2)
  check (dueruem_preis is null or (dueruem_preis > 0 and dueruem_preis < 50));

-- Läden dürfen von allen Angemeldeten gepflegt werden (Wikipedia-Prinzip:
-- Adressen/Öffnungszeiten korrigiert die Community, Missbrauch fangen
-- Meldungen + Admin ab). Löschen bleibt dem Ersteller vorbehalten.
drop policy "shops_update_own" on public.shops;
create policy "shops_update_any" on public.shops
  for update to authenticated using (true);

-- shops_overview neu aufbauen, damit die neue Spalte enthalten ist
-- (s.* wird beim Anlegen der View eingefroren)
drop view public.shops_overview;

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
