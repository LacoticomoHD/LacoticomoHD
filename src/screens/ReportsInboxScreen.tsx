import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AUTO_HIDE_REPORTS, fetchAllReports, fetchClosureReportCounts, setReportStatus } from '@/lib/api';
import type { RootStackParamList } from '@/navigation/types';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from '@/theme/ThemeContext';
import { ReportWithShop } from '@/types';

/** Admin-Postfach: alle Nutzer-Meldungen, offene zuerst. Nur für app_admins sichtbar. */
export function ReportsInboxScreen() {
  const { theme } = useTheme();
  const { t, reportReasonLabel, lang } = useI18n();
  const dateLocale = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-GB' : 'de-DE';
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [reports, setReports] = useState<ReportWithShop[]>([]);
  const [hiddenCounts, setHiddenCounts] = useState<Map<string, number>>(new Map());

  useFocusEffect(
    useCallback(() => {
      fetchAllReports()
        .then(setReports)
        .catch((e: Error) => Alert.alert(t('common.error'), e.message));
      fetchClosureReportCounts().then(setHiddenCounts).catch(() => {});
    }, [])
  );

  const toggleStatus = async (report: ReportWithShop) => {
    const next = report.status === 'offen' ? 'erledigt' : 'offen';
    try {
      await setReportStatus(report.id, next);
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: next } : r))
      );
      setHiddenCounts(await fetchClosureReportCounts());
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
    }
  };

  const open = reports.filter((r) => r.status === 'offen').length;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.counter, { color: theme.colors.textSecondary }]}>
        {open === 0
          ? t('inbox.noOpen')
          : t('inbox.openCount', { n: open, label: open === 1 ? t('inbox.openWord') : t('inbox.openWords') })}
      </Text>
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
            {t('inbox.empty')}
          </Text>
        }
        renderItem={({ item }) => {
          const done = item.status === 'erledigt';
          return (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  opacity: done ? 0.55 : 1,
                },
              ]}
            >
              <Pressable
                onPress={() =>
                  item.shops && navigation.navigate('ShopDetail', { shopId: item.shops.id })
                }
                style={styles.cardBody}
              >
                <Text style={[styles.reason, { color: theme.colors.text }]}>
                  🚩 {reportReasonLabel(item.reason)}
                </Text>
                <Text style={{ color: theme.colors.text, fontSize: 14 }} numberOfLines={1}>
                  {item.shops?.name ?? t('inbox.deletedShop')}
                </Text>
                {(hiddenCounts.get(item.shop_id) ?? 0) >= AUTO_HIDE_REPORTS ? (
                  <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                    {t('inbox.autoHidden', { n: hiddenCounts.get(item.shop_id) ?? 0 })}
                  </Text>
                ) : null}
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {item.shops?.address ?? ''}
                </Text>
                {item.details ? (
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    „{item.details}"
                  </Text>
                ) : null}
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                  {new Date(item.created_at).toLocaleDateString(dateLocale, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => toggleStatus(item)}
                style={[
                  styles.statusButton,
                  {
                    backgroundColor: done ? theme.colors.surfaceVariant : theme.colors.success,
                  },
                ]}
              >
                <Text
                  style={{
                    color: done ? theme.colors.text : theme.colors.onPrimary,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {done ? t('inbox.reopen') : t('inbox.done')}
                </Text>
              </Pressable>
            </View>
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
    gap: 10,
    marginBottom: 10,
    padding: 14,
  },
  cardBody: { flex: 1 },
  counter: { fontSize: 13, paddingHorizontal: 16, paddingTop: 12 },
  empty: { marginTop: 48, paddingHorizontal: 24, textAlign: 'center' },
  flex: { flex: 1 },
  list: { padding: 16 },
  reason: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  statusButton: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
