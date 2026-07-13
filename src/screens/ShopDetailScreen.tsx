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
import { formatPrice } from '@/lib/geo';
import { isOpenNow } from '@/lib/openingHours';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import {
  HoursVoteSummary,
  PriceHistoryEntry,
  RATING_CATEGORIES,
  RATING_CATEGORY_LABELS,
  Shop,
  ShopFeature,
  ShopFeatureSummary,
  ShopRatingSummary,
} from '@/types';

export function ShopDetailScreen() {
  const { theme } = useTheme();
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
        .catch((e: Error) => Alert.alert('Fehler', e.message));
      if (user) {
        fetchFavoriteIds(user.id)
          .then((ids) => setIsFavorite(ids.has(shopId)))
          .catch(() => {});
        fetchMyHoursVote(shopId, user.id).then(setMyHoursVote);
      }
    }, [shopId, user])
  );

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
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    }
  };

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
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setFavoriteBusy(false);
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

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.nameRow}>
        <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={2}>
          {shop.name}
        </Text>
        <Pressable onPress={toggleFavorite} hitSlop={8} style={styles.favoriteButton}>
          <Text style={{ fontSize: 28 }}>{isFavorite ? '❤️' : '🤍'}</Text>
        </Pressable>
      </View>
      <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>📍 {shop.address}</Text>
      <View style={styles.statusRow}>
        <Text
          style={{
            color: open ? theme.colors.success : theme.colors.danger,
            fontWeight: '700',
          }}
        >
          {open ? '● Jetzt geöffnet' : '● Geschlossen'}
        </Text>
        {shop.doener_preis != null ? (
          <Text style={{ color: theme.colors.accent, fontSize: 16, fontWeight: '800' }}>
            🥙 Döner: {formatPrice(shop.doener_preis)}
          </Text>
        ) : null}
      </View>

      {/* Preisverlauf, sobald es mehr als einen erfassten Preis gibt */}
      {priceHistory.length >= 2 ? (
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }}>
          📈 Preisverlauf:{' '}
          {priceHistory
            .map((p) => formatPrice(p.preis))
            .join(' → ')}{' '}
          (seit{' '}
          {new Date(priceHistory[0].recorded_at).toLocaleDateString('de-DE', {
            month: '2-digit',
            year: 'numeric',
          })}
          )
        </Text>
      ) : null}

      {/* Navigation zum Laden über die System-Karten-App */}
      <View
        style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Route zum Laden</Text>
        <View style={styles.travelRow}>
          {TRAVEL_MODES.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => openDirections(shop.latitude, shop.longitude, m.key)}
              style={[
                styles.travelButton,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={{ fontSize: 22 }}>{m.icon}</Text>
              <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '600' }}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

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
        {summary && summary.verifiziert_count > 0 ? (
          <Text style={{ color: theme.colors.success, fontSize: 12, marginBottom: 8 }}>
            📍 {summary.verifiziert_count} von {summary.rating_count}{' '}
            {summary.rating_count === 1 ? 'Bewertung' : 'Bewertungen'} vor Ort verifiziert
          </Text>
        ) : null}
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
        <FeatureBadges
          features={featureSummary.filter((f) => f.score > 0).map((f) => f.feature)}
          counts={Object.fromEntries(
            featureSummary.filter((f) => f.score > 0).map((f) => [f.feature, f.bestaetigt])
          ) as Partial<Record<ShopFeature, number>>}
        />
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 10 }}>
          Von der Community bestätigt – stimme bei deiner Bewertung mit ab.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Öffnungszeiten</Text>
        {hoursVotes && hoursVotes.score <= -2 ? (
          <Text style={{ color: theme.colors.danger, fontSize: 13, marginBottom: 8 }}>
            ⚠️ Laut Community sind diese Zeiten möglicherweise veraltet
          </Text>
        ) : null}
        <OpeningHoursTable hours={shop.opening_hours ?? {}} />
        <View style={[styles.hoursVoteRow, { borderTopColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.textSecondary, flex: 1, fontSize: 13 }}>
            Stimmen die Zeiten?
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

      <Button
        title="Jetzt bewerten"
        onPress={() =>
          navigation.navigate('RateShop', {
            shopId: shop.id,
            shopName: shop.name,
            latitude: shop.latitude,
            longitude: shop.longitude,
          })
        }
      />
      {user && shop.created_by === user.id ? (
        <Pressable
          onPress={() => navigation.navigate('EditShop', { shopId: shop.id })}
          style={styles.reportLink}
        >
          <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '600' }}>
            ✏️ Eintrag bearbeiten (von dir angelegt)
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={() =>
          navigation.navigate('ReportShop', { shopId: shop.id, shopName: shop.name })
        }
        style={styles.reportLink}
      >
        <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
          🚩 Fehler in diesem Eintrag melden
        </Text>
      </Pressable>
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
  favoriteButton: { padding: 2 },
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
  name: { flex: 1, fontSize: 26, fontWeight: '800' },
  nameRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  reportLink: { alignSelf: 'center', marginTop: 16, padding: 4 },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  travelButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingVertical: 10,
  },
  travelRow: { flexDirection: 'row', gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  summaryHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
