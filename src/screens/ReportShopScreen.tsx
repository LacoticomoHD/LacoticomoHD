import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { createReport } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { REPORT_REASON_LABELS, REPORT_REASONS, ReportReason } from '@/types';

export function ReportShopScreen() {
  const { theme } = useTheme();
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
      Alert.alert('Fehler', 'Bitte wähle einen Grund aus.');
      return;
    }
    setBusy(true);
    try {
      await createReport(shopId, user.id, reason, details);
      Alert.alert('Danke!', 'Deine Meldung wurde übermittelt und wird geprüft.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Meldung fehlgeschlagen');
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
        Was stimmt mit diesem Eintrag nicht?
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
              {REPORT_REASON_LABELS[r]}
            </Text>
          </Pressable>
        );
      })}

      <TextField
        label="Details (optional)"
        value={details}
        onChangeText={setDetails}
        placeholder="z. B. die richtige Adresse oder Öffnungszeit"
        multiline
        numberOfLines={4}
        maxLength={500}
        style={styles.detailsInput}
      />

      <Button title="Meldung abschicken" onPress={submit} loading={busy} />
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
