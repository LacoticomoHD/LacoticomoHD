import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { StarRating } from '@/components/StarRating';
import { TextField } from '@/components/TextField';
import { fetchShopsWithSummary } from '@/lib/api';
import { isOpenNow } from '@/lib/openingHours';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { SHOP_FEATURE_ICONS, ShopWithSummary } from '@/types';

export function ShopListScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [shops, setShops] = useState<ShopWithSummary[]>([]);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchShopsWithSummary()
        .then(setShops)
        .catch((e: Error) => Alert.alert('Fehler beim Laden', e.message));
    }, [])
  );

  // Beste zuerst; unbewertete ans Ende.
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shops
      .filter(
        (s) => !q || s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
      )
      .sort((a, b) => (b.summary?.avg_gesamt ?? -1) - (a.summary?.avg_gesamt ?? -1));
  }, [shops, query]);

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.searchWrap}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Nach Name oder Adresse suchen…"
        />
      </View>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
            Noch keine Dönerläden eingetragen. Füge auf der Karte mit ＋ den ersten hinzu!
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
                  {open ? 'Geöffnet' : 'Geschlossen'}
                </Text>
              </View>
              <Text
                style={{ color: theme.colors.textSecondary, fontSize: 13 }}
                numberOfLines={1}
              >
                {item.address}
              </Text>
              <View style={styles.cardFooter}>
                {avg != null ? (
                  <View style={styles.ratingRow}>
                    <StarRating value={avg} size={16} />
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                      {avg.toFixed(1)} ({item.summary?.rating_count})
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                    Noch keine Bewertung
                  </Text>
                )}
                <Text style={{ fontSize: 13 }}>
                  {(item.features ?? []).map((f) => SHOP_FEATURE_ICONS[f]).join(' ')}
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
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardName: { flex: 1, fontSize: 17, fontWeight: '700' },
  empty: { marginTop: 48, paddingHorizontal: 24, textAlign: 'center' },
  flex: { flex: 1 },
  list: { paddingBottom: 24, paddingHorizontal: 16 },
  ratingRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
});
