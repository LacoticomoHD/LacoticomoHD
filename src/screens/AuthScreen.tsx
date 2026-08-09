import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { LanguagePicker } from '@/components/LanguagePicker';
import { TextField } from '@/components/TextField';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/lib/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeContext';

export function AuthScreen() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { signIn, signUp, resetPassword, session } = useAuth();
  const navigation = useNavigation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Wurde die Anmeldung als Overlay geöffnet (Gast wollte etwas bewerten),
  // schließt sie sich nach erfolgreichem Login automatisch wieder.
  const canClose = navigation.canGoBack();
  useEffect(() => {
    if (session && canClose) navigation.goBack();
  }, [session, canClose, navigation]);

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert(t('auth.errorTitle'), t('auth.fillBoth'));
      return;
    }
    setBusy(true);
    const { error } =
      mode === 'login'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    setBusy(false);
    if (error) {
      Alert.alert(t('auth.errorTitle'), error);
    } else if (mode === 'register') {
      Alert.alert(t('auth.registerOkTitle'), t('auth.registerOkBody'));
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t('auth.errorTitle'), t('auth.enterEmailFirst'));
      return;
    }
    const { error } = await resetPassword(email.trim());
    Alert.alert(
      error ? t('auth.errorTitle') : t('auth.resetSentTitle'),
      error ?? t('auth.resetSentBody')
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
            {t('auth.tagline')}
          </Text>

          <View style={styles.langWrap}>
            <LanguagePicker />
          </View>

          {!isSupabaseConfigured ? (
            <Text style={[styles.demoBanner, { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.textSecondary }]}>
              {t('auth.demoBanner')}
            </Text>
          ) : null}

          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="du@beispiel.de"
          />
          <TextField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            isPassword
            placeholder="••••••••"
          />

          <Button
            title={mode === 'login' ? t('auth.login') : t('auth.createAccount')}
            onPress={submit}
            loading={busy}
          />

          <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
            <Text style={[styles.switchText, { color: theme.colors.primary }]}>
              {mode === 'login' ? t('auth.toRegister') : t('auth.toLogin')}
            </Text>
          </Pressable>

          {mode === 'login' ? (
            <Pressable onPress={forgotPassword}>
              <Text style={[styles.forgotText, { color: theme.colors.textSecondary }]}>
                {t('auth.forgot')}
              </Text>
            </Pressable>
          ) : null}

          {canClose ? (
            <Pressable onPress={() => navigation.goBack()}>
              <Text style={[styles.forgotText, { color: theme.colors.textSecondary }]}>
                {t('auth.continueAsGuest')}
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
  demoBanner: {
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
    padding: 12,
  },
  flex: { flex: 1 },
  forgotText: { fontSize: 14, marginTop: 12, textAlign: 'center' },
  langWrap: { marginBottom: 24 },
  logo: { fontSize: 64, textAlign: 'center' },
  safe: { flex: 1 },
  subtitle: { fontSize: 15, marginBottom: 32, textAlign: 'center' },
  switchText: { fontSize: 15, fontWeight: '600', marginTop: 20, textAlign: 'center' },
  title: { fontSize: 34, fontWeight: '800', marginTop: 8, textAlign: 'center' },
});
