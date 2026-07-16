import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from '@/theme/ThemeContext';
import { SHOP_FEATURE_ICONS, ShopFeature } from '@/types';

interface Props {
  features: ShopFeature[];
  /** Anzahl Bestätigungen pro Besonderheit (aus der Community-Abstimmung). */
  counts?: Partial<Record<ShopFeature, number>>;
}

export function FeatureBadges({ features, counts }: Props) {
  const { theme } = useTheme();
  const { t, featureLabel } = useI18n();
  if (features.length === 0) {
    return (
      <Text style={{ color: theme.colors.textSecondary, fontStyle: 'italic' }}>
        {t('detail.noFeatures')}
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
            {SHOP_FEATURE_ICONS[f]} {featureLabel(f)}
            {counts?.[f] ? (
              <Text style={{ color: theme.colors.textSecondary }}> ✓{counts[f]}</Text>
            ) : null}
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
