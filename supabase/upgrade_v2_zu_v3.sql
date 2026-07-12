-- Don Döner – Upgrade von Schema v2 auf v3.
-- NUR ausführen, wenn schema.sql bzw. upgrade_v1_zu_v2.sql bereits eingespielt wurde,
-- bevor das Dönerpreis-Feld hinzukam. Frische Datenbanken brauchen nur schema.sql.

-- Preis des Standard-Döners in Euro (optional)
alter table public.shops
  add column doener_preis numeric(5, 2)
  check (doener_preis is null or (doener_preis > 0 and doener_preis < 50));

-- Neuer Meldegrund "falscher Dönerpreis"
alter table public.reports drop constraint reports_reason_check;
alter table public.reports
  add constraint reports_reason_check check (
    reason in ('falsche_adresse', 'falsche_oeffnungszeiten', 'falscher_preis', 'dauerhaft_geschlossen', 'duplikat', 'sonstiges')
  );
