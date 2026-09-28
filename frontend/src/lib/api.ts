import { Session, EtaParticipant, ChatMessage } from '../types/squad';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
export const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8080/ws';

export async function createSession(data: {
  name: string;
  hostDisplayName: string;
  hostColorHex?: string;
  destinationName?: string;
  destinationLat: number;
  destinationLng: number;
}): Promise<{ session: Session; hostParticipantId: string }> {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to create trip session');
  }

  return res.json();
}

export async function getSession(code: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/api/sessions/${code.toUpperCase()}`);
  if (!res.ok) {
    throw new Error('Trip session not found or expired');
  }
  return res.json();
}

export async function joinSession(
  code: string,
  data: { displayName: string; colorHex?: string }
): Promise<{ participantId: string; displayName: string; colorHex: string; session: Session }> {
  const res = await fetch(`${API_BASE}/api/sessions/${code.toUpperCase()}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to join trip');
  }

  return res.json();
}

export async function updateDestination(
  code: string,
  data: { destinationName?: string; destinationLat: number; destinationLng: number }
): Promise<Session> {
  const res = await fetch(`${API_BASE}/api/sessions/${code.toUpperCase()}/destination`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error('Failed to update destination');
  }

  return res.json();
}

export async function endSession(code: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/sessions/${code.toUpperCase()}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('Failed to end session');
  }
}

export async function getEtas(code: string): Promise<EtaParticipant[]> {
  const res = await fetch(`${API_BASE}/api/sessions/${code.toUpperCase()}/eta`);
  if (!res.ok) return [];
  return res.json();
}

export async function getRecentChat(code: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/api/sessions/${code.toUpperCase()}/chat`);
  if (!res.ok) return [];
  return res.json();
}

export async function sendChat(
  code: string,
  data: { senderId: string; senderName: string; text: string; isQuickReply?: boolean }
): Promise<ChatMessage> {
  const res = await fetch(`${API_BASE}/api/sessions/${code.toUpperCase()}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error('Failed to send chat message');
  }

  return res.json();
}
