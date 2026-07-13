import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import {
  createShop,
  fetchShop,
  fetchShopsInBounds,
  geocodeAddress,
  GeocodingResult,
  updateShop,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { distanceKm } from '@/lib/geo';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { OpeningHours, ShopFeature, WEEKDAY_LABELS, WEEKDAYS, Weekday } from '@/types';

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

interface DayInput {
  closed: boolean;
  open: string;
  close: string;
}

const defaultDay: DayInput = { closed: false, open: '11:00', close: '22:00' };

function emptyDays(): Record<Weekday, DayInput> {
  return Object.fromEntries(WEEKDAYS.map((d) => [d, { ...defaultDay }])) as Record<
    Weekday,
    DayInput
  >;
}

/** Vergleichsform für den Duplikat-Check: klein, ohne Sonderzeichen/Leerzeichen. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-zäöüß0-9]/g, '');
}

/** Formular für "Laden anlegen" (Route AddShop) und "Laden bearbeiten" (Route EditShop). */
export function ShopFormScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, 'AddShop' | 'EditShop'>>();
  const navigation = useNavigation();
  const editShopId = route.name === 'EditShop' ? route.params?.shopId ?? null : null;

  const [loading, setLoading] = useState(editShopId != null);
  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [geoResults, setGeoResults] = useState<GeocodingResult[]>([]);
  const [selected, setSelected] = useState<GeocodingResult | null>(null);
  // Besonderheiten werden nicht mehr hier gepflegt, sondern von der Community
  // beim Bewerten abgestimmt. Bestehende Werte bleiben beim Bearbeiten unangetastet.
  const [features, setFeatures] = useState<ShopFeature[]>([]);
  const [days, setDays] = useState<Record<Weekday, DayInput>>(emptyDays());
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);

  // Im Bearbeiten-Modus die bestehenden Werte laden.
  useEffect(() => {
    if (!editShopId) return;
    fetchShop(editShopId)
      .then((shop) => {
        setName(shop.name);
        setPriceText(shop.doener_preis != null ? shop.doener_preis.toFixed(2).replace('.', ',') : '');
        setAddressQuery(shop.address);
        setSelected({
          displayName: shop.address,
          latitude: shop.latitude,
          longitude: shop.longitude,
          city: shop.city,
        });
        setFeatures(shop.features ?? []);
        const nextDays = emptyDays();
        for (const day of WEEKDAYS) {
          const entry = shop.opening_hours?.[day];
          nextDays[day] = entry
            ? { closed: false, open: entry.open, close: entry.close }
            : { ...defaultDay, closed: true };
        }
        setDays(nextDays);
      })
      .catch((e: Error) => Alert.alert('Fehler', e.message))
      .finally(() => setLoading(false));
  }, [editShopId]);

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

  const setDay = (day: Weekday, patch: Partial<DayInput>) =>
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const parsePrice = (): { ok: boolean; value: number | null } => {
    const trimmed = priceText.trim();
    if (!trimmed) return { ok: true, value: null };
    const value = parseFloat(trimmed.replace(',', '.'));
    if (Number.isNaN(value) || value <= 0 || value >= 50) return { ok: false, value: null };
    return { ok: true, value: Math.round(value * 100) / 100 };
  };

  const save = async (input: Parameters<typeof createShop>[0]) => {
    if (!user) return;
    setBusy(true);
    try {
      if (editShopId) {
        await updateShop(editShopId, input);
      } else {
        await createShop(input, user.id);
      }
      Alert.alert(
        'Gespeichert',
        editShopId ? 'Die Änderungen wurden gespeichert.' : 'Der Dönerladen wurde angelegt.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

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
    const price = parsePrice();
    if (!price.ok) {
      Alert.alert('Fehler', 'Ungültiger Dönerpreis. Beispiel: 6,50');
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

    const input = {
      name: name.trim(),
      address: selected.displayName,
      latitude: selected.latitude,
      longitude: selected.longitude,
      opening_hours,
      features,
      doener_preis: price.value,
      city: selected.city,
    };

    // Duplikat-Schutz: gibt es im Umkreis von 150 m schon einen ähnlich benannten Laden?
    if (!editShopId) {
      try {
        const existing = await fetchShopsInBounds({
          minLat: input.latitude - 0.01,
          maxLat: input.latitude + 0.01,
          minLon: input.longitude - 0.015,
          maxLon: input.longitude + 0.015,
        });
        const normalized = normalizeName(input.name);
        const duplicate = existing.find((s) => {
          const near =
            distanceKm(s.latitude, s.longitude, input.latitude, input.longitude) < 0.15;
          const a = normalizeName(s.name);
          const similar = a.includes(normalized) || normalized.includes(a);
          return near && similar;
        });
        if (duplicate) {
          Alert.alert(
            'Möglicherweise schon vorhanden',
            `In der Nähe gibt es bereits „${duplicate.name}" (${duplicate.address}). Trotzdem anlegen?`,
            [
              { text: 'Abbrechen', style: 'cancel' },
              { text: 'Trotzdem anlegen', onPress: () => save(input) },
            ]
          );
          return;
        }
      } catch {
        // Duplikat-Check ist Komfort – bei Fehlern normal weiterspeichern.
      }
    }

    await save(input);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TextField label="Name des Ladens" value={name} onChangeText={setName} placeholder="z. B. Dönerbude Ali" />

      <TextField
        label="Preis Standard-Döner in € (optional)"
        value={priceText}
        onChangeText={setPriceText}
        placeholder="z. B. 6,50"
        keyboardType="decimal-pad"
      />

      <TextField
        label="Adresse"
        value={addressQuery}
        onChangeText={setAddressQuery}
        placeholder="Straße Hausnummer, Stadt"
        onSubmitEditing={search}
        returnKeyType="search"
      />
      <Button title="Adresse suchen" onPress={search} variant="secondary" loading={searching} />
      {selected && geoResults.length === 0 ? (
        <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 6 }}>
          ✓ Aktuelle Adresse: {selected.displayName}
        </Text>
      ) : null}

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

      <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 20 }}>
        💡 Besonderheiten (Soßen, Fleischsorten, vegan …) werden nicht hier eingetragen,
        sondern von der Community beim Bewerten bestätigt.
      </Text>

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
      <Button
        title={editShopId ? 'Änderungen speichern' : 'Laden anlegen'}
        onPress={submit}
        loading={busy}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
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
