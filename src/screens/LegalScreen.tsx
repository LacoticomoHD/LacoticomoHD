import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';

// WICHTIG: Vor der Veröffentlichung die [Platzhalter] mit echten Angaben füllen!
// Ein Impressum mit ladungsfähiger Anschrift ist in Deutschland Pflicht (§ 5 DDG),
// die Datenschutzerklärung nach DSGVO ebenso.

const IMPRESSUM = `[Vor- und Nachname bzw. Firma]
[Straße und Hausnummer]
[PLZ und Ort]
Deutschland

E-Mail: [deine Kontakt-E-Mail]

Verantwortlich für den Inhalt: [Vor- und Nachname]`;

const DATENSCHUTZ = [
  {
    title: '1. Verantwortlicher',
    text: 'Verantwortlich für die Datenverarbeitung in dieser App ist die im Impressum genannte Person. Bei Fragen zum Datenschutz erreichst du uns unter der dort angegebenen E-Mail-Adresse.',
  },
  {
    title: '2. Welche Daten wir verarbeiten',
    text: 'Konto: Beim Registrieren speichern wir deine E-Mail-Adresse und ein verschlüsseltes Passwort. Bewertungen: Deine Sternebewertungen werden mit deinem Konto verknüpft gespeichert; anderen Nutzern werden nur anonyme Durchschnittswerte angezeigt. Meldungen: Meldest du einen fehlerhaften Eintrag, speichern wir Grund und optionale Details.',
  },
  {
    title: '3. Standort',
    text: 'Dein Standort wird nur mit deiner ausdrücklichen Freigabe verwendet, um die Karte auf deine Umgebung zu zentrieren. Er wird ausschließlich lokal auf deinem Gerät verarbeitet und niemals an unsere Server übertragen oder gespeichert.',
  },
  {
    title: '4. Hosting und Drittanbieter',
    text: 'Die Daten liegen bei Supabase (Datenbank und Login). Die Karte lädt Kartenkacheln von OpenStreetMap-Servern, die Adresssuche nutzt Nominatim (OpenStreetMap); dabei wird technisch bedingt deine IP-Adresse an diese Dienste übertragen. Kartendaten © OpenStreetMap-Mitwirkende.',
  },
  {
    title: '5. Deine Rechte',
    text: 'Du hast das Recht auf Auskunft, Berichtigung und Löschung deiner Daten (Art. 15–17 DSGVO). Dein Konto kannst du jederzeit direkt in der App unter Profil → Konto löschen entfernen; dabei werden dein Konto und alle deine Bewertungen unwiderruflich gelöscht. Von dir eingetragene Läden bleiben ohne Personenbezug als Community-Daten erhalten.',
  },
  {
    title: '6. Speicherdauer',
    text: 'Wir speichern deine Daten, solange dein Konto besteht. Nach der Kontolöschung werden personenbezogene Daten unverzüglich entfernt.',
  },
];

export function LegalScreen() {
  const { theme } = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <View
        style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Impressum</Text>
        <Text style={{ color: theme.colors.text, lineHeight: 22 }}>{IMPRESSUM}</Text>
      </View>

      <View
        style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Datenschutzerklärung
        </Text>
        {DATENSCHUTZ.map((section) => (
          <View key={section.title} style={styles.paragraph}>
            <Text style={{ color: theme.colors.text, fontWeight: '700', marginBottom: 4 }}>
              {section.title}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>
              {section.text}
            </Text>
          </View>
        ))}
      </View>
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
  paragraph: { marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
});
