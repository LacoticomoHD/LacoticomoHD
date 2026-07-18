import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Dezentes haptisches Feedback für ein hochwertiges Gefühl. Auf Web/PWA gibt es
// keine native Haptik – dort werden die Aufrufe still übersprungen. Fehler
// (z. B. auf Geräten ohne Vibrationsmotor) sollen die App nie stören.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

/** Leichter Tipp – für Sterne, Chips, kleine Umschalter. */
export function tapLight() {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Mittlerer Tipp – für Buttons und wichtigere Aktionen. */
export function tapMedium() {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Erfolgs-Vibration – z. B. nach dem Speichern einer Bewertung. */
export function tapSuccess() {
  if (!enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Auswahl-Klick – feiner als ein Tipp, z. B. beim Favorisieren. */
export function tapSelection() {
  if (!enabled) return;
  Haptics.selectionAsync().catch(() => {});
}
