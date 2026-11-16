package com.squadmap.notify.alert;

import java.util.List;
import java.util.UUID;

/** @param nextBefore pass as {@code before} for the next, older page; null when there are no more */
public record AlertPage(List<AlertResponse> items, UUID nextBefore, long unread) {
}
