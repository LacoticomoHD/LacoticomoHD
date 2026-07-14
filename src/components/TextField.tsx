import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

interface Props extends TextInputProps {
  label?: string;
  /** Passwortfeld mit Auge-Knopf zum Ein-/Ausblenden. */
  isPassword?: boolean;
}

export function TextField({ label, style, isPassword, ...rest }: Props) {
  const { theme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text> : null}
      <View>
        <TextInput
          placeholderTextColor={theme.colors.textSecondary}
          secureTextEntry={isPassword ? !showPassword : rest.secureTextEntry}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
            isPassword ? styles.inputWithEye : null,
            style,
          ]}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={10}
            style={styles.eye}
            accessibilityLabel={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
          >
            <Text style={{ fontSize: 18 }}>{showPassword ? '🙈' : '👁️'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  eye: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputWithEye: { paddingRight: 44 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
});
