// Browser-Version der Karte (PWA): MapLibre GL JS statt der nativen Bibliothek.
// Metro wählt diese Datei automatisch für Web-Builds (Endung .web.tsx).
import { Asset } from 'expo-asset';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { FilterBar } from '@/components/FilterBar';
import { useI18n } from '@/i18n/I18nContext';
import {
  BOUNDS_LIMIT,
  type CityCluster,
  fetchCityClusters,
  fetchShopsInBounds,
  geocodeAddress,
} from '@/lib/api';
import {
  CLUSTER_FONT,
  CLUSTER_NAME_OFFSET,
  CLUSTER_RADIUS,
  CLUSTER_TAP_ZOOM,
  clustersToGeoJSON,
} from '@/lib/cityClusters';
import { formatLoadError } from '@/lib/errors';
import { tapLight, tapMedium } from '@/lib/haptics';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useFilters } from '@/lib/FilterContext';
import { isOpenNow } from '@/lib/openingHours';
import type { RootStackParamList } from '@/navigation/types';
import { darkTheme, lightTheme } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { GeoBounds, ShopWithSummary } from '@/types';
import { Text, TextInput } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { NearbySheet, SHEET_PEEK } from '@/components/NearbySheet';
import { darkStyleUrl, loadWarmDarkStyle, useWarmDarkStyle } from '@/lib/mapStyle';
import { LinearGradient } from 'expo-linear-gradient';

const INITIAL_CENTER: [number, number] = [8.4044, 49.0093];

// Karten-Marker (Döner-Pin) je Theme: farbig = geöffnet, neutral = geschlossen.
const PIN_URIS = {
  light: {
    open: Asset.fromModule(require('../../assets/markers/pin-open-light.png')).uri,
    closed: Asset.fromModule(require('../../assets/markers/pin-closed-light.png')).uri,
  },
  dark: {
    open: Asset.fromModule(require('../../assets/markers/pin-open-dark.png')).uri,
    closed: Asset.fromModule(require('../../assets/markers/pin-closed-dark.png')).uri,
  },
};

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

const MAP_STYLE_DARK: string | maplibregl.StyleSpecification =
  darkStyleUrl(MAP_STYLE_URL) ?? MAP_STYLE;
// Umgefärbten dunklen Stil früh vorladen, damit beim Öffnen nichts blau aufblitzt.
loadWarmDarkStyle(MAP_STYLE_URL);

const currentStyleKey = (dark: boolean, warm: object | null) =>
  dark ? (warm ? 'dark-warm' : 'dark') : 'light';
const styleFor = (dark: boolean, warm: object | null): string | maplibregl.StyleSpecification =>
  dark ? ((warm as maplibregl.StyleSpecification | null) ?? MAP_STYLE_DARK) : MAP_STYLE;

// Dunkle Variante des (lizenzrechtlich nötigen) Copyright-Hinweises der Karte.
if (typeof document !== 'undefined' && !document.getElementById('dd-map-dark-css')) {
  const el = document.createElement('style');
  el.id = 'dd-map-dark-css';
  el.textContent = `
    .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right { bottom: ${SHEET_PEEK}px; }
    .dd-dark .maplibregl-ctrl-attrib { background: rgba(26,19,17,0.85) !important; color: #A4958A; }
    .dd-dark .maplibregl-ctrl-attrib a { color: #A4958A !important; }
    .dd-dark .maplibregl-ctrl-attrib-button { filter: invert(1); background-color: transparent; }
  `;
  document.head.appendChild(el);
}

/** Milchglas-Effekt für schwebende Flächen – nur im Browser verfügbar. */
const GLASS = { backdropFilter: 'blur(18px) saturate(1.4)' } as object;

