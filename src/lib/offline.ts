import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { GeoBounds, ShopWithSummary } from '@/types';

/* Offline-Modus: Zuletzt geladene Läden werden auf dem Gerät gespeichert.
 * Fällt das Netz weg, zeigen Karte, Liste und Ladenseite diese Daten weiter an
 * (mit einem Hinweis), statt leer zu bleiben oder Fehler zu melden. */

const SHOPS_KEY = 'dd.offline.shops.v1';
const MISC_KEY = 'dd.offline.misc.v1';
const MAX_SHOPS = 800;
const MAX_MISC = 120;
const REQUEST_TIMEOUT_MS = 12_000;

/** Typische Meldungen, wenn das Netz fehlt (Browser, Android, iOS). */
export function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return /network request failed|failed to fetch|networkerror|load failed|fetch failed|internet|offline|timed? ?out|aborted/i.test(
    msg
  );
}

// ---------------------------------------------------------------- Status ---
let offline = false;
const listeners = new Set<(v: boolean) => void>();

function setOffline(v: boolean) {
  if (offline === v) return;
  offline = v;
  listeners.forEach((l) => l(v));
}

/** Für Fehler außerhalb der gespeicherten Abfragen: Netzfehler → Offline-Hinweis. */
export function noteNetworkError(e: unknown): boolean {
  if (!isNetworkError(e)) return false;
  setOffline(true);
  return true;
}

/** true, solange die letzte Abfrage am fehlenden Netz scheiterte. */
export function useOffline(): boolean {
  const [v, setV] = useState(offline);
  useEffect(() => {
    listeners.add(setV);
    setV(offline);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}

// ------------------------------------------------------------- Speicher ---
let shops: Map<string, ShopWithSummary> | null = null;
let misc: Record<string, { at: number; v: unknown }> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function loadStores() {
  if (shops && misc) return;
  try {
    const [rawShops, rawMisc] = await Promise.all([AsyncStorage.getItem(SHOPS_KEY), AsyncStorage.getItem(MISC_KEY)]);
    shops = new Map((rawShops ? (JSON.parse(rawShops) as ShopWithSummary[]) : []).map((s) => [s.id, s]));
    misc = rawMisc ? JSON.parse(rawMisc) : {};
  } catch {
    shops = new Map();
    misc = {};
  }
}

/** Gebündelt speichern – nicht bei jeder Kartenbewegung sofort schreiben. */
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!shops || !misc) return;
    const list = [...shops.values()].slice(-MAX_SHOPS);
    const entries = Object.entries(misc).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_MISC);
    AsyncStorage.setItem(SHOPS_KEY, JSON.stringify(list)).catch(() => {});
    AsyncStorage.setItem(MISC_KEY, JSON.stringify(Object.fromEntries(entries))).catch(() => {});
  }, 1500);
}

function rememberShops(list: ShopWithSummary[]) {
  if (!shops) return;
  for (const s of list) {
    shops.delete(s.id); // neu einsortieren → zuletzt gesehen steht hinten
    shops.set(s.id, s);
  }
  while (shops.size > MAX_SHOPS) shops.delete(shops.keys().next().value as string);
  scheduleSave();
}

// ------------------------------------------------------------- Wrapper ---

/** Führt eine Abfrage aus und merkt sich das Ergebnis. Fehlt das Netz, kommt
 *  stattdessen der gespeicherte Stand (oder der Fehler, wenn es keinen gibt). */
export async function withOffline<T>(
  load: () => Promise<T>,
  fallback: () => T | undefined,
  remember: (v: T) => void
): Promise<T> {
  await loadStores();
  try {
    // Schlechtes Netz bricht oft nicht ab, sondern hängt – nach 12 s aufgeben.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const v = await Promise.race([
      load(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Network request timed out')), REQUEST_TIMEOUT_MS);
      }),
    ]).finally(() => clearTimeout(timer));
    setOffline(false);
    remember(v);
    return v;
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    setOffline(true);
    const cached = fallback();
    if (cached === undefined) throw e;
    return cached;
  }
}

/** Läden in einem Kartenausschnitt (aus allen bisher geladenen Läden). */
export function offlineShopsInBounds(b: GeoBounds): ShopWithSummary[] {
  return [...(shops?.values() ?? [])].filter(
    (s) => s.latitude >= b.minLat && s.latitude <= b.maxLat && s.longitude >= b.minLon && s.longitude <= b.maxLon
  );
}

export function offlineSearch(q: string): ShopWithSummary[] {
  const needle = q.trim().toLowerCase();
  return [...(shops?.values() ?? [])].filter(
    (s) => s.name.toLowerCase().includes(needle) || (s.address ?? '').toLowerCase().includes(needle)
  );
}

export function offlineShopById(id: string): ShopWithSummary | undefined {
  return shops?.get(id);
}

export function cacheShopList(list: ShopWithSummary[]) {
  rememberShops(list);
}

/** Beliebige kleine Ergebnisse (Ladenseite, Bestenliste …) unter einem Schlüssel. */
export function getMisc<T>(key: string): T | undefined {
  return misc?.[key]?.v as T | undefined;
}

export function setMisc(key: string, v: unknown) {
  if (!misc) return;
  misc[key] = { at: Date.now(), v };
  scheduleSave();
}
