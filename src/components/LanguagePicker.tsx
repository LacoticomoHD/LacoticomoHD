import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/i18n/I18nContext';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, LANGUAGES } from '@/i18n/translations';
import { useTheme } from '@/theme/ThemeContext';

/** Sprachauswahl als Chip-Reihe. `compact` = nur Flaggen (für den Auth-Screen). */
export function LanguagePicker({ compact }: { compact?: boolean }) {
  const { theme } = useTheme();
  const { lang, setLang } = useI18n();

  return (
    <View style={styles.row}>
      {LANGUAGES.map((code) => {
        const active = lang === code;
        return (
          <Pressable
            key={code}
            onPress={() => setLang(code)}
            style={[
              styles.chip,
              compact ? styles.chipCompact : null,
              {
                backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                borderColor: active ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: active ? theme.colors.onPrimary : theme.colors.text,
                fontSize: compact ? 18 : 14,
                fontWeight: '600',
              }}
            >
              {LANGUAGE_FLAGS[code]}
              {compact ? '' : `  ${LANGUAGE_LABELS[code]}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipCompact: { paddingHorizontal: 12, paddingVertical: 6 },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
});
