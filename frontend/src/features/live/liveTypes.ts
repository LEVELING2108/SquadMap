/** A member's last known spot (as kept by the server for 10 minutes at most). */
export type Position = {
  lat: number;
  lng: number;
  /** Accuracy radius in metres. */
  acc: number;
  speed?: number;
  heading?: number;
  /** When the phone took the reading, ISO-8601. */
  ts: string;
};

/** One person on the trip, from GET /trips/:id/members. */
export type LiveMember = {
  memberId: string;
  displayName: string;
  color: string;
  role: 'host' | 'member';
  you: boolean;
  /** Whether they agreed to share their location on this trip. */
  sharing: boolean;
  location: Position | null;
  /** When they reached the destination, or null. */
  arrivedAt: string | null;
  /** How they said they are travelling, or null before they choose (the ETA's mode is then a guess). */
  travelMode: TravelMode | null;
};

/** A bike is a motorbike or scooter: it takes the same roads as a car. */
export type TravelMode = 'car' | 'bike' | 'walk';

/** A member's way to the destination: GET /trips/:id/eta, then /topic/trip.{id}.eta. */
export type Eta = {
  memberId: string;
  /** Metres left along the route. */
  distanceM: number;
  /** Seconds left. */
  durationS: number;
  mode: TravelMode;
  /** The route still to go, polyline6; absent when estimated without one. */
  route?: string;
  /** Share of the way done, 0 to 1. */
  progress: number;
  /** True when worked out without a fresh route. */
  estimated: boolean;
  computedAt: string;
};

/** A member moved: what arrives on /topic/trip.{id}.locations. */
export type MemberLocation = Position & { memberId: string };

export type TripEventType =
  'MEMBER_JOINED' | 'MEMBER_LEFT' | 'SHARING_STARTED' | 'ARRIVED' | 'TRIP_EXTENDED' | 'TRIP_ENDED';

/** Something happened on the trip: what arrives on /topic/trip.{id}.events. */
export type TripEvent = {
  type: TripEventType;
  memberId?: string;
  displayName?: string;
  color?: string;
  expiresAt?: string;
  at: string;
};

/** A refused update, sent to the sender alone on /user/queue/errors. */
export type LiveError = { code: string; message: string; retryAfter?: number };

/** The reading this phone sends: a Position without an id. */
export type LocationReading = Position;
