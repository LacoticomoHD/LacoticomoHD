/** Kartenstil passend zum Theme. Bei MapTiler gibt es zu jedem Stil eine
 *  dunkle Variante – im Dunkelmodus wird automatisch „Streets Dark" geladen,
 *  damit die Karte nicht als helle Fläche aus der Glut-Optik herausfällt. */
export function darkStyleUrl(styleUrl: string | undefined): string | undefined {
  if (!styleUrl?.includes('api.maptiler.com')) return styleUrl;
  const key = styleUrl.match(/[?&]key=([^&]+)/)?.[1];
  return key ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}` : styleUrl;
}
