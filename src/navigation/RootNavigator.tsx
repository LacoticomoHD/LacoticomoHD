import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '@/lib/AuthContext';
import { AuthScreen } from '@/screens/AuthScreen';
import { LegalScreen } from '@/screens/LegalScreen';
import { MapScreen } from '@/screens/MapScreen';
import { MyRatingsScreen } from '@/screens/MyRatingsScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { RateShopScreen } from '@/screens/RateShopScreen';
import { ReportShopScreen } from '@/screens/ReportShopScreen';
import { ShopDetailScreen } from '@/screens/ShopDetailScreen';
import { ShopFormScreen } from '@/screens/ShopFormScreen';
import { ShopListScreen } from '@/screens/ShopListScreen';
import { useTheme } from '@/theme/ThemeContext';

import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, string> = {
  Karte: '🗺️',
  Liste: '📋',
  Profil: '👤',
};

function Tabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>
            {TAB_ICONS[route.name]}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Karte" component={MapScreen} options={{ title: 'Don Döner' }} />
      <Tab.Screen name="Liste" component={ShopListScreen} options={{ title: 'Alle Läden' }} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { theme } = useTheme();
  const { session, loading } = useAuth();

  const navTheme = theme.dark
    ? {
        ...NavDarkTheme,
        colors: {
          ...NavDarkTheme.colors,
          background: theme.colors.background,
          card: theme.colors.surface,
          primary: theme.colors.primary,
          text: theme.colors.text,
          border: theme.colors.border,
        },
      }
    : {
        ...NavLightTheme,
        colors: {
          ...NavLightTheme.colors,
          background: theme.colors.background,
          card: theme.colors.surface,
          primary: theme.colors.primary,
          text: theme.colors.text,
          border: theme.colors.border,
        },
      };

  if (loading) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.background,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {session ? (
        <Stack.Navigator>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="ShopDetail"
            component={ShopDetailScreen}
            options={{ title: 'Details' }}
          />
          <Stack.Screen
            name="RateShop"
            component={RateShopScreen}
            options={{ title: 'Bewerten' }}
          />
          <Stack.Screen
            name="ReportShop"
            component={ReportShopScreen}
            options={{ title: 'Eintrag melden' }}
          />
          <Stack.Screen
            name="AddShop"
            component={ShopFormScreen}
            options={{ title: 'Laden hinzufügen' }}
          />
          <Stack.Screen
            name="EditShop"
            component={ShopFormScreen}
            options={{ title: 'Laden bearbeiten' }}
          />
          <Stack.Screen
            name="MyRatings"
            component={MyRatingsScreen}
            options={{ title: 'Meine Bewertungen' }}
          />
          <Stack.Screen
            name="Legal"
            component={LegalScreen}
            options={{ title: 'Impressum & Datenschutz' }}
          />
        </Stack.Navigator>
      ) : (
        <AuthScreen />
      )}
    </NavigationContainer>
  );
}
