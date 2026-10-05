# Umgebung nach einem Reset wiederherstellen

Wird die Arbeitsumgebung neu aufgesetzt, fehlen alle Dateien, die nicht im Git
liegen: `node_modules/`, `android/`, `dist/` und vor allem **`.env`**.

## Reihenfolge

1. **Quellcode holen**

   ```bash
   git fetch origin <branch> && git checkout -B <branch> origin/<branch>
   npm install
   ```

2. **`.env` wiederherstellen** – sonst baut die App im Demo-Modus, also **ohne
   Datenbank und ohne Karte**. Zwei Wege:

   - Werte aus dem Supabase-Dashboard und MapTiler-Konto neu holen, oder
   - aus dem zuletzt veröffentlichten Bundle auslesen:

     ```bash
     git fetch origin gh-pages
     JS=$(git show origin/gh-pages:index.html | grep -o 'index-[a-f0-9]*\.js' | head -1)
     git show origin/gh-pages:_expo/static/js/web/$JS > /tmp/prev.js
     grep -oE 'https://[a-z]+\.supabase\.co' /tmp/prev.js | head -1
     grep -oE 'sb_publishable_[A-Za-z0-9_-]+'  /tmp/prev.js | head -1
     grep -oE 'https://api\.maptiler\.com/[^"]+' /tmp/prev.js | head -1
     ```

3. **Vor jedem Deployment prüfen**, dass die Zugangsdaten wirklich im Build sind:

   ```bash
   B=$(ls dist/_expo/static/js/web/index-*.js)
   grep -c supabase.co "$B"        # muss > 0 sein
   grep -c sb_publishable_ "$B"    # muss > 0 sein
   ```

## Fallstricke

- **Metro baut aus dem Zwischenspeicher.** Änderungen an `.env` oder am Code
  können sonst unbemerkt fehlen – erkennbar am unveränderten Bundle-Namen.
  Abhilfe: `rm -rf /tmp/metro-* node_modules/.cache .expo` und
  `npx expo export --platform web --clear`.
- **Umlaute täuschen bei Stichproben.** Im Bundle werden sie kodiert, `grep`
  findet „Menü-Angebot" nicht. Immer mit reinen ASCII-Textstellen prüfen.
- **Android-Signaturschlüssel** (`android/app/dondoener-release.keystore`) liegt
  ebenfalls außerhalb von Git. Ohne ihn lässt sich keine Update-fähige APK
  bauen – Sicherungskopie bereithalten (siehe `docs/RELEASE-SIGNATUR.md`).

## Android-APK nach einem Reset bauen

1. Android-SDK installieren (Kommandozeilen-Werkzeuge nach
   `/opt/android-sdk/cmdline-tools/latest`, dann
   `sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"`).
2. `npx expo prebuild --platform android --clean` – erzeugt `android/` neu.
   Versionsname und -nummer kommen aus `app.json` (`version`,
   `android.versionCode`); die Nummer bei jeder Veröffentlichung erhöhen.
3. In `android/app/build.gradle` unter `signingConfigs` einen Block `release`
   ergänzen, der die `DONDOENER_*`-Werte aus `gradle.properties` liest, und
   im `buildTypes.release` `signingConfig signingConfigs.release` setzen
   (siehe `docs/RELEASE-SIGNATUR.md`).
4. In `android/gradle.properties` `expo.useLegacyPackaging=true` setzen –
   sonst wird die APK fast doppelt so groß (38 statt 19 MB).
5. `echo "sdk.dir=/opt/android-sdk" > android/local.properties`, dann
   `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`.
6. Signatur prüfen: `apksigner verify --print-certs app-release.apk` muss
   `CN=Don Doener` zeigen.

## Web-App veröffentlichen

`npx expo export --platform web --clear`, dann in `dist/index.html` vor
`</head>` die PWA-Angaben (Manifest, `theme-color`, Apple-Touch-Icon,
`*-web-app-capable`) einfügen, `dist/404.html` als Kopie davon anlegen,
`dist/.nojekyll` erzeugen und den Ordner als neuen Commit auf `gh-pages`
legen (die Datei `don-doener-latest.apk` aus dem vorigen Stand übernehmen).

## Automatischer Öffnungszeiten-Abgleich (OSM)

- Supabase-Funktion `osm-hours-sync` (Quelltext: `supabase/functions/osm-hours-sync/`),
  aufgerufen stündlich per `pg_cron` (Job `osm-hours-sync`).
- Pro Lauf eine von 54 Rechteck-Kacheln über Deutschland; die Kachel mit dem
  ältesten erfolgreichen Abgleich ist zuerst dran – Fehlschläge holen sich so
  selbst nach.
- Es werden **nur leere** Öffnungszeiten befüllt (SQL `apply_osm_hours`:
  gleicher Name im Umkreis von ~60 m bzw. ohne Namen ~20 m). Von Nutzern
  eingetragene Zeiten werden nie überschrieben.
- Protokoll: Tabelle `osm_sync_log` (nur mit Admin-/Service-Zugang lesbar).
- Bekannt: `overpass-api.de` lehnt Anfragen aus Supabase-Funktionen mit 406 ab;
  die Funktion weicht auf `overpass.kumi.systems` und `overpass.private.coffee` aus.
