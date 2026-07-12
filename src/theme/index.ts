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
  };
}

/** Warme, appetitliche Palette: Paprika-Rot als Primärfarbe, Gold für Sterne. */
export const lightTheme: Theme = {
  dark: false,
  colors: {
    background: '#FAF7F2',
    surface: '#FFFFFF',
    surfaceVariant: '#F1EAE0',
    primary: '#C0392B',
    onPrimary: '#FFFFFF',
    accent: '#E67E22',
    text: '#1F1B16',
    textSecondary: '#6B6258',
    border: '#E3DACC',
    star: '#F5A623',
    starEmpty: '#D8CFC2',
    danger: '#C62828',
    success: '#2E7D32',
  },
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    background: '#17130F',
    surface: '#221D17',
    surfaceVariant: '#2E2820',
    primary: '#E74C3C',
    onPrimary: '#FFFFFF',
    accent: '#F39C12',
    text: '#F5EFE6',
    textSecondary: '#A99F91',
    border: '#3A332A',
    star: '#F5A623',
    starEmpty: '#4A4238',
    danger: '#EF5350',
    success: '#66BB6A',
  },
};
