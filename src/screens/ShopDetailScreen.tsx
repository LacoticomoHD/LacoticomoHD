import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '@/components/Button';
import { FeatureBadges } from '@/components/FeatureBadges';
import { OpeningHoursTable } from '@/components/OpeningHoursTable';
import {
  addFavorite,
  fetchFavoriteIds,
  fetchFeatureSummary,
  fetchHoursVoteSummary,
  fetchMyHoursVote,
  fetchPriceHistory,
  fetchShop,
  fetchShopSummary,
  removeFavorite,
  setHoursVote,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { openDirections, TRAVEL_MODES } from '@/lib/directions';
import { formatLoadError } from '@/lib/errors';
import { useI18n } from '@/i18n/I18nContext';
import { formatPrice } from '@/lib/geo';
import { isOpenNow } from '@/lib/openingHours';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import {
  HoursVoteSummary,
  PriceHistoryEntry,
  RATING_CATEGORIES,
  Shop,
  ShopFeature,
  ShopFeatureSummary,
  ShopRatingSummary,
} from '@/types';

// „Glut"-Verlauf: Paprika → Orange, die Marken-Signatur der App.
const GLUT: [string, string, string] = ['#C0392B', '#D35400', '#E67E22'];

/** Balkenfarbe je nach Wert: stark = grün, solide = gold, schwach = rot. */
function barColor(value: number): string {
  if (value >= 4.25) return '#2E7D32';
  if (value >= 3.25) return '#E67E22';
  return '#C62828';
}

export function ShopDetailScreen() {
  const { theme } = useTheme();
  const { t, categoryLabel, lang } = useI18n();
  const dateLocale = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-GB' : 'de-DE';
  const { user } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, 'ShopDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { shopId } = route.params;

  const [shop, setShop] = useState<Shop | null>(null);
  const [summary, setSummary] = useState<ShopRatingSummary | null>(null);
  const [featureSummary, setFeatureSummary] = useState<ShopFeatureSummary[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [hoursVotes, setHoursVotes] = useState<HoursVoteSummary | null>(null);
  const [myHoursVote, setMyHoursVote] = useState<1 | -1 | 0>(0);
  const [showRouteModes, setShowRouteModes] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        fetchShop(shopId),
        fetchShopSummary(shopId),
        fetchFeatureSummary(shopId),
        fetchPriceHistory(shopId),
        fetchHoursVoteSummary(shopId),
      ])
        .then(([s, sum, feats, prices, hv]) => {
          setShop(s);
          setSummary(sum);
          setFeatureSummary(feats);
          setPriceHistory(prices);
          setHoursVotes(hv);
        })
        .catch((e: Error) => {
          const msg = formatLoadError(e);
          if (msg) Alert.alert(t('common.error'), msg);
        });
      if (user) {
        fetchFavoriteIds(user.id)
          .then((ids) => setIsFavorite(ids.has(shopId)))
          .catch(() => {});
        fetchMyHoursVote(shopId, user.id).then(setMyHoursVote);
      }
    }, [shopId, user])
  );

  const toggleFavorite = async () => {
    if (!user || favoriteBusy) return;
    setFavoriteBusy(true);
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      if (next) await addFavorite(user.id, shopId);
      else await removeFavorite(user.id, shopId);
    } catch (e) {
      setIsFavorite(!next);
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
    } finally {
      setFavoriteBusy(false);
    }
  };

  const voteHours = async (vote: 1 | -1) => {
    if (!user) return;
    const next = myHoursVote === vote ? 0 : vote;
    const previous = myHoursVote;
    setMyHoursVote(next);
    try {
      await setHoursVote(shopId, user.id, next);
      setHoursVotes(await fetchHoursVoteSummary(shopId));
    } catch (e) {
      setMyHoursVote(previous);
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
    }
  };

  if (!shop) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  const open = isOpenNow(shop.opening_hours ?? {});
  const avg = summary?.avg_gesamt;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* Hero-Kopf im Glut-Verlauf */}
      <LinearGradient colors={GLUT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        {shop.city ? <Text style={styles.heroCity}>{shop.city.toUpperCase()}</Text> : null}
        <Text style={styles.heroName}>{shop.name}</Text>
        <Text style={styles.heroAddress}>📍 {shop.address}</Text>

        <View style={styles.heroRow}>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreNumber}>{avg != null ? avg.toFixed(1) : '–'}</Text>
            <Text style={styles.scoreOutOf}>/ 5</Text>
          </View>
          {shop.doener_preis != null ? (
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>🥙 {formatPrice(shop.doener_preis)}</Text>
            </View>
          ) : null}
          {shop.dueruem_preis != null ? (
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>🌯 {formatPrice(shop.dueruem_preis)}</Text>
            </View>
          ) : null}
          <View style={styles.heroPill}>
            <Text style={[styles.heroPillText, { color: open ? '#B9F6CA' : '#FFCDD2' }]}>
              ● {open ? t('common.open') : t('common.closed')}
            </Text>
          </View>
        </View>

        {summary && summary.verifiziert_count > 0 ? (
          <Text style={styles.heroVerify}>
            {t('detail.verifiedShare', {
              v: summary.verifiziert_count,
              n: summary.rating_count,
              label: summary.rating_count === 1 ? t('detail.rating') : t('detail.ratings'),
            })}
          </Text>
        ) : null}
      </LinearGradient>

      {/* Aktions-Leiste */}
      <View style={styles.actionRow}>
        <Pressable
          onPress={() =>
            navigation.navigate('RateShop', {
              shopId: shop.id,
              shopName: shop.name,
              latitude: shop.latitude,
              longitude: shop.longitude,
            })
          }
          style={[
            styles.action,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={styles.actionIcon}>⭐</Text>
          <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{t('detail.act.rate')}</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowRouteModes((v) => !v)}
          style={[
            styles.action,
            {
              backgroundColor: showRouteModes ? theme.colors.surfaceVariant : theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={styles.actionIcon}>🧭</Text>
          <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{t('detail.act.route')}</Text>
        </Pressable>
        <Pressable
          onPress={toggleFavorite}
          style={[
            styles.action,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={styles.actionIcon}>{isFavorite ? '❤️' : '🤍'}</Text>
          <Text style={[styles.actionLabel, { color: theme.colors.text }]}>
            {isFavorite ? t('detail.act.saved') : t('detail.act.save')}
          </Text>
        </Pressable>
      </View>

      {/* Ausklappbare Verkehrsmittel-Wahl */}
      {showRouteModes ? (
        <View style={styles.travelRow}>
          {TRAVEL_MODES.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => openDirections(shop.latitude, shop.longitude, m.key)}
              style={[
                styles.travelButton,
                { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border },
              ]}
            >
              <Text style={{ fontSize: 20 }}>{m.icon}</Text>
              <Text style={{ color: theme.colors.text, fontSize: 11, fontWeight: '600' }}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Preisverlauf */}
      {priceHistory.length >= 2 ? (
        <Text style={[styles.priceHistory, { color: theme.colors.textSecondary }]}>
          {t('detail.priceHistory', {
            list: priceHistory.map((p) => formatPrice(p.preis)).join(' → '),
            date: new Date(priceHistory[0].recorded_at).toLocaleDateString(dateLocale, {
              month: '2-digit',
              year: 'numeric',
            }),
          })}
        </Text>
      ) : null}

      {shop.preis_bestaetigt_am ? (
        <Text style={[styles.priceHistory, { color: theme.colors.success }]}>
          {t('detail.priceConfirmedOn', {
            date: new Date(shop.preis_bestaetigt_am).toLocaleDateString(dateLocale, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            }),
          })}
        </Text>
      ) : null}

      {/* Bewertung im Detail: Balken statt Sterne-Reihen */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.summaryHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {t('detail.ratingDetail')}
          </Text>
          {summary && summary.rating_count > 0 ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
              {summary.rating_count}{' '}
              {summary.rating_count === 1 ? t('detail.rating') : t('detail.ratings')}
            </Text>
          ) : null}
        </View>
        {summary && summary.rating_count > 0 ? (
          RATING_CATEGORIES.map((cat) => {
            const value = summary[`avg_${cat}`] ?? 0;
            return (
              <View key={cat} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: theme.colors.text }]}>
                  {categoryLabel(cat)}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${(value / 5) * 100}%`, backgroundColor: barColor(value) },
                    ]}
                  />
                </View>
                <Text style={[styles.barValue, { color: theme.colors.text }]}>
                  {value.toFixed(1)}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={{ color: theme.colors.textSecondary }}>
            {t('detail.noRatingsBeFirst')}
          </Text>
        )}
      </View>

      {/* Besonderheiten */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('detail.features')}</Text>
        <FeatureBadges
          features={featureSummary.filter((f) => f.score > 0).map((f) => f.feature)}
          counts={Object.fromEntries(
            featureSummary.filter((f) => f.score > 0).map((f) => [f.feature, f.bestaetigt])
          ) as Partial<Record<ShopFeature, number>>}
        />
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 10 }}>
          {t('detail.featuresHint')}
        </Text>
      </View>

      {/* Öffnungszeiten */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('detail.hours')}</Text>
        {hoursVotes && hoursVotes.score <= -2 ? (
          <Text style={{ color: theme.colors.danger, fontSize: 13, marginBottom: 8 }}>
            {t('detail.hoursOutdated')}
          </Text>
        ) : null}
        <OpeningHoursTable hours={shop.opening_hours ?? {}} />
        <View style={[styles.hoursVoteRow, { borderTopColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.textSecondary, flex: 1, fontSize: 13 }}>
            {t('detail.hoursConfirm')}
          </Text>
          <Pressable
            onPress={() => voteHours(1)}
            style={[
              styles.hoursVoteButton,
              {
                backgroundColor:
                  myHoursVote === 1 ? theme.colors.success : theme.colors.surfaceVariant,
              },
            ]}
          >
            <Text style={{ color: myHoursVote === 1 ? theme.colors.onPrimary : theme.colors.text, fontSize: 13 }}>
              👍 {hoursVotes?.bestaetigt ?? 0}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => voteHours(-1)}
            style={[
              styles.hoursVoteButton,
              {
                backgroundColor:
                  myHoursVote === -1 ? theme.colors.danger : theme.colors.surfaceVariant,
              },
            ]}
          >
            <Text style={{ color: myHoursVote === -1 ? theme.colors.onPrimary : theme.colors.text, fontSize: 13 }}>
              👎 {hoursVotes?.veraltet ?? 0}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.ctaWrap}>
        <Button
          title={t('detail.rateNow')}
          onPress={() =>
            navigation.navigate('RateShop', {
              shopId: shop.id,
              shopName: shop.name,
              latitude: shop.latitude,
              longitude: shop.longitude,
            })
          }
        />
      </View>

      <Pressable
        onPress={() => navigation.navigate('EditShop', { shopId: shop.id })}
        style={styles.reportLink}
      >
        <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '600' }}>
          {t('detail.edit')}
        </Text>
      </Pressable>
      <Pressable
        onPress={() =>
          navigation.navigate('ReportShop', { shopId: shop.id, shopName: shop.name })
        }
        style={styles.reportLink}
      >
        <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
          {t('detail.report')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  actionIcon: { fontSize: 18, marginBottom: 2 },
  actionLabel: { fontSize: 12, fontWeight: '700' },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  barFill: { borderRadius: 4, height: '100%' },
  barLabel: { fontSize: 13, width: 104 },
  barRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingVertical: 5 },
  barTrack: { borderRadius: 4, flex: 1, height: 8, overflow: 'hidden' },
  barValue: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    textAlign: 'right',
    width: 28,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
  },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { paddingBottom: 40 },
  ctaWrap: { marginHorizontal: 16, marginTop: 16 },
  hero: {
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  heroAddress: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginBottom: 14 },
  heroCity: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  heroName: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  heroPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  heroRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroVerify: { color: 'rgba(255,255,255,0.92)', fontSize: 11.5, marginTop: 10 },
  hoursVoteButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hoursVoteRow: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
  },
  priceHistory: { fontSize: 12, marginHorizontal: 16, marginTop: 10 },
  reportLink: { alignSelf: 'center', marginTop: 14, padding: 4 },
  scoreBadge: {
    alignItems: 'baseline',
    backgroundColor: '#fff',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  scoreNumber: { color: '#C0392B', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  scoreOutOf: { color: '#8B7E6C', fontSize: 10, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  summaryHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  travelButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingVertical: 8,
  },
  travelRow: { flexDirection: 'row', gap: 8, marginTop: 8, paddingHorizontal: 16 },
});
