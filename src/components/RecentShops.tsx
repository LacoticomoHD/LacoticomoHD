import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/i18n/I18nContext';
import { tapLight } from '@/lib/haptics';
import { useRecentShops } from '@/lib/recentShops';
import { useTheme } from '@/theme/ThemeContext';

interface Props {
  onSelect: (shopId: string) => void;
  /** Hintergrund wie die Overlays auf der Karte (Glas-Optik). */
  overlay?: boolean;
}

/** „Zuletzt angesehen": die letzten 5 geöffneten Läden als Chips. */
export function RecentShops({ onSelect, overlay }: Props) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { recent, clear } = useRecentShops();
  if (recent.length === 0) return null;
  const c = theme.colors;
  return (
    <View
      style={[
        styles.wrap,
        overlay
          ? [styles.overlay, { backgroundColor: c.overlay, borderColor: c.overlayBorder, shadowColor: theme.dark ? '#000' : theme.glow }]
          : null,
      ]}
    >
      <View style={styles.header}>
        <Icon name="clock" size={13} color={c.textSecondary} />
        <Text style={[styles.title, { color: c.textSecondary }]}>{t('recent.title')}</Text>
        <Pressable onPress={clear} hitSlop={8}>
          <Text style={{ color: c.primary, fontSize: 12.5, fontWeight: '600' }}>{t('recent.clear')}</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}
      >
        {recent.map((s) => (
          <Pressable
            key={s.id}
            onPressIn={tapLight}
            onPress={() => onSelect(s.id)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={{ color: c.text, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>
              {s.name}
            </Text>
            {s.city ? (
              <Text style={{ color: c.textSecondary, fontSize: 11.5 }} numberOfLines={1}>
                {s.city}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 16, borderWidth: 1, maxWidth: 190, paddingHorizontal: 13, paddingVertical: 8 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 6, marginBottom: 8, paddingHorizontal: 16 },
  overlay: {
    borderRadius: 22,
    borderWidth: 1,
    elevation: 6,
    marginHorizontal: 12,
    marginTop: 6,
    paddingTop: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  row: { gap: 8, paddingBottom: 12, paddingHorizontal: 16 },
  title: { flex: 1, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  wrap: {},
});
