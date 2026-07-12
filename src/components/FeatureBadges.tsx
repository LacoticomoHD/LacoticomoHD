import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { SHOP_FEATURE_ICONS, SHOP_FEATURE_LABELS, ShopFeature } from '@/types';

export function FeatureBadges({ features }: { features: ShopFeature[] }) {
  const { theme } = useTheme();
  if (features.length === 0) {
    return (
      <Text style={{ color: theme.colors.textSecondary, fontStyle: 'italic' }}>
        Keine Besonderheiten hinterlegt
      </Text>
    );
  }
  return (
    <View style={styles.wrap}>
      {features.map((f) => (
        <View
          key={f}
          style={[
            styles.badge,
            { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontSize: 13 }}>
            {SHOP_FEATURE_ICONS[f]} {SHOP_FEATURE_LABELS[f]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
