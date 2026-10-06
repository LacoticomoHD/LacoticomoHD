import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Text } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/i18n/I18nContext';
import { formatPrice } from '@/lib/geo';
import { tapLight, tapSuccess } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeContext';

export interface ShareCardData {
  id: string;
  name: string;
  city: string | null;
  avg: number | null;
  count: number;
  price: number | null;
  features: string[];
}

interface Props {
  visible: boolean;
  data: ShareCardData;
  onClose: () => void;
}

const SHOP_URL = (id: string) => `https://lacoticomohd.github.io/LacoticomoHD/laden/${id}`;

/** Teilen-Dialog mit Vorschau: als Bild (für WhatsApp/Instagram) oder als Link. */
export function ShareCardModal({ visible, data, onClose }: Props) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const c = theme.colors;
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const url = SHOP_URL(data.id);
  const note =
    data.avg != null
      ? t('detail.shareWithRating', { name: data.name, v: data.avg.toFixed(1) })
      : t('detail.sharePlain', { name: data.name });

  const shareImage = async () => {
    if (!cardRef.current || busy) return;
    tapLight();
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        // Im Browser ist die Ref direkt das DOM-Element → html2canvas, 3-fach scharf.
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(cardRef.current as unknown as HTMLElement, {
          backgroundColor: null,
          scale: 3,
          useCORS: true,
        });
        const dataUrl = canvas.toDataURL('image/png');
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `don-doener-${data.id.slice(0, 8)}.png`, { type: 'image/png' });
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        if (nav.canShare?.({ files: [file] })) {
          await nav.share({ files: [file], text: `${note}\n${url}` }).catch(() => {});
        } else {
          // Kein Teilen-Dialog im Browser (z. B. am PC) → Bild herunterladen.
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = file.name;
          a.click();
        }
      } else {
        const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: data.name, UTI: 'public.png' });
        }
      }
      tapSuccess();
    } catch {
      // Abbruch oder Fehler beim Erzeugen → stattdessen den Link teilen.
      await shareLink();
    } finally {
      setBusy(false);
    }
  };

  const shareLink = async () => {
    try {
      await Share.share({ message: `${note}\n${url}`, url });
    } catch {
      // Abbruch durch den Nutzer ist kein Fehler.
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.inner}>
          {/* Die Karte selbst – genau dieser Bereich wird zum Bild. */}
          <View ref={cardRef} collapsable={false} style={styles.cardShadow}>
            <ShareCard data={data} />
          </View>

          <View style={[styles.actions, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Pressable
              onPress={shareImage}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, { opacity: pressed || busy ? 0.85 : 1 }]}
            >
              <LinearGradient colors={theme.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryFill}>
                {busy ? (
                  <ActivityIndicator color={c.onPrimary} />
                ) : (
                  <>
                    <Icon name="image" size={18} color={c.onPrimary} />
                    <Text style={{ color: c.onPrimary, fontSize: 15, fontWeight: '800' }}>{t('shareCard.image')}</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
            <View style={styles.row}>
              <Pressable onPress={shareLink} accessibilityRole="button" style={[styles.secondary, { borderColor: c.border }]}>
                <Icon name="link" size={16} color={c.text} />
                <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>{t('shareCard.link')}</Text>
              </Pressable>
              <Pressable onPress={onClose} accessibilityRole="button" style={[styles.secondary, { borderColor: c.border }]}>
                <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>{t('common.close')}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Das teilbare Bild: immer im warmen Glut-Look, unabhängig vom Hell/Dunkel-Modus. */
function ShareCard({ data }: { data: ShareCardData }) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const avg = data.avg;
  const full = avg != null ? Math.round(avg) : 0;
  return (
    <LinearGradient
      colors={['#3A0F07', '#7E1A0C', '#FF5A1E', '#FFA534']}
      locations={[0, 0.35, 0.78, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <LinearGradient
        colors={['rgba(255,226,170,0.35)', 'rgba(255,226,170,0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.3, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.brandRow}>
        <View style={styles.brandDot} />
        <Text style={[styles.brand, { fontFamily: theme.fonts.bold }]}>DON DÖNER</Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        {data.city ? <Text style={styles.city}>{data.city.toUpperCase()}</Text> : null}
        <Text style={styles.name} numberOfLines={3}>
          {data.name}
        </Text>

        <View style={styles.scoreRow}>
          <Text style={styles.score}>{avg != null ? avg.toFixed(1).replace('.', ',') : '–'}</Text>
          <View>
            <Text style={styles.stars}>{'★'.repeat(full) + '☆'.repeat(5 - full)}</Text>
            <Text style={styles.count}>
              {data.count > 0
                ? `${data.count} ${data.count === 1 ? t('detail.rating') : t('detail.ratings')}`
                : t('shareCard.noRating')}
            </Text>
          </View>
        </View>

        <View style={styles.chips}>
          {data.price != null ? (
            <View style={[styles.chip, styles.chipStrong]}>
              <Text style={styles.chipStrongText}>Döner {formatPrice(data.price)}</Text>
            </View>
          ) : null}
          {data.features.slice(0, 3).map((f) => (
            <View key={f} style={styles.chip}>
              <Text style={styles.chipText}>{f}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.footer}>{t('shareCard.footer')}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  actions: { borderRadius: 24, borderWidth: 1, gap: 10, marginTop: 14, padding: 14 },
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', flex: 1, justifyContent: 'center', padding: 20 },
  brand: { color: '#FFF4E8', fontSize: 13, letterSpacing: 3 },
  brandDot: { backgroundColor: '#FFA534', borderRadius: 5, height: 10, width: 10 },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  card: { borderRadius: 28, height: 400, overflow: 'hidden', padding: 26, width: 320 },
  cardShadow: { alignSelf: 'center', borderRadius: 28, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24 },
  chip: {
    backgroundColor: 'rgba(255,244,232,0.16)',
    borderColor: 'rgba(255,244,232,0.35)',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipStrong: { backgroundColor: '#FFF4E8', borderColor: '#FFF4E8' },
  chipStrongText: { color: '#7E1A0C', fontSize: 13, fontWeight: '800' },
  chipText: { color: '#FFF4E8', fontSize: 12.5, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 18 },
  city: { color: 'rgba(255,244,232,0.8)', fontSize: 12, fontWeight: '700', letterSpacing: 2.4, marginBottom: 6 },
  count: { color: 'rgba(255,244,232,0.85)', fontSize: 12.5, marginTop: 2 },
  footer: { color: 'rgba(255,244,232,0.85)', fontSize: 11.5, fontWeight: '600' },
  inner: { maxWidth: 380, width: '100%' },
  name: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: -0.8, lineHeight: 36 },
  primary: { borderRadius: 24, overflow: 'hidden' },
  primaryFill: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 14 },
  row: { flexDirection: 'row', gap: 10 },
  score: { color: '#FFFFFF', fontSize: 54, fontWeight: '800', letterSpacing: -2 },
  scoreRow: { alignItems: 'center', flexDirection: 'row', gap: 14, marginTop: 16 },
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
  stars: { color: '#FFD27A', fontSize: 20, letterSpacing: 2 },
});
