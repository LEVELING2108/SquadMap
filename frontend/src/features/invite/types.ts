import type { Trip } from '../trip/types';

/** What anyone with the code may see before joining. */
export type JoinPreview = {
  code: string;
  tripName: string;
  hostName: string;
  destination: Trip['destination'];
  /** Everyone on the trip now, the host included. */
  memberCount: number;
  expiresAt: string;
};

/** The new member. A guest also gets a pass for this trip; an account keeps using its own session. */
export type JoinResponse = {
  tripId: string;
  memberId: string;
  displayName: string;
  color: string;
  role: 'host' | 'member';
  sharingLocation: boolean;
  accessToken: string | null;
  expiresIn: number | null;
};
