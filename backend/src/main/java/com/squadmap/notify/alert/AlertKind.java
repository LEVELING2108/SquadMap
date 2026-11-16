package com.squadmap.notify.alert;

/** What an alert is about. The web app words each one; the server only stores the facts. */
public enum AlertKind {
    /** Someone joined a trip you host. */
    member_joined,
    /** Someone left a trip you host. */
    member_left,
    /** Your trip's sharing ends in 10 minutes or less. */
    ending_soon,
    /** A trip you were on has ended. */
    trip_ended
}
