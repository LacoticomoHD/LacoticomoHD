// Füllt fehlende Öffnungszeiten aus OpenStreetMap nach – läuft täglich in
// GitHub Actions (.github/workflows/osm-hours-sync.yml).
//
// Deutschland ist in 54 Rechteck-Kacheln geteilt; jede wird einzeln bei
// Overpass abgefragt und an die Datenbank-Funktion osm_hours_import geschickt.
// Die befüllt NUR leere Öffnungszeiten (gleicher Name im Umkreis von ~60 m bzw.
// ohne Namen ~20 m) – was Nutzer eingetragen haben, wird nie überschrieben.
//
// Benötigt die Umgebungsvariablen SUPABASE_URL, SUPABASE_ANON_KEY und
// OSM_SYNC_TOKEN (GitHub-Secret). Optional: TILES="K3-2,K4-1" für einzelne Kacheln.

const { SUPABASE_URL, SUPABASE_ANON_KEY, OSM_SYNC_TOKEN, TILES } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !OSM_SYNC_TOKEN) {
  console.error('SUPABASE_URL, SUPABASE_ANON_KEY und OSM_SYNC_TOKEN müssen gesetzt sein.');
  process.exit(1);
}

// Kacheln „K<zeile>-<spalte>" über 47,2–55,3° N und 5,8–15,4° O.
const LAT0 = 47.2, LAT_STEP = 0.9, ROWS = 9;
const LON0 = 5.8, LON_STEP = 1.6, COLS = 6;
const ALL_TILES = Array.from({ length: ROWS * COLS }, (_, i) => `K${Math.floor(i / COLS)}-${i % COLS}`);
const PAUSE_MS = 8_000; // Overpass fair nutzen: kurze Pause zwischen den Kacheln

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/** Rechteck einer Kachel als [Süd, West, Nord, Ost]. */
function tileBox(tile) {
  const [r, c] = tile.slice(1).split('-').map(Number);
  const s = LAT0 + r * LAT_STEP, w = LON0 + c * LON_STEP;
  return [s, w, s + LAT_STEP, w + LON_STEP];
}

/** Teilt ein Rechteck in vier gleich große Viertel. */
function quarters([s, w, n, e]) {
  const mLat = (s + n) / 2, mLon = (w + e) / 2;
  return [
    [s, w, mLat, mLon], [s, mLon, mLat, e],
    [mLat, w, n, mLon], [mLat, mLon, n, e],
  ];
}

/** Wie oft eine überlastete Fläche höchstens geviertelt wird (2 → bis zu 16 Teile). */
const MAX_SPLIT_DEPTH = 2;

// ---------------------------------------------------------------------------
// OSM-opening_hours → App-Format { montag: { open, close }, … }
// Gängige Angaben werden übersetzt; Exotisches (Feiertage, Monate, Sonnenauf-
// gang …) wird übersprungen statt geraten.
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const KEYS = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'];

function parseDays(expr) {
  const out = new Set();
  for (const part of expr.split(',')) {
    const [a, b] = part.split('-').map((x) => DAYS.indexOf(x.trim()));
    if (a < 0 || (part.includes('-') && b < 0)) return null;
    if (!part.includes('-')) out.add(a);
    else for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break; }
  }
  return [...out];
}

const fixTime = (t) => (t === '24:00' ? '00:00' : t.padStart(5, '0'));

export function parseOsmHours(raw) {
  const s = raw.trim();
  if (s === '24/7') return Object.fromEntries(KEYS.map((k) => [k, { open: '00:00', close: '23:59' }]));
  if (/\b(easter|sunrise|sunset|dawn|dusk)\b|"/.test(s)) return null;
  const result = {};
  // Regeln trennen: ";" und auch ", " vor einem neuen Wochentag ("Mo-Sa 10-22, Su 12-22").
  for (let rule of s.split(/;|,\s+(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)\b)/)) {
    rule = rule.trim();
    if (!rule) continue;
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

// ---------------------------------------------------------------------------

/** Fragt ein Rechteck ab. Sind alle Server überlastet (typisch in Großstädten),
 *  wird das Rechteck geviertelt und jedes Viertel einzeln abgefragt. */
async function queryBox(box, depth = 0) {
  try {
    return await overpass(box);
  } catch (e) {
    if (depth >= MAX_SPLIT_DEPTH) throw e;
    const items = [];
    for (const part of quarters(box)) {
      await new Promise((r) => setTimeout(r, PAUSE_MS));
      items.push(...(await queryBox(part, depth + 1)));
    }
    return items;
  }
}

async function overpass(box) {
  const bbox = box.map((x) => x.toFixed(3)).join(',');
  const q = `[out:csv(::lat,::lon,name,opening_hours;false;"\t")][timeout:55][bbox:${bbox}];
nwr["amenity"~"^(fast_food|restaurant)$"]["cuisine"~"kebab|doner|döner|turkish",i]["opening_hours"];
out center;`;
  const errors = [];
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: q }),
        headers: { 'User-Agent': 'DonDoener-HoursSync/2.0 (https://lacoticomohd.github.io/LacoticomoHD/)' },
        signal: AbortSignal.timeout(65_000),
      });
      if (!res.ok) {
        errors.push(`${new URL(url).host}: HTTP ${res.status}`);
        continue;
      }
      return (await res.text())
        .split('\n')
        .map((line) => line.split('\t'))
        .filter((c) => c.length >= 4 && c[0] && c[1] && c[3])
        .map(([lat, lon, name, hours]) => ({ lat: +lat, lon: +lon, name, hours }));
    } catch (e) {
      errors.push(`${new URL(url).host}: ${e.message ?? e}`);
    }
  }
  throw new Error(errors.join(' | '));
}

async function importTile(tile, items) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/osm_hours_import`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: OSM_SYNC_TOKEN, region: tile, items }),
  });
  if (!res.ok) throw new Error(`Supabase HTTP ${res.status}: ${await res.text()}`);
  return Number(await res.json());
}

const tiles = TILES ? TILES.split(',').map((t) => t.trim()).filter(Boolean) : ALL_TILES;
let total = 0;
let failed = 0;
for (const [i, tile] of tiles.entries()) {
  try {
    const raw = await queryBox(tileBox(tile));
    const items = raw
      .map((e) => ({ lat: e.lat, lon: e.lon, name: e.name, hours: parseOsmHours(e.hours) }))
      .filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon) && x.hours);
    const updated = items.length > 0 ? await importTile(tile, items) : 0;
    total += updated;
    console.log(`${tile}: ${raw.length} in OSM, ${items.length} lesbar, ${updated} nachgetragen`);
  } catch (e) {
    failed++;
    console.log(`${tile}: FEHLER ${e.message ?? e}`);
  }
  if (i < tiles.length - 1) await new Promise((r) => setTimeout(r, PAUSE_MS));
}
console.log(`\nFertig: ${total} Läden mit Öffnungszeiten ergänzt, ${failed} von ${tiles.length} Kacheln fehlgeschlagen.`);
// Nur rot markieren, wenn GAR NICHTS geklappt hat (einzelne Ausfälle holt der nächste Lauf nach).
if (failed === tiles.length) process.exit(1);
