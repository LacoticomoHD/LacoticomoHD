// Füllt fehlende Öffnungszeiten aus OpenStreetMap nach.
// Deutschland ist in 54 Rechteck-Kacheln geteilt (Rechteck-Abfragen sind für die
// OSM-Server viel günstiger als Abfragen nach Bundesland-Grenzen). Läuft stündlich
// (pg_cron), eine Kachel pro Lauf – ein kompletter Durchgang dauert gut 2 Tage.
// Nur Läden OHNE Zeiten werden befüllt; was Nutzer eingetragen haben, wird nie
// überschrieben (SQL-Funktion apply_osm_hours).
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Kacheln „K<zeile>-<spalte>" über 47,2–55,3° N und 5,8–15,4° O.
const LAT0 = 47.2, LAT_STEP = 0.9, ROWS = 9;
const LON0 = 5.8, LON_STEP = 1.6, COLS = 6;
const REGIONS = Array.from({ length: ROWS * COLS }, (_, i) => `K${Math.floor(i / COLS)}-${i % COLS}`);

function bbox(region: string): string {
  const [r, c] = region.slice(1).split('-').map(Number);
  const s = LAT0 + r * LAT_STEP, w = LON0 + c * LON_STEP;
  return [s, w, s + LAT_STEP, w + LON_STEP].map((x) => x.toFixed(2)).join(',');
}

/** Zeitlimit je OSM-Server – drei Versuche müssen in die 150 s der Funktion passen. */
const SERVER_TIMEOUT_MS = 40_000;
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const KEYS = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'];

type Hours = Record<string, { open: string; close: string }>;

/** Wochentage eines OSM-Ausdrucks wie "Mo-Fr,Su" → Indizes 0–6. */
function parseDays(expr: string): number[] | null {
  const out = new Set<number>();
  for (const part of expr.split(',')) {
    const [a, b] = part.split('-').map((x) => DAYS.indexOf(x.trim()));
    if (a < 0 || (part.includes('-') && b < 0)) return null;
    if (!part.includes('-')) out.add(a);
    else for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break; }
  }
  return [...out];
}

const fixTime = (t: string) => (t === '24:00' ? '00:00' : t.padStart(5, '0'));

/** Übersetzt gängige OSM-opening_hours in das App-Format. Exotische Angaben
 *  (Monate, Feiertage, Wochennummern) werden übersprungen statt geraten. */
export function parseOsmHours(raw: string): Hours | null {
  const s = raw.trim();
  if (s === '24/7') return Object.fromEntries(KEYS.map((k) => [k, { open: '00:00', close: '23:59' }]));
  if (/\b(easter|sunrise|sunset|dawn|dusk)\b|"/.test(s)) return null;
  const result: Hours = {};
  // Regeln trennen: ";" und auch ", " vor einem neuen Wochentag ("Mo-Sa 10-22, Su 12-22").
  for (let rule of s.split(/;|,\s+(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)\b)/)) {
    rule = rule.trim();
    if (!rule) continue;
    // Sonderregeln für Feiertage, Ferien, Monate oder Datumsangaben überspringen.
    if (/^(PH|SH)\b(?!\s*,)/.test(rule)) continue;
    if (/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|week)\b|\[/.test(rule)) continue;
    rule = rule.replace(/^(PH|SH)\s*,\s*/, '').replace(/,\s*(PH|SH)\b/g, '').trim();
    const m = rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:[-,](?:Mo|Tu|We|Th|Fr|Sa|Su))*)?\s*(.*)$/);
    if (!m) return null;
    const days = m[1] ? parseDays(m[1]) : [0, 1, 2, 3, 4, 5, 6];
    if (!days) return null;
    const times = m[2].trim();
    if (/^(off|closed)$/i.test(times)) {
      for (const d of days) delete result[KEYS[d]];
      continue;
    }
    const ranges = [...times.matchAll(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g)];
    if (ranges.length === 0) return null;
    // Mittagspause etc.: früheste Öffnung bis späteste Schließung.
    const open = fixTime(ranges[0][1]);
    const close = fixTime(ranges[ranges.length - 1][2]);
    for (const d of days) result[KEYS[d]] = { open, close };
  }
  return Object.keys(result).length > 0 ? result : null;
}

