import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { StarRating } from '@/components/StarRating';
import { fetchFavoriteShops, removeFavorite } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { formatPrice } from '@/lib/geo';
import { isOpenNow } from '@/lib/openingHours';
import type { RootStackParamList } from '@/navigation/types';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from '@/theme/ThemeContext';
import { ShopWithSummary } from '@/types';

export function FavoritesScreen() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [shops, setShops] = useState<ShopWithSummary[]>([]);

  const load = useCallback(() => {
    if (!user) return;
    fetchFavoriteShops(user.id)
      .then(setShops)
      .catch((e: Error) => Alert.alert(t('common.error'), e.message));
  }, [user]);

  useFocusEffect(load);

  const unfavorite = async (shopId: string) => {
    if (!user) return;
    try {
      await removeFavorite(user.id, shopId);
      setShops((prev) => prev.filter((s) => s.id !== shopId));
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={shops}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
            {t('fav.empty')}
          </Text>
        }
        renderItem={({ item }) => {
          const open = isOpenNow(item.opening_hours ?? {});
          const avg = item.summary?.avg_gesamt;
          return (
            <Pressable
              onPress={() => navigation.navigate('ShopDetail', { shopId: item.id })}
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardName, { color: theme.colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text
                    style={{
                      color: open ? theme.colors.success : theme.colors.danger,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {open ? t('common.open') : t('common.closed')}
                  </Text>
                </View>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }} numberOfLines={1}>
                  {item.address}
                </Text>
                <View style={styles.cardStats}>
                  {avg != null ? (
                    <>
                      <StarRating value={avg} size={14} />
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                        {avg.toFixed(1)}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                      {t('common.noRating')}
                    </Text>
                  )}
                  {item.doener_preis != null ? (
                    <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700' }}>
                      🥙 {formatPrice(item.doener_preis)}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Pressable onPress={() => unfavorite(item.id)} hitSlop={8}>
                <Text style={{ fontSize: 22 }}>❤️</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 14,
  },
  cardBody: { flex: 1 },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardName: { flex: 1, fontSize: 16, fontWeight: '700' },
  cardStats: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 4 },
  empty: { marginTop: 48, paddingHorizontal: 24, textAlign: 'center' },
  flex: { flex: 1 },
  list: { padding: 16 },
});
