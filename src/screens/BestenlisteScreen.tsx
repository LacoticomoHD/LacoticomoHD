import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ShopListSkeleton } from '@/components/Skeleton';
import { StarRating } from '@/components/StarRating';
import { fetchCityStats, fetchTopShops, TOP_MIN_RATINGS, TopShopsMode } from '@/lib/api';
import { formatPrice } from '@/lib/geo';
import { INVITE_APK_URL, INVITE_WEB_URL, inviteFriends } from '@/lib/invite';
import type { RootStackParamList } from '@/navigation/types';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from '@/theme/ThemeContext';
import { CityStats, ShopWithSummary } from '@/types';
import { Text } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { LinearGradient } from 'expo-linear-gradient';

const MEDALS = ['🥇', '🥈', '🥉'];

export function BestenlisteScreen() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [cities, setCities] = useState<CityStats[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [mode, setMode] = useState<TopShopsMode>('rating');
  const [shops, setShops] = useState<ShopWithSummary[]>([]);
  const [loading, setLoading] = useState(true);
  // Solange es noch keine Läden mit genügend Bewertungen gibt, zeigen wir
  // ersatzweise die schon bewerteten – klar als vorläufig gekennzeichnet.
  const [provisional, setProvisional] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchCityStats()
        .then(setCities)
        .catch(() => {});
      fetchTopShops(selectedCity, mode)
        .then(async (strict) => {
          if (strict.length > 0) {
            setShops(strict);
            setProvisional(false);
            return;
          }
          const fallback = await fetchTopShops(selectedCity, mode, 10, 1);
          setShops(fallback);
          setProvisional(fallback.length > 0);
        })
        .catch((e: Error) => Alert.alert(t('common.loadError'), e.message))
        .finally(() => setLoading(false));
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

  /** Günstigste Städte – der PR-taugliche Teil des Dönerpreis-Index.
   *  Nur Städte mit mindestens 3 Preisangaben, damit Ausreißer nicht führen. */
  const cheapestCities = useMemo(
    () =>
      cities
        .filter((c) => c.preis_schnitt != null && c.preis_anzahl >= 3)
        .sort((a, b) => (a.preis_schnitt ?? 0) - (b.preis_schnitt ?? 0))
        .slice(0, 5),
    [cities]
  );

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
      <OfflineBanner />
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

      {provisional ? (
        <View style={[styles.provisionalNote, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 18 }}>
            {t('top.provisional', { n: TOP_MIN_RATINGS })}
          </Text>
          {/* Mehr Bewertende = schneller eine echte Rangliste. */}
          <Pressable
            onPress={() =>
              inviteFriends(t('invite.message', { web: INVITE_WEB_URL, apk: INVITE_APK_URL }))
            }
            style={styles.inviteLink}
          >
            <Icon name="user-plus" size={15} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '700' }}>
              {t('invite.button')}
            </Text>
          </Pressable>
        </View>
      ) : null}

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

          {!selectedCity && cheapestCities.length >= 2 ? (
            <View style={[styles.cheapList, { borderTopColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>
                {t('top.cheapestCities')}
              </Text>
              {cheapestCities.map((c, i) => (
                <Pressable
                  key={c.city}
                  onPress={() => setSelectedCity(c.city)}
                  style={styles.cheapRow}
                >
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13, width: 20 }}>
                    {i + 1}.
                  </Text>
                  <Text style={{ color: theme.colors.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
                    {c.city}
                  </Text>
                  <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700' }}>
                    {formatPrice(c.preis_schnitt ?? 0)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <FlatList
        data={shops}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? (
            <ShopListSkeleton count={5} />
          ) : (
            <EmptyState
              icon="award"
              text={mode === 'value' ? t('top.emptyValue') : t('top.emptyRating')}
              actions={[
                { label: t('empty.rateShops'), icon: 'map', onPress: () => navigation.navigate('Tabs', { screen: 'Karte' }) },
              ]}
            />
          )
        }
        renderItem={({ item, index }) => {
          const podium = index < 3;
          const rank = (
            <Text
              style={[
                styles.rankText,
                { color: podium ? theme.colors.onPrimary : theme.colors.textSecondary },
              ]}
            >
              {index + 1}
            </Text>
          );
          return (
            <Pressable
              onPress={() => navigation.navigate('ShopDetail', { shopId: item.id })}
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              {podium ? (
                <LinearGradient
                  colors={theme.gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.rank, { opacity: 1 - index * 0.18 }]}
                >
                  {rank}
                </LinearGradient>
              ) : (
                <View style={[styles.rank, { backgroundColor: theme.colors.surfaceVariant }]}>{rank}</View>
              )}
              <View style={styles.cardBody}>
                <Text style={[styles.cardName, { color: theme.colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
                  {[
                    item.city ?? item.address,
                    item.doener_preis != null ? formatPrice(item.doener_preis) : null,
                    `${item.summary?.rating_count ?? 0} ${
                      item.summary?.rating_count === 1 ? t('detail.rating') : t('detail.ratings')
                    }`,
                  ]
                    .filter(Boolean)
                    .join('  ·  ')}
                </Text>
                {item.summary && item.summary.verifiziert_count > 0 ? (
                  <View style={styles.verifiedRow}>
                    <Icon name="check-circle" size={12} color={theme.colors.success} />
                    <Text style={{ color: theme.colors.success, fontSize: 11.5, fontWeight: '600' }}>
                      {item.summary.verifiziert_count}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.score}>
                <Text
                  style={[
                    styles.scoreNumber,
                    { color: theme.dark ? theme.colors.ratingChipText : theme.colors.text },
                  ]}
                >
                  {item.summary?.avg_gesamt?.toFixed(1).replace('.', ',')}
                </Text>
                <StarRating value={item.summary?.avg_gesamt ?? 0} size={10} />
              </View>
            </Pressable>
          );
        }}
      />

      {shops.length > 0 ? (
        <Pressable onPress={share} style={[styles.shareFab, { shadowColor: theme.glow }]}>
          <LinearGradient
            colors={theme.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.shareFill}
          >
            <Icon name="share-2" size={17} color={theme.colors.onPrimary} />
            <Text style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>{t('top.share')}</Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    marginBottom: 10,
    padding: 13,
  },
  cardBody: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700' },
  cardStats: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 4 },
  cityBar: { gap: 8, paddingHorizontal: 16 },
  cityBarWrap: { paddingVertical: 10 },
  cityChip: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  flex: { flex: 1 },
  cheapList: { borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  cheapRow: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 4 },
  inviteLink: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, marginTop: 8, paddingVertical: 4 },
  provisionalNote: {
    borderRadius: 16,
    marginBottom: 4,
    marginHorizontal: 16,
    padding: 12,
  },
  indexCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    gap: 2,
    marginBottom: 12,
    marginHorizontal: 16,
    padding: 14,
  },
  list: { paddingBottom: 90, paddingHorizontal: 16 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 10, paddingHorizontal: 16 },
  rank: { alignItems: 'center', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  rankText: { fontSize: 18, fontWeight: '800' },
  score: { alignItems: 'flex-end', gap: 3 },
  scoreNumber: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  shareFill: {
    alignItems: 'center',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  verifiedRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 3 },
  shareFab: {
    borderRadius: 24,
    bottom: 20,
    elevation: 6,
    position: 'absolute',
    right: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
  },
});
