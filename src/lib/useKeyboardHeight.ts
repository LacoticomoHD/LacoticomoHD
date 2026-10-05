import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/** Aktuelle Tastaturhöhe. Nötig, weil Android im Randlos-Modus (edge-to-edge)
 *  das Fenster beim Einblenden der Tastatur nicht mehr verkleinert – ohne
 *  zusätzlichen Abstand lägen Eingabefelder und Knöpfe unter der Tastatur. */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
