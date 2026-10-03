import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { I18nProvider } from '@/i18n/I18nContext';
import { AuthProvider } from '@/lib/AuthContext';
import { FilterProvider } from '@/lib/FilterContext';
import { installWebAlert } from '@/lib/webAlert';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

installWebAlert();

function AppInner() {
  const { theme } = useTheme();
  // Beide Schriftfamilien vorab laden: Manrope (hell) und Space Grotesk (dunkel).
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    ...Feather.font,
  });
  // Schlägt das Laden fehl, trotzdem starten (dann mit Systemschrift).
  if (!fontsLoaded && !fontError) {
    return <View style={{ backgroundColor: theme.colors.background, flex: 1 }} />;
  }
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <FilterProvider>
              <AppInner />
            </FilterProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
