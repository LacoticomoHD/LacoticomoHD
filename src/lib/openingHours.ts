import { OpeningHours, Weekday, WEEKDAYS } from '@/types';

/** Liefert den Wochentag-Schlüssel für ein Datum (JS: 0 = Sonntag). */
export function weekdayKey(date: Date): Weekday {
  const jsDay = date.getDay();
  return WEEKDAYS[(jsDay + 6) % 7];
}

/** True, wenn für den Laden überhaupt Öffnungszeiten hinterlegt sind. */
export function hasOpeningHours(hours: OpeningHours | null | undefined): boolean {
  return !!hours && Object.keys(hours).length > 0;
}

/** Öffnungsstatus für die Anzeige: 'unknown', wenn gar keine Zeiten hinterlegt
 *  sind (dann ist "Geschlossen" irreführend), sonst 'open' oder 'closed'. */
export type OpenStatus = 'open' | 'closed' | 'unknown';
export function openStatus(hours: OpeningHours | null | undefined, now: Date = new Date()): OpenStatus {
  if (!hasOpeningHours(hours)) return 'unknown';
  return isOpenNow(hours as OpeningHours, now) ? 'open' : 'closed';
}

/** Prüft, ob der Laden zum Zeitpunkt `now` geöffnet ist.
 *  Unterstützt auch Öffnungszeiten über Mitternacht (z. B. 18:00–02:00). */
export function isOpenNow(hours: OpeningHours, now: Date = new Date()): boolean {
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  const today = hours[weekdayKey(now)];
  if (today && inRange(minutesNow, today.open, today.close)) return true;

  // Über Mitternacht: gestern geöffnet und Schließzeit noch nicht erreicht?
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const prev = hours[weekdayKey(yesterday)];
  if (prev) {
    const open = toMinutes(prev.open);
    const close = toMinutes(prev.close);
    if (close < open && minutesNow < close) return true;
  }
  return false;
}

function inRange(minutesNow: number, open: string, close: string): boolean {
  const o = toMinutes(open);
  const c = toMinutes(close);
  if (c > o) return minutesNow >= o && minutesNow < c;
  // Über Mitternacht: heute zählt nur der Teil ab Öffnung.
  return minutesNow >= o;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}
