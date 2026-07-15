import { Alert, AlertButton, Platform } from 'react-native';

/** react-native-web implementiert Alert nicht – für die PWA bilden wir
 *  Alert.alert auf window.alert/confirm ab (inkl. Bestätigungs-Dialoge). */
export function installWebAlert() {
  if (Platform.OS !== 'web') return;
  Alert.alert = (title?: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const confirmButton =
      buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];
    const cancelButton = buttons.find((b) => b.style === 'cancel');
    if (window.confirm(text)) confirmButton?.onPress?.();
    else cancelButton?.onPress?.();
  };
}
