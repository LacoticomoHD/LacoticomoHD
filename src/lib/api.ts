import {
  FeatureVote,
  OpeningHours,
  Rating,
  RatingWithShop,
  ReportReason,
  Shop,
  ShopFeature,
  ShopFeatureSummary,
  ShopRatingSummary,
  ShopWithSummary,
} from '@/types';

import { supabase } from './supabase';

export async function fetchShopsWithSummary(): Promise<ShopWithSummary[]> {
  const [shopsRes, summariesRes, featuresRes] = await Promise.all([
    supabase.from('shops').select('*'),
    supabase.from('shop_rating_summary').select('*'),
    supabase.from('shop_feature_summary').select('*').gt('score', 0),
  ]);
  if (shopsRes.error) throw new Error(shopsRes.error.message);
  if (summariesRes.error) throw new Error(summariesRes.error.message);
  if (featuresRes.error) throw new Error(featuresRes.error.message);

  const summaries = new Map<string, ShopRatingSummary>(
    (summariesRes.data as ShopRatingSummary[]).map((s) => [s.shop_id, s])
  );
  // Besonderheiten stammen aus der Community-Abstimmung (nur positiver Saldo zählt).
  const confirmedFeatures = new Map<string, ShopFeature[]>();
  for (const row of featuresRes.data as ShopFeatureSummary[]) {
    const list = confirmedFeatures.get(row.shop_id) ?? [];
    list.push(row.feature);
    confirmedFeatures.set(row.shop_id, list);
  }
  return (shopsRes.data as Shop[]).map((shop) => ({
    ...shop,
    features: confirmedFeatures.get(shop.id) ?? [],
    summary: summaries.get(shop.id) ?? null,
  }));
}

/** Abstimmungsstand der Besonderheiten eines Ladens. */
export async function fetchFeatureSummary(shopId: string): Promise<ShopFeatureSummary[]> {
  const { data, error } = await supabase
    .from('shop_feature_summary')
    .select('*')
    .eq('shop_id', shopId);
  if (error) throw new Error(error.message);
  return data as ShopFeatureSummary[];
}

/** Eigene Besonderheiten-Stimmen für einen Laden. */
export async function fetchMyFeatureVotes(
  shopId: string,
  userId: string
): Promise<Partial<Record<ShopFeature, FeatureVote>>> {
  const { data, error } = await supabase
    .from('shop_feature_votes')
    .select('feature, vote')
    .eq('shop_id', shopId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  const result: Partial<Record<ShopFeature, FeatureVote>> = {};
  for (const row of data as { feature: ShopFeature; vote: FeatureVote }[]) {
    result[row.feature] = row.vote;
  }
  return result;
}

/** Speichert die Besonderheiten-Stimmen eines Nutzers (0 = Stimme zurückziehen).
 *  Datenbankseitig nur erlaubt, wenn der Nutzer den Laden bewertet hat. */
export async function saveFeatureVotes(
  shopId: string,
  userId: string,
  votes: Partial<Record<ShopFeature, FeatureVote | 0>>
) {
  const toUpsert = Object.entries(votes)
    .filter(([, v]) => v === 1 || v === -1)
    .map(([feature, vote]) => ({
      shop_id: shopId,
      user_id: userId,
      feature,
      vote,
      updated_at: new Date().toISOString(),
    }));
  const toDelete = Object.entries(votes)
    .filter(([, v]) => v === 0)
    .map(([feature]) => feature);

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from('shop_feature_votes')
      .upsert(toUpsert, { onConflict: 'shop_id,user_id,feature' });
    if (error) throw new Error(error.message);
  }
  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('shop_feature_votes')
      .delete()
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .in('feature', toDelete);
    if (error) throw new Error(error.message);
  }
}

export async function fetchShops(): Promise<Shop[]> {
  const { data, error } = await supabase.from('shops').select('*');
  if (error) throw new Error(error.message);
  return data as Shop[];
}

export async function fetchShop(shopId: string): Promise<Shop> {
  const { data, error } = await supabase.from('shops').select('*').eq('id', shopId).single();
  if (error) throw new Error(error.message);
  return data as Shop;
}

export async function fetchShopSummary(shopId: string): Promise<ShopRatingSummary | null> {
  const { data, error } = await supabase
    .from('shop_rating_summary')
    .select('*')
    .eq('shop_id', shopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ShopRatingSummary | null;
}

export async function fetchMyRating(shopId: string, userId: string): Promise<Rating | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('shop_id', shopId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Rating | null;
}

export interface RatingInput {
  geschmack: number;
  freundlichkeit: number;
  sauberkeit: number;
  preis_leistung: number;
  wartezeit: number;
}

/** Legt die Bewertung an oder aktualisiert die bestehende (eine pro Nutzer und Laden). */
export async function upsertRating(shopId: string, userId: string, input: RatingInput) {
  const { error } = await supabase
    .from('ratings')
    .upsert(
      { shop_id: shopId, user_id: userId, ...input, updated_at: new Date().toISOString() },
      { onConflict: 'shop_id,user_id' }
    );
  if (error) throw new Error(error.message);
}

export interface NewShopInput {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  opening_hours: OpeningHours;
  features: ShopFeature[];
  doener_preis: number | null;
}

export async function createShop(input: NewShopInput, userId: string): Promise<Shop> {
  const { data, error } = await supabase
    .from('shops')
    .insert({ ...input, created_by: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Shop;
}

/** Aktualisiert einen Laden – per RLS nur für die Person erlaubt, die ihn angelegt hat. */
export async function updateShop(shopId: string, input: NewShopInput) {
  const { error } = await supabase.from('shops').update(input).eq('id', shopId);
  if (error) throw new Error(error.message);
}

/** Alle eigenen Bewertungen inkl. Ladendaten für die Profil-Übersicht. */
export async function fetchMyRatings(userId: string): Promise<RatingWithShop[]> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*, shops(id, name, address)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as unknown as RatingWithShop[];
}

/** Meldet einen fehlerhaften Ladeneintrag (falsche Adresse, geschlossen, Duplikat …). */
export async function createReport(
  shopId: string,
  userId: string,
  reason: ReportReason,
  details: string
) {
  const { error } = await supabase.from('reports').insert({
    shop_id: shopId,
    user_id: userId,
    reason,
    details: details.trim() || null,
  });
  if (error) throw new Error(error.message);
}

/** Löscht das eigene Konto samt aller Bewertungen (DB-Funktion delete_own_account).
 *  Selbst angelegte Läden bleiben als Community-Daten erhalten. */
export async function deleteOwnAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw new Error(error.message);
}

export interface GeocodingResult {
  displayName: string;
  latitude: number;
  longitude: number;
}

/** Adresssuche über Nominatim (OpenStreetMap). Bitte Usage Policy beachten: max. 1 Anfrage/Sekunde. */
export async function geocodeAddress(query: string): Promise<GeocodingResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'DonDoener/1.0 (Doener-Bewertungs-App)' },
  });
  if (!res.ok) throw new Error(`Adresssuche fehlgeschlagen (${res.status})`);
  const results = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return results.map((r) => ({
    displayName: r.display_name,
    latitude: parseFloat(r.lat),
    longitude: parseFloat(r.lon),
  }));
}
