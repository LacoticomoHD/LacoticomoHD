import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { fetchAllReports, setReportStatus } from '@/lib/api';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { REPORT_REASON_LABELS, ReportWithShop } from '@/types';

/** Admin-Postfach: alle Nutzer-Meldungen, offene zuerst. Nur für app_admins sichtbar. */
export function ReportsInboxScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [reports, setReports] = useState<ReportWithShop[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchAllReports()
        .then(setReports)
        .catch((e: Error) => Alert.alert('Fehler', e.message));
    }, [])
  );

  const toggleStatus = async (report: ReportWithShop) => {
    const next = report.status === 'offen' ? 'erledigt' : 'offen';
    try {
      await setReportStatus(report.id, next);
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: next } : r))
      );
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    }
  };

  const open = reports.filter((r) => r.status === 'offen').length;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.counter, { color: theme.colors.textSecondary }]}>
        {open === 0 ? 'Keine offenen Meldungen 🎉' : `${open} offene ${open === 1 ? 'Meldung' : 'Meldungen'}`}
      </Text>
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
            Bisher wurde nichts gemeldet.
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
                  🚩 {REPORT_REASON_LABELS[item.reason]}
                </Text>
                <Text style={{ color: theme.colors.text, fontSize: 14 }} numberOfLines={1}>
                  {item.shops?.name ?? 'Gelöschter Laden'}
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {item.shops?.address ?? ''}
                </Text>
                {item.details ? (
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    „{item.details}"
                  </Text>
                ) : null}
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                  {new Date(item.created_at).toLocaleDateString('de-DE', {
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
                  {done ? '↩︎ Wieder öffnen' : '✓ Erledigt'}
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
