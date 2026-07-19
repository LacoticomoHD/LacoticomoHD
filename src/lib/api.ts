import {
  CityStats,
  FeatureVote,
  GeoBounds,
  HoursVoteSummary,
  OpeningHours,
  PriceHistoryEntry,
  Rating,
  RatingWithShop,
  ReportReason,
  ReportWithShop,
  Shop,
  ShopFeature,
  ShopFeatureSummary,
  ShopRatingSummary,
  ShopWithSummary,
} from '@/types';

import { supabase } from './supabase';

/** Zeile der View shops_overview: Laden + Bewertungsschnitt + bestätigte Besonderheiten. */
interface OverviewRow extends Shop {
  rating_count: number;
  verifiziert_count: number;
  avg_geschmack: number | null;
  avg_fleischqualitaet: number | null;
  avg_sossenqualitaet: number | null;
  avg_freundlichkeit: number | null;
  avg_sauberkeit: number | null;
  avg_preis_leistung: number | null;
  avg_wartezeit: number | null;
  avg_gesamt: number | null;
  value_score: number | null;
  features_confirmed: ShopFeature[];
}

function mapOverviewRow(row: OverviewRow): ShopWithSummary {
  const {
    rating_count,
    verifiziert_count,
    avg_geschmack,
    avg_fleischqualitaet,
    avg_sossenqualitaet,
    avg_freundlichkeit,
    avg_sauberkeit,
    avg_preis_leistung,
    avg_wartezeit,
    avg_gesamt,
    value_score,
    features_confirmed,
    ...shop
  } = row;
  return {
    ...shop,
    features: features_confirmed ?? [],
    value_score,
    summary:
      rating_count > 0
        ? {
            shop_id: shop.id,
            rating_count,
            verifiziert_count,
            avg_geschmack,
            avg_fleischqualitaet,
            avg_sossenqualitaet,
            avg_freundlichkeit,
            avg_sauberkeit,
            avg_preis_leistung,
            avg_wartezeit,
            avg_gesamt,
          }
        : null,
  };
}

/** Läden im sichtbaren Kartenausschnitt – die App lädt nie ganz Deutschland auf einmal. */
export async function fetchShopsInBounds(
  bounds: GeoBounds,
  limit = 400
): Promise<ShopWithSummary[]> {
  const { data, error } = await supabase
    .from('shops_overview')
    .select('*')
    .gte('latitude', bounds.minLat)
    .lte('latitude', bounds.maxLat)
    .gte('longitude', bounds.minLon)
    .lte('longitude', bounds.maxLon)
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as OverviewRow[]).map(mapOverviewRow);
}

/** Serverseitige Suche nach Name oder Adresse (deutschlandweit). */
export async function searchShops(query: string, limit = 50): Promise<ShopWithSummary[]> {
  const escaped = query.replace(/[%_]/g, '');
  const { data, error } = await supabase
    .from('shops_overview')
    .select('*')
    .or(`name.ilike.%${escaped}%,address.ilike.%${escaped}%`)
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as OverviewRow[]).map(mapOverviewRow);
}

export type TopShopsMode = 'rating' | 'value';

/** Bestenliste: Top-Läden nach Gesamtschnitt oder Preis-Leistung (Sterne pro Euro),
 *  optional auf eine Stadt begrenzt. */
export async function fetchTopShops(
  city: string | null,
  mode: TopShopsMode = 'rating',
  limit = 10
): Promise<ShopWithSummary[]> {
  let query = supabase.from('shops_overview').select('*').gt('rating_count', 0);
  if (mode === 'value') {
    query = query
      .not('value_score', 'is', null)
      .order('value_score', { ascending: false })
      .order('rating_count', { ascending: false });
  } else {
    query = query
      .order('avg_gesamt', { ascending: false })
      .order('rating_count', { ascending: false });
  }
  if (city) query = query.eq('city', city);
  const { data, error } = await query.limit(limit);
  if (error) throw new Error(error.message);
  return (data as OverviewRow[]).map(mapOverviewRow);
}

/** Stadt-Statistik (Ladenanzahl + Dönerpreis-Index), größte Städte zuerst. */
export async function fetchCityStats(limit = 12): Promise<CityStats[]> {
  const { data, error } = await supabase
    .from('city_stats')
    .select('*')
    .order('laeden', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as CityStats[];
}

// ---------------------------------------------------------------------------
// Favoriten („Meine Stammläden")
// ---------------------------------------------------------------------------

export async function fetchFavoriteIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('favorites')
    .select('shop_id')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return new Set((data as { shop_id: string }[]).map((r) => r.shop_id));
}

export async function addFavorite(userId: string, shopId: string) {
  const { error } = await supabase
    .from('favorites')
    .upsert({ user_id: userId, shop_id: shopId });
  if (error) throw new Error(error.message);
}

export async function removeFavorite(userId: string, shopId: string) {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('shop_id', shopId);
  if (error) throw new Error(error.message);
}

export async function fetchFavoriteShops(userId: string): Promise<ShopWithSummary[]> {
  const ids = await fetchFavoriteIds(userId);
  if (ids.size === 0) return [];
  const { data, error } = await supabase
    .from('shops_overview')
    .select('*')
    .in('id', [...ids]);
  if (error) throw new Error(error.message);
  return (data as OverviewRow[]).map(mapOverviewRow);
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
  fleischqualitaet: number;
  sossenqualitaet: number;
  freundlichkeit: number;
  sauberkeit: number;
  preis_leistung: number;
  wartezeit: number;
}

