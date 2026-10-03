import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { FilterBar } from '@/components/FilterBar';
import { PressableScale } from '@/components/PressableScale';
import { StarRating } from '@/components/StarRating';
import { TextField } from '@/components/TextField';
import { useI18n } from '@/i18n/I18nContext';
import { fetchShopsInBounds, searchShops } from '@/lib/api';
import { formatLoadError } from '@/lib/errors';
import { useFilters } from '@/lib/FilterContext';
import { distanceKm, formatDistance, formatPrice } from '@/lib/geo';
import { openStatus } from '@/lib/openingHours';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { ShopWithSummary } from '@/types';
import { Text } from '@/components/AppText';

// Ohne Standort/Suche zeigt die Liste die Region Karlsruhe (Start-Community).
const DEFAULT_CENTER = { latitude: 49.0093, longitude: 8.4044 };
// ±0,25° Breite ≈ Umkreis von rund 25 km
const NEARBY_DELTA = 0.25;

type SortMode = 'rating' | 'distance' | 'price';

interface Coords {
  latitude: number;
  longitude: number;
}

const PINS = {
  light: {
    open: require('../../assets/markers/pin-open-light.png'),
    closed: require('../../assets/markers/pin-closed-light.png'),
  },
  dark: {
    open: require('../../assets/markers/pin-open-dark.png'),
    closed: require('../../assets/markers/pin-closed-dark.png'),
  },
};

export function ShopListScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { matchesFilters } = useFilters();
  const { t, featureLabel } = useI18n();
  const pins = theme.dark ? PINS.dark : PINS.light;
  const [shops, setShops] = useState<ShopWithSummary[]>([]);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('rating');
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
        });
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
      <FilterBar />
      <View style={styles.sortRow}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{t('list.sort')}</Text>
        <Pressable onPress={() => setSortMode('rating')} style={sortChip(sortMode === 'rating')}>
          <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
            {t('list.sortBest')}
          </Text>
        </Pressable>
        <Pressable onPress={() => setSortMode('price')} style={sortChip(sortMode === 'price')}>
          <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
            {t('list.sortCheapest')}
          </Text>
        </Pressable>
        <Pressable onPress={selectDistanceSort} style={sortChip(sortMode === 'distance')}>
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
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
            {shops.length === 0
              ? query.trim().length >= 2
                ? t('list.emptyNothing')
                : t('list.emptyArea')
              : t('list.emptyFilter')}
          </Text>
        }
        renderItem={({ item }) => {
          const status = openStatus(item.opening_hours ?? {});
          const avg = item.summary?.avg_gesamt;
          const dist = position
            ? distanceKm(position.latitude, position.longitude, item.latitude, item.longitude)
            : null;
          const open = status === 'open';
          const features = (item.features ?? []).slice(0, 3).map((f) => featureLabel(f));
          return (
            <PressableScale
              onPress={() => navigation.navigate('ShopDetail', { shopId: item.id })}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  shadowColor: theme.dark ? '#000' : theme.glow,
                },
              ]}
            >
              <View
                style={[
                  styles.tile,
                  open
                    ? {
                        backgroundColor: theme.dark ? 'rgba(255,90,30,0.14)' : 'rgba(192,57,43,0.08)',
                        borderColor: theme.dark ? '#45302A' : 'rgba(192,57,43,0.2)',
                      }
                    : { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border },
                ]}
              >
                <Image
                  source={open ? pins.open : pins.closed}
                  style={styles.tilePin}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardName, { color: theme.colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.metaLine} numberOfLines={1}>
                  <Text
                    style={{
                      color:
                        status === 'open'
                          ? theme.colors.success
                          : status === 'closed'
                            ? theme.colors.danger
                            : theme.colors.textSecondary,
                      fontWeight: '700',
                    }}
                  >
                    {status === 'open'
                      ? t('common.open')
                      : status === 'closed'
                        ? t('common.closed')
                        : t('common.hoursUnknown')}
                  </Text>
                  {dist != null ? (
                    <Text style={{ color: theme.colors.textSecondary }}>{`  ·  ${formatDistance(dist)}`}</Text>
                  ) : null}
                  {item.doener_preis != null ? (
                    <Text style={{ color: theme.colors.textSecondary }}>
                      {`  ·  ${formatPrice(item.doener_preis)}`}
                    </Text>
                  ) : null}
                </Text>
                {features.length > 0 ? (
                  <Text
                    style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 3 }}
                    numberOfLines={1}
                  >
                    {features.join(' · ')}
                  </Text>
                ) : null}
              </View>
              {avg != null ? (
                <View
                  style={[
                    styles.ratingChip,
                    { backgroundColor: theme.colors.ratingChip, borderColor: theme.colors.ratingChipBorder },
                  ]}
                >
                  <Text style={{ color: theme.colors.star, fontSize: 12 }}>★</Text>
                  <Text style={{ color: theme.colors.ratingChipText, fontSize: 14, fontWeight: '800' }}>
                    {avg.toFixed(1).replace('.', ',')}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11.5 }}>
                  {t('common.noRating')}
                </Text>
              )}
            </PressableScale>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    flexDirection: 'row',
    gap: 13,
    marginBottom: 10,
    padding: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  cardBody: { flex: 1, minWidth: 0 },
  metaLine: { fontSize: 12.5, marginTop: 3 },
  ratingChip: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
  },
  tile: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  tilePin: { height: 30, width: 22 },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  empty: { marginTop: 48, paddingHorizontal: 24, textAlign: 'center' },
  flex: { flex: 1 },
  list: { paddingBottom: 24, paddingHorizontal: 16, paddingTop: 4 },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  ratingRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
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
