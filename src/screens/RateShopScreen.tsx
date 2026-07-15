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
  upsertRating,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { distanceKm, formatPrice } from '@/lib/geo';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import {
  FeatureVote,
  RATING_CATEGORIES,
  RATING_CATEGORY_LABELS,
  RatingCategory,
  SHOP_FEATURE_ICONS,
  SHOP_FEATURE_LABELS,
  SHOP_FEATURES,
  ShopFeature,
} from '@/types';

const EMPTY: RatingInput = {
  geschmack: 0,
  freundlichkeit: 0,
  sauberkeit: 0,
  preis_leistung: 0,
  wartezeit: 0,
};

/** 0 = keine Angabe, 1 = vorhanden, -1 = nicht vorhanden */
type VoteState = Partial<Record<ShopFeature, FeatureVote | 0>>;

export function RateShopScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, 'RateShop'>>();
  const navigation = useNavigation();
  const { shopId, shopName, latitude, longitude } = route.params;

  const [values, setValues] = useState<RatingInput>(EMPTY);
  const [votes, setVotes] = useState<VoteState>({});
  const [existing, setExisting] = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  // Preis-Frischehalter
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceAnswer, setPriceAnswer] = useState<'stimmt' | 'anders' | null>(null);
  const [newPriceText, setNewPriceText] = useState('');

  useEffect(() => {
    fetchShop(shopId)
      .then((shop) => setCurrentPrice(shop.doener_preis))
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
  const cycleVote = (feature: ShopFeature) =>
    setVotes((prev) => {
      const current = prev[feature] ?? 0;
      const next = current === 0 ? 1 : current === 1 ? -1 : 0;
      return { ...prev, [feature]: next };
    });

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
    if (RATING_CATEGORIES.some((cat) => values[cat] < 1)) {
      Alert.alert('Unvollständig', 'Bitte vergib in jeder Kategorie mindestens einen Stern.');
      return;
    }
    // Preis-Frischehalter: Eingabe prüfen, bevor irgendetwas gespeichert wird.
    let priceUpdate: number | null = null;
    if ((priceAnswer === 'anders' || (currentPrice == null && newPriceText.trim())) && newPriceText.trim()) {
      const parsed = parseFloat(newPriceText.trim().replace(',', '.'));
      if (Number.isNaN(parsed) || parsed <= 0 || parsed >= 50) {
        Alert.alert('Fehler', 'Ungültiger Dönerpreis. Beispiel: 6,50');
        return;
      }
      priceUpdate = Math.round(parsed * 100) / 100;
    }
    setBusy(true);
    try {
      // Einmal verifiziert bleibt verifiziert – auch wenn später von zu Hause angepasst wird.
      const verified = alreadyVerified || (await checkOnSite());
      // Erst die Bewertung – sie ist die Voraussetzung, um über Besonderheiten abzustimmen.
      await upsertRating(shopId, user.id, values, verified);
      await saveFeatureVotes(shopId, user.id, votes);
      // Preis-Feedback ist Bonus – Fehler hier sollen die Bewertung nicht blockieren.
      try {
        if (priceUpdate != null) await updateDoenerPreis(shopId, priceUpdate);
        else if (priceAnswer === 'stimmt' && currentPrice != null) await confirmPrice(shopId);
      } catch {}
      Alert.alert(
        'Danke!',
        (existing ? 'Deine Bewertung wurde aktualisiert.' : 'Deine Bewertung wurde gespeichert.') +
          (verified ? '\n\n📍 Vor Ort verifiziert – deine Bewertung trägt das ✓-Siegel!' : ''),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Unbekannter Fehler');
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
          ? 'Du hast diesen Laden schon bewertet – du kannst deine Angaben anpassen.'
          : 'Vergib 1 bis 5 Sterne pro Kategorie.'}
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
          ? '✓ Diese Bewertung ist vor Ort verifiziert.'
          : '📍 Tipp: Bewerte direkt beim Laden (mit Standortfreigabe) – dann bekommt deine Bewertung das „✓ vor Ort verifiziert"-Siegel. Gespeichert wird nur ja/nein, nie dein Standort.'}
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
            {RATING_CATEGORY_LABELS[cat]}
          </Text>
          <StarRating value={values[cat]} onChange={(v) => setCategory(cat, v)} size={30} />
        </View>
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Besonderheiten (optional)
      </Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 10 }}>
        Was bietet dieser Laden wirklich an? Tippen wechselt: einmal = ✓ vorhanden, zweimal = ✗
        nicht vorhanden, dreimal = keine Angabe. Angezeigt wird eine Besonderheit erst, wenn die
        Community sie mehrheitlich bestätigt.
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
                {SHOP_FEATURE_ICONS[f]} {SHOP_FEATURE_LABELS[f]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Preis-Frischehalter */}
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        💶 Preis-Check (optional)
      </Text>
      {currentPrice != null ? (
        <>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 10 }}>
            Kostet der Döner hier noch {formatPrice(currentPrice)}?
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
                ✓ Stimmt noch
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
                ✗ Ist jetzt anders
              </Text>
            </Pressable>
          </View>
          {priceAnswer === 'anders' ? (
            <TextField
              label="Neuer Dönerpreis in €"
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
            Für diesen Laden ist noch kein Dönerpreis bekannt – weißt du ihn?
          </Text>
          <TextField
            label="Dönerpreis in € (optional)"
            value={newPriceText}
            onChangeText={setNewPriceText}
            placeholder="z. B. 6,50"
            keyboardType="decimal-pad"
          />
        </>
      )}

      <View style={styles.spacer} />
      <Button
        title={existing ? 'Bewertung aktualisieren' : 'Bewertung abschicken'}
        onPress={submit}
        loading={busy}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
