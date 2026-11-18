package com.squadmap.chat.dto;

import java.util.List;
import java.util.UUID;

/**
 * @param items      newest first
 * @param nextBefore pass as {@code before} for the next, older page; null when there are no more
 * @param unread     messages from others that the caller hasn't seen, in the whole chat
 * @param memberId   the caller's own member id, to tell their messages apart
 */
public record MessagePage(List<MessageView> items, UUID nextBefore, long unread, UUID memberId) {
}
