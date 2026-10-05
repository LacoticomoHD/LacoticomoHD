import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { Text } from '@/components/AppText';

const MIN_LENGTH = 6;

/** Wird angezeigt, wenn der Nutzer über den Link aus der
 *  „Passwort vergessen"-Mail kommt: neues Passwort setzen. */
export function ResetPasswordScreen() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password.length < MIN_LENGTH) {
      Alert.alert(t('common.error'), t('reset.tooShort', { n: MIN_LENGTH }));
      return;
    }
    if (password !== repeat) {
      Alert.alert(t('common.error'), t('reset.mismatch'));
      return;
    }
    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) {
      Alert.alert(t('common.error'), error);
      return;
    }
    Alert.alert(t('reset.doneTitle'), t('reset.doneBody'));
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      // Auch auf Android: Im Randlos-Modus schiebt das System den Inhalt nicht mehr hoch.
        behavior="padding"
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Image source={APP_ICON} style={[styles.logo, { shadowColor: theme.glow }]} />
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('reset.title')}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {t('reset.subtitle')}
        </Text>

        <TextField
          label={t('reset.newPassword')}
          value={password}
          onChangeText={setPassword}
          isPassword
          autoCapitalize="none"
          textContentType="newPassword"
        />
        <TextField
          label={t('reset.repeatPassword')}
          value={repeat}
          onChangeText={setRepeat}
          isPassword
          autoCapitalize="none"
          textContentType="newPassword"
          onSubmitEditing={submit}
        />

        <View style={styles.spacer} />
        <Button title={t('reset.save')} onPress={submit} loading={busy} />
        <View style={styles.spacer} />
        <Button title={t('reset.cancel')} onPress={signOut} variant="secondary" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Das App-Icon (Neon-Spieß) als Logo – gleiche Optik wie auf dem Startbildschirm.
const APP_ICON = require('../../assets/icon.png');

const styles = StyleSheet.create({
  content: { justifyContent: 'center', padding: 24, paddingTop: 60 },
  flex: { flex: 1 },
  logo: {
    alignSelf: 'center',
    borderRadius: 20,
    height: 80,
    marginBottom: 6,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    width: 80,
  },
  spacer: { height: 12 },
  subtitle: { fontSize: 14, marginBottom: 24, textAlign: 'center' },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
});
