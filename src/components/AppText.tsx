import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

import type { Theme } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';

/** Wählt zur gewünschten Strichstärke die passende Schriftdatei des aktiven
 *  Themes (Manrope hell, Space Grotesk dunkel). Eigene Schriftdateien tragen
 *  ihre Stärke schon in sich – ein zusätzliches fontWeight würde auf Android zur
 *  Systemschrift zurückfallen und im Browser künstlich nachfetten. */
function fontFor(theme: Theme, style: TextStyle | undefined): TextStyle | null {
  if (style?.fontFamily) return null;
  const w = String(style?.fontWeight ?? '400');
  const f = theme.fonts;
  const fontFamily =
    w === '800' || w === '900'
      ? f.extrabold
      : w === '700' || w === 'bold'
        ? f.bold
        : w === '600'
          ? f.semibold
          : w === '500'
            ? f.medium
            : f.regular;
  return { fontFamily, fontWeight: 'normal' };
}

/** Ersatz für Text aus react-native – setzt automatisch die Theme-Schrift. */
export const Text = forwardRef<RNText, TextProps>(function AppText({ style, ...rest }, ref) {
  const { theme } = useTheme();
  const font = fontFor(theme, StyleSheet.flatten(style));
  return <RNText ref={ref} style={[style, font]} {...rest} />;
});

/** Ersatz für TextInput aus react-native – setzt automatisch die Theme-Schrift. */
export const TextInput = forwardRef<RNTextInput, TextInputProps>(function AppTextInput(
  { style, ...rest },
  ref
) {
  const { theme } = useTheme();
  const font = fontFor(theme, StyleSheet.flatten(style) as TextStyle);
  return <RNTextInput ref={ref} style={[style, font]} {...rest} />;
});
