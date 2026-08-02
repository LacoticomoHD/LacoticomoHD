# Release-Signatur (Android)

Die Release-APK wird mit einem **eigenen Schlüssel** signiert – nicht mehr mit
dem öffentlich bekannten Debug-Schlüssel.

## Wichtig
- Die Schlüsseldatei `dondoener-release.keystore` und die Passwörter liegen
  **bewusst nicht im Git** (der Ordner `android/` ist ohnehin ignoriert).
- **Bewahre die Datei sicher auf.** Geht sie verloren, lassen sich künftige
  Versionen nicht mehr als Update installieren – Nutzer müssten die App
  deinstallieren und neu installieren. Im Google Play Store wäre die App unter
  derselben Kennung gar nicht mehr aktualisierbar.

## Einrichtung auf einem neuen Rechner / nach Neuaufsetzen
1. Schlüsseldatei nach `android/app/dondoener-release.keystore` legen.
2. In `android/gradle.properties` ergänzen (Werte aus der sicheren Ablage):

   ```properties
   DONDOENER_STORE_FILE=dondoener-release.keystore
   DONDOENER_KEY_ALIAS=dondoener
   DONDOENER_STORE_PASSWORD=<Passwort>
   DONDOENER_KEY_PASSWORD=<Passwort>
   ```

3. Bauen:

   ```bash
   cd android
   ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
   ```

Fehlen die Einträge, fällt der Build automatisch auf den Debug-Schlüssel
zurück (siehe `android/app/build.gradle`, `signingConfigs.release`) – die APK
ist dann nur zum Testen geeignet.

## Signatur prüfen

```bash
keytool -printcert -jarfile android/app/build/outputs/apk/release/app-release.apk
```

Beim eigenen Schlüssel steht dort `CN=Don Doener`; beim Debug-Schlüssel
stünde `CN=Android Debug`.

## Neuen Schlüssel erzeugen (nur falls nötig)

```bash
keytool -genkeypair -v \
  -keystore dondoener-release.keystore \
  -alias dondoener \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12
```
