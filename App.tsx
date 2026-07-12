import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/lib/AuthContext';
import { FilterProvider } from '@/lib/FilterContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

function AppInner() {
  const { theme } = useTheme();
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
      <ThemeProvider>
        <AuthProvider>
          <FilterProvider>
            <AppInner />
          </FilterProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
