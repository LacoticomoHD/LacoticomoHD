import React, { useRef } from 'react';
import { Animated, Pressable, type PressableProps, type ViewStyle } from 'react-native';

import { tapLight } from '@/lib/haptics';

interface Props extends PressableProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Wie stark beim Drücken verkleinert wird (Standard 0.97). */
  activeScale?: number;
  /** Haptik beim Drücken auslösen (Standard true). */
  haptic?: boolean;
}

/** Pressable, das beim Antippen sanft „einfedert" (Scale) und dezent vibriert –
 *  gibt der App ein hochwertiges, reaktives Gefühl. Funktioniert nativ und im Web. */
export function PressableScale({
  children,
  style,
  activeScale = 0.97,
  haptic = true,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      onPressIn={(e) => {
        if (haptic) tapLight();
        animateTo(activeScale);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
