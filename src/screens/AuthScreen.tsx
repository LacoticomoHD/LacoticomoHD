import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeContext';

export function AuthScreen() {
  const { theme } = useTheme();
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Fehler', 'Bitte E-Mail und Passwort eingeben.');
      return;
    }
    setBusy(true);
    const { error } =
      mode === 'login'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    setBusy(false);
    if (error) {
      Alert.alert('Fehler', error);
    } else if (mode === 'register') {
      Alert.alert(
        'Registrierung erfolgreich',
        'Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach.'
      );
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Hinweis', 'Bitte zuerst deine E-Mail-Adresse eingeben.');
      return;
    }
    const { error } = await resetPassword(email.trim());
    Alert.alert(
      error ? 'Fehler' : 'E-Mail verschickt',
      error ?? 'Wir haben dir einen Link zum Zurücksetzen des Passworts geschickt.'
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>🥙</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Don Döner</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Bewerte die besten Dönerläden deiner Stadt
          </Text>

          <TextField
            label="E-Mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="du@beispiel.de"
          />
          <TextField
            label="Passwort"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />

          <Button
            title={mode === 'login' ? 'Einloggen' : 'Konto erstellen'}
            onPress={submit}
            loading={busy}
          />

          <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
            <Text style={[styles.switchText, { color: theme.colors.primary }]}>
              {mode === 'login'
                ? 'Noch kein Konto? Jetzt registrieren'
                : 'Schon ein Konto? Zum Login'}
            </Text>
          </Pressable>

          {mode === 'login' ? (
            <Pressable onPress={forgotPassword}>
              <Text style={[styles.forgotText, { color: theme.colors.textSecondary }]}>
                Passwort vergessen?
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  flex: { flex: 1 },
  forgotText: { fontSize: 14, marginTop: 12, textAlign: 'center' },
  logo: { fontSize: 64, textAlign: 'center' },
  safe: { flex: 1 },
  subtitle: { fontSize: 15, marginBottom: 32, textAlign: 'center' },
  switchText: { fontSize: 15, fontWeight: '600', marginTop: 20, textAlign: 'center' },
  title: { fontSize: 34, fontWeight: '800', marginTop: 8, textAlign: 'center' },
});
