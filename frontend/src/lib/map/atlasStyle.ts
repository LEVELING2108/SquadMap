import type { LayerSpecification, StyleSpecification } from 'mapbox-gl';

/** The id the app uses for the Atlas map (see useMapStyle). It is not a Mapbox style: see loadAtlasStyle. */
export const ATLAS_STYLE = 'squadmap/atlas';

/** The Mapbox style the Atlas map is painted over. */
export const ATLAS_BASE_STYLE = 'mapbox/streets-v12';

/**
 * The Atlas map colours, from design/tokens/tokens-atlas.json ("map", plus "tint" and "lagoon"); a test
 * checks they match. A map style needs the values themselves, so they can't be CSS variables.
 */
export const ATLAS_MAP = {
  land: '#EFE6D2',
  park: '#D5D9B4',
  water: '#A9CBC3',
  roadCasing: '#D2C5A8',
  road: '#FBF7EC',
  highway: '#F2CC82',
  highwayCasing: '#D8A03C',
  label: '#6B6A57',
  tint: '#E6DFCB',
  lagoon: '#0E5A57',
} as const;

/** Land use that reads as green space; the rest of the town is a slightly darker paper. */
const GREEN = ['park', 'wood', 'scrub', 'grass', 'agriculture', 'cemetery', 'pitch', 'golf_course'];

type Paint = Record<string, unknown>;

/** The colours one layer of Mapbox Streets gets in Atlas, by its id and type. Null leaves it as it is. */
export function atlasPaint(layer: Pick<LayerSpecification, 'id' | 'type'>): Paint | null {
  const { id, type } = layer;
  const m = ATLAS_MAP;
  const big = /(motorway-trunk|primary)(-2)?/;

  if (type === 'background') return { 'background-color': m.land };
  if (type === 'symbol') {
    const water = /^(water|waterway)-/.test(id);
    return { 'text-color': water ? m.lagoon : m.label, 'text-halo-color': m.land };
  }
  if (id === 'landcover' || id === 'national-park') return { 'fill-color': m.park };
  if (id === 'landuse') return { 'fill-color': ['match', ['get', 'class'], GREEN, m.park, m.tint] };
  if (/^water/.test(id) && type === 'fill') return { 'fill-color': m.water };
  if (/^waterway/.test(id) && type === 'line') return { 'line-color': m.water };
  if (/^land-structure/.test(id))
    return type === 'fill' ? { 'fill-color': m.land } : { 'line-color': m.land };
  if (id === 'aeroway-polygon') return { 'fill-color': m.tint };
  if (id === 'aeroway-line') return { 'line-color': m.roadCasing };
  if (/^building/.test(id) && type === 'fill')
    return { 'fill-color': m.tint, 'fill-outline-color': m.roadCasing };
  if (/^(road|bridge|tunnel)-/.test(id) || id === 'crosswalks' || /^turning-feature/.test(id)) {
    // Rails and one-way arrows keep their own look.
    if (/rail|oneway-arrow|level-crossing/.test(id)) return null;
    if (type === 'fill') return { 'fill-color': m.road };
    if (type !== 'line') return null;
    if (/-(case|bg)$/.test(id)) return { 'line-color': big.test(id) ? m.highwayCasing : m.roadCasing };
    return { 'line-color': big.test(id) ? m.highway : m.road };
  }
  return null;
}

/** Mapbox Streets, repainted in Atlas colours. Everything but the colours (data, widths, labels) is kept. */
export function toAtlas(streets: StyleSpecification): StyleSpecification {
  return {
    ...streets,
    name: 'SquadMap Atlas',
    layers: streets.layers.map((layer) => {
      const paint = atlasPaint(layer);
      if (!paint) return layer;
      return {
        ...layer,
        paint: { ...(('paint' in layer && layer.paint) || {}), ...paint },
      } as LayerSpecification;
    }),
  };
}

let cached: Promise<StyleSpecification> | null = null;

/**
 * The Atlas map style: Mapbox Streets downloaded once (about 8 KB) and repainted here, so there is nothing
 * to keep in a Mapbox account. Rejects if Streets can't be fetched; the caller then shows plain Streets.
 */
export function loadAtlasStyle(token: string): Promise<StyleSpecification> {
  cached ??= fetch(`https://api.mapbox.com/styles/v1/${ATLAS_BASE_STYLE}?access_token=${token}`)
    .then((response) => {
      if (!response.ok) throw new Error(`Mapbox answered ${response.status}`);
      return response.json() as Promise<StyleSpecification>;
    })
    .then(toAtlas)
    .catch((error: unknown) => {
      cached = null;
      throw error;
    });
  return cached;
}
