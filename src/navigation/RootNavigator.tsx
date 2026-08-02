import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/lib/AuthContext';
import { AuthScreen } from '@/screens/AuthScreen';
import { BestenlisteScreen } from '@/screens/BestenlisteScreen';
import { FavoritesScreen } from '@/screens/FavoritesScreen';
import { LegalScreen } from '@/screens/LegalScreen';
import { MapScreen } from '@/screens/MapScreen';
import { MyRatingsScreen } from '@/screens/MyRatingsScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { RateShopScreen } from '@/screens/RateShopScreen';
import { ReportShopScreen } from '@/screens/ReportShopScreen';
import { ReportsInboxScreen } from '@/screens/ReportsInboxScreen';
import { ResetPasswordScreen } from '@/screens/ResetPasswordScreen';
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
  Top10: '🏆',
  Profil: '👤',
};

function Tabs() {
  const { theme } = useTheme();
  const { t } = useI18n();
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
      <Tab.Screen name="Karte" component={MapScreen} options={{ title: t('tab.map') }} />
      <Tab.Screen
        name="Liste"
        component={ShopListScreen}
        options={{ title: t('tab.list') }}
      />
      <Tab.Screen
        name="Top10"
        component={BestenlisteScreen}
        options={{ title: t('nav.leaderboard'), tabBarLabel: t('tab.top') }}
      />
      <Tab.Screen name="Profil" component={ProfileScreen} options={{ title: t('tab.profile') }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { session, loading, passwordRecovery } = useAuth();

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
      {passwordRecovery ? (
        // Kommt der Nutzer über den Link aus der Passwort-vergessen-Mail,
        // muss zuerst ein neues Passwort gesetzt werden.
        <ResetPasswordScreen />
      ) : session ? (
        <Stack.Navigator>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="ShopDetail"
            component={ShopDetailScreen}
            options={{ title: t('nav.details') }}
          />
          <Stack.Screen
            name="RateShop"
            component={RateShopScreen}
            options={{ title: t('nav.rate') }}
          />
          <Stack.Screen
            name="ReportShop"
            component={ReportShopScreen}
            options={{ title: t('nav.report') }}
          />
          <Stack.Screen
            name="AddShop"
            component={ShopFormScreen}
            options={{ title: t('nav.addShop') }}
          />
          <Stack.Screen
            name="EditShop"
            component={ShopFormScreen}
            options={{ title: t('nav.editShop') }}
          />
          <Stack.Screen
            name="MyRatings"
            component={MyRatingsScreen}
            options={{ title: t('nav.myRatings') }}
          />
          <Stack.Screen
            name="Favorites"
            component={FavoritesScreen}
            options={{ title: t('nav.favorites') }}
          />
          <Stack.Screen
            name="ReportsInbox"
            component={ReportsInboxScreen}
            options={{ title: t('nav.reports') }}
          />
          <Stack.Screen
            name="Legal"
            component={LegalScreen}
            options={{ title: t('nav.legal') }}
          />
        </Stack.Navigator>
      ) : (
        <AuthScreen />
      )}
    </NavigationContainer>
  );
}
