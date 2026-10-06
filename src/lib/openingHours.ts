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

/** Ab so vielen Minuten vor Ladenschluss gilt ein Laden als „schließt bald". */
export const CLOSING_SOON_MIN = 30;

/** Minuten bis zur Schließung, falls der Laden offen ist und in höchstens
 *  CLOSING_SOON_MIN Minuten schließt – sonst null. */
export function closingSoon(hours: OpeningHours | null | undefined, now: Date = new Date()): number | null {
  if (!hasOpeningHours(hours) || !isOpenNow(hours as OpeningHours, now)) return null;
  const h = hours as OpeningHours;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const candidates: number[] = [];
  const today = h[weekdayKey(now)];
  if (today && inRange(minutesNow, today.open, today.close)) {
    const c = toMinutes(today.close);
    // Durchgehend geöffnet (bis 23:59/0 Uhr, morgen ab 0 Uhr) → schließt nicht.
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const next = h[weekdayKey(tomorrow)];
    if ((c === 0 || c >= 1439) && next && toMinutes(next.open) === 0) return null;
    // Schließt nach Mitternacht (oder genau um 0 Uhr) → bis morgen rechnen.
    candidates.push(c > minutesNow ? c - minutesNow : c + 1440 - minutesNow);
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const prev = h[weekdayKey(yesterday)];
  if (prev) {
    const o = toMinutes(prev.open);
    const c = toMinutes(prev.close);
    if (c < o && minutesNow < c) candidates.push(c - minutesNow);
  }
  if (candidates.length === 0) return null;
  // Läuft eine Öffnung nahtlos weiter (z. B. 24 h), zählt die spätere Schließung.
  const left = Math.max(...candidates);
  return left <= CLOSING_SOON_MIN ? left : null;
}

/** Pin-Variante für die Karte: 'open' | 'soon' | 'closed' (unbekannt = closed). */
export function pinState(hours: OpeningHours | null | undefined, now: Date = new Date()): 'open' | 'soon' | 'closed' {
  if (!hasOpeningHours(hours) || !isOpenNow(hours as OpeningHours, now)) return 'closed';
  return closingSoon(hours, now) != null ? 'soon' : 'open';
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
