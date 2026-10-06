import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Text } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { ShopRow } from '@/components/ShopRow';
import { useI18n } from '@/i18n/I18nContext';
import { useFilters } from '@/lib/FilterContext';
import { distanceKm } from '@/lib/geo';
import { tapLight } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeContext';
import { ShopWithSummary } from '@/types';

/** Sichtbare Höhe der eingeklappten Liste (Griff + Titelzeile). */
export const SHEET_PEEK = 72;

interface Props {
  /** Bereits gefilterte Läden im sichtbaren Kartenausschnitt. */
  shops: ShopWithSummary[];
  /** Bezugspunkt für die Entfernung: eigener Standort, sonst Kartenmitte. */
  origin: { latitude: number; longitude: number } | null;
  /** true = origin ist der eigene Standort (ändert den Titel). */
  originIsUser: boolean;
  /** Kartenausschnitt zu groß – es wurden bewusst keine Läden geladen. */
  zoomedOut: boolean;
  onSelect: (shopId: string) => void;
}

/** Hochzieh-Liste über der Karte: eingeklappt nur die Anzahl, hochgezogen die
 *  Läden im Kartenausschnitt – nach Entfernung sortiert. */
export function NearbySheet({ shops, origin, originIsUser, zoomedOut, onSelect }: Props) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { hasActiveFilters, resetFilters } = useFilters();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.max(320, Math.round(windowHeight * 0.58));
  const collapsedY = sheetHeight - SHEET_PEEK;

  const translateY = useRef(new Animated.Value(collapsedY)).current;
  const [expanded, setExpanded] = useState(false);
  const startY = useRef(collapsedY);
  const currentY = useRef(collapsedY);

  useEffect(() => {
    const id = translateY.addListener(({ value }) => {
      currentY.current = value;
    });
    return () => translateY.removeListener(id);
  }, [translateY]);

  // Fenstergröße geändert (Drehen, Browser-Fenster): Position neu einrasten.
  useEffect(() => {
    translateY.setValue(expanded ? 0 : collapsedY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsedY]);

  const snapTo = (open: boolean) => {
    setExpanded(open);
    Animated.spring(translateY, {
      toValue: open ? 0 : collapsedY,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
        // Beim Ziehen nicht an die Liste oder die Karte abgeben.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          translateY.stopAnimation();
          startY.current = currentY.current;
        },
        onPanResponderMove: (_e, g) => {
          const next = Math.min(collapsedY, Math.max(0, startY.current + g.dy));
          translateY.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          // Kurzes Antippen ohne Bewegung: auf- bzw. zuklappen.
          if (Math.abs(g.dy) < 6) {
            tapLight();
            snapTo(currentY.current > collapsedY / 2);
            return;
          }
          const open = g.vy < -0.4 || (g.vy <= 0.4 && currentY.current < collapsedY / 2);
          snapTo(open);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collapsedY]
  );

  const sorted = useMemo(() => {
    if (!origin) return shops;
    return shops
      .map((s) => ({ s, d: distanceKm(origin.latitude, origin.longitude, s.latitude, s.longitude) }))
      .sort((a, b) => a.d - b.d)
      .map((x) => x.s);
  }, [shops, origin]);

  const title = zoomedOut
    ? t('map.sheetZoomIn')
    : t(originIsUser ? 'map.sheetNearby' : 'map.sheetInView', { n: shops.length });

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          height: sheetHeight,
          shadowColor: theme.dark ? '#000' : theme.glow,
          transform: [{ translateY }],
        },
      ]}
    >
      <View {...pan.panHandlers} style={styles.header}>
        <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          {!zoomedOut && shops.length > 0 ? (
            <Pressable onPress={() => snapTo(!expanded)} hitSlop={10}>
              <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '600' }}>
                {expanded ? t('map.sheetClose') : t('map.sheetOpen')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <FlatList
        data={sorted.slice(0, 60)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ShopRow
            shop={item}
            distance={
              origin
                ? distanceKm(origin.latitude, origin.longitude, item.latitude, item.longitude)
                : null
            }
            onPress={() => onSelect(item.id)}
          />
        )}
        ListEmptyComponent={
          zoomedOut ? null : hasActiveFilters ? (
            <EmptyState
              compact
              icon="sliders"
              text={t('list.emptyFilter')}
              actions={[{ label: t('empty.resetFilters'), icon: 'x', onPress: resetFilters }]}
            />
          ) : (
            <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
              {t('map.sheetEmpty')}
            </Text>
          )
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: { marginTop: 24, paddingHorizontal: 24, textAlign: 'center' },
  handle: { alignSelf: 'center', borderRadius: 3, height: 5, marginBottom: 10, width: 42 },
  // userSelect: Im Browser würde Ziehen mit der Maus sonst Text markieren.
  header: { paddingBottom: 14, paddingHorizontal: 18, paddingTop: 9, userSelect: 'none' },
  list: { paddingBottom: 24, paddingHorizontal: 12 },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    bottom: 0,
    elevation: 16,
    left: 0,
    position: 'absolute',
    right: 0,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  title: { flex: 1, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
});
