import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// In .env hinterlegen (siehe README): EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/** true, wenn die App ohne Backend-Zugangsdaten gebaut wurde (Demo-Modus). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase ist nicht konfiguriert. EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY in .env setzen.'
  );
}

// Platzhalter verhindern einen Absturz beim Start, wenn keine Zugangsdaten gesetzt sind –
// Anfragen laufen dann ins Leere und die UI zeigt den Demo-Hinweis.
export const supabase = createClient(
  supabaseUrl || 'https://demo-nicht-konfiguriert.supabase.co',
  supabaseAnonKey || 'demo-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Im Web muss der Link aus der Passwort-vergessen-Mail erkannt werden
      // (die Sitzung steckt dort in der URL). Nativ gibt es keine URL-Session.
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
);

