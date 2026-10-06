-- Trägt Öffnungszeiten aus OSM ein – ausschließlich bei Läden OHNE Zeiten.
-- Zuordnung wie bisher: gleicher Name (einer im anderen enthalten) im Umkreis
-- von ~60 m, oder ohne Namensangabe im Umkreis von ~20 m.
-- NEU, nur wenn ein Eintrag "loose": true trägt: auch bei abweichendem Namen,
-- sofern im Umkreis von 30 m genau EIN Laden bei uns und genau EIN OSM-Laden
-- liegen (dann ist es praktisch sicher derselbe Laden).
create or replace function public.apply_osm_hours(items jsonb)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  n integer;
begin
  with src as (
    select row_number() over () as sid,
           (e->>'lat')::float8 as lat,
           (e->>'lon')::float8 as lon,
           lower(regexp_replace(coalesce(e->>'name', ''), '[^[:alnum:]]', '', 'g')) as nname,
           coalesce((e->>'loose')::boolean, false) as loose,
           e->'hours' as hours
    from jsonb_array_elements(items) e
    where jsonb_typeof(e->'hours') = 'object' and e->'hours' <> '{}'::jsonb
  ),
  cand as (
    select s.id, src.sid, src.hours, src.loose, src.nname,
           ((s.latitude - src.lat) * 111000) ^ 2
             + ((s.longitude - src.lon) * 111000 * cos(radians(src.lat))) ^ 2 as d2,
           lower(regexp_replace(s.name, '[^[:alnum:]]', '', 'g')) as sname,
           s.opening_hours
    from src
    join public.shops s
      on s.latitude between src.lat - 0.0006 and src.lat + 0.0006
     and s.longitude between src.lon - 0.0009 and src.lon + 0.0009
    where coalesce(s.ausgeblendet, false) = false
  ),
  near as (
    -- Eindeutigkeit im 30-m-Umkreis: wie viele unserer Läden je OSM-Eintrag
    -- und wie viele OSM-Einträge je Laden (über alle Läden, auch mit Zeiten).
    select c.*,
           count(*) filter (where c.d2 <= 900) over (partition by c.sid) as shops_near_osm,
           count(*) filter (where c.d2 <= 900) over (partition by c.id) as osm_near_shop
    from cand c
  ),
  m as (
    select distinct on (id) id, hours
    from near
    where (opening_hours is null or opening_hours = '{}'::jsonb)
      and (
        (nname <> '' and length(nname) >= 3 and length(sname) >= 3
         and (sname = nname or position(nname in sname) > 0 or position(sname in nname) > 0)
         and d2 <= 3600)
        or (nname = '' and d2 <= 400)
        or (loose and d2 <= 900 and shops_near_osm = 1 and osm_near_shop = 1)
      )
    order by id, d2
  )
  update public.shops s set opening_hours = m.hours
  from m
  where s.id = m.id;
  get diagnostics n = row_count;
  return n;
end;
$function$;
