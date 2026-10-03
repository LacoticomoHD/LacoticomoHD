import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
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
  const textColor = variant === 'secondary' ? theme.colors.text : theme.colors.onPrimary;

  const animateTo = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  const label = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <Text style={[styles.label, { color: textColor }]}>{title}</Text>
  );

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
            styles.shell,
            variant === 'primary' ? [styles.glow, { shadowColor: theme.glow }] : null,
            { opacity: disabled || pressed ? 0.85 : 1, transform: [{ scale }] },
          ]}
        >
          {variant === 'primary' ? (
            <LinearGradient
              colors={theme.gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              {label}
            </LinearGradient>
          ) : (
            <View
              style={[
                styles.button,
                variant === 'danger'
                  ? { backgroundColor: theme.colors.danger }
                  : {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderWidth: 1,
                    },
              ]}
            >
              {label}
            </View>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 26,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  glow: {
    elevation: 6,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  label: { fontSize: 16, fontWeight: '700', letterSpacing: -0.1 },
  shell: { borderRadius: 26 },
});
