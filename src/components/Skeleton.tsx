import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

/** Gemeinsamer Puls für alle Platzhalter einer Liste (sonst laufen sie versetzt). */
function usePulse() {
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
}

/** Grauer Platzhalter in der Form einer Ladenzeile, solange Daten laden. */
function RowSkeleton({ opacity }: { opacity: Animated.Value }) {
  const { theme } = useTheme();
  const block = { backgroundColor: theme.colors.surfaceVariant };
  return (
    <Animated.View
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity }]}
    >
      <View style={[styles.tile, block]} />
      <View style={styles.body}>
        <View style={[styles.line, block, { width: '62%', height: 14 }]} />
        <View style={[styles.line, block, { width: '82%' }]} />
        <View style={[styles.line, block, { width: '40%' }]} />
      </View>
      <View style={[styles.chip, block]} />
    </Animated.View>
  );
}

/** Mehrere Ladenzeilen-Platzhalter untereinander. */
export function ShopListSkeleton({ count = 6 }: { count?: number }) {
  const opacity = usePulse();
  return (
    <View accessibilityLabel="…" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <RowSkeleton key={i} opacity={opacity} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: 7 },
  card: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    marginBottom: 10,
    padding: 12,
  },
  chip: { borderRadius: 15, height: 30, width: 54 },
  line: { borderRadius: 6, height: 10 },
  tile: { borderRadius: 16, height: 54, width: 54 },
});
