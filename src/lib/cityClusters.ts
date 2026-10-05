import type { CityCluster } from '@/lib/api';

/** Städte-Blasen als GeoJSON (gemeinsam für App- und Web-Karte). */
export function clustersToGeoJSON(clusters: CityCluster[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: clusters.map((c, i) => ({
      type: 'Feature' as const,
      id: i,
      geometry: { type: 'Point' as const, coordinates: [c.lon, c.lat] },
      properties: { city: c.city, anzahl: c.anzahl, label: String(c.anzahl) },
    })),
  };
}

/** Blasengröße wächst mit der Ladenzahl, bleibt aber auch bei Berlin handlich. */
export const CLUSTER_RADIUS = [
  'interpolate', ['linear'], ['get', 'anzahl'],
  1, 12,
  20, 15,
  100, 19,
  500, 25,
  1500, 32,
] as const;

/** Name unter der Blase: um ~2,4 Zeilenhöhen nach unten versetzt. */
export const CLUSTER_NAME_OFFSET = [0, 2.4];

/** Schrift aus den Glyphen der MapTiler-Stile (in allen verwendeten Stilen vorhanden). */
export const CLUSTER_FONT = ['Noto Sans Bold'];

/** Zoomstufe beim Antippen einer Blase: die Stadt füllt dann ungefähr den Bildschirm. */
export const CLUSTER_TAP_ZOOM = 11.5;
