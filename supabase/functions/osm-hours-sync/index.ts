// Füllt fehlende Öffnungszeiten aus OpenStreetMap nach.
// Läuft täglich (pg_cron) und bearbeitet pro Lauf ein Bundesland – so ist jedes
// Land etwa alle 16 Tage dran. Nur Läden OHNE Zeiten werden befüllt; was Nutzer
// eingetragen haben, wird nie überschrieben (siehe SQL-Funktion apply_osm_hours).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const REGIONS = [
  'DE-BW', 'DE-BY', 'DE-BE', 'DE-BB', 'DE-HB', 'DE-HH', 'DE-HE', 'DE-MV',
  'DE-NI', 'DE-NW', 'DE-RP', 'DE-SL', 'DE-SN', 'DE-ST', 'DE-SH', 'DE-TH',
];
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
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

async function overpass(region: string): Promise<any[]> {
  const q = `[out:json][timeout:120];
area["ISO3166-2"="${region}"]->.a;
nwr(area.a)["amenity"~"^(fast_food|restaurant)$"]["cuisine"~"kebab|doner|döner|turkish",i]["opening_hours"];
out center tags;`;
  let lastErr = '';
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: q }),
        headers: { 'User-Agent': 'DonDoener-HoursSync/1.0 (lacoticomohd.github.io)' },
      });
      if (res.ok) return (await res.json()).elements ?? [];
      lastErr = `${url}: HTTP ${res.status}`;
    } catch (e) {
      lastErr = `${url}: ${e}`;
    }
  }
  throw new Error(lastErr);
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Schutz vor Missbrauch: höchstens ein Lauf alle 3 Minuten (jeder Lauf fragt OSM einmal ab).
  const { data: last } = await db
    .from('osm_sync_log').select('ran_at').order('ran_at', { ascending: false }).limit(1);
  if (last?.[0] && Date.now() - new Date(last[0].ran_at).getTime() < 3 * 60 * 1000) {
    return Response.json({ skipped: 'zu kurz nach dem letzten Lauf' }, { status: 429 });
  }

  const url = new URL(req.url);
  const day = Math.floor(Date.now() / 86400000);
  const region = REGIONS.includes(url.searchParams.get('region') ?? '')
    ? url.searchParams.get('region')!
    : REGIONS[day % REGIONS.length];

  try {
    const elements = await overpass(region);
    const items = elements
      .map((e) => ({
        lat: e.lat ?? e.center?.lat,
        lon: e.lon ?? e.center?.lon,
        name: e.tags?.name ?? '',
        hours: parseOsmHours(e.tags?.opening_hours ?? ''),
      }))
      .filter((i) => i.lat && i.lon && i.hours);
    const { data: updated, error } = await db.rpc('apply_osm_hours', { items });
    if (error) throw new Error(error.message);
    await db.from('osm_sync_log').insert({ region, gefunden: items.length, aktualisiert: updated ?? 0 });
    return Response.json({ region, gefunden: items.length, aktualisiert: updated });
  } catch (e) {
    await db.from('osm_sync_log').insert({ region, fehler: String(e).slice(0, 500) });
    return Response.json({ region, fehler: String(e) }, { status: 502 });
  }
});
