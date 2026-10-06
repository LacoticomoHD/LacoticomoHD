import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';
import { OfflineBanner } from '@/components/OfflineBanner';
import { RecentShops } from '@/components/RecentShops';
import { ShopListSkeleton } from '@/components/Skeleton';
import { TipBanner } from '@/components/TipBanner';
import { TextField } from '@/components/TextField';
import { useI18n } from '@/i18n/I18nContext';
import { fetchShopsInBounds, searchShops } from '@/lib/api';
import { formatLoadError } from '@/lib/errors';
import { useFilters } from '@/lib/FilterContext';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { distanceKm } from '@/lib/geo';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { ShopWithSummary } from '@/types';
import { Text } from '@/components/AppText';
import { ShopRow } from '@/components/ShopRow';

// Ohne Standort/Suche zeigt die Liste die Region Karlsruhe (Start-Community).
const DEFAULT_CENTER = { latitude: 49.0093, longitude: 8.4044 };
// ±0,25° Breite ≈ Umkreis von rund 25 km
const NEARBY_DELTA = 0.25;

interface Coords {
  latitude: number;
  longitude: number;
}

export function ShopListScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { matchesFilters, hasActiveFilters, resetFilters, sortMode, setSortMode } = useFilters();
  const { t } = useI18n();
  const requireAuth = useRequireAuth();
  const [shops, setShops] = useState<ShopWithSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<Coords | null>(null);

  // Läden laden: bei Suchbegriff deutschlandweit suchen, sonst Umgebung
  // (eigener Standort oder Karlsruhe als Standard) – nie ganz Deutschland.
  const loadShops = useCallback(
    (center: Coords | null, searchQuery: string) => {
      const q = searchQuery.trim();
      const promise =
        q.length >= 2
          ? searchShops(q)
          : fetchShopsInBounds({
              minLat: (center ?? DEFAULT_CENTER).latitude - NEARBY_DELTA,
              maxLat: (center ?? DEFAULT_CENTER).latitude + NEARBY_DELTA,
              minLon: (center ?? DEFAULT_CENTER).longitude - NEARBY_DELTA * 1.5,
              maxLon: (center ?? DEFAULT_CENTER).longitude + NEARBY_DELTA * 1.5,
            });
      promise
        .then(setShops)
        .catch((e: Error) => {
          const msg = formatLoadError(e);
          if (msg) Alert.alert(t('common.loadError'), msg);
        })
        .finally(() => setLoading(false));
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadShops(position, query);
      // Standort nur nutzen, wenn die Freigabe schon erteilt wurde (kein Popup hier).
      Location.getForegroundPermissionsAsync().then(({ status }) => {
        if (status === 'granted') {
          Location.getCurrentPositionAsync({}).then(
            (pos) => {
              const coords = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              };
              setPosition(coords);
              if (!query.trim()) loadShops(coords, query);
            },
            () => {}
          );
        }
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadShops])
  );

  // Bei Eingabe im Suchfeld serverseitig (deutschlandweit) suchen.
  useEffect(() => {
    const timer = setTimeout(() => loadShops(position, query), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const selectDistanceSort = async () => {
    if (!position) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('list.locationNeeded'),
          t('list.locationNeededBody')
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    }
    setSortMode('distance');
  };

  const sorted = useMemo(() => {
    // Die Textsuche läuft bereits serverseitig – hier nur noch Filter + Sortierung.
    const filtered = shops.filter(matchesFilters);
    if (sortMode === 'distance' && position) {
      return filtered.sort(
        (a, b) =>
          distanceKm(position.latitude, position.longitude, a.latitude, a.longitude) -
          distanceKm(position.latitude, position.longitude, b.latitude, b.longitude)
      );
    }
    if (sortMode === 'price') {
      // Günstigste zuerst; Läden ohne Preisangabe ans Ende.
      return filtered.sort(
        (a, b) => (a.doener_preis ?? Infinity) - (b.doener_preis ?? Infinity)
      );
    }
    return filtered.sort(
      (a, b) => (b.summary?.avg_gesamt ?? -1) - (a.summary?.avg_gesamt ?? -1)
    );
  }, [shops, sortMode, position, matchesFilters]);

  const sortChip = (active: boolean) => [
    styles.sortChip,
    {
      backgroundColor: active ? theme.colors.surfaceVariant : 'transparent',
      borderColor: active ? theme.colors.primary : theme.colors.border,
    },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.searchWrap}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t('list.searchPlaceholder')}
        />
      </View>
      <OfflineBanner />
      <FilterBar />
      <View style={styles.sortRow}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{t('list.sort')}</Text>
        <Pressable onPress={() => setSortMode('rating')} style={sortChip(sortMode === 'rating')} accessibilityRole="radio" accessibilityState={{ checked: sortMode === 'rating' }}>
          <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
            {t('list.sortBest')}
          </Text>
        </Pressable>
        <Pressable onPress={() => setSortMode('price')} style={sortChip(sortMode === 'price')} accessibilityRole="radio" accessibilityState={{ checked: sortMode === 'price' }}>
          <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
            {t('list.sortCheapest')}
          </Text>
        </Pressable>
        <Pressable onPress={selectDistanceSort} style={sortChip(sortMode === 'distance')} accessibilityRole="radio" accessibilityState={{ checked: sortMode === 'distance' }}>
          <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
            {t('list.sortNearest')}
          </Text>
        </Pressable>
      </View>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        style={styles.flex}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {query.trim() === '' ? (
              <View style={styles.recentWrap}>
                <RecentShops onSelect={(id) => navigation.navigate('ShopDetail', { shopId: id })} />
              </View>
            ) : null}
            {sorted.length > 0 ? <TipBanner id="longpress" icon="zap" text={t('tip.longPress')} /> : null}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ShopListSkeleton />
          ) : shops.length > 0 && hasActiveFilters ? (
            <EmptyState
              icon="sliders"
              text={t('list.emptyFilter')}
              actions={[{ label: t('empty.resetFilters'), icon: 'x', onPress: resetFilters }]}
            />
          ) : query.trim().length >= 2 ? (
            <EmptyState
              icon="search"
              text={t('list.emptyNothing')}
              actions={[
                { label: t('empty.clearSearch'), icon: 'x', onPress: () => setQuery('') },
                { label: t('empty.addShop'), icon: 'plus', onPress: () => requireAuth() && navigation.navigate('AddShop') },
              ]}
            />
          ) : (
            <EmptyState
              icon="map"
              text={t('list.emptyArea')}
              actions={[
                {
                  label: t('empty.toMap'),
                  icon: 'map',
                  onPress: () => navigation.navigate('Tabs', { screen: 'Karte' }),
                },
              ]}
            />
          )
        }
        renderItem={({ item }) => (
          <ShopRow
            shop={item}
            distance={
              position
                ? distanceKm(position.latitude, position.longitude, item.latitude, item.longitude)
                : null
            }
            onPress={() => navigation.navigate('ShopDetail', { shopId: item.id })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { marginTop: 48, paddingHorizontal: 24, textAlign: 'center' },
  flex: { flex: 1 },
  list: { paddingBottom: 24, paddingHorizontal: 16, paddingTop: 4 },
  recentWrap: { marginHorizontal: -16, marginBottom: 6 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  sortChip: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  sortRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
});
