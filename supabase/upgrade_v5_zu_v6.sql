-- Don Döner – Upgrade von Schema v5 auf v6:
-- Admin-Meldungspostfach, Dönerpreis-Historie, Öffnungszeiten-Feedback.
-- Im Supabase SQL Editor ausführen.

-- ---------------------------------------------------------------------------
-- Admins (sehen und bearbeiten Meldungen in der App)
-- ---------------------------------------------------------------------------
create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.app_admins enable row level security;

create policy "admins_select_self" on public.app_admins
  for select to authenticated using (user_id = auth.uid());

-- Der erste registrierte Nutzer (App-Betreiber) wird Admin.
insert into public.app_admins (user_id)
select id from auth.users order by created_at limit 1
on conflict do nothing;

-- Meldungen bekommen einen Bearbeitungsstatus; Admins sehen und pflegen alle.
alter table public.reports
  add column status text not null default 'offen' check (status in ('offen', 'erledigt'));

create policy "reports_select_admin" on public.reports
  for select to authenticated using (
    exists (select 1 from public.app_admins a where a.user_id = auth.uid())
  );

create policy "reports_update_admin" on public.reports
  for update to authenticated using (
    exists (select 1 from public.app_admins a where a.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Dönerpreis-Historie: jede Preisänderung wird automatisch protokolliert
-- ---------------------------------------------------------------------------
create table public.price_history (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  preis       numeric(5, 2) not null,
  recorded_at timestamptz not null default now()
);

create index price_history_shop_idx on public.price_history (shop_id, recorded_at);

alter table public.price_history enable row level security;

create policy "price_history_select" on public.price_history
  for select to authenticated using (true);

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

-- Bestehende Preise als Startpunkt der Historie erfassen
insert into public.price_history (shop_id, preis)
select id, doener_preis from public.shops where doener_preis is not null;

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

alter table public.hours_votes enable row level security;

create policy "hours_votes_select" on public.hours_votes
  for select to authenticated using (true);

create policy "hours_votes_insert_own" on public.hours_votes
  for insert to authenticated with check (user_id = auth.uid());

create policy "hours_votes_update_own" on public.hours_votes
  for update to authenticated using (user_id = auth.uid());

create policy "hours_votes_delete_own" on public.hours_votes
  for delete to authenticated using (user_id = auth.uid());

-- Wer seinen Laden bearbeitet (Zeiten korrigiert), darf die Votes zurücksetzen.
create policy "hours_votes_delete_owner" on public.hours_votes
  for delete to authenticated using (
    exists (select 1 from public.shops s where s.id = shop_id and s.created_by = auth.uid())
  );
