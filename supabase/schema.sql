-- Don Döner – Datenbankschema für Supabase (PostgreSQL)
-- Ausführen im Supabase SQL Editor: Dashboard → SQL Editor → New query → einfügen → Run.
-- Login/Registrierung übernimmt Supabase Auth (auth.users); hier liegen Läden und Bewertungen.

-- ---------------------------------------------------------------------------
-- Dönerläden
-- ---------------------------------------------------------------------------
create table public.shops (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 120),
  address       text not null,
  latitude      double precision not null check (latitude between -90 and 90),
  longitude     double precision not null check (longitude between -180 and 180),
  -- Öffnungszeiten als JSON, z. B. {"montag": {"open": "11:00", "close": "22:00"}}
  opening_hours jsonb not null default '{}'::jsonb,
  -- Besonderheiten: kalb, haehnchen, vegetarisch, vegan, halal, hausgemachtes_brot
  features      text[] not null default '{}',
  -- Preis des Standard-Döners in Euro (optional)
  doener_preis  numeric(5, 2) check (doener_preis is null or (doener_preis > 0 and doener_preis < 50)),
  -- Preis für Dürüm/Yufka in Euro (optional)
  dueruem_preis numeric(5, 2) check (dueruem_preis is null or (dueruem_preis > 0 and dueruem_preis < 50)),
  -- Wann der Dönerpreis zuletzt von der Community bestätigt wurde
  preis_bestaetigt_am timestamptz,
  -- Stadt (für Bestenliste und Dönerpreis-Index)
  city          text,
  -- Kartenzahlung möglich? true = ja, false = nur Bar, null = keine Angabe
  kartenzahlung boolean,
  -- Bei Kontolöschung bleiben Läden als Community-Daten erhalten (created_by wird null).
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint valid_features check (
    features <@ array['kalb', 'haehnchen', 'lamm', 'oktopus', 'vegetarisch', 'vegan', 'halal', 'hausgemachtes_brot', 'joghurtsosse', 'knoblauchsosse', 'scharfe_sosse', 'cocktailsosse', 'ayran_hausgemacht']::text[]
  )
);

-- ---------------------------------------------------------------------------
-- Bewertungen: eine pro Nutzer und Laden, je Kategorie 1–5 Sterne
-- ---------------------------------------------------------------------------
create table public.ratings (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  geschmack      smallint not null check (geschmack between 1 and 5),
  -- Fleischqualität ist optional (vegetarisch/vegan): darf NULL sein.
  fleischqualitaet smallint check (fleischqualitaet is null or fleischqualitaet between 1 and 5),
  sossenqualitaet  smallint not null check (sossenqualitaet between 1 and 5),
  freundlichkeit smallint not null check (freundlichkeit between 1 and 5),
  sauberkeit     smallint not null check (sauberkeit between 1 and 5),
  preis_leistung smallint not null check (preis_leistung between 1 and 5),
  wartezeit      smallint not null check (wartezeit between 1 and 5),
  -- Vor-Ort-Verifizierung: true, wenn der Nutzer beim Bewerten nachweislich
  -- in Ladennähe war (App prüft Distanz; gespeichert wird nur ja/nein).
  verified       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (shop_id, user_id)
);

create index ratings_shop_id_idx on public.ratings (shop_id);
create index shops_created_by_idx on public.shops (created_by);
-- Für das regionale Laden des sichtbaren Kartenausschnitts
create index shops_lat_lon_idx on public.shops (latitude, longitude);
create index shops_city_idx on public.shops (city);

-- ---------------------------------------------------------------------------
-- Favoriten („Meine Stammläden")
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  shop_id    uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

-- ---------------------------------------------------------------------------
-- Besonderheiten: Community-Abstimmung (1 = vorhanden, -1 = nicht vorhanden).
-- Abstimmen darf nur, wer den Laden bewertet hat (siehe RLS unten) –
-- Schutz gegen Spaß-Klicker. Angezeigt wird nur bei positivem Saldo.
-- ---------------------------------------------------------------------------
create table public.shop_feature_votes (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  feature    text not null check (
    feature in ('kalb', 'haehnchen', 'lamm', 'oktopus', 'vegetarisch', 'vegan', 'halal', 'hausgemachtes_brot', 'joghurtsosse', 'knoblauchsosse', 'scharfe_sosse', 'cocktailsosse', 'ayran_hausgemacht')
  ),
  vote       smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, user_id, feature)
);

create index feature_votes_shop_id_idx on public.shop_feature_votes (shop_id);

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

-- ---------------------------------------------------------------------------
-- Kombinierte Übersicht: Laden + Bewertungsschnitt + bestätigte Besonderheiten.
-- Die App lädt hierüber effizient nur den sichtbaren Kartenausschnitt.
-- ---------------------------------------------------------------------------
create view public.shops_overview
with (security_invoker = true) as
select
  s.*,
  coalesce(rs.rating_count, 0)     as rating_count,
  coalesce(rs.verifiziert_count, 0) as verifiziert_count,
  rs.avg_geschmack,
  rs.avg_fleischqualitaet,
  rs.avg_sossenqualitaet,
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

