package com.squadmap.trip.dto;

/**
 * @param trips   trips the account hosted or joined, running or over
 * @param friends different people it has shared a trip with
 */
public record StatsResponse(long trips, long friends) {
}
