import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

interface Props {
  value: number;
  /** Wird gesetzt, macht die Sterne antippbar (1–5). */
  onChange?: (value: number) => void;
  size?: number;
}

export function StarRating({ value, onChange, size = 22 }: Props) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value >= star - 0.25;
        const star_ = (
          <Text
            key={star}
            style={{
              fontSize: size,
              color: filled ? theme.colors.star : theme.colors.starEmpty,
              marginRight: 2,
            }}
          >
            ★
          </Text>
        );
        if (!onChange) return star_;
        return (
          <Pressable key={star} onPress={() => onChange(star)} hitSlop={6}>
            {star_}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
