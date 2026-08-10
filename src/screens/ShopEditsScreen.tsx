import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { fetchRecentShopEdits, restoreShopEdit } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { EDITABLE_SHOP_FIELDS, ShopEdit } from '@/types';

/** Kurzfassung eines Werts für die Anzeige (Objekte/Listen nur angedeutet). */
function short(value: unknown): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') return '{…}';
  return String(value);
}

/** Welche Felder wurden bei dieser Änderung angefasst? */
function changedFields(edit: ShopEdit): string[] {
  const before = edit.vorher ?? {};
  const after = edit.nachher ?? {};
  return EDITABLE_SHOP_FIELDS.filter(
    (f) => JSON.stringify(before[f]) !== JSON.stringify(after[f])
  );
}

/** Admin-Ansicht: Wer hat wann was an einem Laden geändert – mit Rückgängig-Knopf.
 *  So bleibt offenes Bearbeiten möglich, ohne dass Vandalismus dauerhaft bleibt. */
export function ShopEditsScreen() {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const dateLocale = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-GB' : 'de-DE';
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [edits, setEdits] = useState<ShopEdit[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchRecentShopEdits()
      .then(setEdits)
      .catch((e: Error) => Alert.alert(t('common.error'), e.message));
  }, []);

  useFocusEffect(load);

  const confirmRestore = (edit: ShopEdit) => {
    Alert.alert(
      t('edits.restoreTitle'),
      t('edits.restoreBody', { name: edit.shops?.name ?? '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('edits.restoreYes'),
          style: 'destructive',
          onPress: async () => {
            setBusyId(edit.id);
            try {
              await restoreShopEdit(edit);
              Alert.alert(t('edits.restoredTitle'), t('edits.restoredBody'));
              load();
            } catch (e) {
              Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>
        {t('edits.intro')}
      </Text>
      <FlatList
        data={edits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
            {t('edits.empty')}
          </Text>
        }
        renderItem={({ item }) => {
          const fields = changedFields(item);
          return (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Pressable
                onPress={() =>
                  item.shops && navigation.navigate('ShopDetail', { shopId: item.shops.id })
                }
              >
                <Text style={[styles.shopName, { color: theme.colors.text }]} numberOfLines={1}>
                  {item.shops?.name ?? t('edits.deletedShop')}
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                  {new Date(item.changed_at).toLocaleString(dateLocale, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </Pressable>

              {fields.length === 0 ? (
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 8 }}>
                  {t('edits.noVisibleChange')}
                </Text>
              ) : (
                <View style={styles.diffBlock}>
                  {fields.map((f) => (
                    <View key={f} style={styles.diffRow}>
                      <Text style={[styles.diffField, { color: theme.colors.text }]}>{f}</Text>
                      <Text style={{ color: theme.colors.danger, fontSize: 12, flex: 1 }} numberOfLines={1}>
                        {short(item.vorher?.[f])}
                      </Text>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>→</Text>
                      <Text style={{ color: theme.colors.success, fontSize: 12, flex: 1 }} numberOfLines={1}>
                        {short(item.nachher?.[f])}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {item.vorher && fields.length > 0 ? (
                <Pressable
                  onPress={() => confirmRestore(item)}
                  disabled={busyId === item.id}
                  style={[
                    styles.restoreButton,
                    { backgroundColor: theme.colors.surfaceVariant, opacity: busyId === item.id ? 0.5 : 1 },
                  ]}
                >
                  <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '700' }}>
                    {busyId === item.id ? t('edits.restoring') : t('edits.restore')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
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
  diffBlock: { gap: 4, marginTop: 8 },
  diffField: { fontSize: 12, fontWeight: '700', width: 96 },
  diffRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  empty: { marginTop: 48, paddingHorizontal: 24, textAlign: 'center' },
  flex: { flex: 1 },
  intro: { fontSize: 13, paddingHorizontal: 16, paddingTop: 12 },
  list: { padding: 16 },
  restoreButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  shopName: { fontSize: 16, fontWeight: '700' },
});
