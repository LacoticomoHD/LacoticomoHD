import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Button } from '@/components/Button';
import { StarRating } from '@/components/StarRating';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { TextField } from '@/components/TextField';
import {
  confirmPrice,
  fetchMyFeatureVotes,
  fetchMyRating,
  fetchShop,
  fetchShopSummary,
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
  SHOP_FEATURES,
  ShopFeature,
} from '@/types';
import { Text } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { hasOpeningHours } from '@/lib/openingHours';

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
  const keyboardHeight = useKeyboardHeight();
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
  const [hoursMissing, setHoursMissing] = useState(false);
  // Schritt-für-Schritt: erst je eine Kategorie pro Seite, zum Schluss die Details.
  const [step, setStep] = useState(0);
  const lastStep = RATING_CATEGORIES.length; // = Detail-Seite
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  useEffect(() => {
    fetchShop(shopId)
      .then((shop) => {
        setCurrentPrice(shop.doener_preis);
        setCardPayment(shop.kartenzahlung ?? null);
        setOriginalCard(shop.kartenzahlung ?? null);
        setHoursMissing(!hasOpeningHours(shop.opening_hours));
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

  const setCategory = (cat: RatingCategory, value: number) => {
    setValues((prev) => ({ ...prev, [cat]: value }));
    // Nach dem Tippen kurz die Sterne zeigen, dann automatisch weiter.
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => setStep((s) => Math.min(s + 1, lastStep)), 420);
  };

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
    const missing = RATING_CATEGORIES.findIndex((cat) => cat !== 'fleischqualitaet' && values[cat] < 1);
    if (missing >= 0) {
      Alert.alert(t('rate.incomplete'), t('rate.incompleteBody'));
      setStep(missing);
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
      // Erste Bewertung dieses Ladens überhaupt? Dann gibt es den Pionier-Hinweis.
      let pioneer = false;
      if (!existing) {
        try {
          pioneer = (await fetchShopSummary(shopId))?.rating_count === 1;
        } catch {}
      }
      tapSuccess();
      Alert.alert(
        pioneer ? t('rate.pioneerTitle') : t('rate.thanks'),
        (existing ? t('rate.savedEdit') : t('rate.savedNew')) +
          (verified ? t('rate.verifiedSuffix') : '') +
          (pioneer ? t('rate.pioneerSuffix') : ''),
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
      contentContainerStyle={[styles.content, { paddingBottom: 40 + keyboardHeight }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>{shopName}</Text>
      {step === 0 ? (
      <>
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
      </>
      ) : null}

      {/* Fortschritt: ein Punkt je Kategorie + Details – antippbar zum Springen */}
      <View style={styles.progressRow} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: lastStep + 1, now: step + 1 }}>
        {[...RATING_CATEGORIES, 'details' as const].map((key, i) => {
          const done = i < lastStep ? values[key as RatingCategory] >= 1 : false;
          const active = i === step;
          return (
            <Pressable
              key={key}
              onPress={() => setStep(i)}
              hitSlop={{ top: 10, bottom: 10 }}
              accessibilityLabel={i < lastStep ? categoryLabel(key as RatingCategory) : t('rate.stepDetails')}
              style={[
                styles.progressSeg,
                {
                  backgroundColor: active ? theme.colors.primary : done ? theme.colors.accent : theme.colors.surfaceVariant,
                  opacity: active || done ? 1 : 0.9,
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 12.5, marginBottom: 12 }}>
        {t('rate.stepOf', { n: step + 1, total: lastStep + 1 })}
      </Text>

      {step < lastStep ? (
        (() => {
          const cat = RATING_CATEGORIES[step];
          const optional = cat === 'fleischqualitaet';
          return (
            <View
              style={[styles.stepCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            >
              <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{categoryLabel(cat)}</Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13.5, marginBottom: 18, textAlign: 'center' }}>
                {optional ? t('rate.meatOptionalHint') : t(`rate.q.${cat}`)}
              </Text>
              <StarRating value={values[cat]} onChange={(v) => setCategory(cat, v)} size={46} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 12, minHeight: 18 }}>
                {values[cat] >= 1 ? t(`rate.level${values[cat]}`) : ' '}
              </Text>
              <View style={styles.stepNav}>
                <Pressable
                  onPress={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  accessibilityRole="button"
                  style={[styles.stepBtn, { borderColor: theme.colors.border, opacity: step === 0 ? 0.4 : 1 }]}
                >
                  <Icon name="chevron-left" size={18} color={theme.colors.text} />
                  <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{t('rate.back')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setStep((s) => Math.min(lastStep, s + 1))}
                  disabled={!optional && values[cat] < 1}
                  accessibilityRole="button"
                  style={[
                    styles.stepBtn,
                    {
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary,
                      opacity: !optional && values[cat] < 1 ? 0.4 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: theme.colors.onPrimary, fontWeight: '800' }}>
                    {optional && values[cat] < 1 ? t('rate.skip') : t('rate.next')}
                  </Text>
                  <Icon name="chevron-right" size={18} color={theme.colors.onPrimary} />
                </Pressable>
              </View>
            </View>
          );
        })()
      ) : (
        <>
      {/* Zusammenfassung der Sterne – antippen springt zur Kategorie */}
      <View style={[styles.summary, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {RATING_CATEGORIES.map((cat, i) => (
          <Pressable key={cat} onPress={() => setStep(i)} style={styles.summaryRow} accessibilityRole="button">
            <Text style={{ color: theme.colors.text, flex: 1, fontSize: 14 }}>{categoryLabel(cat)}</Text>
            {values[cat] >= 1 ? (
              <StarRating value={values[cat]} size={16} />
            ) : (
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{t('rate.notRated')}</Text>
            )}
          </Pressable>
        ))}
      </View>

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
                {featureLabel(f)}
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

      {/* Fehlende Öffnungszeiten: wer gerade dort war, kennt sie oft. */}
      {hoursMissing ? (
        <Pressable
          onPress={() =>
            (navigation as unknown as { navigate: (s: string, p: object) => void }).navigate(
              'EditShop',
              { shopId }
            )
          }
          style={[
            styles.hoursCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary },
          ]}
        >
          <Icon name="clock" size={20} color={theme.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.text, fontSize: 14.5, fontWeight: '700' }}>
              {t('rate.hoursTitle')}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12.5, marginTop: 2 }}>
              {t('rate.hoursBody')}
            </Text>
          </View>
          <Icon name="chevron-right" size={18} color={theme.colors.textSecondary} />
        </Pressable>
      ) : null}

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
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hoursCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    padding: 14,
  },
  cardChip: {
    alignItems: 'center',
    borderRadius: 16,
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
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  priceRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  row: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6, marginTop: 20 },
  progressRow: { flexDirection: 'row', gap: 5, marginBottom: 8, marginTop: 6 },
  progressSeg: { borderRadius: 3, flex: 1, height: 6 },
  spacer: { height: 20 },
  stepBtn: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  stepCard: { alignItems: 'center', borderRadius: 24, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 26 },
  stepNav: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, marginTop: 22 },
  stepTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginBottom: 6, textAlign: 'center' },
  summary: { borderRadius: 20, borderWidth: 1, gap: 10, padding: 16 },
  summaryRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  verifiedHint: {
    borderRadius: 14,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
    padding: 10,
  },
});
