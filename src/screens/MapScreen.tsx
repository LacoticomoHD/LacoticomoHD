import {
  Camera,
  CircleLayer,
  MapView,
  ShapeSource,
  UserLocation,
  type MapViewRef,
  type OnPressEvent,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
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

// Start: Karlsruhe – hier begann die Community. [Längengrad, Breitengrad]
// Wird beim Start durch den eigenen Standort ersetzt, sobald die Freigabe da ist.
const INITIAL_CENTER: [number, number] = [8.4044, 49.0093];

/** Kamera-Sprünge laufen ausschließlich über defaultSettings + key-Remount:
 *  Der imperative setCamera-Befehl bleibt auf der neuen RN-Architektur als
 *  Eigenschaft "kleben" und wird bei jedem Daten-Refresh erneut ausgeführt –
 *  das war die Ursache für das ständige Zurückspringen der Karte. Ein
 *  Remount wendet die Position dagegen garantiert genau EINMAL an. */
interface CameraJump {
  centerCoordinate: [number, number];
  zoomLevel: number;
  key: number;
}

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
  const mapRef = useRef<MapViewRef>(null);
  const [shops, setShops] = useState<ShopWithSummary[]>([]);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [camera, setCameraJump] = useState<CameraJump>({
    centerCoordinate: INITIAL_CENTER,
    zoomLevel: 11,
    key: 0,
  });
  const { matchesFilters } = useFilters();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

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
      const msg = formatLoadError(e);
      if (msg) Alert.alert(t('common.loadError'), msg);
    }
  }, []);

  // Bei jedem Fokus neu laden, damit neue Läden/Bewertungen sofort sichtbar sind.
  useFocusEffect(
    useCallback(() => {
      loadVisibleShops();
    }, [loadVisibleShops])
  );

  // Beim Start: Wenn die Standortfreigabe schon erteilt ist, direkt zur eigenen
  // Position springen (kein Berechtigungs-Popup – das kommt erst beim 📍-Knopf).
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      setHasLocationPermission(true);
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(
          () => null
        ));
      if (pos) {
        setCameraJump((prev) => ({
          centerCoordinate: [pos.coords.longitude, pos.coords.latitude],
          zoomLevel: 13,
          key: prev.key + 1,
        }));
      }
    })();
  }, []);

  // Läden als GeoJSON für die GL-Kreis-Ebene. Wichtig: Die Marker sind KEINE
  // einzelnen Views – dadurch bleibt die Kartenstruktur stabil und die Kamera
  // springt beim Nachladen nicht auf die Startposition zurück (Android-Bug).
  const shopFeatures = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: shops.filter(matchesFilters).map((shop) => ({
        type: 'Feature' as const,
        id: shop.id,
        geometry: { type: 'Point' as const, coordinates: [shop.longitude, shop.latitude] },
        properties: {
          id: shop.id,
          open: isOpenNow(shop.opening_hours ?? {}),
        },
      })),
    }),
    [shops, matchesFilters]
  );

  const onShopPress = (event: OnPressEvent) => {
    const shopId = event.features?.[0]?.properties?.id as string | undefined;
    if (shopId) navigation.navigate('ShopDetail', { shopId });
  };

  // Ortssuche: Eingabe (z. B. „Frankfurt") per Nominatim geokodieren und die
  // Karte dorthin springen lassen – kein mühsames Scrollen quer durch Deutschland.
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
      tapMedium();
      setCameraJump((prev) => ({
        centerCoordinate: [longitude, latitude],
        zoomLevel: 13,
        key: prev.key + 1,
      }));
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSearching(false);
    }
  };

  const goToMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('map.locationTitle'), t('map.locationDenied'));
      return;
    }
    setHasLocationPermission(true);
    const pos = await Location.getCurrentPositionAsync({});
    setCameraJump((prev) => ({
      centerCoordinate: [pos.coords.longitude, pos.coords.latitude],
      zoomLevel: 14,
      key: prev.key + 1,
    }));
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
        <Camera
          key={camera.key}
          defaultSettings={{
            centerCoordinate: camera.centerCoordinate,
            zoomLevel: camera.zoomLevel,
          }}
        />
        {/* Immer eingehängt (nur Sichtbarkeit wechselt): Ein-/Aushängen von
            Karten-Kindern löste auf Android den Kamera-Reset beim Zoomen aus. */}
        <UserLocation visible={hasLocationPermission} />
        <ShapeSource id="shops" shape={shopFeatures} onPress={onShopPress} hitbox={{ width: 24, height: 24 }}>
          <CircleLayer
            id="shop-circles"
            style={{
              circleRadius: 9,
              circleColor: theme.colors.primary,
              circleStrokeWidth: 3,
              circleStrokeColor: [
                'case',
                ['get', 'open'],
                theme.colors.success,
                theme.colors.danger,
              ],
              circleOpacity: 0.95,
            }}
          />
        </ShapeSource>
      </MapView>

      {/* Ortssuche + Filter-Chips über der Karte */}
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

      {/* OSM-Attribution ist lizenzrechtlich Pflicht. */}
      <View style={[styles.attribution, { backgroundColor: theme.colors.surface }]}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 10 }}>
          {ATTRIBUTION_TEXT}
        </Text>
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
