import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { Banner } from '../../components/ui/Banner';
import { describeFailure } from '../auth/formErrors';
import type { LiveMember } from '../live/liveTypes';
import {
  clearUnread,
  messagesOf,
  myIdOf,
  newClientId,
  useChatMessages,
  useMarkRead,
  useSendMessage,
} from './chatApi';
import { groupLabel, MAX_MESSAGE, QUICK_REPLIES, startsGroup, typingWords } from './chatFormat';
import type { ChatMessage, OutgoingMessage } from './chatTypes';

/** The box counts down over the last stretch before the limit. */
const COUNTDOWN_FROM = 40;
/** "Typing" goes out at most this often while someone writes. */
const TYPING_EVERY_MS = 2_000;
/** Closer than this to the bottom, new messages scroll into view; further up, the reader is left alone. */
const NEAR_BOTTOM_PX = 120;

type TripChatProps = {
  tripId: string;
  /** Everyone on the trip, for who is typing. */
  members: LiveMember[];
  typingIds: string[];
  onTyping: () => void;
  /** After the trip ends the chat can be read but not written. */
  readOnly: boolean;
  timeFormat: '12h' | '24h';
  now: number;
};

function Initial({ name, color }: { name: string; color: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 flex-none items-center justify-center rounded-pill bg-muted text-xs font-extrabold text-on-person"
      style={color ? { backgroundColor: color } : undefined}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Bubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  if (mine) {
    return (
      <p className="bubble-mine m-0 max-w-[280px] self-end bg-blue px-3.5 py-2.5 text-[15px] leading-5 break-words text-on-primary">
        <span className="sr-only">You: </span>
        {message.text}
      </p>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <Initial name={message.displayName} color={message.color} />
      <p className="glass-button bubble-friend m-0 max-w-[280px] px-3.5 py-2.5 text-[15px] leading-5 break-words text-ink">
        <span className="sr-only">{message.displayName}: </span>
        {message.text}
      </p>
    </div>
  );
}

/**
 * D4, the trip chat: a sheet over the map with the conversation, who is typing, quick replies and a
 * box to write in. Opening it marks everything read.
 */
export const TripChat = forwardRef<HTMLElement, TripChatProps>(function TripChat(
  { tripId, members, typingIds, onTyping, readOnly, timeFormat, now },
  ref,
) {
  const queryClient = useQueryClient();
  const chat = useChatMessages(tripId, true);
  const send = useSendMessage(tripId);
  const markRead = useMarkRead(tripId);
  const [draft, setDraft] = useState('');
  const [outgoing, setOutgoing] = useState<OutgoingMessage[]>([]);
  const [sendError, setSendError] = useState<unknown>(null);
  const lastTyping = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const keepFromBottom = useRef<number | null>(null);
  const stickToBottom = useRef(true);

  const myId = myIdOf(chat.data);
  const messages = messagesOf(chat.data);
  const sentIds = new Set(messages.map((message) => message.clientId).filter(Boolean));
  const pending = outgoing.filter((item) => !sentIds.has(item.clientId));
  const newest = messages.at(-1);

  // Everything on screen counts as seen.
  const lastMarked = useRef<string | null>(null);
  const { mutate: markSeen } = markRead;
  useEffect(() => {
    if (!newest || lastMarked.current === newest.id) return;
    lastMarked.current = newest.id;
    clearUnread(queryClient, tripId);
    markSeen(newest.id);
  }, [newest, markSeen, queryClient, tripId]);

  // Opens at the newest message, follows new ones while the reader is at the bottom, and keeps the
  // reader's place when older messages are added above.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (keepFromBottom.current !== null) {
      list.scrollTop = list.scrollHeight - keepFromBottom.current;
      keepFromBottom.current = null;
    } else if (stickToBottom.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages.length, pending.length, typingIds.length]);

  function loadOlder() {
    const list = listRef.current;
    if (list) keepFromBottom.current = list.scrollHeight - list.scrollTop;
    void chat.fetchNextPage();
  }

  function deliver(item: OutgoingMessage) {
    stickToBottom.current = true;
    setSendError(null);
    send.mutateAsync({ clientId: item.clientId, text: item.text }).then(
      () => setOutgoing((all) => all.filter((other) => other.clientId !== item.clientId)),
      (error: unknown) => {
        setSendError(error);
        setOutgoing((all) =>
          all.map((other) => (other.clientId === item.clientId ? { ...other, failed: true } : other)),
        );
      },
    );
  }

  function post(text: string) {
    const clean = text.trim();
    if (!clean) return;
    const item = { clientId: newClientId(), text: clean, failed: false };
    setOutgoing((all) => [...all, item]);
    deliver(item);
  }

  function retry(item: OutgoingMessage) {
    setOutgoing((all) =>
      all.map((other) => (other.clientId === item.clientId ? { ...other, failed: false } : other)),
    );
    deliver(item);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    post(draft);
    setDraft('');
  }

  function type(value: string) {
    setDraft(value);
    const at = Date.now();
    if (value.trim() && at - lastTyping.current >= TYPING_EVERY_MS) {
      lastTyping.current = at;
      onTyping();
    }
  }

  const typists = typingIds
    .filter((id) => id !== myId)
    .flatMap((id) => members.filter((member) => member.memberId === id));
  const left = MAX_MESSAGE - draft.length;

  return (
    <section
      ref={ref}
      aria-labelledby="live-title"
      className="glass-strong motion-sheet absolute inset-x-0 top-[115px] bottom-0 z-10 flex flex-col gap-2.5 rounded-t-sheet px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]"
    >
      <div aria-hidden="true" className="mx-auto h-1 w-10 flex-none rounded-[2px] bg-handle" />
      <h1 id="live-title" className="sr-only">
        Trip chat
      </h1>

      <div
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget;
          stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;
        }}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <div className="mt-auto flex flex-col gap-2">
          {chat.hasNextPage && (
            <button
              type="button"
              onClick={loadOlder}
              disabled={chat.isFetchingNextPage}
              className="min-h-11 self-center rounded-pill px-4 text-[13px] font-bold text-blue-d disabled:opacity-50"
            >
              {chat.isFetchingNextPage ? 'Loading…' : 'Show earlier messages'}
            </button>
          )}
          {chat.isPending && <p className="text-center text-xs leading-4 text-muted">Loading messages…</p>}
          {chat.isError && <Banner tone="error">{describeFailure(chat.error)}</Banner>}
          {chat.isSuccess && messages.length === 0 && pending.length === 0 && (
            <p className="py-6 text-center text-sm leading-5 text-muted">
              {readOnly
                ? 'Nobody wrote anything on this trip.'
                : 'No messages yet. Say hello, or tap a quick reply.'}
            </p>
          )}

          <div role="log" aria-label="Messages" className="flex flex-col gap-2">
            {messages.map((message, index) => (
              <div key={message.id} className="flex flex-col gap-2">
                {startsGroup(messages[index - 1], message) && (
                  <p className="text-center text-xs leading-4 text-muted">
                    {groupLabel(message.sentAt, now, timeFormat)}
                  </p>
                )}
                <Bubble message={message} mine={message.memberId === myId} />
              </div>
            ))}
            {pending.map((item) => (
              <div key={item.clientId} className="flex flex-col items-end gap-1">
                <p
                  className={`bubble-mine m-0 max-w-[280px] bg-blue px-3.5 py-2.5 text-[15px] leading-5 break-words text-on-primary ${
                    item.failed ? '' : 'opacity-70'
                  }`}
                >
                  <span className="sr-only">You: </span>
                  {item.text}
                </p>
                {item.failed ? (
                  <p className="flex items-center gap-1 text-xs leading-4 font-bold text-red">
                    Not sent
                    <button
                      type="button"
                      onClick={() => retry(item)}
                      className="min-h-11 rounded-pill px-2 text-xs font-extrabold text-blue-d underline"
                    >
                      Retry
                    </button>
                  </p>
                ) : (
                  <p className="text-xs leading-4 text-muted">Sending…</p>
                )}
              </div>
            ))}
          </div>

          {typists.length > 0 && (
            <div className="flex items-end gap-2">
              <Initial name={typists[0]!.displayName} color={typists[0]!.color} />
              <div className="glass-button bubble-friend flex items-center px-3.5 py-3.5">
                <span aria-hidden="true" className="motion-typing flex gap-1">
                  <i className="size-[7px] rounded-pill bg-muted" />
                  <i className="size-[7px] rounded-pill bg-muted" />
                  <i className="size-[7px] rounded-pill bg-muted" />
                </span>
              </div>
            </div>
          )}
          <p aria-live="polite" className="sr-only">
            {typingWords(typists.map((member) => member.displayName))}
          </p>
        </div>
      </div>

      {sendError !== null && <Banner tone="error">{describeFailure(sendError)}</Banner>}

      {readOnly ? (
        <p className="py-2 text-center text-sm leading-5 text-muted">
          This trip has ended. You can read the chat, but not send messages.
        </p>
      ) : (
        <>
          <div
            aria-label="Quick replies"
            role="group"
            className="-mx-4 flex flex-none gap-2 overflow-x-auto px-4"
          >
            {QUICK_REPLIES.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => post(reply)}
                className="glass-button min-h-11 flex-none rounded-pill px-4 text-sm font-bold whitespace-nowrap text-ink"
              >
                {reply}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex flex-none items-center gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Message</span>
              <input
                value={draft}
                onChange={(event) => type(event.target.value)}
                maxLength={MAX_MESSAGE}
                enterKeyHint="send"
                autoComplete="off"
                placeholder="Message the group"
                className={`h-13 w-full rounded-pill border-[1.5px] border-input-border bg-input-bg pl-5 text-[15px] font-medium text-ink placeholder:text-input-placeholder focus:border-blue focus:outline-2 focus:outline-blue ${
                  left <= COUNTDOWN_FROM ? 'pr-20' : 'pr-5'
                }`}
              />
              {left <= COUNTDOWN_FROM && (
                <span
                  aria-live="polite"
                  className="absolute top-1/2 right-4 -translate-y-1/2 text-xs font-bold text-muted"
                >
                  {left} left
                </span>
              )}
            </label>
            <button
              type="submit"
              aria-label="Send"
              disabled={!draft.trim()}
              className="flex size-14 flex-none items-center justify-center rounded-pill bg-blue text-on-primary shadow-primary disabled:opacity-50"
            >
              <Send aria-hidden="true" className="size-6" />
            </button>
          </form>
        </>
      )}
    </section>
  );
});
