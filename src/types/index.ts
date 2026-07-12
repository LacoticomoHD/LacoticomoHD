/** Bewertungskategorien – jede wird einzeln mit 1–5 Sternen bewertet. */
export const RATING_CATEGORIES = [
  'geschmack',
  'freundlichkeit',
  'sauberkeit',
  'preis_leistung',
  'wartezeit',
] as const;

export type RatingCategory = (typeof RATING_CATEGORIES)[number];

export const RATING_CATEGORY_LABELS: Record<RatingCategory, string> = {
  geschmack: 'Geschmack',
  freundlichkeit: 'Freundlichkeit',
  sauberkeit: 'Sauberkeit',
  preis_leistung: 'Preis-Leistung',
  wartezeit: 'Wartezeit',
};

/** Besonderheiten eines Ladens (Angebots-Merkmale). */
export const SHOP_FEATURES = [
  'kalb',
  'haehnchen',
  'vegetarisch',
  'vegan',
  'halal',
  'hausgemachtes_brot',
] as const;

export type ShopFeature = (typeof SHOP_FEATURES)[number];

export const SHOP_FEATURE_LABELS: Record<ShopFeature, string> = {
  kalb: 'Kalb',
  haehnchen: 'Hähnchen',
  vegetarisch: 'Vegetarisch',
  vegan: 'Vegan',
  halal: 'Halal',
  hausgemachtes_brot: 'Hausgemachtes Brot',
};

export const SHOP_FEATURE_ICONS: Record<ShopFeature, string> = {
  kalb: '🐄',
  haehnchen: '🐔',
  vegetarisch: '🥗',
  vegan: '🌱',
  halal: '☪️',
  hausgemachtes_brot: '🥖',
};

export const WEEKDAYS = [
  'montag',
  'dienstag',
  'mittwoch',
  'donnerstag',
  'freitag',
  'samstag',
  'sonntag',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  montag: 'Montag',
  dienstag: 'Dienstag',
  mittwoch: 'Mittwoch',
  donnerstag: 'Donnerstag',
  freitag: 'Freitag',
  samstag: 'Samstag',
  sonntag: 'Sonntag',
};

/** Öffnungszeiten pro Wochentag, z. B. { montag: { open: "10:00", close: "22:00" } }.
 *  Fehlt ein Tag, gilt der Laden an diesem Tag als geschlossen. */
export type OpeningHours = Partial<Record<Weekday, { open: string; close: string }>>;

export interface Shop {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  opening_hours: OpeningHours;
  features: ShopFeature[];
  created_by: string;
  created_at: string;
}

export interface Rating {
  id: string;
  shop_id: string;
  user_id: string;
  geschmack: number;
  freundlichkeit: number;
  sauberkeit: number;
  preis_leistung: number;
  wartezeit: number;
  created_at: string;
  updated_at: string;
}

/** Aggregierte Bewertung eines Ladens (aus der DB-View shop_rating_summary). */
export interface ShopRatingSummary {
  shop_id: string;
  rating_count: number;
  avg_geschmack: number | null;
  avg_freundlichkeit: number | null;
  avg_sauberkeit: number | null;
  avg_preis_leistung: number | null;
  avg_wartezeit: number | null;
  avg_gesamt: number | null;
}

export type ShopWithSummary = Shop & { summary: ShopRatingSummary | null };
