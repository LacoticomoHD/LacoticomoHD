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

/** Besonderheiten eines Ladens. Werden von der Community per Abstimmung gepflegt:
 *  Nur Nutzer, die den Laden bewertet haben, dürfen abstimmen (✓ vorhanden / ✗ nicht
 *  vorhanden); angezeigt wird eine Besonderheit nur bei positivem Stimmen-Saldo. */
export const SHOP_FEATURES = [
  'kalb',
  'haehnchen',
  'lamm',
  'oktopus',
  'vegetarisch',
  'vegan',
  'halal',
  'hausgemachtes_brot',
  'joghurtsosse',
  'knoblauchsosse',
  'scharfe_sosse',
  'ayran_hausgemacht',
] as const;

export type ShopFeature = (typeof SHOP_FEATURES)[number];

export const SHOP_FEATURE_LABELS: Record<ShopFeature, string> = {
  kalb: 'Kalb',
  haehnchen: 'Hähnchen',
  lamm: 'Lammfleisch',
  oktopus: 'Oktopusfleisch',
  vegetarisch: 'Vegetarisch',
  vegan: 'Vegan',
  halal: 'Halal',
  hausgemachtes_brot: 'Hausgemachtes Brot',
  joghurtsosse: 'Joghurtsoße',
  knoblauchsosse: 'Knoblauchsoße',
  scharfe_sosse: 'Scharfe Soße',
  ayran_hausgemacht: 'Ayran aus eigener Herstellung',
};

export const SHOP_FEATURE_ICONS: Record<ShopFeature, string> = {
  kalb: '🐄',
  haehnchen: '🐔',
  lamm: '🐑',
  oktopus: '🐙',
  vegetarisch: '🥗',
  vegan: '🌱',
  halal: '☪️',
  hausgemachtes_brot: '🥖',
  joghurtsosse: '🥣',
  knoblauchsosse: '🧄',
  scharfe_sosse: '🌶️',
  ayran_hausgemacht: '🥤',
};

/** Stimme eines Nutzers zu einer Besonderheit: 1 = vorhanden, -1 = nicht vorhanden. */
export type FeatureVote = 1 | -1;

/** Aggregierte Abstimmung je Laden und Besonderheit (View shop_feature_summary). */
export interface ShopFeatureSummary {
  shop_id: string;
  feature: ShopFeature;
  bestaetigt: number;
  widersprochen: number;
  score: number;
}

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
  /** Preis des Standard-Döners in Euro, optional. */
  doener_preis: number | null;
  /** Stadt (für Bestenliste und Dönerpreis-Index). */
  city: string | null;
  created_by: string | null;
  created_at: string;
}

/** Statistik einer Stadt (View city_stats): Ladenanzahl + Dönerpreis-Index. */
export interface CityStats {
  city: string;
  laeden: number;
  preis_schnitt: number | null;
  preis_anzahl: number;
}

/** Geografischer Ausschnitt für regionales Laden (sichtbarer Kartenbereich). */
export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/** Gründe für die Meldung eines fehlerhaften Ladeneintrags. */
export const REPORT_REASONS = [
  'falsche_adresse',
  'falsche_oeffnungszeiten',
  'falscher_preis',
  'dauerhaft_geschlossen',
  'duplikat',
  'sonstiges',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  falsche_adresse: 'Falsche Adresse',
  falsche_oeffnungszeiten: 'Falsche Öffnungszeiten',
  falscher_preis: 'Falscher Dönerpreis',
  dauerhaft_geschlossen: 'Dauerhaft geschlossen',
  duplikat: 'Doppelter Eintrag',
  sonstiges: 'Sonstiges',
};

/** Eigene Bewertung inkl. Basisdaten des bewerteten Ladens (für die Profil-Übersicht). */
export type RatingWithShop = Rating & {
  shops: Pick<Shop, 'id' | 'name' | 'address'> | null;
};

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
