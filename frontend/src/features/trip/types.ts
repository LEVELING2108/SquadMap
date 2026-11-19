export type Destination = { name: string; lat: number; lng: number };

export type TripStatus = 'active' | 'ended' | 'expired';

/** A trip as one of its members sees it (GET /trips/:id). */
export type Trip = {
  id: string;
  name: string;
  code: string;
  inviteUrl: string;
  destination: Destination | null;
  chatEnabled: boolean;
  startsAt: string;
  expiresAt: string;
  status: TripStatus;
  role: 'host' | 'member';
  memberCount: number;
};
