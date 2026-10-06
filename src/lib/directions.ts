import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

export type TravelMode = 'driving' | 'walking' | 'bicycling' | 'transit';

export const TRAVEL_MODES: { key: TravelMode; label: string; icon: string }[] = [
  { key: 'driving', label: 'Auto', icon: '🚗' },
  { key: 'walking', label: 'Zu Fuß', icon: '🚶' },
  { key: 'bicycling', label: 'Fahrrad', icon: '🚲' },
  { key: 'transit', label: 'ÖPNV', icon: '🚌' },
];

/** Bevorzugte Navi-App (Einstellung im Profil). */
export type NavApp = 'system' | 'google' | 'apple' | 'waze' | 'other';

/** Welche Navi-Apps auf dieser Plattform zur Wahl stehen. */
export const NAV_APPS: NavApp[] =
  Platform.OS === 'ios'
    ? ['system', 'google', 'waze']
    : Platform.OS === 'android'
      ? ['system', 'google', 'waze', 'other']
      : ['system', 'google', 'apple', 'waze'];

/** Waze und „andere App" kennen keine Verkehrsmittel-Wahl → direkt starten. */
export function navAppHasModes(app: NavApp): boolean {
  return app !== 'waze' && app !== 'other';
}

const STORAGE_KEY = 'dd.navApp.v1';
let current: NavApp = 'system';
let loaded = false;
const listeners = new Set<(a: NavApp) => void>();

const loadPromise = AsyncStorage.getItem(STORAGE_KEY)
  .then((v) => {
    if (v && (NAV_APPS as string[]).includes(v)) current = v as NavApp;
  })
  .catch(() => {})
  .finally(() => {
    loaded = true;
    listeners.forEach((l) => l(current));
  });

export function setNavApp(app: NavApp) {
  current = app;
  listeners.forEach((l) => l(app));
  AsyncStorage.setItem(STORAGE_KEY, app).catch(() => {});
}

export function useNavApp(): NavApp {
  const [app, setApp] = useState<NavApp>(current);
  useEffect(() => {
    listeners.add(setApp);
    if (loaded) setApp(current);
    return () => {
      listeners.delete(setApp);
    };
  }, []);
  return app;
}

async function tryOpen(url: string, check = true): Promise<boolean> {
  try {
    if (check && !(await Linking.canOpenURL(url))) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Startet die Navigation zum Ziel – in der bevorzugten Navi-App, sonst in der
 *  System-Karten-App (Apple Karten auf iOS, Google Maps/Standard auf Android). */
export async function openDirections(
  latitude: number,
  longitude: number,
  mode: TravelMode = 'driving',
  label?: string
): Promise<void> {
  await loadPromise;
  const dest = `${latitude},${longitude}`;
  // Fallback, der überall funktioniert (öffnet Browser oder Maps-App):
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=${mode}`;
  const app = current;

  if (app === 'waze') {
    // Universeller Link: öffnet Waze, falls installiert, sonst die Waze-Webseite.
    if (await tryOpen(`https://waze.com/ul?ll=${dest}&navigate=yes`, false)) return;
  } else if (app === 'other' && Platform.OS === 'android') {
    // geo:-Link → Android zeigt die Auswahl aller installierten Karten-Apps.
    const name = label ? `(${encodeURIComponent(label)})` : '';
    if (await tryOpen(`geo:0,0?q=${dest}${name}`, false)) return;
  } else if (app === 'apple') {
    const dirflg: Record<TravelMode, string> = { driving: 'd', walking: 'w', bicycling: 'c', transit: 'r' };
    if (await tryOpen(`https://maps.apple.com/?daddr=${dest}&dirflg=${dirflg[mode]}`, false)) return;
  } else if (app === 'google') {
    if (Platform.OS === 'ios') {
      if (await tryOpen(`comgooglemaps://?daddr=${dest}&directionsmode=${mode}`)) return;
    } else if (Platform.OS === 'android' && mode !== 'transit') {
      const navMode = { driving: 'd', walking: 'w', bicycling: 'b' }[mode];
      if (await tryOpen(`google.navigation:q=${dest}&mode=${navMode}`)) return;
    }
    await Linking.openURL(webUrl);
    return;
  }

  // Standard (System): bisheriges Verhalten.
  let nativeUrl: string | null = null;
  if (Platform.OS === 'ios') {
    const dirflg: Record<TravelMode, string> = {
      driving: 'd',
      walking: 'w',
      bicycling: 'c',
      transit: 'r',
    };
    nativeUrl = `maps://?daddr=${dest}&dirflg=${dirflg[mode]}`;
  } else if (Platform.OS === 'android') {
    // google.navigation kennt kein ÖPNV – dafür den Web-Fallback nutzen.
    const navMode: Partial<Record<TravelMode, string>> = {
      driving: 'd',
      walking: 'w',
      bicycling: 'b',
    };
    if (navMode[mode]) nativeUrl = `google.navigation:q=${dest}&mode=${navMode[mode]}`;
  }
  if (nativeUrl && (await tryOpen(nativeUrl))) return;
  await Linking.openURL(webUrl);
}
