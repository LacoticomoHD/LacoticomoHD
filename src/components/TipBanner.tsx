import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from '@/theme/ThemeContext';

/** Einmaliger Tipp, der nach „Verstanden" nie wieder erscheint. */
export function TipBanner({ id, icon, text }: { id: string; icon: IconName; text: string }) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const key = `dd.tip.${id}`;
  const [show, setShow] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((v) => setShow(v == null))
      .catch(() => {});
  }, [key]);
  if (!show) return null;
  const c = theme.colors;
  return (
    <View style={[styles.box, { backgroundColor: c.surfaceVariant, borderColor: c.border }]}>
      <Icon name={icon} size={18} color={c.primary} />
      <Text style={{ color: c.text, flex: 1, fontSize: 13, lineHeight: 18 }}>{text}</Text>
      <Pressable
        onPress={() => {
          setShow(false);
          AsyncStorage.setItem(key, '1').catch(() => {});
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('tip.ok')}
      >
        <Text style={{ color: c.primary, fontSize: 13, fontWeight: '700' }}>{t('tip.ok')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
});
