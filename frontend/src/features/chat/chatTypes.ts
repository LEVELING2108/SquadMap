/** One message in the trip chat (GET /trips/:id/messages, and live on /topic/trip.{id}.chat). */
export type ChatMessage = {
  id: string;
  /** The trip member who wrote it. */
  memberId: string;
  displayName: string;
  color: string | null;
  text: string;
  sentAt: string;
  /** The id the sender's app chose when sending, if any. */
  clientId?: string;
};

/**
 * A page of the chat, newest first, with how many messages from others this person hasn't seen, and
 * their own member id.
 */
export type MessagePage = {
  items: ChatMessage[];
  nextBefore: string | null;
  unread: number;
  memberId: string;
};

/** What arrives on /topic/trip.{id}.chat: a new message, or someone typing. */
export type ChatEvent =
  { type: 'MESSAGE'; message: ChatMessage; at: string } | { type: 'TYPING'; memberId: string; at: string };

/** A message this phone is sending or failed to send, shown until the server has it. */
export type OutgoingMessage = { clientId: string; text: string; failed: boolean };
