import { ShopWithSummary } from '@/types';

import { distanceKm } from './geo';
import { pinState } from './openingHours';

/** Umkreis für das Döner-Roulette (km). */
export const ROULETTE_RADIUS_KM = 5;

/** Wählt zufällig einen geöffneten Laden in der Nähe – bevorzugt gut bewertete.
 *  Stufen: ★ ≥ 4 → ★ ≥ 3 → irgendein geöffneter Laden. Läden, die gleich
 *  schließen, und der zuletzt gezogene Laden werden nach Möglichkeit übergangen. */
export function pickRouletteShop(
  shops: ShopWithSummary[],
  origin: { latitude: number; longitude: number } | null,
  excludeId?: string | null
): ShopWithSummary | null {
  const near = shops.filter(
    (s) =>
      !origin ||
      distanceKm(origin.latitude, origin.longitude, s.latitude, s.longitude) <= ROULETTE_RADIUS_KM
  );
  const open = near.filter((s) => pinState(s.opening_hours) === 'open');
  const avg = (s: ShopWithSummary) => s.summary?.avg_gesamt ?? 0;
  const tiers = [open.filter((s) => avg(s) >= 4), open.filter((s) => avg(s) >= 3), open];
  for (const tier of tiers) {
    const pool = tier.length > 1 ? tier.filter((s) => s.id !== excludeId) : tier;
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}
