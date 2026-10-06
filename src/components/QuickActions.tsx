import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { ShareCardModal } from '@/components/ShareCardModal';
import { useI18n } from '@/i18n/I18nContext';
import { addFavorite, fetchFavoriteIds, removeFavorite } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { openDirections } from '@/lib/directions';
import { tapMedium, tapSelection } from '@/lib/haptics';
import { useRequireAuth } from '@/lib/useRequireAuth';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { ShopWithSummary } from '@/types';

const QuickActionsContext = createContext<(shop: ShopWithSummary) => void>(() => {});

/** Lange auf einen Laden drücken → Schnellmenü (Bewerten, Merken, Route, Teilen). */
export function useQuickActions() {
  return useContext(QuickActionsContext);
}

export function QuickActionsProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { t, featureLabel } = useI18n();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const requireAuth = useRequireAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [shop, setShop] = useState<ShopWithSummary | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [shareShop, setShareShop] = useState<ShopWithSummary | null>(null);
  const c = theme.colors;

  const open = useCallback(
    (s: ShopWithSummary) => {
      tapMedium();
      setShop(s);
      setIsFav(false);
      if (user) fetchFavoriteIds(user.id).then((ids) => setIsFav(ids.has(s.id))).catch(() => {});
    },
    [user]
  );

  const close = () => setShop(null);

  const run = (fn: (s: ShopWithSummary) => void) => () => {
    if (!shop) return;
    const s = shop;
    close();
    fn(s);
  };

  const toggleFav = async () => {
    if (!shop) return;
    if (!requireAuth() || !user) {
      close();
      return;
    }
    const next = !isFav;
    setIsFav(next);
    tapSelection();
    try {
      if (next) await addFavorite(user.id, shop.id);
      else await removeFavorite(user.id, shop.id);
    } catch (e) {
      setIsFav(!next);
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
    }
  };

  const actions: { key: string; icon: IconName; label: string; onPress: () => void; active?: boolean }[] = [
    {
      key: 'rate',
      icon: 'star',
      label: t('detail.act.rate'),
      onPress: run((s) => {
        if (!requireAuth()) return;
        navigation.navigate('RateShop', { shopId: s.id, shopName: s.name, latitude: s.latitude, longitude: s.longitude });
      }),
    },
    { key: 'fav', icon: 'heart', label: isFav ? t('detail.act.saved') : t('detail.act.save'), onPress: toggleFav, active: isFav },
    {
      key: 'route',
      icon: 'navigation',
      label: t('detail.act.route'),
      onPress: run((s) => openDirections(s.latitude, s.longitude, 'driving', s.name)),
    },
    { key: 'share', icon: 'share-2', label: t('detail.act.share'), onPress: run((s) => setShareShop(s)) },
  ];

  return (
    <QuickActionsContext.Provider value={open}>
      {children}
      <Modal visible={shop != null} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={t('common.close')}>
          <Pressable
            onPress={() => {}}
            style={[
              styles.sheet,
              { backgroundColor: c.surface, borderColor: c.border, paddingBottom: 18 + insets.bottom },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: c.border }]} />
            <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
              {shop?.name}
            </Text>
            {shop?.address ? (
              <Text style={{ color: c.textSecondary, fontSize: 13 }} numberOfLines={1}>
                {shop.address}
              </Text>
            ) : null}
            <View style={styles.grid}>
              {actions.map((a) => (
                <Pressable
                  key={a.key}
                  onPress={a.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  style={({ pressed }) => [
                    styles.action,
                    {
                      backgroundColor: a.active ? c.surfaceVariant : c.background,
                      borderColor: a.active ? c.primary : c.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Icon name={a.icon} size={21} color={a.key === 'rate' || a.active ? c.primary : c.text} />
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={run((s) => navigation.navigate('ShopDetail', { shopId: s.id }))}
              accessibilityRole="button"
              style={[styles.detailLink, { borderColor: c.border }]}
            >
              <Text style={{ color: c.text, fontSize: 14.5, fontWeight: '700' }}>{t('quick.details')}</Text>
              <Icon name="chevron-right" size={18} color={c.textSecondary} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      {shareShop ? (
        <ShareCardModal
          visible
          onClose={() => setShareShop(null)}
          data={{
            id: shareShop.id,
            name: shareShop.name,
            city: shareShop.city ?? null,
            avg: shareShop.summary?.avg_gesamt ?? null,
            count: shareShop.summary?.rating_count ?? 0,
            price: shareShop.doener_preis ?? null,
            features: (shareShop.features ?? []).map((f) => featureLabel(f)),
          }}
        />
      ) : null}
    </QuickActionsContext.Provider>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    paddingVertical: 14,
  },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)', flex: 1, justifyContent: 'flex-end' },
  detailLink: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  grid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  handle: { alignSelf: 'center', borderRadius: 3, height: 5, marginBottom: 14, width: 42 },
  name: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginBottom: 2 },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
});
