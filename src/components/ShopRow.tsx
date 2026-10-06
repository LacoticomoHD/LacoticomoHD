import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { useQuickActions } from '@/components/QuickActions';
import { useI18n } from '@/i18n/I18nContext';
import { formatDistance, formatPrice } from '@/lib/geo';
import { useOpenState } from '@/lib/useOpenState';
import { useTheme } from '@/theme/ThemeContext';
import { ShopWithSummary } from '@/types';

const PINS = {
  light: {
    open: require('../../assets/markers/pin-open-light.png'),
    soon: require('../../assets/markers/pin-soon-light.png'),
    closed: require('../../assets/markers/pin-closed-light.png'),
  },
  dark: {
    open: require('../../assets/markers/pin-open-dark.png'),
    soon: require('../../assets/markers/pin-soon-dark.png'),
    closed: require('../../assets/markers/pin-closed-dark.png'),
  },
};

interface Props {
  shop: ShopWithSummary;
  /** Entfernung in km – null, wenn kein Bezugspunkt bekannt ist. */
  distance: number | null;
  onPress: () => void;
}

/** Eine Ladenzeile: Pin-Kachel, Name, Status · Entfernung · Preis, Bewertung.
 *  Gemeinsam genutzt von „Alle Läden" und der Hochzieh-Liste auf der Karte. */
export function ShopRow({ shop: item, distance: dist, onPress }: Props) {
  const { theme } = useTheme();
  const { t, featureLabel } = useI18n();
  const pins = theme.dark ? PINS.dark : PINS.light;
  const { state, label, color } = useOpenState(item.opening_hours);
  const avg = item.summary?.avg_gesamt;
  const open = state === 'open' || state === 'soon';
  const features = (item.features ?? []).slice(0, 3).map((f) => featureLabel(f));
  const quickActions = useQuickActions();
  // Für Bildschirmleser alles in einem Satz statt vieler Einzelteile.
  const a11yLabel = [
    item.name,
    label,
    dist != null ? formatDistance(dist) : null,
    item.doener_preis != null ? formatPrice(item.doener_preis) : null,
    avg != null ? t('a11y.stars', { v: avg.toFixed(1).replace('.', ',') }) : t('common.noRating'),
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={() => quickActions(item)}
      delayLongPress={380}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={t('a11y.rowHint')}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          shadowColor: theme.dark ? '#000' : theme.glow,
        },
      ]}
    >
      <View
        style={[
          styles.tile,
          open
            ? {
                backgroundColor: theme.dark ? 'rgba(255,90,30,0.14)' : 'rgba(192,57,43,0.08)',
                borderColor: theme.dark ? '#45302A' : 'rgba(192,57,43,0.2)',
              }
            : { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border },
        ]}
      >
        <Image
          source={state === 'soon' ? pins.soon : open ? pins.open : pins.closed}
          style={styles.tilePin}
          resizeMode="contain"
        />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, { color: theme.colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.metaLine} numberOfLines={1}>
          <Text style={{ color, fontWeight: '700' }}>{label}</Text>
          {dist != null ? (
            <Text style={{ color: theme.colors.textSecondary }}>{`  ·  ${formatDistance(dist)}`}</Text>
          ) : null}
          {item.doener_preis != null ? (
            <Text style={{ color: theme.colors.textSecondary }}>
              {`  ·  ${formatPrice(item.doener_preis)}`}
            </Text>
          ) : null}
        </Text>
        {features.length > 0 ? (
          <Text
            style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 3 }}
            numberOfLines={1}
          >
            {features.join(' · ')}
          </Text>
        ) : null}
      </View>
      {avg != null ? (
        <View
          style={[
            styles.ratingChip,
            { backgroundColor: theme.colors.ratingChip, borderColor: theme.colors.ratingChipBorder },
          ]}
        >
          <Text style={{ color: theme.colors.star, fontSize: 12 }}>★</Text>
          <Text style={{ color: theme.colors.ratingChipText, fontSize: 14, fontWeight: '800' }}>
            {avg.toFixed(1).replace('.', ',')}
          </Text>
        </View>
      ) : (
        <View
          style={[styles.ratingChip, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border }]}
          accessibilityLabel={t('common.noRating')}
        >
          <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: '700' }}>–</Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    flexDirection: 'row',
    gap: 13,
    marginBottom: 10,
    padding: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  metaLine: { fontSize: 12.5, marginTop: 3 },
  ratingChip: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
  },
  tile: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  tilePin: { height: 30, width: 22 },
});
