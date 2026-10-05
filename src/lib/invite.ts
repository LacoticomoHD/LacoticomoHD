import { Share } from 'react-native';

import { tapLight } from '@/lib/haptics';

export const INVITE_WEB_URL = 'https://lacoticomohd.github.io/LacoticomoHD/';
export const INVITE_APK_URL = 'https://lacoticomohd.github.io/LacoticomoHD/don-doener-latest.apk';

/** Öffnet das Teilen-Menü mit einer Einladung zur App. Die Web-App funktioniert
 *  auf jedem Handy (auch iPhone), die APK ist für Android zum Installieren.
 *  `message` ist der fertig übersetzte Text (enthält beide Links). */
export async function inviteFriends(message: string): Promise<void> {
  tapLight();
  try {
    await Share.share({ message, url: INVITE_WEB_URL });
  } catch {
    // Abbruch durch den Nutzer ist kein Fehler.
  }
}
