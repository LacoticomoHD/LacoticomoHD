import { Linking, Platform } from 'react-native';

export type TravelMode = 'driving' | 'walking' | 'bicycling' | 'transit';

export const TRAVEL_MODES: { key: TravelMode; label: string; icon: string }[] = [
  { key: 'driving', label: 'Auto', icon: '🚗' },
  { key: 'walking', label: 'Zu Fuß', icon: '🚶' },
  { key: 'bicycling', label: 'Fahrrad', icon: '🚲' },
  { key: 'transit', label: 'ÖPNV', icon: '🚌' },
];

/** Startet die Navigation zum Ziel in der System-Karten-App
 *  (Apple Maps auf iOS, Google Maps/Standard-App auf Android). */
export async function openDirections(
  latitude: number,
  longitude: number,
  mode: TravelMode
): Promise<void> {
  const dest = `${latitude},${longitude}`;
  // Fallback, der überall funktioniert (öffnet Browser oder Maps-App):
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=${mode}`;

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

  try {
    if (nativeUrl && (await Linking.canOpenURL(nativeUrl))) {
      await Linking.openURL(nativeUrl);
      return;
    }
  } catch {
    // native App nicht verfügbar → Web-Fallback
  }
  await Linking.openURL(webUrl);
}
