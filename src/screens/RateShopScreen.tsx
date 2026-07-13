import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Button } from '@/components/Button';
import { StarRating } from '@/components/StarRating';
import {
  fetchMyFeatureVotes,
  fetchMyRating,
  RatingInput,
  saveFeatureVotes,
  upsertRating,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
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
  const { shopId, shopName } = route.params;

  const [values, setValues] = useState<RatingInput>(EMPTY);
  const [votes, setVotes] = useState<VoteState>({});
  const [existing, setExisting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchMyRating(shopId, user.id)
      .then((rating) => {
        if (rating) {
          setExisting(true);
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

  const submit = async () => {
    if (!user) return;
    if (RATING_CATEGORIES.some((cat) => values[cat] < 1)) {
      Alert.alert('Unvollständig', 'Bitte vergib in jeder Kategorie mindestens einen Stern.');
      return;
    }
    setBusy(true);
    try {
      // Erst die Bewertung – sie ist die Voraussetzung, um über Besonderheiten abzustimmen.
      await upsertRating(shopId, user.id, values);
      await saveFeatureVotes(shopId, user.id, votes);
      Alert.alert(
        'Danke!',
        existing ? 'Deine Bewertung wurde aktualisiert.' : 'Deine Bewertung wurde gespeichert.',
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
      <Text style={{ color: theme.colors.textSecondary, marginBottom: 20 }}>
        {existing
          ? 'Du hast diesen Laden schon bewertet – du kannst deine Angaben anpassen.'
          : 'Vergib 1 bis 5 Sterne pro Kategorie.'}
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
  row: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6, marginTop: 20 },
  spacer: { height: 20 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
});