export function MapScreen() {
  const { theme } = useTheme();
  const darkRef = useRef(theme.dark);
  darkRef.current = theme.dark;
  const warmDark = useWarmDarkStyle(MAP_STYLE_URL, theme.dark);
  const warmDarkRef = useRef(warmDark);
  warmDarkRef.current = warmDark;
  const appliedStyleRef = useRef('');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const containerRef = useRef<View>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapReadyRef = useRef(false);
  const handlersRef = useRef(false);
  const shopFeaturesRef = useRef<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] });
  const [shops, setShops] = useState<ShopWithSummary[]>([]);
  const { matchesFilters } = useFilters();
  const { t } = useI18n();
  const requireAuth = useRequireAuth();
  const [truncated, setTruncated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // Für die Hochzieh-Liste: eigener Standort (falls freigegeben) bzw. Kartenmitte.
  const [userPos, setUserPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [zoomedOut, setZoomedOut] = useState(false);
  const [clusters, setClusters] = useState<CityCluster[]>([]);
  const clusterFeaturesRef = useRef<GeoJSON.FeatureCollection>(clustersToGeoJSON([]));

  // Jede Ladeabfrage bekommt eine Nummer. Kommt eine ältere Antwort erst nach
  // einer neueren an (z. B. nach schnellem Herauszoomen), wird sie verworfen –
  // sonst blieben veraltete Pins stehen.
  const loadSeq = useRef(0);

  const loadVisibleShops = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const seq = ++loadSeq.current;
    const b = map.getBounds();
    const bounds: GeoBounds = {
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
      minLon: b.getWest(),
      maxLon: b.getEast(),
    };
    const c = map.getCenter();
    setMapCenter({ latitude: c.lat, longitude: c.lng });
    // Weit herausgezoomt: statt Einzelläden Blasen mit der Anzahl je Stadt.
    if (bounds.maxLat - bounds.minLat > 3.5) {
      setShops([]);
      setTruncated(false);
      setZoomedOut(true);
      fetchCityClusters(bounds)
        .then((c) => {
          if (seq === loadSeq.current) setClusters(c);
        })
        .catch(() => {});
      return;
    }
    setZoomedOut(false);
    setClusters([]);
    try {
      const found = await fetchShopsInBounds(bounds);
      if (seq !== loadSeq.current) return;
      setShops(found);
      setTruncated(found.length >= BOUNDS_LIMIT);
    } catch (e) {
      const msg = formatLoadError(e);
      if (msg) Alert.alert(t('common.loadError'), msg);
    }
  }, []);

  // Karte initialisieren
  useEffect(() => {
    const container = containerRef.current as unknown as HTMLElement | null;
    if (!container) return;
    appliedStyleRef.current = currentStyleKey(darkRef.current, warmDarkRef.current);
    const map = new maplibregl.Map({
      container,
      style: styleFor(darkRef.current, warmDarkRef.current),
      center: INITIAL_CENTER,
      zoom: 11,
      attributionControl: false,
    });
    // Copyright-Hinweis (Pflicht) links unten, damit er nicht unter dem „+" liegt.
    map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-left');
    mapRef.current = map;
    container.classList.toggle('dd-dark', darkRef.current);
    // Nur in der Entwicklung: Zugriff für automatisierte Browser-Tests.
    if (__DEV__) (window as unknown as { __ddMap?: maplibregl.Map }).__ddMap = map;

    const loadMarker = (name: string, url: string) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          if (!map.hasImage(name)) map.addImage(name, img);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      });

    // Läuft beim ersten Laden UND nach jedem Theme-Wechsel (setStyle verwirft
    // eigene Quellen, Ebenen und Bilder – sie werden hier neu angelegt).
    map.on('style.load', async () => {
      const pins = darkRef.current ? PIN_URIS.dark : PIN_URIS.light;
      if (map.hasImage('pin-open')) map.removeImage('pin-open');
      if (map.hasImage('pin-closed')) map.removeImage('pin-closed');
      await Promise.all([loadMarker('pin-open', pins.open), loadMarker('pin-closed', pins.closed)]);
      if (map.getSource('shops')) {
        mapReadyRef.current = true;
        return;
      }
      map.addSource('shops', {
        type: 'geojson',
        data: shopFeaturesRef.current,
      });
      map.addLayer({
        id: 'shop-markers',
        type: 'symbol',
        source: 'shops',
        layout: {
          'icon-image': ['case', ['get', 'open'], 'pin-open', 'pin-closed'],
          // Noch unbewertete Läden treten optisch zurück.
          'icon-size': ['case', ['get', 'rated'], 0.17, 0.12],
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-opacity': ['case', ['get', 'rated'], 1, 0.7],
        },
      });
      // Städte-Blasen für die weit herausgezoomte Karte.
      const th = darkRef.current ? darkTheme : lightTheme;
      map.addSource('cities', { type: 'geojson', data: clusterFeaturesRef.current });
      map.addLayer({
        id: 'city-bubbles',
        type: 'circle',
        source: 'cities',
        paint: {
          'circle-radius': CLUSTER_RADIUS as unknown as maplibregl.ExpressionSpecification,
          'circle-color': th.colors.primary,
          'circle-opacity': 0.92,
          'circle-stroke-color': th.dark ? '#FFA534' : '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'city-counts',
        type: 'symbol',
        source: 'cities',
        layout: {
          'text-field': ['get', 'label'],
          'text-font': CLUSTER_FONT,
          'text-size': 12,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': th.colors.onPrimary },
      });
      map.addLayer({
        id: 'city-names',
        type: 'symbol',
        source: 'cities',
        layout: {
          'text-field': ['get', 'city'],
          'text-font': CLUSTER_FONT,
          'text-size': 11,
          'text-offset': CLUSTER_NAME_OFFSET as [number, number],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': th.colors.text,
          'text-halo-color': th.colors.background,
          'text-halo-width': 1.5,
        },
      });
      mapReadyRef.current = true;
      if (handlersRef.current) return;
      handlersRef.current = true;
      map.on('click', 'city-bubbles', (e) => {
        const f = e.features?.[0];
        if (f?.geometry.type !== 'Point') return;
        const [lon, lat] = f.geometry.coordinates;
        map.flyTo({ center: [lon, lat], zoom: CLUSTER_TAP_ZOOM });
      });
      map.on('mouseenter', 'city-bubbles', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'city-bubbles', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', 'shop-markers', (e) => {
        const shopId = e.features?.[0]?.properties?.id as string | undefined;
        if (shopId) navigation.navigate('ShopDetail', { shopId });
      });
      map.on('mouseenter', 'shop-markers', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'shop-markers', () => {
        map.getCanvas().style.cursor = '';
      });
      loadVisibleShops();
    });
    map.on('moveend', loadVisibleShops);

    // Wenn der Standort bereits freigegeben ist, direkt dorthin springen.
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          if (status.state === 'granted') {
            navigator.geolocation.getCurrentPosition((pos) => {
              setUserPos({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              map.jumpTo({
                center: [pos.coords.longitude, pos.coords.latitude],
                zoom: 13,
              });
            });
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
  const visibleShops = useMemo(() => shops.filter(matchesFilters), [shops, matchesFilters]);

  const shopFeatures = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: visibleShops.map((shop) => ({
        type: 'Feature' as const,
        id: shop.id,
        geometry: { type: 'Point' as const, coordinates: [shop.longitude, shop.latitude] },
        properties: {
          id: shop.id,
          open: isOpenNow(shop.opening_hours ?? {}),
          rated: (shop.summary?.rating_count ?? 0) > 0,
        },
      })),
    }),
    [visibleShops]
  );

  useEffect(() => {
    const map = mapRef.current;
    shopFeaturesRef.current = shopFeatures;
    if (!map || !mapReadyRef.current) return;
    const source = map.getSource('shops') as maplibregl.GeoJSONSource | undefined;
    source?.setData(shopFeatures);
  }, [shopFeatures]);

  useEffect(() => {
    const features = clustersToGeoJSON(clusters);
    clusterFeaturesRef.current = features;
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    (map.getSource('cities') as maplibregl.GeoJSONSource | undefined)?.setData(features);
  }, [clusters]);

  // Theme gewechselt oder umgefärbter Dunkel-Stil fertig geladen: passenden
  // Kartenstil setzen (nur wenn er sich wirklich ändert).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const wanted = currentStyleKey(theme.dark, warmDark);
    if (wanted === appliedStyleRef.current) return;
    appliedStyleRef.current = wanted;
    map.getContainer().classList.toggle('dd-dark', theme.dark);
    mapReadyRef.current = false;
    map.setStyle(styleFor(theme.dark, warmDark), { diff: false });
  }, [theme.dark, warmDark]);

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
      (pos) => {
        setUserPos({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 14,
        });
      },
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
            GLASS,
            {
              backgroundColor: theme.colors.overlay,
              borderColor: theme.colors.overlayBorder,
              shadowColor: theme.dark ? '#000' : theme.glow,
            },
          ]}
        >
          <Icon name="search" size={19} color={theme.colors.textSecondary} />
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
              <Icon name="x" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <FilterBar />
        {truncated ? (
          <Text
            style={[
              styles.truncatedHint,
              { backgroundColor: theme.colors.surface, color: theme.colors.textSecondary },
            ]}
          >
            {t('map.tooMany')}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPressIn={tapLight}
        onPress={goToMyLocation}
        style={({ pressed }) => [
          styles.fab,
          styles.locateFab,
          GLASS,
          {
            backgroundColor: theme.colors.overlay,
            borderColor: theme.colors.overlayBorder,
            borderWidth: 1,
            transform: [{ scale: pressed ? 0.92 : 1 }],
          },
        ]}
        accessibilityLabel={t('map.locationTitle')}
      >
        <Icon name="crosshair" size={22} color={theme.colors.text} />
      </Pressable>

      <Pressable
        onPressIn={tapMedium}
        onPress={() => {
          if (!requireAuth()) return;
          navigation.navigate('AddShop');
        }}
        style={({ pressed }) => [
          styles.fab,
          styles.addFab,
          { shadowColor: theme.glow, transform: [{ scale: pressed ? 0.92 : 1 }] },
        ]}
        accessibilityLabel={t('nav.addShop')}
      >
        <LinearGradient
          colors={theme.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabFill}
        >
          <Icon name="plus" size={28} color={theme.colors.onPrimary} />
        </LinearGradient>
      </Pressable>

      <NearbySheet
        shops={visibleShops}
        origin={userPos ?? mapCenter}
        originIsUser={userPos != null}
        zoomedOut={zoomedOut}
        onSelect={(shopId) => navigation.navigate('ShopDetail', { shopId })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  addFab: { bottom: SHEET_PEEK + 16, right: 16, shadowOpacity: 0.45, shadowRadius: 12 },
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
  fabFill: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  flex: { flex: 1 },
  locateFab: { bottom: SHEET_PEEK + 84, right: 16 },
  searchBox: {
    alignItems: 'center',
    borderRadius: 27,
    borderWidth: 1,
    elevation: 6,
    flexDirection: 'row',
    gap: 10,
    height: 54,
    marginBottom: 4,
    marginHorizontal: 12,
    paddingHorizontal: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  truncatedHint: {
    borderRadius: 14,
    fontSize: 12,
    marginHorizontal: 8,
    marginTop: 6,
    opacity: 0.95,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  topOverlay: { left: 0, position: 'absolute', right: 0, top: 8 },
});
