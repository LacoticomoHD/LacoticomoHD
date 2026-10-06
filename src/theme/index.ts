import { Platform } from 'react-native';

/** Im Browser eine Ersatzschrift anhängen: Lädt die Webschrift bei schwachem
 *  Netz nicht, erscheint sonst Times New Roman statt einer serifenlosen Schrift. */
const font = (name: string) =>
  Platform.OS === 'web' ? `${name}, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` : name;

export interface Theme {
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceVariant: string;
    primary: string;
    onPrimary: string;
    accent: string;
    text: string;
    textSecondary: string;
    border: string;
    star: string;
    starEmpty: string;
    danger: string;
    success: string;
    /** Hinweisfarbe, z. B. „Schließt bald“. */
    warning: string;
    /** Schwebende Flächen über der Karte (Suche, Chips, Knöpfe). */
    overlay: string;
    overlayBorder: string;
    /** Bewertungs-Kapsel (z. B. „★ 4,6" in Listen). */
    ratingChip: string;
    ratingChipBorder: string;
    ratingChipText: string;
  };
  gradients: {
    /** Füllung für Primär-Knöpfe und aktive Chips. */
    primary: [string, string];
    /** Kopfbereich der Laden-Detailseite. */
    hero: [string, string, string];
  };
  /** Farbe des Leucht-Schattens unter aktiven Elementen. */
  glow: string;
  radius: { card: number; pill: number };
  /** Schriftfamilie je Strichstärke (geladen in App.tsx). */
  fonts: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
    extrabold: string;
  };
}

/** Heller Modus „Glas": cremefarbene Basis, milchige Flächen, Paprika-Rot. */
export const lightTheme: Theme = {
  dark: false,
  colors: {
    background: '#F3EDE4',
    surface: '#FFFFFF',
    surfaceVariant: '#EFE6D8',
    primary: '#C0392B',
    onPrimary: '#FFFFFF',
    accent: '#E67E22',
    text: '#1C1714',
    textSecondary: '#6E6358',
    border: '#E2D7C7',
    star: '#C98A14',
    starEmpty: '#CFC2B2',
    danger: '#C62828',
    success: '#1E7A3C',
    warning: '#9A5200',
    overlay: 'rgba(255,255,255,0.86)',
    overlayBorder: 'rgba(255,255,255,0.95)',
    ratingChip: '#FDF3DF',
    ratingChipBorder: '#EBD6A8',
    ratingChipText: '#7A5405',
  },
  gradients: {
    primary: ['#C0392B', '#C0392B'],
    hero: ['#8E2318', '#C0392B', '#E67E22'],
  },
  glow: '#4E361C',
  radius: { card: 20, pill: 22 },
  fonts: {
    regular: font('Manrope_400Regular'),
    medium: font('Manrope_500Medium'),
    semibold: font('Manrope_600SemiBold'),
    bold: font('Manrope_700Bold'),
    extrabold: font('Manrope_800ExtraBold'),
  },
};

/** Dunkler Modus „Glut": fast schwarzer Grund, Hitze-Verlauf, Leucht-Schatten. */
export const darkTheme: Theme = {
  dark: true,
  colors: {
    background: '#0E0A09',
    surface: '#1A1311',
    surfaceVariant: '#241B18',
    primary: '#FF5A1E',
    // Dunkle Schrift auf dem hellen Glut-Verlauf – weiß wäre zu kontrastarm.
    onPrimary: '#2A0F04',
    accent: '#FFA534',
    text: '#F7EFE8',
    textSecondary: '#A4958A',
    border: '#33251F',
    star: '#FFB23F',
    starEmpty: '#4A3B33',
    danger: '#FF6B5B',
    success: '#5FD98A',
    warning: '#FFB938',
    overlay: 'rgba(26,19,17,0.94)',
    overlayBorder: '#35261F',
    ratingChip: 'rgba(255,178,63,0.14)',
    ratingChipBorder: 'rgba(255,178,63,0.3)',
    ratingChipText: '#FFCE85',
  },
  gradients: {
    primary: ['#FF5A1E', '#FFA534'],
    hero: ['#7E1A0C', '#FF5A1E', '#FFA534'],
  },
  glow: '#FF601C',
  radius: { card: 20, pill: 22 },
  fonts: {
    regular: font('SpaceGrotesk_400Regular'),
    medium: font('SpaceGrotesk_500Medium'),
    semibold: font('SpaceGrotesk_600SemiBold'),
    bold: font('SpaceGrotesk_700Bold'),
    extrabold: font('SpaceGrotesk_700Bold'),
  },
};
