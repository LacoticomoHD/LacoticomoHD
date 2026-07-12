import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useAuth } from '@/lib/AuthContext';
import { ThemeMode, useTheme } from '@/theme/ThemeContext';

const MODES: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Hell' },
  { key: 'dark', label: 'Dunkel' },
];

export function ProfileScreen() {
  const { theme, mode, setMode } = useTheme();
  const { user, signOut } = useAuth();

  const confirmSignOut = () =>
    Alert.alert('Abmelden', 'Möchtest du dich wirklich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <View
        style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Konto</Text>
        <Text style={{ color: theme.colors.textSecondary }}>Angemeldet als</Text>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600', marginTop: 2 }}>
          {user?.email}
        </Text>
      </View>

      <View
        style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Erscheinungsbild</Text>
        <View style={styles.modeRow}>
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMode(m.key)}
                style={[
                  styles.modeChip,
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.surfaceVariant,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? theme.colors.onPrimary : theme.colors.text,
                    fontWeight: '600',
                  }}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Über Don Döner</Text>
        <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>
          Don Döner ist eine reine Bewertungs-App für Dönerläden. Bewertet wird objektiv mit
          Sternen in den Kategorien Geschmack, Freundlichkeit, Sauberkeit, Preis-Leistung und
          Wartezeit – ohne Kommentare. Kartendaten © OpenStreetMap-Mitwirkende, Adresssuche über
          Nominatim.
        </Text>
      </View>

      <Button title="Abmelden" onPress={confirmSignOut} variant="danger" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  content: { padding: 20, paddingBottom: 40 },
  modeChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  modeRow: { flexDirection: 'row', gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
});
