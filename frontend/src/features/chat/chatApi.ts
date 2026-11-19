import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import type { ChatMessage, MessagePage } from './chatTypes';

type ChatData = InfiniteData<MessagePage, unknown>;

export const chatKeys = {
  messages: (tripId: string) => ['trips', tripId, 'messages'] as const,
};

/** Messages are loaded 50 at a time, newest first. */
const PAGE_SIZE = 50;

/**
 * The trip's chat: the newest page when the map opens (for the unread count), older pages on request.
 * New messages are added from the live connection with {@link addMessage}.
 */
export function useChatMessages(tripId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(tripId),
    queryFn: ({ pageParam }) =>
      api<MessagePage>(
        `/trips/${encodeURIComponent(tripId)}/messages?limit=${PAGE_SIZE}${
          pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
    enabled: enabled && tripId !== '',
  });
}

/** Messages from others not yet seen, from the newest page. */
export function unreadOf(data: ChatData | undefined): number {
  return data?.pages[0]?.unread ?? 0;
}

/** This person's member id on the trip, which tells their own messages apart. */
export function myIdOf(data: ChatData | undefined): string | undefined {
  return data?.pages[0]?.memberId;
}

/** Every loaded message, oldest first, the order they are shown in. */
export function messagesOf(data: ChatData | undefined): ChatMessage[] {
  return (data?.pages ?? []).flatMap((page) => page.items).reverse();
}

/**
 * Adds a message that arrived live or was just sent, once: the live copy of your own message and the
 * answer to sending it are the same message. `unread` counts it for the badge.
 */
export function addMessage(queryClient: QueryClient, tripId: string, message: ChatMessage, unread: boolean) {
  queryClient.setQueryData<ChatData>(chatKeys.messages(tripId), (data) => {
    if (!data || data.pages.length === 0) return data;
    if (data.pages.some((page) => page.items.some((item) => item.id === message.id))) return data;
    const [newest, ...older] = data.pages;
    return {
      ...data,
      pages: [
        { ...newest!, items: [message, ...newest!.items], unread: newest!.unread + (unread ? 1 : 0) },
        ...older,
      ],
    };
  });
}

/** The chat is open: nothing is unread any more. */
export function clearUnread(queryClient: QueryClient, tripId: string) {
  queryClient.setQueryData<ChatData>(chatKeys.messages(tripId), (data) => {
    if (!data || data.pages.length === 0 || data.pages[0]!.unread === 0) return data;
    const [newest, ...older] = data.pages;
    return { ...data, pages: [{ ...newest!, unread: 0 }, ...older] };
  });
}

/** An id for a message about to be sent, so a retry can't post it twice. */
export function newClientId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Sends a message. The same clientId on a retry gives back the first message instead of a second one. */
export function useSendMessage(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, text }: { clientId: string; text: string }) =>
      api<ChatMessage>(`/trips/${encodeURIComponent(tripId)}/messages`, {
        method: 'POST',
        body: { clientId, text },
      }),
    onSuccess: (message) => addMessage(queryClient, tripId, message, false),
  });
}

/** Tells the server this person has seen everything up to this message. */
export function useMarkRead(tripId: string) {
  return useMutation({
    mutationFn: (lastSeenId: string) =>
      api<void>(`/trips/${encodeURIComponent(tripId)}/messages/read`, {
        method: 'POST',
        body: { lastSeenId },
      }),
  });
}
