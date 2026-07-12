import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '@/components/Button';
import { deleteOwnAccount } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import type { RootStackParamList } from '@/navigation/types';
import { ThemeMode, useTheme } from '@/theme/ThemeContext';

const MODES: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Hell' },
  { key: 'dark', label: 'Dunkel' },
];

export function ProfileScreen() {
  const { theme, mode, setMode } = useTheme();
  const { user, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [deleting, setDeleting] = useState(false);

  const confirmSignOut = () =>
    Alert.alert('Abmelden', 'Möchtest du dich wirklich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: () => signOut() },
    ]);

  const confirmDeleteAccount = () =>
    Alert.alert(
      'Konto löschen',
      'Dein Konto und alle deine Bewertungen werden unwiderruflich gelöscht. Von dir eingetragene Läden bleiben als Community-Daten erhalten. Fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Endgültig löschen',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteOwnAccount();
              await signOut();
            } catch (e) {
              Alert.alert('Fehler', e instanceof Error ? e.message : 'Löschen fehlgeschlagen');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );

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

      <Pressable
        onPress={() => navigation.navigate('MyRatings')}
        style={[
          styles.legalLink,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={{ color: theme.colors.text, fontWeight: '600' }}>⭐ Meine Bewertungen</Text>
        <Text style={{ color: theme.colors.textSecondary }}>›</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('Legal')}
        style={[
          styles.legalLink,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
          📄 Impressum & Datenschutz
        </Text>
        <Text style={{ color: theme.colors.textSecondary }}>›</Text>
      </Pressable>

      <Button title="Abmelden" onPress={confirmSignOut} variant="danger" />

      <Pressable onPress={confirmDeleteAccount} disabled={deleting} style={styles.deleteLink}>
        <Text style={{ color: theme.colors.danger, fontSize: 13 }}>
          {deleting ? 'Konto wird gelöscht…' : 'Konto endgültig löschen'}
        </Text>
      </Pressable>
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
  deleteLink: { alignSelf: 'center', marginTop: 20, padding: 4 },
  legalLink: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 16,
  },
  modeChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  modeRow: { flexDirection: 'row', gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
});
