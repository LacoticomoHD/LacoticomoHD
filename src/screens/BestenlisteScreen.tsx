import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { StarRating } from '@/components/StarRating';
import { fetchCityStats, fetchTopShops, TopShopsMode } from '@/lib/api';
import { formatPrice } from '@/lib/geo';
import type { RootStackParamList } from '@/navigation/types';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from '@/theme/ThemeContext';
import { CityStats, ShopWithSummary } from '@/types';

const MEDALS = ['🥇', '🥈', '🥉'];

export function BestenlisteScreen() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [cities, setCities] = useState<CityStats[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [mode, setMode] = useState<TopShopsMode>('rating');
  const [shops, setShops] = useState<ShopWithSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchCityStats()
        .then(setCities)
        .catch(() => {});
      fetchTopShops(selectedCity, mode)
        .then(setShops)
        .catch((e: Error) => Alert.alert(t('common.loadError'), e.message));
    }, [selectedCity, mode])
  );

  // Dönerpreis-Index: gewählte Stadt oder Deutschland gesamt (gewichteter Schnitt).
  const preisIndex = useMemo(() => {
    if (selectedCity) {
      const stats = cities.find((c) => c.city === selectedCity);
      return stats?.preis_schnitt != null
        ? { label: selectedCity, schnitt: stats.preis_schnitt, anzahl: stats.preis_anzahl }
        : null;
    }
    const withPrice = cities.filter((c) => c.preis_schnitt != null);
    const total = withPrice.reduce((acc, c) => acc + c.preis_anzahl, 0);
    if (total === 0) return null;
    const weighted =
      withPrice.reduce((acc, c) => acc + (c.preis_schnitt ?? 0) * c.preis_anzahl, 0) / total;
    return { label: t('top.germany').replace('🇩🇪 ', ''), schnitt: Math.round(weighted * 100) / 100, anzahl: total };
  }, [cities, selectedCity]);

  const share = async () => {
    if (shops.length === 0) return;
    const scope = selectedCity ?? t('top.germany').replace('🇩🇪 ', '');
    const title =
      mode === 'value'
        ? t('top.shareValue', { city: scope })
        : t('top.shareRating', { city: scope });
    const lines = shops
      .slice(0, 10)
      .map(
        (s, i) =>
          `${MEDALS[i] ?? `${i + 1}.`} ${s.name} – ${s.summary?.avg_gesamt?.toFixed(1)} ★${
            s.doener_preis != null ? ` (${formatPrice(s.doener_preis)})` : ''
          }`
      );
    // Auf Web/Desktop gibt es nicht überall einen Teilen-Dialog – Fehler still schlucken.
    await Share.share({
      message: `${title} ${t('top.shareFooter')}\n\n${lines.join('\n')}`,
    }).catch(() => {});
  };

  const cityChip = (active: boolean) => [
    styles.cityChip,
    {
      backgroundColor: active ? theme.colors.primary : theme.colors.surface,
      borderColor: active ? theme.colors.primary : theme.colors.border,
    },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.cityBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityBar}>
          <Pressable onPress={() => setSelectedCity(null)} style={cityChip(selectedCity === null)}>
            <Text
              style={{
                color: selectedCity === null ? theme.colors.onPrimary : theme.colors.text,
                fontWeight: '600',
                fontSize: 13,
              }}
            >
              {t('top.germany')}
            </Text>
          </Pressable>
          {cities.map((c) => {
            const active = selectedCity === c.city;
            return (
              <Pressable key={c.city} onPress={() => setSelectedCity(c.city)} style={cityChip(active)}>
                <Text
                  style={{
                    color: active ? theme.colors.onPrimary : theme.colors.text,
                    fontWeight: '600',
                    fontSize: 13,
                  }}
                >
                  {c.city}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Ranking-Modus: beste Bewertung vs. Preis-Leistung */}
      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setMode('rating')}
          style={cityChip(mode === 'rating')}
        >
          <Text
            style={{
              color: mode === 'rating' ? theme.colors.onPrimary : theme.colors.text,
              fontWeight: '600',
              fontSize: 13,
            }}
          >
            {t('top.modeRating')}
          </Text>
        </Pressable>
        <Pressable onPress={() => setMode('value')} style={cityChip(mode === 'value')}>
          <Text
            style={{
              color: mode === 'value' ? theme.colors.onPrimary : theme.colors.text,
              fontWeight: '600',
              fontSize: 13,
            }}
          >
            {t('top.modeValue')}
          </Text>
        </Pressable>
      </View>

      {preisIndex ? (
        <View
          style={[
            styles.indexCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
            {t('top.priceIndex', { city: preisIndex.label })}
          </Text>
          <Text style={{ color: theme.colors.accent, fontSize: 22, fontWeight: '800' }}>
            {formatPrice(preisIndex.schnitt)}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
            {t('top.priceIndexAvg', { n: preisIndex.anzahl, label: preisIndex.anzahl === 1 ? t('top.priceReport') : t('top.priceReports') })}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={shops}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
            {mode === 'value'
              ? t('top.emptyValue')
              : t('top.emptyRating')}
          </Text>
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => navigation.navigate('ShopDetail', { shopId: item.id })}
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={styles.rank}>{MEDALS[index] ?? `${index + 1}.`}</Text>
            <View style={styles.cardBody}>
              <Text style={[styles.cardName, { color: theme.colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                {item.city ?? item.address}
              </Text>
              <View style={styles.cardStats}>
                <StarRating value={item.summary?.avg_gesamt ?? 0} size={14} />
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                  {item.summary?.avg_gesamt?.toFixed(1)} ({item.summary?.rating_count})
                </Text>
                {item.summary && item.summary.verifiziert_count > 0 ? (
                  <Text style={{ color: theme.colors.success, fontSize: 12 }}>
                    📍{item.summary.verifiziert_count}
                  </Text>
                ) : null}
                {item.doener_preis != null ? (
                  <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700' }}>
                    🥙 {formatPrice(item.doener_preis)}
                  </Text>
                ) : null}
              </View>
              {mode === 'value' && item.value_score != null && item.doener_preis != null ? (
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                  {item.summary?.avg_gesamt?.toFixed(1)} ★ für {formatPrice(item.doener_preis)}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />

      {shops.length > 0 ? (
        <Pressable onPress={share} style={[styles.shareFab, { backgroundColor: theme.colors.primary }]}>
          <Text style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>{t('top.share')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 14,
  },
  cardBody: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700' },
  cardStats: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 4 },
  cityBar: { gap: 8, paddingHorizontal: 16 },
  cityBarWrap: { paddingVertical: 10 },
  cityChip: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  empty: { marginTop: 48, paddingHorizontal: 24, textAlign: 'center' },
  flex: { flex: 1 },
  indexCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
    marginBottom: 12,
    marginHorizontal: 16,
    padding: 14,
  },
  list: { paddingBottom: 90, paddingHorizontal: 16 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 10, paddingHorizontal: 16 },
  rank: { fontSize: 24, width: 36, textAlign: 'center' },
  shareFab: {
    alignItems: 'center',
    borderRadius: 24,
    bottom: 20,
    elevation: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
    position: 'absolute',
    right: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