-- ---------------------------------------------------------------------------
-- Meldungen fehlerhafter Ladeneinträge
-- ---------------------------------------------------------------------------
create table public.reports (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  reason     text not null check (
    reason in ('falsche_adresse', 'falsche_oeffnungszeiten', 'falscher_preis', 'dauerhaft_geschlossen', 'duplikat', 'sonstiges')
  ),
  details    text check (char_length(details) <= 500),
  status     text not null default 'offen' check (status in ('offen', 'erledigt')),
  created_at timestamptz not null default now()
);

create index reports_shop_id_idx on public.reports (shop_id);

-- ---------------------------------------------------------------------------
-- Admins: sehen und bearbeiten Meldungen in der App.
-- Nach der ersten Registrierung den Betreiber eintragen:
--   insert into public.app_admins (user_id)
--   select id from auth.users order by created_at limit 1;
-- ---------------------------------------------------------------------------
create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Dönerpreis-Historie: jede Preisänderung wird per Trigger protokolliert
-- ---------------------------------------------------------------------------
create table public.price_history (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  preis       numeric(5, 2) not null,
  recorded_at timestamptz not null default now()
);

create index price_history_shop_idx on public.price_history (shop_id, recorded_at);

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

create trigger shops_price_log
  after insert or update of doener_preis on public.shops
  for each row execute function public.log_price_change();

-- ---------------------------------------------------------------------------
-- Öffnungszeiten-Feedback: stimmen die Zeiten noch? (👍 = 1 / 👎 = -1)
-- ---------------------------------------------------------------------------
create table public.hours_votes (
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  vote       smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create view public.hours_vote_summary
with (security_invoker = true) as
select
  shop_id,
  (count(*) filter (where vote = 1))::int  as bestaetigt,
  (count(*) filter (where vote = -1))::int as veraltet,
  coalesce(sum(vote), 0)::int              as score
from public.hours_votes
group by shop_id;

-- ---------------------------------------------------------------------------
-- Aggregierte Bewertungen pro Laden (von der App gelesen)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.shops enable row level security;
alter table public.ratings enable row level security;
alter table public.reports enable row level security;
alter table public.shop_feature_votes enable row level security;
alter table public.favorites enable row level security;
alter table public.app_admins enable row level security;
alter table public.price_history enable row level security;
alter table public.hours_votes enable row level security;

-- Admins: jeder sieht nur den eigenen Eintrag (reicht für die Admin-Erkennung).
create policy "admins_select_self" on public.app_admins
  for select to authenticated using (user_id = auth.uid());

-- Preis-Historie: lesbar für alle Angemeldeten, geschrieben nur per Trigger.
create policy "price_history_select" on public.price_history
  for select to authenticated using (true);

-- Öffnungszeiten-Feedback: eigene Stimme verwalten; Laden-Ersteller darf nach
-- einer Korrektur alle Stimmen zurücksetzen.
create policy "hours_votes_select" on public.hours_votes
  for select to authenticated using (true);

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

-- Favoriten: jeder verwaltet nur seine eigenen.
create policy "favorites_select_own" on public.favorites
  for select to authenticated using (user_id = auth.uid());

create policy "favorites_insert_own" on public.favorites
  for insert to authenticated with check (user_id = auth.uid());

create policy "favorites_delete_own" on public.favorites
  for delete to authenticated using (user_id = auth.uid());

-- Läden: jeder Angemeldete darf lesen und anlegen; ändern/löschen nur, wer sie angelegt hat.
create policy "shops_select" on public.shops
  for select to authenticated using (true);

create policy "shops_insert" on public.shops
  for insert to authenticated with check (created_by = auth.uid());

-- Läden dürfen von allen Angemeldeten gepflegt werden (Wikipedia-Prinzip:
-- Adressen/Öffnungszeiten korrigiert die Community, Missbrauch fangen
-- Meldungen + Admin ab). Löschen bleibt dem Ersteller vorbehalten.
create policy "shops_update_any" on public.shops
  for update to authenticated using (true);

create policy "shops_delete_own" on public.shops
  for delete to authenticated using (created_by = auth.uid());

-- Bewertungen: jeder Angemeldete darf lesen (für Durchschnitte);
-- schreiben/ändern/löschen nur die eigene Bewertung.
create policy "ratings_select" on public.ratings
  for select to authenticated using (true);

create policy "ratings_insert_own" on public.ratings
  for insert to authenticated with check (user_id = auth.uid());

create policy "ratings_update_own" on public.ratings
  for update to authenticated using (user_id = auth.uid());

create policy "ratings_delete_own" on public.ratings
  for delete to authenticated using (user_id = auth.uid());

-- Besonderheiten-Stimmen: lesen dürfen alle Angemeldeten; abstimmen darf nur,
-- wer den Laden bewertet hat (Troll-Schutz); ändern/zurückziehen nur die eigene Stimme.
create policy "feature_votes_select" on public.shop_feature_votes
  for select to authenticated using (true);

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

-- Meldungen: Angemeldete dürfen melden und ihre eigenen Meldungen sehen.
-- Auswerten/Löschen erfolgt durch Admins über das Supabase-Dashboard.
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

-- ---------------------------------------------------------------------------
-- Konto-Selbstlöschung (Pflicht für App-Store-Apps mit Registrierung)
-- Löscht das eigene Konto; Bewertungen und Meldungen fallen per Cascade weg,
-- eingetragene Läden bleiben ohne Personenbezug erhalten (created_by = null).
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
