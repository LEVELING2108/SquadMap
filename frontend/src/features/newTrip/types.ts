/** One place from search (GET /places/search) or recent places (GET /places/recent). */
export type PlaceResult = {
  /** Mapbox's id; null for a recent place. Only for telling rows apart. */
  id: string | null;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  /** poi, address, street, neighborhood, locality, place, region... or "recent". */
  kind: string;
  distanceMeters: number | null;
};

/** Where the new trip is heading, as the host chose it. */
export type DraftDestination = {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  /**
   * True for a place search result, which the server looks up again before saving. False for a pin
   * the host dropped or a recent place, saved as given.
   */
  fromSearch: boolean;
};
