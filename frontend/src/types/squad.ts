export interface Participant {
  id: string;
  displayName: string;
  colorHex: string;
  lat?: number | null;
  lng?: number | null;
  speed?: number | null;
  heading?: number | null;
  isPaused?: boolean;
  hasArrived?: boolean;
  lastPing?: string;
  joinedAt?: string;
}

export interface Session {
  id: string;
  code: string;
  name: string;
  destinationName?: string;
  destinationLat?: number;
  destinationLng?: number;
  createdAt: string;
  expiresAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'ENDED';
  participants: Participant[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isQuickReply?: boolean;
}

export interface EtaParticipant {
  participantId: string;
  displayName: string;
  colorHex: string;
  distanceMeters: number;
  durationSeconds: number;
  etaFormatted: string;
  distanceFormatted: string;
  hasArrived: boolean;
  speedKmh: number;
  routeGeometry?: string | null;
}

export interface LocationBroadcast {
  userId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  isPaused: boolean;
  hasArrived: boolean;
  timestamp: string;
}

export interface ArrivedEvent {
  userId: string;
  displayName: string;
  arrivalTime: string;
  message: string;
}

export interface PresenceEvent {
  userId: string;
  displayName: string;
  colorHex: string;
  action: 'JOIN' | 'LEAVE' | 'PAUSE' | 'RESUME';
  timestamp: string;
}

export interface WebRtcSignal {
  sessionCode: string;
  type: 'join' | 'offer' | 'answer' | 'candidate' | 'talking-start' | 'talking-stop' | 'leave';
  senderId: string;
  senderName: string;
  targetId?: string | null;
  payload?: any;
}
