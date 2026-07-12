import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { StarRating } from '@/components/StarRating';
import { fetchMyRatings } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { RATING_CATEGORIES, RatingWithShop } from '@/types';

/** Eigener Gesamtschnitt einer Bewertung über alle Kategorien. */
function ownAverage(rating: RatingWithShop): number {
  const sum = RATING_CATEGORIES.reduce((acc, cat) => acc + rating[cat], 0);
  return sum / RATING_CATEGORIES.length;
}

export function MyRatingsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [ratings, setRatings] = useState<RatingWithShop[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      fetchMyRatings(user.id)
        .then(setRatings)
        .catch((e: Error) => Alert.alert('Fehler', e.message));
    }, [user])
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={ratings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
            Du hast noch keine Läden bewertet.
          </Text>
        }
        renderItem={({ item }) => {
          const avg = ownAverage(item);
          return (
            <Pressable
              onPress={() =>
                item.shops && navigation.navigate('ShopDetail', { shopId: item.shops.id })
              }
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.cardName, { color: theme.colors.text }]} numberOfLines={1}>
                {item.shops?.name ?? 'Gelöschter Laden'}
              </Text>
              <Text
                style={{ color: theme.colors.textSecondary, fontSize: 13 }}
                numberOfLines={1}
              >
                {item.shops?.address ?? ''}
              </Text>
              <View style={styles.cardFooter}>
                <StarRating value={avg} size={16} />
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                  Dein Schnitt: {avg.toFixed(1)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
  },
  cardFooter: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  cardName: { fontSize: 17, fontWeight: '700' },
  empty: { marginTop: 48, paddingHorizontal: 24, textAlign: 'center' },
  flex: { flex: 1 },
  list: { padding: 16 },
});
