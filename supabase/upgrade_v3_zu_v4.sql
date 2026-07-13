-- Don Döner – Upgrade von Schema v3 auf v4: Besonderheiten als Community-Abstimmung.
-- Im Supabase SQL Editor ausführen (nach schema.sql bzw. den vorherigen Upgrades).

-- Neue Besonderheiten auch für die (Alt-)Spalte shops.features zulassen
alter table public.shops drop constraint valid_features;
alter table public.shops add constraint valid_features check (
  features <@ array['kalb', 'haehnchen', 'lamm', 'oktopus', 'vegetarisch', 'vegan', 'halal', 'hausgemachtes_brot', 'joghurtsosse', 'knoblauchsosse', 'scharfe_sosse', 'ayran_hausgemacht']::text[]
);

-- Abstimmungs-Tabelle: 1 = vorhanden, -1 = nicht vorhanden, eine Stimme
-- pro Nutzer/Laden/Besonderheit.
create table public.shop_feature_votes (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  feature    text not null check (
    feature in ('kalb', 'haehnchen', 'lamm', 'oktopus', 'vegetarisch', 'vegan', 'halal', 'hausgemachtes_brot', 'joghurtsosse', 'knoblauchsosse', 'scharfe_sosse', 'ayran_hausgemacht')
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

alter table public.shop_feature_votes enable row level security;

create policy "feature_votes_select" on public.shop_feature_votes
  for select to authenticated using (true);

-- Troll-Schutz: Abstimmen darf nur, wer den Laden bewertet hat.
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

-- Bestehende Besonderheiten (z. B. aus dem OpenStreetMap-Import) in je eine
-- Bestätigungs-Stimme des Laden-Erstellers umwandeln. Sie zählen damit als
-- 1x bestätigt und können von der Community überstimmt werden.
insert into public.shop_feature_votes (shop_id, user_id, feature, vote)
select s.id, s.created_by, f.feature, 1
from public.shops s
cross join lateral unnest(s.features) as f(feature)
where s.created_by is not null
on conflict (shop_id, user_id, feature) do nothing;
