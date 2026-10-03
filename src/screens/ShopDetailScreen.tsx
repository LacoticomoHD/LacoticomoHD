import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '@/components/Button';
import { FeatureBadges } from '@/components/FeatureBadges';
import { OpeningHoursTable } from '@/components/OpeningHoursTable';
import { Icon, type IconName } from '@/components/Icon';
import { StarRating } from '@/components/StarRating';
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
import { tapLight, tapMedium, tapSelection } from '@/lib/haptics';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useI18n } from '@/i18n/I18nContext';
import { formatPrice } from '@/lib/geo';
import { openStatus } from '@/lib/openingHours';
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
import { Text } from '@/components/AppText';

/** Bewertungsbalken, der beim Öffnen sanft von 0 auf seinen Wert wächst. */
function RatingBar({
  value,
  label,
  trackColor,
  labelColor,
  valueColor,
  fill,
  delay,
}: {
  value: number;
  label: string;
  trackColor: string;
  textColor: string;
  labelColor: string;
  valueColor: string;
  fill: [string, string];
  delay: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      delay,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [value, delay, progress]);
  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${(value / 5) * 100}%`],
  });
  return (
    <View style={styles.barRow}>
      <View style={styles.barHead}>
        <Text style={{ color: labelColor, fontSize: 13.5 }}>{label}</Text>
        <Text style={{ color: valueColor, fontSize: 13.5, fontWeight: '700' }}>
          {value.toFixed(1).replace('.', ',')}
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.barFill, { width }]}>
          <LinearGradient
            colors={fill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

export function ShopDetailScreen() {
  const { theme } = useTheme();
  const { t, categoryLabel, lang } = useI18n();
  const dateLocale = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-GB' : 'de-DE';
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
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
  const heartScale = useRef(new Animated.Value(1)).current;

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
    if (!requireAuth()) return;
    if (!user || favoriteBusy) return;
    setFavoriteBusy(true);
    const next = !isFavorite;
    setIsFavorite(next);
    tapSelection();
    // Herz kurz aufpoppen lassen.
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.45, useNativeDriver: true, speed: 50, bounciness: 14 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }),
    ]).start();
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
    if (!requireAuth()) return;
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

  /** Laden weiterempfehlen – der Link öffnet den Laden direkt in der Web-App. */
  const shareShop = async () => {
    if (!shop) return;
    tapLight();
    const url = `https://lacoticomohd.github.io/LacoticomoHD/laden/${shop.id}`;
    const note =
      summary?.avg_gesamt != null
        ? t('detail.shareWithRating', { name: shop.name, v: summary.avg_gesamt.toFixed(1) })
        : t('detail.sharePlain', { name: shop.name });
    try {
      await Share.share({ message: `${note}\n${url}`, url });
    } catch {
      // Abbruch durch den Nutzer ist kein Fehler.
    }
  };

  if (!shop) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  const hoursStatus = openStatus(shop.opening_hours ?? {});
  const avg = summary?.avg_gesamt;
  const c = theme.colors;
  const card = [styles.card, { backgroundColor: c.surface, borderColor: c.border }];
  const goRate = () => {
    if (!requireAuth()) return;
    navigation.navigate('RateShop', {
      shopId: shop.id,
      shopName: shop.name,
      latitude: shop.latitude,
      longitude: shop.longitude,
    });
  };

  const prices: { label: string; value: number; highlight?: boolean }[] = [];
  if (shop.doener_preis != null) prices.push({ label: 'Döner', value: shop.doener_preis });
  if (shop.doener_gross_preis != null)
    prices.push({ label: `Döner ${t('detail.large')}`, value: shop.doener_gross_preis });
  if (shop.dueruem_preis != null) prices.push({ label: 'Dürüm', value: shop.dueruem_preis });
  if (shop.menue_preis != null)
    prices.push({ label: t('detail.menu'), value: shop.menue_preis, highlight: true });

  const actions: { key: string; icon: IconName; label: string; onPress: () => void; active?: boolean }[] = [
    {
      key: 'rate',
      icon: 'star',
      label: t('detail.act.rate'),
      onPress: () => {
        tapMedium();
        goRate();
      },
    },
    {
      key: 'route',
      icon: 'navigation',
      label: t('detail.act.route'),
      active: showRouteModes,
      onPress: () => {
        tapLight();
        setShowRouteModes((v) => !v);
      },
    },
    {
      key: 'fav',
      icon: 'heart',
      label: isFavorite ? t('detail.act.saved') : t('detail.act.save'),
      active: isFavorite,
      onPress: toggleFavorite,
    },
    { key: 'share', icon: 'share-2', label: t('detail.act.share'), onPress: shareShop },
  ];

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      {/* Hero-Kopf im Glut-Verlauf */}
      <LinearGradient
        colors={theme.gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* Warmer Lichtschein oben rechts */}
        <LinearGradient
          colors={['rgba(255,226,170,0.38)', 'rgba(255,226,170,0)']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.35, y: 0.75 }}
          style={StyleSheet.absoluteFill}
        />
        {theme.dark ? (
          <LinearGradient
            colors={['rgba(14,10,9,0)', 'rgba(14,10,9,0.7)']}
            start={{ x: 0, y: 0.45 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {shop.city ? <Text style={styles.heroCity}>{shop.city.toUpperCase()}</Text> : null}
        <Text style={styles.heroName}>{shop.name}</Text>
        <View style={styles.heroAddressRow}>
          <Icon name="map-pin" size={13} color="rgba(255,244,232,0.85)" />
          <Text style={styles.heroAddress}>{shop.address}</Text>
        </View>
        <View style={styles.heroRow}>
          <View
            style={[
              styles.statusPill,
              hoursStatus === 'open'
                ? styles.statusOpen
                : hoursStatus === 'closed'
                  ? styles.statusClosed
                  : null,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    hoursStatus === 'open'
                      ? '#5FD98A'
                      : hoursStatus === 'closed'
                        ? '#FF8A80'
                        : 'rgba(255,255,255,0.7)',
                },
              ]}
            />
            <Text style={styles.statusText}>
              {hoursStatus === 'open'
                ? t('common.openNow')
                : hoursStatus === 'closed'
                  ? t('common.closed')
                  : t('common.hoursUnknown')}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Bewertungs-Medaillon, ragt in den Kopf hinein */}
      <View
        style={[
          styles.medallion,
          { backgroundColor: c.surface, borderColor: c.border, shadowColor: theme.dark ? '#000' : theme.glow },
        ]}
      >
        <View style={styles.medallionScore}>
          <Text style={[styles.medallionNumber, { color: theme.dark ? c.ratingChipText : c.text }]}>
            {avg != null ? avg.toFixed(1).replace('.', ',') : '–'}
          </Text>
          <StarRating value={avg ?? 0} size={14} />
        </View>
        <View style={[styles.medallionDivider, { backgroundColor: c.border }]} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>
            {summary && summary.rating_count > 0
              ? `${summary.rating_count} ${summary.rating_count === 1 ? t('detail.rating') : t('detail.ratings')}`
              : t('detail.noRatingsBeFirst')}
          </Text>
          {summary && summary.verifiziert_count > 0 ? (
            <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 3 }}>
              {t('detail.verifiedShare', {
                v: summary.verifiziert_count,
                n: summary.rating_count,
                label: summary.rating_count === 1 ? t('detail.rating') : t('detail.ratings'),
              })}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Aktions-Leiste */}
      <View style={styles.actionRow}>
        {actions.map((a) => (
          <Pressable
            key={a.key}
            onPress={a.onPress}
            accessibilityLabel={a.label}
            style={[
              styles.action,
              {
                backgroundColor: a.active ? c.surfaceVariant : c.surface,
                borderColor: a.active ? c.primary : c.border,
              },
            ]}
          >
            {a.key === 'fav' ? (
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Icon name="heart" size={20} color={isFavorite ? c.primary : c.text} />
              </Animated.View>
            ) : (
              <Icon name={a.icon} size={20} color={a.key === 'rate' ? c.primary : c.text} />
            )}
            <Text style={[styles.actionLabel, { color: c.text }]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Ausklappbare Verkehrsmittel-Wahl */}
      {showRouteModes ? (
        <View style={styles.travelRow}>
          {TRAVEL_MODES.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => openDirections(shop.latitude, shop.longitude, m.key)}
              style={[styles.travelButton, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <Icon name={TRAVEL_ICONS[m.key]} size={19} color={c.primary} />
              <Text style={{ color: c.text, fontSize: 11.5, fontWeight: '600' }}>{m.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Preise */}
      {prices.length > 0 ? (
        <>
          <Text style={[styles.overline, { color: c.textSecondary }]}>{t('detail.prices')}</Text>
          <View style={styles.priceGrid}>
            {prices.map((p) => (
              <View
                key={p.label}
                style={[
                  styles.priceTile,
                  p.highlight
                    ? { backgroundColor: theme.dark ? 'rgba(255,90,30,0.14)' : '#FDF0E4', borderColor: theme.dark ? '#553A30' : '#F0D2B4' }
                    : { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <Text
                  style={{
                    color: p.highlight ? (theme.dark ? c.accent : '#9D5415') : c.textSecondary,
                    fontSize: 12,
                    fontWeight: p.highlight ? '700' : '500',
                  }}
                  numberOfLines={1}
                >
                  {p.label}
                </Text>
                <Text style={[styles.priceValue, { color: c.text }]}>{formatPrice(p.value)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {priceHistory.length >= 2 ? (
        <Text style={[styles.priceHistory, { color: c.textSecondary }]}>
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
        <Text style={[styles.priceHistory, { color: c.success }]}>
          {t('detail.priceConfirmedOn', {
            date: new Date(shop.preis_bestaetigt_am).toLocaleDateString(dateLocale, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            }),
          })}
        </Text>
      ) : null}

      {/* Bezahlung – direkt sichtbar, eigenes Feld */}
      <View style={[card, styles.paymentRow]}>
        <View
          style={[
            styles.paymentIcon,
            {
              backgroundColor:
                shop.kartenzahlung === true
                  ? theme.dark
                    ? 'rgba(95,217,138,0.14)'
                    : '#E4F3E8'
                  : c.surfaceVariant,
            },
          ]}
        >
          <Icon
            name="credit-card"
            size={20}
            color={
              shop.kartenzahlung === true
                ? c.success
                : shop.kartenzahlung === false
                  ? c.accent
                  : c.textSecondary
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: '700' }}>
            {shop.kartenzahlung === true
              ? t('detail.cardYes')
              : shop.kartenzahlung === false
                ? t('detail.cardNo')
                : `${t('detail.payment')}: ${t('detail.cardUnknownShort')}`}
          </Text>
          {shop.kartenzahlung == null ? (
            <Pressable onPress={goRate}>
              <Text style={{ color: c.primary, fontSize: 12.5, fontWeight: '600', marginTop: 3 }}>
                {t('detail.cardUnknownHint')}
              </Text>
            </Pressable>
          ) : (
            <Text style={{ color: c.textSecondary, fontSize: 12.5, marginTop: 2 }}>
              {t('detail.payment')}
            </Text>
          )}
        </View>
        {shop.kartenzahlung === true ? <Icon name="check" size={20} color={c.success} /> : null}
      </View>

      {/* Bewertung im Detail */}
      <View style={card}>
        <Text style={[styles.overlineInCard, { color: c.textSecondary }]}>
          {t('detail.ratingDetail')}
        </Text>
        {summary && summary.rating_count > 0 ? (
          RATING_CATEGORIES.map((cat, i) => {
            const avgCat = summary[`avg_${cat}`];
            // Optionale Fleischqualität: ohne Angabe keinen (irreführenden) 0-Balken zeigen.
            if (avgCat == null) return null;
            return (
              <RatingBar
                key={cat}
                value={avgCat}
                label={categoryLabel(cat)}
                trackColor={c.surfaceVariant}
                textColor={c.text}
                labelColor={theme.dark ? '#D8CBC1' : '#44392F'}
                valueColor={theme.dark ? c.ratingChipText : c.text}
                fill={theme.gradients.primary}
                delay={i * 90}
              />
            );
          })
        ) : (
          <Text style={{ color: c.textSecondary }}>{t('detail.noRatingsBeFirst')}</Text>
        )}
      </View>

      {/* Besonderheiten */}
      <View style={card}>
        <Text style={[styles.overlineInCard, { color: c.textSecondary }]}>{t('detail.features')}</Text>
        <FeatureBadges
          features={featureSummary.filter((f) => f.score > 0).map((f) => f.feature)}
          counts={Object.fromEntries(
            featureSummary.filter((f) => f.score > 0).map((f) => [f.feature, f.bestaetigt])
          ) as Partial<Record<ShopFeature, number>>}
        />
        <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 10 }}>
          {t('detail.featuresHint')}
        </Text>
      </View>

      {/* Öffnungszeiten */}
      <View style={card}>
        <Text style={[styles.overlineInCard, { color: c.textSecondary }]}>{t('detail.hours')}</Text>
        {hoursStatus === 'unknown' ? (
          <Pressable
            onPress={() => {
              if (!requireAuth()) return;
              navigation.navigate('EditShop', { shopId: shop.id });
            }}
            style={styles.inlineRow}
          >
            <Icon name="clock" size={16} color={c.primary} />
            <Text style={{ color: c.primary, flex: 1, fontSize: 14, lineHeight: 20 }}>
              {t('detail.hoursUnknownHint')}
            </Text>
          </Pressable>
        ) : (
          <>
            {hoursVotes && hoursVotes.score <= -2 ? (
              <Text style={{ color: c.danger, fontSize: 13, marginBottom: 8 }}>
                {t('detail.hoursOutdated')}
              </Text>
            ) : null}
            <OpeningHoursTable hours={shop.opening_hours ?? {}} />
            <View style={[styles.hoursVoteRow, { borderTopColor: c.border }]}>
              <Text style={{ color: c.textSecondary, flex: 1, fontSize: 13 }}>
                {t('detail.hoursConfirm')}
              </Text>
              {([1, -1] as const).map((v) => {
                const active = myHoursVote === v;
                const color = active ? c.onPrimary : c.text;
                return (
                  <Pressable
                    key={v}
                    onPress={() => voteHours(v)}
                    style={[
                      styles.hoursVoteButton,
                      {
                        backgroundColor: active
                          ? v === 1
                            ? c.success
                            : c.danger
                          : c.surfaceVariant,
                      },
                    ]}
                  >
                    <Icon name={v === 1 ? 'thumbs-up' : 'thumbs-down'} size={14} color={color} />
                    <Text style={{ color, fontSize: 13, fontWeight: '600' }}>
                      {v === 1 ? (hoursVotes?.bestaetigt ?? 0) : (hoursVotes?.veraltet ?? 0)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      <View style={styles.ctaWrap}>
        <Button title={t('detail.rateNow')} onPress={goRate} />
      </View>

      <Pressable
        onPress={() => {
          if (!requireAuth()) return;
          navigation.navigate('EditShop', { shopId: shop.id });
        }}
        style={[styles.reportLink, styles.inlineRow]}
      >
        <Icon name="edit-2" size={14} color={c.primary} />
        <Text style={{ color: c.primary, fontSize: 13, fontWeight: '600' }}>{t('detail.edit')}</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          if (!requireAuth()) return;
          navigation.navigate('ReportShop', { shopId: shop.id, shopName: shop.name });
        }}
        style={[styles.reportLink, styles.inlineRow]}
      >
        <Icon name="flag" size={14} color={c.textSecondary} />
        <Text style={{ color: c.textSecondary, fontSize: 13 }}>{t('detail.report')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const TRAVEL_ICONS: Record<string, IconName> = {
  driving: 'truck',
  walking: 'user',
  bicycling: 'activity',
  transit: 'map',
};

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    paddingVertical: 12,
  },
  actionLabel: { fontSize: 11.5, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14, paddingHorizontal: 16 },
  barFill: { borderRadius: 4, height: '100%', overflow: 'hidden' },
  barRow: { paddingVertical: 6 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barTrack: { borderRadius: 4, height: 7, overflow: 'hidden' },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
  },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { paddingBottom: 40 },
  ctaWrap: { marginHorizontal: 16, marginTop: 18 },
  hero: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    paddingBottom: 56,
    paddingHorizontal: 20,
    paddingTop: 26,
  },
  heroAddress: { color: 'rgba(255,244,232,0.88)', flexShrink: 1, fontSize: 13 },
  heroAddressRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginBottom: 14 },
  heroCity: {
    color: 'rgba(255,244,232,0.8)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 33,
    marginBottom: 6,
  },
  heroRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hoursVoteButton: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  hoursVoteRow: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
  },
  inlineRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  medallion: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    elevation: 8,
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 16,
    marginTop: -40,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
  },
  medallionDivider: { alignSelf: 'stretch', width: 1 },
  medallionNumber: { fontSize: 36, fontWeight: '800', letterSpacing: -1.5, lineHeight: 40 },
  medallionScore: { alignItems: 'flex-start' },
  overline: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
    marginHorizontal: 18,
    marginTop: 20,
    textTransform: 'uppercase',
  },
  overlineInCard: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  paymentIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  paymentRow: { alignItems: 'center', flexDirection: 'row', gap: 13 },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingHorizontal: 16 },
  priceHistory: { fontSize: 12, marginHorizontal: 18, marginTop: 10 },
  priceTile: {
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: '30%',
    flexGrow: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  priceValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.6, marginTop: 3 },
  reportLink: { alignSelf: 'center', marginTop: 14, padding: 4 },
  statusClosed: { backgroundColor: 'rgba(120,20,10,0.45)', borderColor: 'rgba(255,138,128,0.5)' },
  statusDot: { borderRadius: 4, height: 7, width: 7 },
  statusOpen: { backgroundColor: 'rgba(20,90,45,0.55)', borderColor: 'rgba(95,217,138,0.5)' },
  statusPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  travelButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    paddingVertical: 10,
  },
  travelRow: { flexDirection: 'row', gap: 8, marginTop: 8, paddingHorizontal: 16 },
});
