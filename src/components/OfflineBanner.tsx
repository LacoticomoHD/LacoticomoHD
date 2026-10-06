import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/i18n/I18nContext';
import { useOffline } from '@/lib/offline';
import { useTheme } from '@/theme/ThemeContext';

/** Hinweis, solange kein Netz da ist und gespeicherte Daten angezeigt werden. */
export function OfflineBanner({ floating }: { floating?: boolean }) {
  const offline = useOffline();
  const { theme } = useTheme();
  const { t } = useI18n();
  if (!offline) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        floating ? styles.floating : null,
        { backgroundColor: theme.colors.warning, shadowColor: '#000' },
      ]}
    >
      <Icon name="wifi-off" size={15} color={theme.dark ? '#2A1A00' : '#FFFFFF'} />
      <Text style={{ color: theme.dark ? '#2A1A00' : '#FFFFFF', flex: 1, fontSize: 12.5, fontWeight: '700' }}>
        {t('offline.banner')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  floating: { elevation: 4, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8 },
});
