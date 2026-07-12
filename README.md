# 🥙 Don Döner

**Die App, die nur eines kann – Dönerläden bewerten. Aber das richtig.**

Don Döner ist eine Cross-Platform-App (Android & iOS, gebaut mit [Expo](https://expo.dev) /
React Native), mit der Nutzer Dönerläden objektiv bewerten – mit Kategorien, die es bei
Google-Maps-Rezensionen so nicht gibt.

## Features

- 🗺️ **Karte auf OpenStreetMap-Basis** (keine Google-Maps-Daten) mit allen eingetragenen Läden;
  Marker zeigen grün/rot, ob gerade geöffnet ist
- ⭐ **Bewertung mit 1–5 Sternen** in fünf Kategorien:
  Geschmack, Freundlichkeit, Sauberkeit, Preis-Leistung, Wartezeit
- 🚫 **Bewusst ohne Freitext-Kommentare** – rein objektive Sternebewertung
- 🐄🐔 **Besonderheiten pro Laden**: Kalb, Hähnchen, Vegetarisch, Vegan, Halal, Hausgemachtes Brot
- 🕐 **Öffnungszeiten** pro Wochentag (inkl. „geöffnet über Mitternacht", z. B. 18:00–02:00)
  und Adressanzeige
- ➕ **Läden eintragen** direkt in der App, mit Adresssuche über Nominatim (OpenStreetMap)
- 📋 **Listenansicht** mit Suche und Sortierung nach bester Bewertung
- 🔐 **Login/Registrierung** per E-Mail & Passwort (Supabase Auth), inkl. Passwort-Zurücksetzen
- 🌗 **Hell- und Dunkelmodus** – manuell wählbar oder automatisch nach Systemeinstellung
- ✏️ **Eine Bewertung pro Nutzer und Laden**, jederzeit änderbar (kein Bewertungs-Spam)
- 🔎 **Filter** nach Besonderheiten und „Jetzt geöffnet" – auf Karte und Liste
- 🧭 **Navigation zum Laden** in der System-Karten-App: Auto, zu Fuß, Fahrrad oder ÖPNV
- 💶 **Dönerpreis** pro Laden (optional) – inkl. Meldegrund „falscher Preis"
- 📏 **Entfernungsanzeige** und Sortierung „Nächste zuerst" in der Liste
- ✏️ **Eigene Läden bearbeiten** (Öffnungszeiten, Preis, Besonderheiten …)
- 🛡️ **Duplikat-Warnung** beim Anlegen, wenn in der Nähe schon ein ähnlicher Laden existiert
- ⭐ **„Meine Bewertungen"** im Profil mit Direktzugriff zum Ändern
- 🚩 **Melden-Funktion** für fehlerhafte Einträge (falsche Adresse, geschlossen, Duplikat …)
- 🗑️ **Konto-Selbstlöschung** direkt in der App (Pflicht für den Apple App Store)
- 📄 **Impressum & Datenschutzerklärung** in der App (Platzhalter vor Release ausfüllen!)
- 👑 **Eigenes App-Icon und Splashscreen** (gekrönter Dönerspieß, hell & dunkel)

## Tech-Stack

| Bereich | Technologie |
| --- | --- |
| App | Expo / React Native, TypeScript |
| Karte | `react-native-maps` mit OpenStreetMap-Tiles (`UrlTile`) |
| Geocoding | Nominatim (OpenStreetMap) |
| Backend & Login | Supabase (PostgreSQL, Auth, Row Level Security) |
| Navigation | React Navigation (Stack + Bottom Tabs) |

## Setup

### 1. Supabase-Projekt anlegen

1. Kostenloses Projekt auf [supabase.com](https://supabase.com) erstellen.
2. Im **SQL Editor** den Inhalt von [`supabase/schema.sql`](supabase/schema.sql) ausführen.
   Das legt die Tabellen `shops` und `ratings`, die View `shop_rating_summary` sowie alle
   Row-Level-Security-Regeln an.
3. Unter **Authentication → Providers** ist „Email" standardmäßig aktiv – mehr braucht es nicht.

### 2. App konfigurieren

```bash
cp .env.example .env
# .env öffnen und die Werte aus dem Supabase-Dashboard (Project Settings → API) eintragen
npm install
```

### 3. Starten

```bash
npm start          # Expo Dev Server; QR-Code mit Expo Go (Android/iOS) scannen
npm run android    # direkt auf Android-Gerät/-Emulator
npm run ios        # direkt auf iOS-Simulator (nur macOS)
```

Für Store-Builds (`.aab`/`.ipa`) empfiehlt sich [EAS Build](https://docs.expo.dev/build/introduction/):
`npx eas build --platform all`.

## Datenmodell

- **`shops`** – Name, Adresse, Koordinaten, Öffnungszeiten (JSON pro Wochentag),
  Besonderheiten (`features`-Array), Ersteller.
- **`ratings`** – 5 Kategorien à 1–5 Sterne, `UNIQUE (shop_id, user_id)`:
  pro Nutzer und Laden genau eine Bewertung, Updates überschreiben sie.
- **`shop_rating_summary`** (View) – Durchschnitt pro Kategorie, Gesamtschnitt und Anzahl
  der Bewertungen je Laden.
- **Nutzerkonten** liegen in Supabase Auth (`auth.users`); RLS stellt sicher, dass jeder nur
  seine eigenen Bewertungen und Läden ändern kann.

## Vor dem Store-Release ausfüllen

- **Impressum & Datenschutz**: In `src/screens/LegalScreen.tsx` die `[Platzhalter]` durch
  echte Angaben ersetzen (Name, Anschrift, E-Mail). Ohne vollständiges Impressum keine
  Veröffentlichung in Deutschland!
- **Tile-Anbieter**: `EXPO_PUBLIC_TILE_URL` in `.env` auf einen eigenen Anbieter (z. B.
  MapTiler) setzen – die offiziellen OSM-Server sind nicht für den App-Massenbetrieb gedacht.
- **Bestehende Datenbank aktualisieren**: Wer `schema.sql` schon in einer früheren Version
  eingespielt hat, führt die passenden Upgrade-Skripte in Reihenfolge aus:
  `supabase/upgrade_v1_zu_v2.sql` (Meldungen + Konto-Löschung), dann
  `supabase/upgrade_v2_zu_v3.sql` (Dönerpreis). Frische Datenbanken brauchen nur `schema.sql`.

## Hinweise zu OpenStreetMap

- Die Karte lädt Tiles von `tile.openstreetmap.org`. Die Attribution
  „© OpenStreetMap-Mitwirkende" wird in der App angezeigt (lizenzrechtlich erforderlich).
- Für den Produktivbetrieb mit vielen Nutzern bitte die
  [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) beachten und
  ggf. einen eigenen Tile-Server oder Anbieter (z. B. MapTiler, Thunderforest) verwenden –
  dafür nur die `OSM_TILE_URL` in `src/screens/MapScreen.tsx` austauschen.
- Die Adresssuche nutzt Nominatim (max. 1 Anfrage/Sekunde laut deren Usage Policy).
