import {
  Camera,
  MapView,
  PointAnnotation,
  UserLocation,
  type CameraRef,
  type MapViewRef,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { FilterBar } from '@/components/FilterBar';
import { fetchShopsInBounds } from '@/lib/api';
import { useFilters } from '@/lib/FilterContext';
import { isOpenNow } from '@/lib/openingHours';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { GeoBounds, ShopWithSummary } from '@/types';

// Start: Karlsruhe – hier begann die Community. [Längengrad, Breitengrad]
const INITIAL_CENTER: [number, number] = [8.4044, 49.0093];

// Kartenstil: Bevorzugt eine komplette Style-URL (z. B. MapTiler-Vektorkarte) aus
// EXPO_PUBLIC_MAP_STYLE_URL; alternativ Raster-Tiles über EXPO_PUBLIC_TILE_URL.
// Ohne Konfiguration fallen wir auf die offiziellen OSM-Server zurück
// (nur für Entwicklung – nicht für App-Massenbetrieb gedacht).
const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL;

const OSM_TILE_URL =
  process.env.EXPO_PUBLIC_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// MapLibre rendert komplett ohne Google/Apple-Dienste – reines OpenStreetMap.
const MAP_STYLE: string | object = MAP_STYLE_URL ?? {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [OSM_TILE_URL],
      tileSize: 256,
      attribution: '© OpenStreetMap-Mitwirkende',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

const ATTRIBUTION_TEXT = MAP_STYLE_URL?.includes('maptiler')
  ? '© MapTiler © OpenStreetMap-Mitwirkende'
  : '© OpenStreetMap-Mitwirkende';

export function MapScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapViewRef>(null);
  const [shops, setShops] = useState<ShopWithSummary[]>([]);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const { matchesFilters } = useFilters();

  // Es wird immer nur der sichtbare Kartenausschnitt geladen (deutschlandweit
  // wären es zu viele Läden auf einmal).
  const loadVisibleShops = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const [northEast, southWest] = await map.getVisibleBounds();
      const bounds: GeoBounds = {
        minLat: southWest[1],
        maxLat: northEast[1],
        minLon: southWest[0],
        maxLon: northEast[0],
      };
      // Bei sehr weitem Zoom (halb Deutschland sichtbar) nicht laden – erst reinzoomen.
      if (bounds.maxLat - bounds.minLat > 3.5) {
        setShops([]);
        return;
      }
      setShops(await fetchShopsInBounds(bounds));
    } catch (e) {
      Alert.alert('Fehler beim Laden', e instanceof Error ? e.message : 'Unbekannt');
    }
  }, []);

  // Bei jedem Fokus neu laden, damit neue Läden/Bewertungen sofort sichtbar sind.
  useFocusEffect(
    useCallback(() => {
      loadVisibleShops();
    }, [loadVisibleShops])
  );

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) =>
      setHasLocationPermission(status === 'granted')
    );
  }, []);

  const goToMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Standort', 'Ohne Standortfreigabe kann die Karte nicht zentriert werden.');
      return;
    }
    setHasLocationPermission(true);
    const pos = await Location.getCurrentPositionAsync({});
    cameraRef.current?.setCamera({
      centerCoordinate: [pos.coords.longitude, pos.coords.latitude],
      zoomLevel: 14,
      animationDuration: 500,
    });
  };

  return (
    <View style={styles.flex}>
      <MapView
        ref={mapRef}
        style={styles.flex}
        mapStyle={MAP_STYLE}
        attributionEnabled
        logoEnabled={false}
        onRegionDidChange={loadVisibleShops}
        onDidFinishLoadingMap={loadVisibleShops}
      >
        <Camera defaultSettings={{ centerCoordinate: INITIAL_CENTER, zoomLevel: 11 }} ref={cameraRef} />
        {hasLocationPermission ? <UserLocation /> : null}
        {shops.filter(matchesFilters).map((shop) => {
          const open = isOpenNow(shop.opening_hours ?? {});
          return (
            <PointAnnotation
              key={shop.id}
              id={shop.id}
              coordinate={[shop.longitude, shop.latitude]}
              onSelected={() => navigation.navigate('ShopDetail', { shopId: shop.id })}
            >
              <View
                style={[
                  styles.pin,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: open ? theme.colors.success : theme.colors.danger,
                  },
                ]}
              >
                <Text style={styles.pinEmoji}>🥙</Text>
              </View>
            </PointAnnotation>
          );
        })}
      </MapView>

      {/* Filter-Chips über der Karte */}
      <View style={styles.filterOverlay}>
        <FilterBar />
      </View>

      {/* OSM-Attribution ist lizenzrechtlich Pflicht. */}
      <View style={[styles.attribution, { backgroundColor: theme.colors.surface }]}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 10 }}>
          {ATTRIBUTION_TEXT}
        </Text>
      </View>

      <Pressable
        onPress={goToMyLocation}
        style={[styles.fab, styles.locateFab, { backgroundColor: theme.colors.surface }]}
      >
        <Text style={{ fontSize: 22 }}>📍</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('AddShop')}
        style={[styles.fab, styles.addFab, { backgroundColor: theme.colors.primary }]}
      >
        <Text style={{ color: theme.colors.onPrimary, fontSize: 30, lineHeight: 34 }}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  addFab: { bottom: 24, right: 16 },
  attribution: {
    borderRadius: 4,
    bottom: 4,
    left: 4,
    opacity: 0.85,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: 'absolute',
  },
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
  filterOverlay: { left: 0, position: 'absolute', right: 0, top: 4 },
  flex: { flex: 1 },
  locateFab: { bottom: 92, right: 16 },
  pin: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 3,
    elevation: 3,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  pinEmoji: { fontSize: 20 },
});
