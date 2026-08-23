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
