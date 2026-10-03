import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n/I18nContext';
import { useFilters } from '@/lib/FilterContext';
import { useTheme } from '@/theme/ThemeContext';
import { SHOP_FEATURES } from '@/types';
import { Icon, type IconName } from '@/components/Icon';
import { Text } from '@/components/AppText';

/** Horizontale Chip-Leiste: "Jetzt geöffnet" + Besonderheiten-Filter.
 *  Wird auf Karte und Liste gleichermaßen genutzt (gemeinsamer Zustand). */
export function FilterBar() {
  const { theme } = useTheme();
  const { t, featureLabel } = useI18n();
  const {
    activeFeatures,
    openNowOnly,
    cardPaymentOnly,
    menuOnly,
    toggleFeature,
    toggleOpenNow,
    toggleCardPayment,
    toggleMenu,
  } = useFilters();

  const Chip = ({
    active,
    onPress,
    icon,
    label,
  }: {
    active: boolean;
    onPress: () => void;
    icon?: IconName;
    label: string;
  }) => {
    const color = active ? theme.colors.onPrimary : theme.colors.text;
    const inner = (
      <>
        {icon ? <Icon name={icon} size={15} color={color} /> : null}
        <Text style={[styles.chipText, { color }]}>{label}</Text>
      </>
    );
    return (
      <Pressable onPress={onPress} style={styles.chipWrap}>
        {active ? (
          <LinearGradient
            colors={theme.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.chip, styles.chipActive, { shadowColor: theme.glow }]}
          >
            {inner}
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.chip,
              Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px)' } as object) : null,
              {
                backgroundColor: theme.colors.overlay,
                borderColor: theme.colors.overlayBorder,
                borderWidth: 1,
              },
            ]}
          >
            {inner}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={styles.content}
    >
      <Chip active={openNowOnly} onPress={toggleOpenNow} icon="clock" label={t('common.openNow')} />
      <Chip
        active={cardPaymentOnly}
        onPress={toggleCardPayment}
        icon="credit-card"
        label={t('filter.cardPayment')}
      />
      <Chip active={menuOnly} onPress={toggleMenu} icon="coffee" label={t('filter.menu')} />
      {SHOP_FEATURES.map((f) => (
        <Chip
          key={f}
          active={activeFeatures.includes(f)}
          onPress={() => toggleFeature(f)}
          label={featureLabel(f)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Exakt 56px hoch, direkt unter dem Suchfeld. Wichtig: RN-ScrollViews haben
  // von Haus aus flexGrow:1 UND flexShrink:1 – ohne beides explizit auf 0 wird
  // die Leiste je nach Platz abgeschnitten (geschrumpft) oder es entstehen
  // riesige Lücken (gewachsen, Höhe zählt nur als Startwert).
  bar: { flexGrow: 0, flexShrink: 0, height: 56 },
  chip: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 6,
    height: 40,
    paddingHorizontal: 15,
  },
  chipActive: {
    elevation: 5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  chipText: { fontSize: 13.5, fontWeight: '600' },
  chipWrap: { marginRight: 8 },
  content: { alignItems: 'center', paddingHorizontal: 12 },
});
