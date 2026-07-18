// Browser-Version der Karte (PWA): MapLibre GL JS statt der nativen Bibliothek.
// Metro wählt diese Datei automatisch für Web-Builds (Endung .web.tsx).
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { FilterBar } from '@/components/FilterBar';
import { useI18n } from '@/i18n/I18nContext';
import { fetchShopsInBounds, geocodeAddress } from '@/lib/api';
import { formatLoadError } from '@/lib/errors';
import { tapLight, tapMedium } from '@/lib/haptics';
import { useFilters } from '@/lib/FilterContext';
import { isOpenNow } from '@/lib/openingHours';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { GeoBounds, ShopWithSummary } from '@/types';

const INITIAL_CENTER: [number, number] = [8.4044, 49.0093];

const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL;
const OSM_TILE_URL =
  process.env.EXPO_PUBLIC_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const MAP_STYLE: string | maplibregl.StyleSpecification = MAP_STYLE_URL ?? {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: [OSM_TILE_URL],
      tileSize: 256,
      attribution: '© OpenStreetMap-Mitwirkende',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

export function MapScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const containerRef = useRef<View>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapReadyRef = useRef(false);
  const [shops, setShops] = useState<ShopWithSummary[]>([]);
  const { matchesFilters } = useFilters();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const loadVisibleShops = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const bounds: GeoBounds = {
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
      minLon: b.getWest(),
      maxLon: b.getEast(),
    };
    if (bounds.maxLat - bounds.minLat > 3.5) {
      setShops([]);
      return;
    }
    try {
      setShops(await fetchShopsInBounds(bounds));
    } catch (e) {
      const msg = formatLoadError(e);
      if (msg) Alert.alert(t('common.loadError'), msg);
    }
  }, []);

  // Karte initialisieren
  useEffect(() => {
    const container = containerRef.current as unknown as HTMLElement | null;
    if (!container) return;
    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: INITIAL_CENTER,
      zoom: 11,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('shops', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'shop-circles',
        type: 'circle',
        source: 'shops',
        paint: {
          'circle-radius': 9,
          'circle-color': '#C0392B',
          'circle-stroke-width': 3,
          'circle-stroke-color': ['case', ['get', 'open'], '#2E7D32', '#C62828'],
          'circle-opacity': 0.95,
        },
      });
      map.on('click', 'shop-circles', (e) => {
        const shopId = e.features?.[0]?.properties?.id as string | undefined;
        if (shopId) navigation.navigate('ShopDetail', { shopId });
      });
      map.on('mouseenter', 'shop-circles', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'shop-circles', () => {
        map.getCanvas().style.cursor = '';
      });
      mapReadyRef.current = true;
      loadVisibleShops();
    });
    map.on('moveend', loadVisibleShops);

    // Wenn der Standort bereits freigegeben ist, direkt dorthin springen.
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          if (status.state === 'granted') {
            navigator.geolocation.getCurrentPosition((pos) =>
              map.jumpTo({
                center: [pos.coords.longitude, pos.coords.latitude],
                zoom: 13,
              })
            );
          }
        })
        .catch(() => {});
    }

    return () => {
      mapReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Läden (inkl. Filter) in die Kreis-Ebene schreiben
  const shopFeatures = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: shops.filter(matchesFilters).map((shop) => ({
        type: 'Feature' as const,
        id: shop.id,
        geometry: { type: 'Point' as const, coordinates: [shop.longitude, shop.latitude] },
        properties: { id: shop.id, open: isOpenNow(shop.opening_hours ?? {}) },
      })),
    }),
    [shops, matchesFilters]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const source = map.getSource('shops') as maplibregl.GeoJSONSource | undefined;
    source?.setData(shopFeatures);
  }, [shopFeatures]);

  // Beim Tab-Wechsel zurück zur Karte: Daten auffrischen
  useFocusEffect(
    useCallback(() => {
      if (mapReadyRef.current) loadVisibleShops();
    }, [loadVisibleShops])
  );

  // Ortssuche: Eingabe (z. B. „Frankfurt") geokodieren und die Karte dorthin fliegen.
  const runSearch = async () => {
    const query = searchQuery.trim();
    if (!query || searching) return;
    setSearching(true);
    try {
      const results = await geocodeAddress(query);
      if (results.length === 0) {
        Alert.alert(t('map.searchTitle'), t('map.searchNotFound'));
        return;
      }
      const { latitude, longitude } = results[0];
      mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 13 });
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSearching(false);
    }
  };

  const goToMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 14,
        }),
      () =>
        Alert.alert(t('map.locationTitle'), t('map.locationDenied'))
    );
  };

  return (
    <View style={styles.flex}>
      <View ref={containerRef} style={styles.flex} />

      <View style={styles.topOverlay}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={{ fontSize: 15 }}>🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={runSearch}
            placeholder={t('map.searchPlaceholder')}
            placeholderTextColor={theme.colors.textSecondary}
            returnKeyType="search"
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
          {searching ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>✕</Text>
            </Pressable>
          ) : null}
        </View>
        <FilterBar />
      </View>

      <Pressable
        onPressIn={tapLight}
        onPress={goToMyLocation}
        style={({ pressed }) => [
          styles.fab,
          styles.locateFab,
          { backgroundColor: theme.colors.surface, transform: [{ scale: pressed ? 0.92 : 1 }] },
        ]}
      >
        <Text style={{ fontSize: 22 }}>📍</Text>
      </Pressable>

      <Pressable
        onPressIn={tapMedium}
        onPress={() => navigation.navigate('AddShop')}
        style={({ pressed }) => [
          styles.fab,
          styles.addFab,
          { backgroundColor: theme.colors.primary, transform: [{ scale: pressed ? 0.92 : 1 }] },
        ]}
      >
        <Text style={{ color: theme.colors.onPrimary, fontSize: 30, lineHeight: 34 }}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  addFab: { bottom: 24, right: 16 },
  fab: {
    alignItems: 'center',
    borderRadius: 28,
    elevation: 4,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    width: 56,
  },
  flex: { flex: 1 },
  locateFab: { bottom: 92, right: 16 },
  searchBox: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    elevation: 3,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
    marginHorizontal: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  topOverlay: { left: 0, position: 'absolute', right: 0, top: 8 },
});
