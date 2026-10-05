import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

const BUCKET = 'shop-photos';
/** Längste Bildkante nach dem Verkleinern – scharf genug fürs Handy, aber klein
 *  (meist 200–400 KB statt mehrerer MB direkt aus der Kamera). */
const MAX_EDGE = 1440;

export interface ShopPhoto {
  id: string;
  url: string;
  userId: string;
  createdAt: string;
  path: string;
}

/** Fotos eines Ladens, neueste zuerst (ausgeblendete filtert die Datenbank). */
export async function fetchShopPhotos(shopId: string): Promise<ShopPhoto[]> {
  const { data, error } = await supabase
    .from('shop_photos')
    .select('id, path, user_id, created_at')
    .eq('shop_id', shopId)
    .eq('ausgeblendet', false)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    path: p.path,
    userId: p.user_id,
    createdAt: p.created_at,
    url: supabase.storage.from(BUCKET).getPublicUrl(p.path).data.publicUrl,
  }));
}

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Foto aus der Galerie oder mit der Kamera aufnehmen. null = abgebrochen. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('camera-denied');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/** Verkleinert das Bild, lädt es hoch und legt den Datenbankeintrag an. */
export async function uploadShopPhoto(
  shopId: string,
  userId: string,
  photo: PickedPhoto
): Promise<void> {
  // Nur verkleinern, nie vergrößern – und an der längeren Kante messen.
  const actions: ImageManipulator.Action[] =
    Math.max(photo.width, photo.height) > MAX_EDGE
      ? [{ resize: photo.width >= photo.height ? { width: MAX_EDGE } : { height: MAX_EDGE } }]
      : [];
  const resized = await ImageManipulator.manipulateAsync(photo.uri, actions, {
    compress: 0.72,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const body = await (await fetch(resized.uri)).arrayBuffer();
  const path = `${userId}/${shopId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from('shop_photos').insert({ shop_id: shopId, path });
  if (error) {
    // Eintrag gescheitert (z. B. Tageslimit): Datei wieder entfernen.
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

/** Eigenes Foto löschen (Admins dürfen alle löschen – per RLS geregelt). */
export async function deleteShopPhoto(photo: ShopPhoto): Promise<void> {
  const { error } = await supabase.from('shop_photos').delete().eq('id', photo.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([photo.path]);
}

/** Beim Kontolöschen: alle eigenen Bilddateien entfernen. Die Datenbankeinträge
 *  verschwinden mit dem Konto automatisch, die Dateien im Speicher aber nicht. */
export async function deleteAllMyPhotos(userId: string): Promise<void> {
  const { data } = await supabase.from('shop_photos').select('path').eq('user_id', userId);
  const paths = (data ?? []).map((p) => p.path);
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
  }
}

/** Foto melden – ab 3 Meldungen wird es automatisch ausgeblendet. */
export async function reportShopPhoto(photoId: string): Promise<void> {
  const { error } = await supabase.from('photo_reports').insert({ photo_id: photoId });
  // Doppelte Meldung derselben Person ist kein Fehler.
  if (error && error.code !== '23505') throw error;
}
