-- Don Döner – Upgrade von Schema v1 auf v2.
-- NUR ausführen, wenn schema.sql bereits in einer früheren Version (ohne reports-Tabelle)
-- eingespielt wurde. Bei einer frischen Datenbank stattdessen direkt schema.sql verwenden.

-- Läden bleiben bei Kontolöschung als Community-Daten erhalten.
alter table public.shops alter column created_by drop not null;
alter table public.shops drop constraint shops_created_by_fkey;
alter table public.shops
  add constraint shops_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

-- Meldungen fehlerhafter Ladeneinträge
create table public.reports (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  reason     text not null check (
    reason in ('falsche_adresse', 'falsche_oeffnungszeiten', 'dauerhaft_geschlossen', 'duplikat', 'sonstiges')
  ),
  details    text check (char_length(details) <= 500),
  created_at timestamptz not null default now()
);

create index reports_shop_id_idx on public.reports (shop_id);

alter table public.reports enable row level security;

create policy "reports_insert_own" on public.reports
  for insert to authenticated with check (user_id = auth.uid());

create policy "reports_select_own" on public.reports
  for select to authenticated using (user_id = auth.uid());

-- Konto-Selbstlöschung
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
