import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useFilters } from '@/lib/FilterContext';
import { useTheme } from '@/theme/ThemeContext';
import { SHOP_FEATURE_ICONS, SHOP_FEATURE_LABELS, SHOP_FEATURES } from '@/types';

/** Horizontale Chip-Leiste: "Jetzt geöffnet" + Besonderheiten-Filter.
 *  Wird auf Karte und Liste gleichermaßen genutzt (gemeinsamer Zustand). */
export function FilterBar() {
  const { theme } = useTheme();
  const { activeFeatures, openNowOnly, toggleFeature, toggleOpenNow } = useFilters();

  const chip = (active: boolean) => [
    styles.chip,
    {
      backgroundColor: active ? theme.colors.primary : theme.colors.surface,
      borderColor: active ? theme.colors.primary : theme.colors.border,
    },
  ];
  const chipText = (active: boolean) => ({
    color: active ? theme.colors.onPrimary : theme.colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <Pressable onPress={toggleOpenNow} style={chip(openNowOnly)}>
        <Text style={chipText(openNowOnly)}>🕐 Jetzt geöffnet</Text>
      </Pressable>
      {SHOP_FEATURES.map((f) => {
        const active = activeFeatures.includes(f);
        return (
          <Pressable key={f} onPress={() => toggleFeature(f)} style={chip(active)}>
            <Text style={chipText(active)}>
              {SHOP_FEATURE_ICONS[f]} {SHOP_FEATURE_LABELS[f]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  content: { paddingHorizontal: 12, paddingVertical: 8 },
});
