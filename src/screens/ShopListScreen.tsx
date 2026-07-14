import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { FilterBar } from '@/components/FilterBar';
import { StarRating } from '@/components/StarRating';
import { TextField } from '@/components/TextField';
import { fetchShopsInBounds, searchShops } from '@/lib/api';
import { formatLoadError } from '@/lib/errors';
import { useFilters } from '@/lib/FilterContext';
import { distanceKm, formatDistance, formatPrice } from '@/lib/geo';
import { isOpenNow } from '@/lib/openingHours';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { SHOP_FEATURE_ICONS, ShopWithSummary } from '@/types';

// Ohne Standort/Suche zeigt die Liste die Region Karlsruhe (Start-Community).
const DEFAULT_CENTER = { latitude: 49.0093, longitude: 8.4044 };
// ±0,25° Breite ≈ Umkreis von rund 25 km
const NEARBY_DELTA = 0.25;

type SortMode = 'rating' | 'distance';

interface Coords {
  latitude: number;
  longitude: number;
}

export function ShopListScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { matchesFilters } = useFilters();
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
          if (msg) Alert.alert('Fehler beim Laden', msg);
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
          'Standort benötigt',
          'Um nach Entfernung zu sortieren, muss der Standortzugriff erlaubt sein.'
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
          placeholder="Deutschlandweit nach Name oder Adresse suchen…"
        />
      </View>
      <FilterBar />
      <View style={styles.sortRow}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Sortierung:</Text>
        <Pressable onPress={() => setSortMode('rating')} style={sortChip(sortMode === 'rating')}>
          <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
            ⭐ Beste zuerst
          </Text>
        </Pressable>
        <Pressable onPress={selectDistanceSort} style={sortChip(sortMode === 'distance')}>
          <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
            📍 Nächste zuerst
          </Text>
        </Pressable>
      </View>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
            {shops.length === 0
              ? query.trim().length >= 2
                ? 'Nichts gefunden – anderer Suchbegriff oder Laden auf der Karte mit ＋ eintragen.'
                : 'In dieser Gegend ist noch kein Dönerladen eingetragen. Füge auf der Karte mit ＋ den ersten hinzu!'
              : 'Kein Laden passt zu den aktuellen Filtern.'}
          </Text>
        }
        renderItem={({ item }) => {
          const open = isOpenNow(item.opening_hours ?? {});
          const avg = item.summary?.avg_gesamt;
          const dist = position
            ? distanceKm(position.latitude, position.longitude, item.latitude, item.longitude)
            : null;
          return (
            <Pressable
              onPress={() => navigation.navigate('ShopDetail', { shopId: item.id })}
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardName, { color: theme.colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text
                  style={{
                    color: open ? theme.colors.success : theme.colors.danger,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {open ? 'Geöffnet' : 'Geschlossen'}
                </Text>
              </View>
              <Text
                style={{ color: theme.colors.textSecondary, fontSize: 13 }}
                numberOfLines={1}
              >
                {item.address}
              </Text>
              <View style={styles.cardFooter}>
                {avg != null ? (
                  <View style={styles.ratingRow}>
                    <StarRating value={avg} size={16} />
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                      {avg.toFixed(1)} ({item.summary?.rating_count})
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                    Noch keine Bewertung
                  </Text>
                )}
                <Text style={{ fontSize: 13 }}>
                  {(item.features ?? []).map((f) => SHOP_FEATURE_ICONS[f]).join(' ')}
                </Text>
              </View>
              {(dist != null || item.doener_preis != null) && (
                <View style={styles.metaRow}>
                  {dist != null ? (
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                      📍 {formatDistance(dist)}
                    </Text>
                  ) : (
                    <View />
                  )}
                  {item.doener_preis != null ? (
                    <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700' }}>
                      🥙 {formatPrice(item.doener_preis)}
                    </Text>
                  ) : null}
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
  },
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
  cardName: { flex: 1, fontSize: 17, fontWeight: '700' },
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
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sortRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
});
