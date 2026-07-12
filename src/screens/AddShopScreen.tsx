import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { createShop, geocodeAddress, GeocodingResult } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import {
  OpeningHours,
  SHOP_FEATURE_ICONS,
  SHOP_FEATURE_LABELS,
  SHOP_FEATURES,
  ShopFeature,
  WEEKDAY_LABELS,
  WEEKDAYS,
  Weekday,
} from '@/types';

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

interface DayInput {
  closed: boolean;
  open: string;
  close: string;
}

const defaultDay: DayInput = { closed: false, open: '11:00', close: '22:00' };

export function AddShopScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();

  const [name, setName] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [geoResults, setGeoResults] = useState<GeocodingResult[]>([]);
  const [selected, setSelected] = useState<GeocodingResult | null>(null);
  const [features, setFeatures] = useState<Set<ShopFeature>>(new Set());
  const [days, setDays] = useState<Record<Weekday, DayInput>>(
    Object.fromEntries(WEEKDAYS.map((d) => [d, { ...defaultDay }])) as Record<Weekday, DayInput>
  );
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (!addressQuery.trim()) return;
    setSearching(true);
    setSelected(null);
    try {
      const results = await geocodeAddress(addressQuery.trim());
      setGeoResults(results);
      if (results.length === 0) {
        Alert.alert('Nichts gefunden', 'Versuche es mit einer genaueren Adresse.');
      }
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Adresssuche fehlgeschlagen');
    } finally {
      setSearching(false);
    }
  };

  const toggleFeature = (f: ShopFeature) => {
    setFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const setDay = (day: Weekday, patch: Partial<DayInput>) =>
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('Fehler', 'Bitte einen Namen für den Laden angeben.');
      return;
    }
    if (!selected) {
      Alert.alert('Fehler', 'Bitte eine Adresse suchen und auswählen.');
      return;
    }
    for (const day of WEEKDAYS) {
      const d = days[day];
      if (!d.closed && (!TIME_PATTERN.test(d.open) || !TIME_PATTERN.test(d.close))) {
        Alert.alert(
          'Fehler',
          `Ungültige Öffnungszeit am ${WEEKDAY_LABELS[day]}. Format: HH:MM, z. B. 11:00.`
        );
        return;
      }
    }

    const opening_hours: OpeningHours = {};
    for (const day of WEEKDAYS) {
      const d = days[day];
      if (!d.closed) opening_hours[day] = { open: d.open, close: d.close };
    }

    setBusy(true);
    try {
      await createShop(
        {
          name: name.trim(),
          address: selected.displayName,
          latitude: selected.latitude,
          longitude: selected.longitude,
          opening_hours,
          features: [...features],
        },
        user.id
      );
      Alert.alert('Gespeichert', 'Der Dönerladen wurde angelegt.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
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
      <TextField label="Name des Ladens" value={name} onChangeText={setName} placeholder="z. B. Dönerbude Ali" />

      <TextField
        label="Adresse"
        value={addressQuery}
        onChangeText={setAddressQuery}
        placeholder="Straße Hausnummer, Stadt"
        onSubmitEditing={search}
        returnKeyType="search"
      />
      <Button title="Adresse suchen" onPress={search} variant="secondary" loading={searching} />

      {geoResults.map((r) => {
        const isSelected = selected?.displayName === r.displayName;
        return (
          <Pressable
            key={r.displayName}
            onPress={() => setSelected(r)}
            style={[
              styles.geoResult,
              {
                backgroundColor: isSelected ? theme.colors.surfaceVariant : theme.colors.surface,
                borderColor: isSelected ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <Text style={{ color: theme.colors.text }}>
              {isSelected ? '✓ ' : ''}
              {r.displayName}
            </Text>
          </Pressable>
        );
      })}

      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Besonderheiten</Text>
      <View style={styles.featureWrap}>
        {SHOP_FEATURES.map((f) => {
          const active = features.has(f);
          return (
            <Pressable
              key={f}
              onPress={() => toggleFeature(f)}
              style={[
                styles.featureChip,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <Text style={{ color: active ? theme.colors.onPrimary : theme.colors.text }}>
                {SHOP_FEATURE_ICONS[f]} {SHOP_FEATURE_LABELS[f]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Öffnungszeiten</Text>
      {WEEKDAYS.map((day) => {
        const d = days[day];
        return (
          <View
            key={day}
            style={[
              styles.dayRow,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.dayHeader}>
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                {WEEKDAY_LABELS[day]}
              </Text>
              <View style={styles.closedSwitch}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Geöffnet</Text>
                <Switch
                  value={!d.closed}
                  onValueChange={(v) => setDay(day, { closed: !v })}
                  trackColor={{ true: theme.colors.primary }}
                />
              </View>
            </View>
            {!d.closed ? (
              <View style={styles.timeRow}>
                <TextField
                  value={d.open}
                  onChangeText={(t) => setDay(day, { open: t })}
                  placeholder="11:00"
                  keyboardType="numbers-and-punctuation"
                  style={styles.timeInput}
                />
                <Text style={{ color: theme.colors.textSecondary }}>bis</Text>
                <TextField
                  value={d.close}
                  onChangeText={(t) => setDay(day, { close: t })}
                  placeholder="22:00"
                  keyboardType="numbers-and-punctuation"
                  style={styles.timeInput}
                />
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={styles.spacer} />
      <Button title="Laden anlegen" onPress={submit} loading={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  closedSwitch: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  content: { padding: 20, paddingBottom: 48 },
  dayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayRow: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  featureChip: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  featureWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  geoResult: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    padding: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10, marginTop: 24 },
  spacer: { height: 12 },
  timeInput: { textAlign: 'center', width: 90 },
  timeRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 8 },
});
