import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Button } from '@/components/Button';
import { StarRating } from '@/components/StarRating';
import { fetchMyRating, RatingInput, upsertRating } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { RATING_CATEGORIES, RATING_CATEGORY_LABELS, RatingCategory } from '@/types';

const EMPTY: RatingInput = {
  geschmack: 0,
  freundlichkeit: 0,
  sauberkeit: 0,
  preis_leistung: 0,
  wartezeit: 0,
};

export function RateShopScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, 'RateShop'>>();
  const navigation = useNavigation();
  const { shopId, shopName } = route.params;

  const [values, setValues] = useState<RatingInput>(EMPTY);
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
  }, [shopId, user]);

  const setCategory = (cat: RatingCategory, value: number) =>
    setValues((prev) => ({ ...prev, [cat]: value }));

  const submit = async () => {
    if (!user) return;
    if (RATING_CATEGORIES.some((cat) => values[cat] < 1)) {
      Alert.alert('Unvollständig', 'Bitte vergib in jeder Kategorie mindestens einen Stern.');
      return;
    }
    setBusy(true);
    try {
      await upsertRating(shopId, user.id, values);
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
          ? 'Du hast diesen Laden schon bewertet – du kannst deine Bewertung anpassen.'
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
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  row: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  spacer: { height: 8 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
});