/** Legt die Bewertung an oder aktualisiert die bestehende (eine pro Nutzer und Laden).
 *  `verified` = Nutzer war beim Bewerten nachweislich in Ladennähe. */
export async function upsertRating(
  shopId: string,
  userId: string,
  input: RatingInput,
  verified: boolean
) {
  const { error } = await supabase
    .from('ratings')
    .upsert(
      {
        shop_id: shopId,
        user_id: userId,
        ...input,
        verified,
        updated_at: new Date().toISOString(),
      },
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
  dueruem_preis: number | null;
  city: string | null;
  kartenzahlung: boolean | null;
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
  // Zeiten wurden ggf. korrigiert – das Öffnungszeiten-Feedback beginnt von vorn.
  await supabase.from('hours_votes').delete().eq('shop_id', shopId);
}

/** Alle eigenen Bewertungen inkl. Ladendaten für die Profil-Übersicht. */
export async function fetchMyRatings(userId: string): Promise<RatingWithShop[]> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*, shops(id, name, address, city)')
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

// ---------------------------------------------------------------------------
// Admin: Meldungs-Postfach
// ---------------------------------------------------------------------------

/** Ist der Nutzer als Admin eingetragen (Tabelle app_admins)? */
export async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('app_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return false;
  return data != null;
}

/** Alle Meldungen inkl. Ladendaten – per RLS nur für Admins sichtbar. */
export async function fetchAllReports(): Promise<ReportWithShop[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('id, shop_id, reason, details, status, created_at, shops(id, name, address)')
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as unknown as ReportWithShop[];
}

export async function setReportStatus(reportId: string, status: 'offen' | 'erledigt') {
  const { error } = await supabase.from('reports').update({ status }).eq('id', reportId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Preis-Frischehalter: Community bestätigt oder korrigiert den Dönerpreis
// ---------------------------------------------------------------------------

/** Bestätigt den aktuellen Dönerpreis („stimmt noch"). */
export async function confirmPrice(shopId: string) {
  const { error } = await supabase
    .from('shops')
    .update({ preis_bestaetigt_am: new Date().toISOString() })
    .eq('id', shopId);
  if (error) throw new Error(error.message);
}

/** Setzt/korrigiert den Dönerpreis (Preisänderung landet per Trigger in der Historie). */
export async function updateDoenerPreis(shopId: string, preis: number) {
  const { error } = await supabase
    .from('shops')
    .update({ doener_preis: preis, preis_bestaetigt_am: new Date().toISOString() })
    .eq('id', shopId);
  if (error) throw new Error(error.message);
}

/** Setzt die Kartenzahlungs-Angabe (true = möglich, false = nur Bar, null = keine Angabe). */
export async function updateKartenzahlung(shopId: string, kartenzahlung: boolean | null) {
  const { error } = await supabase
    .from('shops')
    .update({ kartenzahlung })
    .eq('id', shopId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Dönerpreis-Historie
// ---------------------------------------------------------------------------

export async function fetchPriceHistory(shopId: string): Promise<PriceHistoryEntry[]> {
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('shop_id', shopId)
    .order('recorded_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data as PriceHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Öffnungszeiten-Feedback („Stimmen die Zeiten noch?")
// ---------------------------------------------------------------------------

export async function fetchHoursVoteSummary(shopId: string): Promise<HoursVoteSummary | null> {
  const { data, error } = await supabase
    .from('hours_vote_summary')
    .select('*')
    .eq('shop_id', shopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as HoursVoteSummary | null;
}

export async function fetchMyHoursVote(shopId: string, userId: string): Promise<1 | -1 | 0> {
  const { data, error } = await supabase
    .from('hours_votes')
    .select('vote')
    .eq('shop_id', shopId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return 0;
  return (data?.vote as 1 | -1 | undefined) ?? 0;
}

/** Setzt die eigene Stimme; 0 zieht sie zurück. */
export async function setHoursVote(shopId: string, userId: string, vote: 1 | -1 | 0) {
  if (vote === 0) {
    const { error } = await supabase
      .from('hours_votes')
      .delete()
      .eq('shop_id', shopId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase
    .from('hours_votes')
    .upsert({ shop_id: shopId, user_id: userId, vote }, { onConflict: 'shop_id,user_id' });
  if (error) throw new Error(error.message);
}

export interface GeocodingResult {
  displayName: string;
  latitude: number;
  longitude: number;
  city: string | null;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: { city?: string; town?: string; village?: string; municipality?: string };
}

/** Adresssuche über Nominatim (OpenStreetMap). Bitte Usage Policy beachten: max. 1 Anfrage/Sekunde. */
export async function geocodeAddress(query: string): Promise<GeocodingResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'DonDoener/1.0 (Doener-Bewertungs-App)' },
  });
  if (!res.ok) throw new Error(`Adresssuche fehlgeschlagen (${res.status})`);
  const results = (await res.json()) as NominatimResult[];
  return results.map((r) => ({
    displayName: r.display_name,
    latitude: parseFloat(r.lat),
    longitude: parseFloat(r.lon),
    city: r.address?.city ?? r.address?.town ?? r.address?.village ?? r.address?.municipality ?? null,
  }));
}
