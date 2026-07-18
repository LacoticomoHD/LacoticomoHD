import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text } from 'react-native';

import { tapMedium } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeContext';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled }: Props) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const background =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'danger'
        ? theme.colors.danger
        : theme.colors.surfaceVariant;
  const textColor = variant === 'secondary' ? theme.colors.text : theme.colors.onPrimary;

  const animateTo = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (!(disabled || loading)) tapMedium();
        animateTo(0.97);
      }}
      onPressOut={() => animateTo(1)}
      disabled={disabled || loading}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.button,
            variant === 'primary' ? styles.shadow : null,
            {
              backgroundColor: background,
              opacity: disabled || pressed ? 0.85 : 1,
              transform: [{ scale }],
              shadowColor: theme.colors.primary,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={textColor} />
          ) : (
            <Text style={[styles.label, { color: textColor }]}>{title}</Text>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: { fontSize: 16, fontWeight: '600' },
  shadow: {
    elevation: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
  },
});
