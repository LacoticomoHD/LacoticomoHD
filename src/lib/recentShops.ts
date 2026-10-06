import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/** Zuletzt geöffnete Läden – nur lokal auf dem Gerät gespeichert. */
export interface RecentShop {
  id: string;
  name: string;
  city: string | null;
}

const STORAGE_KEY = 'dd.recentShops.v1';
const MAX = 5;

let cache: RecentShop[] | null = null;
const listeners = new Set<(list: RecentShop[]) => void>();

async function load(): Promise<RecentShop[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as RecentShop[]).slice(0, MAX) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function publish(list: RecentShop[]) {
  cache = list;
  listeners.forEach((l) => l(list));
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)).catch(() => {});
}

/** Beim Öffnen eines Ladens aufrufen – setzt ihn an die erste Stelle. */
export async function rememberShop(shop: RecentShop): Promise<void> {
  const list = await load();
  publish([shop, ...list.filter((s) => s.id !== shop.id)].slice(0, MAX));
}

export async function clearRecentShops(): Promise<void> {
  await load();
  publish([]);
}

/** Liste der zuletzt angesehenen Läden, aktualisiert sich automatisch. */
export function useRecentShops(): { recent: RecentShop[]; clear: () => void } {
  const [recent, setRecent] = useState<RecentShop[]>(cache ?? []);
  useEffect(() => {
    listeners.add(setRecent);
    load().then(setRecent);
    return () => {
      listeners.delete(setRecent);
    };
  }, []);
  const clear = useCallback(() => {
    clearRecentShops();
  }, []);
  return { recent, clear };
}
