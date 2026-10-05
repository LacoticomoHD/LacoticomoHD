/** Kartenstil passend zum Theme.
 *
 *  Dunkelmodus: MapTilers „Streets Dark" hat alle Orts- und Straßennamen, ist
 *  aber kühl-blau. Wir laden ihn und färben alle Farben beim Laden in warme,
 *  fast neutrale Töne um (Helligkeit bleibt, Farbton → Glut-Braun, Sättigung
 *  stark reduziert). So bleiben Beschriftungen erhalten und die leuchtenden Pins
 *  stechen trotzdem heraus. */

import { useEffect, useState } from 'react';

const DARK_BASE = 'streets-v2-dark';
/** Ziel-Farbton (Grad) und wie viel Sättigung übrig bleibt. */
const WARM_HUE = 22;
const SATURATION_KEEP = 0.22;

export function darkStyleUrl(styleUrl: string | undefined): string | undefined {
  if (!styleUrl?.includes('api.maptiler.com')) return styleUrl;
  const key = styleUrl.match(/[?&]key=([^&]+)/)?.[1];
  return key ? `https://api.maptiler.com/maps/${DARK_BASE}/style.json?key=${key}` : styleUrl;
}

let cachedDark: Promise<object | null> | null = null;

/** Lädt den dunklen Stil einmal und liefert ihn umgefärbt (oder null bei Fehler –
 *  dann nutzt die Karte die unveränderte Stil-URL). */
export function loadWarmDarkStyle(styleUrl: string | undefined): Promise<object | null> {
  const url = darkStyleUrl(styleUrl);
  if (!url || !url.includes(DARK_BASE)) return Promise.resolve(null);
  cachedDark ??= fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((style) => (style ? warmUp(style) : null))
    .catch(() => {
      cachedDark = null; // nächster Versuch darf es erneut probieren
      return null;
    });
  return cachedDark;
}

/** Liefert den umgefärbten dunklen Stil, sobald er geladen ist (sonst null). */
export function useWarmDarkStyle(styleUrl: string | undefined, active: boolean): object | null {
  const [style, setStyle] = useState<object | null>(null);
  useEffect(() => {
    if (!active || style) return;
    let alive = true;
    loadWarmDarkStyle(styleUrl).then((s) => {
      if (alive && s) setStyle(s);
    });
    return () => {
      alive = false;
    };
  }, [active, styleUrl, style]);
  return style;
}

function warmUp(style: { layers?: { paint?: Record<string, unknown> }[] }): object {
  for (const layer of style.layers ?? []) {
    if (!layer.paint) continue;
    for (const [prop, value] of Object.entries(layer.paint)) {
      if (prop.endsWith('color')) layer.paint[prop] = recolor(value);
    }
  }
  return style;
}

/** Ersetzt jede Farbangabe – auch innerhalb von Ausdrücken (interpolate, case …). */
function recolor(value: unknown): unknown {
  if (typeof value === 'string') return warmColor(value) ?? value;
  if (Array.isArray(value)) return value.map(recolor);
  if (value && typeof value === 'object') {
    const v = value as { stops?: unknown[] };
    if (Array.isArray(v.stops)) return { ...v, stops: v.stops.map(recolor) };
  }
  return value;
}

function warmColor(input: string): string | null {
  const rgba = parseColor(input.trim());
  if (!rgba) return null;
  const [r, g, b, a] = rgba;
  const [, s, l] = rgbToHsl(r, g, b);
  const [nr, ng, nb] = hslToRgb(WARM_HUE, s * SATURATION_KEEP, l);
  return `rgba(${nr},${ng},${nb},${a})`;
}

function parseColor(c: string): [number, number, number, number] | null {
  let m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = h.split('').map((x) => x + x).join('');
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
  if (m) return [+m[1], +m[2], +m[3], alpha(m[4])];
  m = c.match(/^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
  if (m) {
    const [r, g, b] = hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
    return [r, g, b, alpha(m[4])];
  }
  return null;
}

function alpha(v: string | undefined): number {
  if (v == null) return 1;
  return v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
