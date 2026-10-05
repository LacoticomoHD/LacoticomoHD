import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/i18n/I18nContext';
import { fetchIsAdmin } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { tapLight, tapSuccess } from '@/lib/haptics';
import {
  deleteShopPhoto,
  fetchShopPhotos,
  pickPhoto,
  reportShopPhoto,
  type ShopPhoto,
  uploadShopPhoto,
} from '@/lib/photos';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useTheme } from '@/theme/ThemeContext';

interface Props {
  shopId: string;
  /** Meldet die geladenen Fotos nach oben (z. B. für das Titelbild). */
  onPhotos?: (photos: ShopPhoto[]) => void;
}

/** Foto-Leiste der Laden-Seite: Fotos ansehen, hinzufügen, melden, löschen. */
export function ShopPhotos({ shopId, onPhotos }: Props) {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<ShopPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<ShopPhoto | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const c = theme.colors;

  const load = useCallback(() => {
    fetchShopPhotos(shopId)
      .then((p) => {
        setPhotos(p);
        onPhotos?.(p);
      })
      .catch(() => {});
  }, [shopId, onPhotos]);

  useEffect(load, [load]);
  useEffect(() => {
    if (user) fetchIsAdmin(user.id).then(setIsAdmin);
  }, [user]);

  const upload = async (source: 'camera' | 'library') => {
    if (!user) return;
    try {
      const picked = await pickPhoto(source);
      if (!picked) return;
      setUploading(true);
      await uploadShopPhoto(shopId, user.id, picked);
      tapSuccess();
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(t('common.error'), msg === 'camera-denied' ? t('photos.cameraDenied') : msg);
    } finally {
      setUploading(false);
    }
  };

  const addPhoto = () => {
    tapLight();
    if (!requireAuth()) return;
    // Im Browser bietet die Dateiauswahl am Handy selbst Kamera oder Galerie an.
    if (Platform.OS === 'web') {
      upload('library');
      return;
    }
    Alert.alert(t('photos.add'), undefined, [
      { text: t('photos.camera'), onPress: () => upload('camera') },
      { text: t('photos.library'), onPress: () => upload('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const remove = (photo: ShopPhoto) => {
    Alert.alert(t('photos.deleteConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('photos.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteShopPhoto(photo);
            setViewer(null);
            load();
          } catch (e) {
            Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  const report = async (photo: ShopPhoto) => {
    if (!requireAuth()) return;
    try {
      await reportShopPhoto(photo.id);
      Alert.alert(t('photos.reportDone'));
      setViewer(null);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
    }
  };

  const dateLocale = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-GB' : 'de-DE';
  const canDelete = (p: ShopPhoto) => user?.id === p.userId || isAdmin;

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.overline, { color: c.textSecondary }]}>{t('photos.title')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        <Pressable
          onPress={addPhoto}
          disabled={uploading}
          accessibilityLabel={t('photos.add')}
          style={[styles.tile, styles.addTile, { borderColor: c.primary, backgroundColor: c.surfaceVariant }]}
        >
          {uploading ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <>
              <Icon name="camera" size={22} color={c.primary} />
              <Text style={{ color: c.primary, fontSize: 11.5, fontWeight: '700' }}>
                {t('photos.addShort')}
              </Text>
            </>
          )}
        </Pressable>
        {photos.map((p) => (
          <Pressable key={p.id} onPress={() => setViewer(p)} style={styles.tile}>
            <Image source={{ uri: p.url }} style={styles.thumb} />
          </Pressable>
        ))}
      </ScrollView>
      {photos.length === 0 && !uploading ? (
        <Text style={{ color: c.textSecondary, fontSize: 12.5, marginTop: 10 }}>
          {t('photos.empty')}
        </Text>
      ) : null}

      <Modal visible={viewer != null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          {viewer ? (
            <>
              <Image source={{ uri: viewer.url }} style={styles.full} resizeMode="contain" />
              <Pressable
                onPress={() => setViewer(null)}
                accessibilityLabel={t('common.close')}
                style={[styles.close, { top: insets.top + 12 }]}
              >
                <Icon name="x" size={24} color="#FFFFFF" />
              </Pressable>
              <View style={[styles.viewerBar, { paddingBottom: insets.bottom + 16 }]}>
                <Text style={{ color: 'rgba(255,255,255,0.75)', flex: 1, fontSize: 13 }}>
                  {new Date(viewer.createdAt).toLocaleDateString(dateLocale)}
                </Text>
                {canDelete(viewer) ? (
                  <Pressable onPress={() => remove(viewer)} style={styles.viewerAction}>
                    <Icon name="trash-2" size={17} color="#FF8A80" />
                    <Text style={{ color: '#FF8A80', fontWeight: '700' }}>{t('photos.delete')}</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => report(viewer)} style={styles.viewerAction}>
                    <Icon name="flag" size={17} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{t('photos.report')}</Text>
                  </Pressable>
                )}
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  addTile: {
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1.5,
    gap: 4,
    justifyContent: 'center',
  },
  card: { borderRadius: 20, borderWidth: 1, marginHorizontal: 16, marginTop: 12, padding: 16 },
  close: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    width: 44,
  },
  full: { flex: 1, width: '100%' },
  overline: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  strip: { gap: 10 },
  thumb: { borderRadius: 14, height: '100%', width: '100%' },
  tile: { borderRadius: 14, height: 96, overflow: 'hidden', width: 96 },
  viewer: { backgroundColor: 'rgba(0,0,0,0.94)', flex: 1 },
  viewerAction: { alignItems: 'center', flexDirection: 'row', gap: 7, padding: 6 },
  viewerBar: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 14,
  },
});
