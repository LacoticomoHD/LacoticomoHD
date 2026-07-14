let jwtHintShown = false;

/** Übersetzt Ladefehler in verständliche Meldungen.
 *  Gibt null zurück, wenn der Fehler still ignoriert werden soll
 *  (z. B. der vorübergehende JWT-Zeitabgleich – nur einmal pro Sitzung melden). */
export function formatLoadError(e: unknown): string | null {
  const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
  if (/jwt/i.test(msg)) {
    if (jwtHintShown) return null;
    jwtHintShown = true;
    return (
      'Kurzer Schluckauf beim Anmelde-Zeitabgleich – meist hilft: einen Moment warten ' +
      'und die Ansicht kurz bewegen/wechseln.\n\nFalls die Meldung wiederkommt: Prüfe in den ' +
      'Handy-Einstellungen, ob Datum & Uhrzeit auf „Automatisch" stehen.'
    );
  }
  return msg;
}
