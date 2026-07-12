import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '@/components/Button';
import { FeatureBadges } from '@/components/FeatureBadges';
import { OpeningHoursTable } from '@/components/OpeningHoursTable';
import { StarRating } from '@/components/StarRating';
import { fetchShop, fetchShopSummary } from '@/lib/api';
import { isOpenNow } from '@/lib/openingHours';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import {
  RATING_CATEGORIES,
  RATING_CATEGORY_LABELS,
  Shop,
  ShopRatingSummary,
} from '@/types';

export function ShopDetailScreen() {
  const { theme } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'ShopDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { shopId } = route.params;

  const [shop, setShop] = useState<Shop | null>(null);
  const [summary, setSummary] = useState<ShopRatingSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([fetchShop(shopId), fetchShopSummary(shopId)])
        .then(([s, sum]) => {
          setShop(s);
          setSummary(sum);
        })
        .catch((e: Error) => Alert.alert('Fehler', e.message));
    }, [shopId])
  );

  if (!shop) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  const open = isOpenNow(shop.opening_hours ?? {});

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.name, { color: theme.colors.text }]}>{shop.name}</Text>
      <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>📍 {shop.address}</Text>
      <Text
        style={{
          color: open ? theme.colors.success : theme.colors.danger,
          fontWeight: '700',
          marginTop: 6,
        }}
      >
        {open ? '● Jetzt geöffnet' : '● Geschlossen'}
      </Text>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.summaryHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Bewertung</Text>
          {summary && summary.rating_count > 0 ? (
            <Text style={{ color: theme.colors.textSecondary }}>
              {summary.avg_gesamt?.toFixed(1)} ★ · {summary.rating_count}{' '}
              {summary.rating_count === 1 ? 'Bewertung' : 'Bewertungen'}
            </Text>
          ) : null}
        </View>
        {summary && summary.rating_count > 0 ? (
          RATING_CATEGORIES.map((cat) => {
            const value = summary[`avg_${cat}`] ?? 0;
            return (
              <View key={cat} style={styles.categoryRow}>
                <Text style={{ color: theme.colors.text, width: 130 }}>
                  {RATING_CATEGORY_LABELS[cat]}
                </Text>
                <StarRating value={value} size={18} />
                <Text style={{ color: theme.colors.textSecondary, marginLeft: 8 }}>
                  {value.toFixed(1)}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={{ color: theme.colors.textSecondary }}>
            Noch keine Bewertungen – sei die/der Erste!
          </Text>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Besonderheiten</Text>
        <FeatureBadges features={shop.features ?? []} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Öffnungszeiten</Text>
        <OpeningHoursTable hours={shop.opening_hours ?? {}} />
      </View>

      <Button
        title="Jetzt bewerten"
        onPress={() => navigation.navigate('RateShop', { shopId: shop.id, shopName: shop.name })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 0,
    padding: 16,
  },
  categoryRow: { alignItems: 'center', flexDirection: 'row', paddingVertical: 4 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40, gap: 0 },
  name: { fontSize: 26, fontWeight: '800' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  summaryHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
