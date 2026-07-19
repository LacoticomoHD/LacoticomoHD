import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Button } from '@/components/Button';
import { StarRating } from '@/components/StarRating';
import { TextField } from '@/components/TextField';
import {
  confirmPrice,
  fetchMyFeatureVotes,
  fetchMyRating,
  fetchShop,
  RatingInput,
  saveFeatureVotes,
  updateDoenerPreis,
  updateKartenzahlung,
  upsertRating,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { tapLight, tapSuccess } from '@/lib/haptics';
import { useI18n } from '@/i18n/I18nContext';
import { distanceKm, formatPrice } from '@/lib/geo';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import {
  FeatureVote,
  RATING_CATEGORIES,
  RatingCategory,
  SHOP_FEATURE_ICONS,
  SHOP_FEATURES,
  ShopFeature,
} from '@/types';

// UI-Zustand: 0 = noch nicht bewertet. Fleischqualität darf 0 bleiben (optional).
const EMPTY: Record<RatingCategory, number> = {
  geschmack: 0,
  fleischqualitaet: 0,
  sossenqualitaet: 0,
  freundlichkeit: 0,
  sauberkeit: 0,
  preis_leistung: 0,
  wartezeit: 0,
};

/** 0 = keine Angabe, 1 = vorhanden, -1 = nicht vorhanden */
type VoteState = Partial<Record<ShopFeature, FeatureVote | 0>>;

export function RateShopScreen() {
  const { theme } = useTheme();
  const { t, categoryLabel, featureLabel } = useI18n();
  const { user } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, 'RateShop'>>();
  const navigation = useNavigation();
  const { shopId, shopName, latitude, longitude } = route.params;

  const [values, setValues] = useState<Record<RatingCategory, number>>(EMPTY);
  const [votes, setVotes] = useState<VoteState>({});
  const [existing, setExisting] = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  // Preis-Frischehalter
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceAnswer, setPriceAnswer] = useState<'stimmt' | 'anders' | null>(null);
  const [newPriceText, setNewPriceText] = useState('');
  // Kartenzahlung: true = möglich, false = nur Bar, null = keine Angabe.
  const [cardPayment, setCardPayment] = useState<boolean | null>(null);
  const [originalCard, setOriginalCard] = useState<boolean | null>(null);

  useEffect(() => {
    fetchShop(shopId)
      .then((shop) => {
        setCurrentPrice(shop.doener_preis);
        setCardPayment(shop.kartenzahlung ?? null);
        setOriginalCard(shop.kartenzahlung ?? null);
      })
      .catch(() => {});
  }, [shopId]);

  useEffect(() => {
    if (!user) return;
    fetchMyRating(shopId, user.id)
      .then((rating) => {
        if (rating) {
          setExisting(true);
          setAlreadyVerified(rating.verified);
          setValues({
            geschmack: rating.geschmack,
            fleischqualitaet: rating.fleischqualitaet ?? 0,
            sossenqualitaet: rating.sossenqualitaet,
            freundlichkeit: rating.freundlichkeit,
            sauberkeit: rating.sauberkeit,
            preis_leistung: rating.preis_leistung,
            wartezeit: rating.wartezeit,
          });
        }
      })
      .catch(() => {});
    fetchMyFeatureVotes(shopId, user.id)
      .then((v) => setVotes(v))
      .catch(() => {});
  }, [shopId, user]);

  const setCategory = (cat: RatingCategory, value: number) =>
    setValues((prev) => ({ ...prev, [cat]: value }));

  /** Tippen wechselt: keine Angabe → ✓ vorhanden → ✗ nicht vorhanden → keine Angabe */
  const cycleVote = (feature: ShopFeature) => {
    tapLight();
    setVotes((prev) => {
      const current = prev[feature] ?? 0;
      const next = current === 0 ? 1 : current === 1 ? -1 : 0;
      return { ...prev, [feature]: next };
    });
  };

  /** Vor-Ort-Check: Ist der Nutzer gerade in Ladennähe (< 150 m)?
   *  Es wird nur ja/nein gespeichert, nie der Standort selbst. */
  const checkOnSite = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return false;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return distanceKm(pos.coords.latitude, pos.coords.longitude, latitude, longitude) < 0.15;
    } catch {
      return false;
    }
  };

  const submit = async () => {
    if (!user) return;
    // Alle Kategorien sind Pflicht – außer Fleischqualität (bei vegetarisch/vegan optional).
    if (RATING_CATEGORIES.some((cat) => cat !== 'fleischqualitaet' && values[cat] < 1)) {
      Alert.alert(t('rate.incomplete'), t('rate.incompleteBody'));
      return;
    }
    // Preis-Frischehalter: Eingabe prüfen, bevor irgendetwas gespeichert wird.
    let priceUpdate: number | null = null;
    if ((priceAnswer === 'anders' || (currentPrice == null && newPriceText.trim())) && newPriceText.trim()) {
      const parsed = parseFloat(newPriceText.trim().replace(',', '.'));
      if (Number.isNaN(parsed) || parsed <= 0 || parsed >= 50) {
        Alert.alert(t('common.error'), t('rate.priceInvalid'));
        return;
      }
      priceUpdate = Math.round(parsed * 100) / 100;
    }
    setBusy(true);
    try {
      // Einmal verifiziert bleibt verifiziert – auch wenn später von zu Hause angepasst wird.
      const verified = alreadyVerified || (await checkOnSite());
      // Fleischqualität 0 (nicht bewertet) → null in der Datenbank.
      const ratingInput: RatingInput = {
        geschmack: values.geschmack,
        fleischqualitaet: values.fleischqualitaet >= 1 ? values.fleischqualitaet : null,
        sossenqualitaet: values.sossenqualitaet,
        freundlichkeit: values.freundlichkeit,
        sauberkeit: values.sauberkeit,
        preis_leistung: values.preis_leistung,
        wartezeit: values.wartezeit,
      };
      // Erst die Bewertung – sie ist die Voraussetzung, um über Besonderheiten abzustimmen.
      await upsertRating(shopId, user.id, ratingInput, verified);
      await saveFeatureVotes(shopId, user.id, votes);
      // Preis-Feedback ist Bonus – Fehler hier sollen die Bewertung nicht blockieren.
      try {
        if (priceUpdate != null) await updateDoenerPreis(shopId, priceUpdate);
        else if (priceAnswer === 'stimmt' && currentPrice != null) await confirmPrice(shopId);
      } catch {}
      // Kartenzahlung nur schreiben, wenn geändert (jede:r darf sie aktualisieren).
      try {
        if (cardPayment !== originalCard) await updateKartenzahlung(shopId, cardPayment);
      } catch {}
      tapSuccess();
      Alert.alert(
        t('rate.thanks'),
        (existing ? t('rate.savedEdit') : t('rate.savedNew')) +
          (verified ? t('rate.verifiedSuffix') : ''),
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>{shopName}</Text>
      <Text style={{ color: theme.colors.textSecondary, marginBottom: 8 }}>
        {existing
          ? t('rate.introEdit')
          : t('rate.introNew')}
      </Text>
      <Text
        style={[
          styles.verifiedHint,
          {
            backgroundColor: theme.colors.surfaceVariant,
            color: alreadyVerified ? theme.colors.success : theme.colors.textSecondary,
          },
        ]}
      >
        {alreadyVerified
          ? t('rate.verifiedAlready')
          : t('rate.verifyHint')}
      </Text>

      {RATING_CATEGORIES.map((cat) => (
        <View
          key={cat}
          style={[
            styles.row,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {categoryLabel(cat)}
            {cat === 'fleischqualitaet' ? (
              <Text style={{ color: theme.colors.textSecondary, fontWeight: '400', fontSize: 13 }}>
                {'  '}
                {t('rate.optional')}
              </Text>
            ) : null}
          </Text>
          {cat === 'fleischqualitaet' ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12.5, marginBottom: 10, marginTop: -4 }}>
              {t('rate.meatOptionalHint')}
            </Text>
          ) : null}
          <StarRating value={values[cat]} onChange={(v) => setCategory(cat, v)} size={30} />
        </View>
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {t('rate.featuresTitle')}
      </Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 10 }}>
        {t('rate.featuresHint')}
      </Text>
      <View style={styles.featureWrap}>
        {SHOP_FEATURES.map((f) => {
          const vote = votes[f] ?? 0;
          const background =
            vote === 1
              ? theme.colors.success
              : vote === -1
                ? theme.colors.danger
                : theme.colors.surface;
          const textColor = vote === 0 ? theme.colors.text : theme.colors.onPrimary;
          return (
            <Pressable
              key={f}
              onPress={() => cycleVote(f)}
              style={[
                styles.featureChip,
                {
                  backgroundColor: background,
                  borderColor: vote === 0 ? theme.colors.border : background,
                },
              ]}
            >
              <Text style={{ color: textColor, fontSize: 14 }}>
                {vote === 1 ? '✓ ' : vote === -1 ? '✗ ' : ''}
                {SHOP_FEATURE_ICONS[f]} {featureLabel(f)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Kartenzahlung */}
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {t('rate.cardTitle')}
      </Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 10 }}>
        {t('rate.cardHint')}
      </Text>
      <View style={styles.priceRow}>
        {([
          { value: true as boolean | null, label: t('form.cardYes') },
          { value: false as boolean | null, label: t('form.cardNo') },
          { value: null as boolean | null, label: t('form.cardUnknown') },
        ]).map((opt) => {
          const active = cardPayment === opt.value;
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => {
                tapLight();
                setCardPayment(opt.value);
              }}
              style={[
                styles.cardChip,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: active ? theme.colors.onPrimary : theme.colors.text,
                  fontWeight: '600',
                  fontSize: 14,
                  textAlign: 'center',
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Preis-Frischehalter */}
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {t('rate.priceCheck')}
      </Text>
      {currentPrice != null ? (
        <>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 10 }}>
            {t('rate.priceStillQ', { price: formatPrice(currentPrice) })}
          </Text>
          <View style={styles.priceRow}>
            <Pressable
              onPress={() => setPriceAnswer(priceAnswer === 'stimmt' ? null : 'stimmt')}
              style={[
                styles.priceChip,
                {
                  backgroundColor:
                    priceAnswer === 'stimmt' ? theme.colors.success : theme.colors.surface,
                  borderColor:
                    priceAnswer === 'stimmt' ? theme.colors.success : theme.colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: priceAnswer === 'stimmt' ? theme.colors.onPrimary : theme.colors.text,
                  fontWeight: '600',
                }}
              >
                {t('rate.priceStillYes')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPriceAnswer(priceAnswer === 'anders' ? null : 'anders')}
              style={[
                styles.priceChip,
                {
                  backgroundColor:
                    priceAnswer === 'anders' ? theme.colors.danger : theme.colors.surface,
                  borderColor:
                    priceAnswer === 'anders' ? theme.colors.danger : theme.colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: priceAnswer === 'anders' ? theme.colors.onPrimary : theme.colors.text,
                  fontWeight: '600',
                }}
              >
                {t('rate.priceDifferent')}
              </Text>
            </Pressable>
          </View>
          {priceAnswer === 'anders' ? (
            <TextField
              label={t('rate.newPrice')}
              value={newPriceText}
              onChangeText={setNewPriceText}
              placeholder="z. B. 7,00"
              keyboardType="decimal-pad"
            />
          ) : null}
        </>
      ) : (
        <>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 10 }}>
            {t('rate.priceUnknown')}
          </Text>
          <TextField
            label={t('rate.priceOptional')}
            value={newPriceText}
            onChangeText={setNewPriceText}
            placeholder="z. B. 6,50"
            keyboardType="decimal-pad"
          />
        </>
      )}

      <View style={styles.spacer} />
      <Button
        title={existing ? t('rate.submitEdit') : t('rate.submitNew')}
        onPress={submit}
        loading={busy}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardChip: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 11,
  },
  content: { padding: 20, paddingBottom: 40 },
  featureChip: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  featureWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  priceChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  priceRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  row: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6, marginTop: 20 },
  spacer: { height: 20 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  verifiedHint: {
    borderRadius: 10,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
    padding: 10,
  },
});
