import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { tapLight } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeContext';

interface Props {
  value: number;
  /** Wird gesetzt, macht die Sterne antippbar (1–5). */
  onChange?: (value: number) => void;
  size?: number;
}

/** Ein einzelner Stern, der beim Auswählen kurz „aufpoppt" (Spring-Scale). */
function Star({
  filled,
  size,
  color,
  emptyColor,
}: {
  filled: boolean;
  size: number;
  color: string;
  emptyColor: string;
}) {
  const scale = useRef(new Animated.Value(filled ? 1 : 0.88)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      scale.setValue(filled ? 1 : 0.88);
      return;
    }
    if (filled) {
      // Kleiner Pop: kurz über 100 % hinaus und wieder zurückfedern.
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.35, useNativeDriver: true, speed: 50, bounciness: 12 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
      ]).start();
    } else {
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 20 }).start();
    }
  }, [filled, scale]);

  return (
    <Animated.Text
      style={{
        fontSize: size,
        color: filled ? color : emptyColor,
        marginRight: 2,
        transform: [{ scale }],
      }}
    >
      ★
    </Animated.Text>
  );
}

export function StarRating({ value, onChange, size = 22 }: Props) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value >= star - 0.25;
        const starNode = (
          <Star
            filled={filled}
            size={size}
            color={theme.colors.star}
            emptyColor={theme.colors.starEmpty}
          />
        );
        if (!onChange) return <View key={star}>{starNode}</View>;
        return (
          <Pressable
            key={star}
            onPress={() => {
              tapLight();
              onChange(star);
            }}
            hitSlop={6}
          >
            {starNode}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
