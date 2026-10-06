import Feather from '@expo/vector-icons/Feather';
import React from 'react';

import { useTheme } from '@/theme/ThemeContext';

export type IconName = React.ComponentProps<typeof Feather>['name'];

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

/** Einheitliche Linien-Icons (Feather) statt Emojis – wirken auf jedem Gerät gleich. */
export function Icon({ name, size = 20, color }: Props) {
  const { theme } = useTheme();
  // Rein dekorativ: Bildschirmleser sollen das Symbolzeichen nicht vorlesen –
  // die Bedeutung steht immer im Text bzw. im accessibilityLabel daneben.
  return (
    <Feather
      name={name}
      size={size}
      color={color ?? theme.colors.text}
      accessibilityElementsHidden
      importantForAccessibility="no"
      aria-hidden
    />
  );
}
