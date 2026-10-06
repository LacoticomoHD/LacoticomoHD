import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/i18n/I18nContext';
import { formatDistance, formatPrice, distanceKm } from '@/lib/geo';
import { tapLight, tapSuccess } from '@/lib/haptics';
import { pickRouletteShop, ROULETTE_RADIUS_KM } from '@/lib/roulette';
import { useOpenState } from '@/lib/useOpenState';
import { useTheme } from '@/theme/ThemeContext';
import { ShopWithSummary } from '@/types';

interface Props {
  visible: boolean;
  shops: ShopWithSummary[];
  origin: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onOpen: (shopId: string) => void;
}

/** Döner-Roulette: würfelt einen geöffneten, gut bewerteten Laden in der Nähe aus. */
export function RouletteModal({ visible, shops, origin, onClose, onOpen }: Props) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const c = theme.colors;
  const [pick, setPick] = useState<ShopWithSummary | null>(null);
  const spin = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;

  const roll = useCallback(() => {
    spin.setValue(0);
    pop.setValue(0.85);
    Animated.parallel([
      Animated.timing(spin, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    setPick((prev) => {
      const next = pickRouletteShop(shops, origin, prev?.id);
      if (next) tapSuccess();
      return next;
    });
  }, [shops, origin, spin, pop]);

  useEffect(() => {
    if (visible) roll();
    // Nur beim Öffnen würfeln, nicht bei jedem Nachladen der Karte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, shadowColor: theme.dark ? '#000' : theme.glow }]}
          // Klicks in der Karte nicht zum Hintergrund durchreichen.
          onPress={() => {}}
        >
          <Animated.View style={[styles.dice, { transform: [{ rotate }, { scale: pop }] }]}>
            <LinearGradient colors={theme.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.diceFill}>
              <Icon name="shuffle" size={26} color={c.onPrimary} />
            </LinearGradient>
          </Animated.View>
          <Text style={[styles.overline, { color: c.textSecondary }]}>{t('roulette.title')}</Text>
          {pick ? (
            <PickInfo shop={pick} origin={origin} />
          ) : (
            <Text style={[styles.none, { color: c.textSecondary }]}>
              {t('roulette.none', { km: ROULETTE_RADIUS_KM })}
            </Text>
          )}
          <View style={styles.buttons}>
            {pick ? (
              <Pressable
                onPress={() => {
                  tapLight();
                  onOpen(pick.id);
                }}
                style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.85 : 1 }]}
              >
                <LinearGradient colors={theme.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryFill}>
                  <Text style={{ color: c.onPrimary, fontSize: 15, fontWeight: '800' }}>{t('roulette.go')}</Text>
                </LinearGradient>
              </Pressable>
            ) : null}
            <View style={styles.row}>
              {pick ? (
                <Pressable onPress={roll} style={[styles.secondary, { borderColor: c.border }]}>
                  <Icon name="refresh-cw" size={16} color={c.text} />
                  <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>{t('roulette.again')}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={onClose} style={[styles.secondary, { borderColor: c.border }]}>
                <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>{t('common.close')}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PickInfo({ shop, origin }: { shop: ShopWithSummary; origin: Props['origin'] }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { label, color } = useOpenState(shop.opening_hours);
  const avg = shop.summary?.avg_gesamt;
  const meta = [
    origin ? formatDistance(distanceKm(origin.latitude, origin.longitude, shop.latitude, shop.longitude)) : null,
    shop.doener_preis != null ? formatPrice(shop.doener_preis) : null,
  ].filter(Boolean);
  return (
    <View style={styles.info}>
      <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
        {shop.name}
      </Text>
      <View style={styles.metaRow}>
        {avg != null ? (
          <Text style={{ color: c.star, fontSize: 15, fontWeight: '800' }}>
            ★ <Text style={{ color: c.text }}>{avg.toFixed(1).replace('.', ',')}</Text>
          </Text>
        ) : null}
        <Text style={{ color, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      </View>
      {meta.length > 0 ? (
        <Text style={{ color: c.textSecondary, fontSize: 13.5, marginTop: 4 }}>{meta.join('  ·  ')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', flex: 1, justifyContent: 'center', padding: 24 },
  buttons: { alignSelf: 'stretch', gap: 10, marginTop: 20 },
  card: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    elevation: 10,
    maxWidth: 380,
    padding: 24,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    width: '100%',
  },
  dice: { borderRadius: 22, height: 64, marginBottom: 14, overflow: 'hidden', width: 64 },
  diceFill: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  info: { alignItems: 'center' },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 6 },
  name: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  none: { fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
  overline: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.6, marginBottom: 8, textTransform: 'uppercase' },
  primary: { borderRadius: 24, overflow: 'hidden' },
  primaryFill: { alignItems: 'center', paddingVertical: 14 },
  row: { flexDirection: 'row', gap: 10 },
  secondary: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingVertical: 11,
  },
});
