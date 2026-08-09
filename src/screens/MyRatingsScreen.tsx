import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { StarRating } from '@/components/StarRating';
import { deleteRating, fetchMyRatings } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import type { RootStackParamList } from '@/navigation/types';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from '@/theme/ThemeContext';
import { RATING_CATEGORIES, RatingWithShop } from '@/types';

/** Eigener Gesamtschnitt einer Bewertung – nur über tatsächlich vergebene
 *  Kategorien (Fleischqualität ist optional und darf fehlen). */
function ownAverage(rating: RatingWithShop): number {
  const values = RATING_CATEGORIES.map((cat) => rating[cat]).filter(
    (v): v is number => typeof v === 'number' && v >= 1
  );
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

export function MyRatingsScreen() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [ratings, setRatings] = useState<RatingWithShop[]>([]);

  const confirmDelete = (item: RatingWithShop) => {
    if (!user || !item.shops) return;
    Alert.alert(t('myratings.deleteTitle'), t('myratings.deleteBody', { name: item.shops.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('myratings.deleteYes'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRating(item.shop_id, user.id);
            setRatings((prev) => prev.filter((r) => r.id !== item.id));
          } catch (e) {
            Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
          }
        },
      },
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      fetchMyRatings(user.id)
        .then(setRatings)
        .catch((e: Error) => Alert.alert(t('common.error'), e.message));
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
            {t('myratings.empty')}
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
                {item.shops?.name ?? t('myratings.deletedShop')}
              </Text>
              <Text
                style={{ color: theme.colors.textSecondary, fontSize: 13 }}
                numberOfLines={1}
              >
                {item.shops?.address ?? ''}
              </Text>
              <View style={styles.cardFooter}>
                <StarRating value={avg} size={16} />
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, flex: 1 }}>
                  {t('myratings.yourAvg', { v: avg.toFixed(1) })}
                </Text>
                <Pressable onPress={() => confirmDelete(item)} hitSlop={8}>
                  <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: '600' }}>
                    {t('myratings.delete')}
                  </Text>
                </Pressable>
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
