import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/** Kleine App-Einstellungen, die schon beim Start feststehen müssen. */
export interface AppPrefs {
  /** Welcher Tab beim App-Start offen ist. */
  startTab: 'Karte' | 'Liste';
  /** Beim Start automatisch zum eigenen Standort springen (falls freigegeben). */
  autoLocate: boolean;
}

const STORAGE_KEY = 'dd.appPrefs.v1';
const DEFAULTS: AppPrefs = { startTab: 'Karte', autoLocate: true };

let current: AppPrefs = DEFAULTS;
const listeners = new Set<(p: AppPrefs) => void>();

/** Einmal beim Start laden (App wartet darauf, bevor die Navigation startet). */
export const appPrefsReady: Promise<void> = AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    const p = JSON.parse(raw) as Partial<AppPrefs>;
    current = {
      startTab: p.startTab === 'Liste' ? 'Liste' : 'Karte',
      autoLocate: p.autoLocate !== false,
    };
  })
  .catch(() => {});

export function getAppPrefs(): AppPrefs {
  return current;
}

export function setAppPrefs(patch: Partial<AppPrefs>) {
  current = { ...current, ...patch };
  listeners.forEach((l) => l(current));
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
}

export function useAppPrefs(): AppPrefs {
  const [p, setP] = useState(current);
  useEffect(() => {
    listeners.add(setP);
    setP(current);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return p;
}
