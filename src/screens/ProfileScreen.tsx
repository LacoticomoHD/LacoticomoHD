import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '@/components/Button';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useI18n } from '@/i18n/I18nContext';
import { deleteOwnAccount, fetchIsAdmin, fetchMyRatings } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import type { RootStackParamList } from '@/navigation/types';
import { ThemeMode, useTheme } from '@/theme/ThemeContext';
import { RatingWithShop } from '@/types';

/** Döner-Pass: Abzeichen nach Anzahl bewerteter Läden (Schwellen + Übersetzungsschlüssel). */
const BADGES = [
  { min: 100, key: 'profile.badgeGold' },
  { min: 25, key: 'profile.badgeSilver' },
  { min: 5, key: 'profile.badgeBronze' },
] as const;

function badgeInfo(count: number): { currentKey: string | null; nextKey: string | null; missing: number } {
  const current = BADGES.find((b) => count >= b.min) ?? null;
  const next = [...BADGES].reverse().find((b) => count < b.min) ?? null;
  return { currentKey: current?.key ?? null, nextKey: next?.key ?? null, missing: next ? next.min - count : 0 };
}

export function ProfileScreen() {
  const { theme, mode, setMode } = useTheme();
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [deleting, setDeleting] = useState(false);
  const [myRatings, setMyRatings] = useState<RatingWithShop[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      fetchMyRatings(user.id).then(setMyRatings).catch(() => {});
      fetchIsAdmin(user.id).then(setIsAdmin);
    }, [user])
  );

  const cityCount = new Set(
    myRatings.map((r) => r.shops?.city).filter((c): c is string => Boolean(c))
  ).size;
  const badge = badgeInfo(myRatings.length);

  const MODES: { key: ThemeMode; label: string }[] = [
    { key: 'system', label: t('profile.themeSystem') },
    { key: 'light', label: t('profile.themeLight') },
    { key: 'dark', label: t('profile.themeDark') },
  ];

  const confirmSignOut = () =>
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => signOut() },
    ]);

  const confirmDeleteAccount = () =>
    Alert.alert(t('profile.deleteConfirmTitle'), t('profile.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteConfirmYes'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteOwnAccount();
            await signOut();
          } catch (e) {
            Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <View
        style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {t('profile.account')}
        </Text>
        {user ? (
          <>
            <Text style={{ color: theme.colors.textSecondary }}>{t('profile.loggedInAs')}</Text>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600', marginTop: 2 }}>
              {user.email}
            </Text>
          </>
        ) : (
          <>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 12 }}>
              {t('profile.guestHint')}
            </Text>
            <Button title={t('profile.guestLogin')} onPress={() => navigation.navigate('Auth')} />
          </>
        )}
      </View>

      <View
        style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {t('profile.language')}
        </Text>
        <LanguagePicker />
      </View>

      <View
        style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {t('profile.appearance')}
        </Text>
        <View style={styles.modeRow}>
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMode(m.key)}
                style={[
                  styles.modeChip,
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.surfaceVariant,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? theme.colors.onPrimary : theme.colors.text,
                    fontWeight: '600',
                  }}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {t('profile.about')}
        </Text>
        <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>
          {t('profile.aboutText')}
        </Text>
      </View>

      {user ? (
      <View
        style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('profile.pass')}</Text>
        <View style={styles.passRow}>
          <View style={styles.passStat}>
            <Text style={[styles.passNumber, { color: theme.colors.primary }]}>
              {myRatings.length}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
              {myRatings.length === 1 ? t('profile.passShop') : t('profile.passShops')}
            </Text>
          </View>
          <View style={styles.passStat}>
            <Text style={[styles.passNumber, { color: theme.colors.primary }]}>{cityCount}</Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
              {cityCount === 1 ? t('profile.passCity') : t('profile.passCities')}
            </Text>
          </View>
        </View>
        <Text style={{ color: theme.colors.text, marginTop: 10 }}>
          {badge.currentKey ? t(badge.currentKey) : t('profile.noBadge')}
          {badge.nextKey
            ? t('profile.badgeProgress', {
                n: `${badge.missing} ${
                  badge.missing === 1 ? t('profile.ratingWord') : t('profile.ratingsWord')
                }`,
                next: t(badge.nextKey),
              })
            : badge.currentKey
              ? t('profile.badgeMax')
              : ''}
        </Text>
      </View>
      ) : null}

      {isAdmin ? (
        <Pressable
          onPress={() => navigation.navigate('ReportsInbox')}
          style={[
            styles.legalLink,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
            {t('profile.reportsAdmin')}
          </Text>
          <Text style={{ color: theme.colors.textSecondary }}>›</Text>
        </Pressable>
      ) : null}

      {user ? (
      <>
      <Pressable
        onPress={() => navigation.navigate('Favorites')}
        style={[
          styles.legalLink,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{t('profile.favorites')}</Text>
        <Text style={{ color: theme.colors.textSecondary }}>›</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('MyRatings')}
        style={[
          styles.legalLink,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{t('profile.myRatings')}</Text>
        <Text style={{ color: theme.colors.textSecondary }}>›</Text>
      </Pressable>
      </>
      ) : null}

      <Pressable
        onPress={() => navigation.navigate('Legal')}
        style={[
          styles.legalLink,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{t('profile.legal')}</Text>
        <Text style={{ color: theme.colors.textSecondary }}>›</Text>
      </Pressable>

      {user ? (
        <>
          <Button title={t('profile.logout')} onPress={confirmSignOut} variant="danger" />

          <Pressable onPress={confirmDeleteAccount} disabled={deleting} style={styles.deleteLink}>
            <Text style={{ color: theme.colors.danger, fontSize: 13 }}>
              {deleting ? t('profile.deleting') : t('profile.deleteAccount')}
            </Text>
          </Pressable>
        </>
      ) : null}
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
  deleteLink: { alignSelf: 'center', marginTop: 20, padding: 4 },
  legalLink: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 16,
  },
  modeChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  modeRow: { flexDirection: 'row', gap: 10 },
  passNumber: { fontSize: 28, fontWeight: '800' },
  passRow: { flexDirection: 'row', gap: 24 },
  passStat: { alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
});
