import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/types';

import { useAuth } from './AuthContext';

/** Karte, Liste und Ladendetails sind frei zugänglich. Aktionen wie Bewerten,
 *  Eintragen oder Merken brauchen ein Konto: Gäste landen dann im Anmelde-
 *  Overlay statt in einer Fehlermeldung.
 *
 *  Verwendung:
 *    const requireAuth = useRequireAuth();
 *    if (!requireAuth()) return;   // Gast → Anmeldung wird geöffnet
 */
export function useRequireAuth(): () => boolean {
  const { session } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return useCallback(() => {
    if (session) return true;
    navigation.navigate('Auth');
    return false;
  }, [session, navigation]);
}
