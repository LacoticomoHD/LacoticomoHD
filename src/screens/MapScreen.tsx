import * as Location from 'expo-location';
import React, { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { fetchShopsWithSummary } from '@/lib/api';
import { isOpenNow } from '@/lib/openingHours';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { ShopWithSummary } from '@/types';

// Start: Berlin Mitte – bis der Nutzer seinen Standort freigibt.
const INITIAL_REGION = {
  latitude: 52.52,
  longitude: 13.405,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

// Für Produktivbetrieb eigenen Tile-Anbieter in .env setzen (EXPO_PUBLIC_TILE_URL),
// z. B. MapTiler – die offiziellen OSM-Server sind nicht für App-Massenbetrieb gedacht.
const OSM_TILE_URL =
  process.env.EXPO_PUBLIC_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export function MapScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const mapRef = useRef<MapView>(null);
  const [shops, setShops] = useState<ShopWithSummary[]>([]);

  const loadShops = useCallback(() => {
    fetchShopsWithSummary()
      .then(setShops)
      .catch((e: Error) => Alert.alert('Fehler beim Laden', e.message));
  }, []);

  // Bei jedem Fokus neu laden, damit neue Läden/Bewertungen sofort sichtbar sind.
  useFocusEffect(loadShops);

  const goToMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Standort', 'Ohne Standortfreigabe kann die Karte nicht zentriert werden.');
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateToRegion(
      {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      },
      500
    );
  };

  return (
    <View style={styles.flex}>
      <MapView
        ref={mapRef}
        style={styles.flex}
        initialRegion={INITIAL_REGION}
        // Eigene OSM-Tiles statt der Standard-Karte (Google/Apple).
        mapType={undefined}
      >
        <UrlTile urlTemplate={OSM_TILE_URL} maximumZ={19} shouldReplaceMapContent />
        {shops.map((shop) => {
          const open = isOpenNow(shop.opening_hours ?? {});
          const avg = shop.summary?.avg_gesamt;
          return (
            <Marker
              key={shop.id}
              coordinate={{ latitude: shop.latitude, longitude: shop.longitude }}
              title={shop.name}
              description={
                (avg != null ? `★ ${avg.toFixed(1)} · ` : 'Noch keine Bewertung · ') +
                (open ? 'Jetzt geöffnet' : 'Geschlossen')
              }
              pinColor={open ? theme.colors.success : theme.colors.danger}
              onCalloutPress={() => navigation.navigate('ShopDetail', { shopId: shop.id })}
            />
          );
        })}
      </MapView>

      {/* OSM-Attribution ist lizenzrechtlich Pflicht. */}
      <View style={[styles.attribution, { backgroundColor: theme.colors.surface }]}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 10 }}>
          © OpenStreetMap-Mitwirkende
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
  flex: { flex: 1 },
  locateFab: { bottom: 92, right: 16 },
});
