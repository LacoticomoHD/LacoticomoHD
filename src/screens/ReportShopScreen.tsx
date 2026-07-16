import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { createReport } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import type { RootStackParamList } from '@/navigation/types';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from '@/theme/ThemeContext';
import { REPORT_REASONS, ReportReason } from '@/types';

export function ReportShopScreen() {
  const { theme } = useTheme();
  const { t, reportReasonLabel } = useI18n();
  const { user } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, 'ReportShop'>>();
  const navigation = useNavigation();
  const { shopId, shopName } = route.params;

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!reason) {
      Alert.alert(t('common.error'), t('report.chooseReason'));
      return;
    }
    setBusy(true);
    try {
      await createReport(shopId, user.id, reason, details);
      Alert.alert(t('report.thanks'), t('report.thanksBody'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>{shopName}</Text>
      <Text style={{ color: theme.colors.textSecondary, marginBottom: 20 }}>
        {t('report.what')}
      </Text>

      {REPORT_REASONS.map((r) => {
        const active = reason === r;
        return (
          <Pressable
            key={r}
            onPress={() => setReason(r)}
            style={[
              styles.reasonRow,
              {
                backgroundColor: active ? theme.colors.surfaceVariant : theme.colors.surface,
                borderColor: active ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <Text style={{ color: theme.colors.text, fontSize: 16 }}>
              {active ? '◉ ' : '○ '}
              {reportReasonLabel(r)}
            </Text>
          </Pressable>
        );
      })}

      <TextField
        label={t('report.details')}
        value={details}
        onChangeText={setDetails}
        placeholder={t('report.detailsPlaceholder')}
        multiline
        numberOfLines={4}
        maxLength={500}
        style={styles.detailsInput}
      />

      <Button title={t('report.submit')} onPress={submit} loading={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  detailsInput: { minHeight: 100, textAlignVertical: 'top' },
  reasonRow: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    padding: 14,
  },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
});