interface OsmItem {
  lat: number;
  lon: number;
  name: string;
  hours: string;
}

/** Fragt die OSM-Server nacheinander ab. CSV statt JSON hält Antwort und
 *  Rechenzeit klein. Eine leere Antwort wird beim nächsten Server gegengeprüft
 *  (manche Server liefern bei Überlast leer statt mit Fehler). */
async function overpass(region: string): Promise<{ items: OsmItem[]; server: string }> {
  const q = `[out:csv(::lat,::lon,name,opening_hours;false;"\t")][timeout:35][bbox:${bbox(region)}];
nwr["amenity"~"^(fast_food|restaurant)$"]["cuisine"~"kebab|doner|döner|turkish",i]["opening_hours"];
out center;`;
  const errors: string[] = [];
  let emptyServer: string | null = null;
  for (const url of OVERPASS) {
    const host = new URL(url).host;
    try {
      // GET statt POST: overpass-api.de weist POST aus Cloud-Funktionen mit 406 ab.
      const res = await fetch(`${url}?data=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'DonDoener-HoursSync/1.1 (lacoticomohd.github.io)', Accept: '*/*' },
        signal: AbortSignal.timeout(SERVER_TIMEOUT_MS),
      });
      if (!res.ok) {
        errors.push(`${host}: HTTP ${res.status}`);
        continue;
      }
      const items = (await res.text())
        .split('\n')
        .map((line) => line.split('\t'))
        .filter((c) => c.length >= 4 && c[0] && c[1] && c[3])
        .map(([lat, lon, name, hours]) => ({ lat: +lat, lon: +lon, name, hours }));
      if (items.length === 0) {
        emptyServer ??= host;
        continue;
      }
      return { items, server: host };
    } catch (e) {
      errors.push(`${host}: ${e}`);
    }
  }
  if (emptyServer) return { items: [], server: emptyServer };
  throw new Error(errors.join(' | '));
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Schutz vor Missbrauch: höchstens ein Lauf alle 3 Minuten (jeder Lauf fragt OSM einmal ab).
  const { data: last } = await db
    .from('osm_sync_log').select('ran_at').order('ran_at', { ascending: false }).limit(1);
  if (last?.[0] && Date.now() - new Date(last[0].ran_at).getTime() < 3 * 60 * 1000) {
    return Response.json({ skipped: 'zu kurz nach dem letzten Lauf' }, { status: 429 });
  }

  // Kachel wählen: per ?region=K3-2 oder die, deren letzter ERFOLGREICHER
  // Abgleich am längsten her ist (nie gelaufene zuerst) – Fehlschläge holen
  // sich so von selbst nach.
  let region = new URL(req.url).searchParams.get('region') ?? '';
  if (!REGIONS.includes(region)) {
    const { data: ok } = await db
      .from('osm_sync_log').select('region, ran_at').is('fehler', null)
      .like('region', 'K%')
      .order('ran_at', { ascending: false }).limit(1000);
    const lastOk = new Map<string, number>();
    for (const r of ok ?? []) {
      if (!lastOk.has(r.region)) lastOk.set(r.region, new Date(r.ran_at).getTime());
    }
    region = [...REGIONS].sort((a, b) => (lastOk.get(a) ?? 0) - (lastOk.get(b) ?? 0))[0];
  }

  try {
    const { items: raw, server } = await overpass(region);
    const items = raw
      .map((e) => ({ lat: e.lat, lon: e.lon, name: e.name, hours: parseOsmHours(e.hours) }))
      .filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lon) && i.hours);
    const { data: updated, error } = await db.rpc('apply_osm_hours', { items });
    if (error) throw new Error(error.message);
    await db.from('osm_sync_log').insert({ region, gefunden: items.length, aktualisiert: updated ?? 0 });
    return Response.json({ region, server, osm: raw.length, gefunden: items.length, aktualisiert: updated });
  } catch (e) {
    await db.from('osm_sync_log').insert({ region, fehler: String(e).slice(0, 500) });
    return Response.json({ region, fehler: String(e) }, { status: 502 });
  }
});
