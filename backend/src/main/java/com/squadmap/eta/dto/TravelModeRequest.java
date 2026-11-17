package com.squadmap.eta.dto;

/** @param mode "car", "bike" (a motorbike or scooter) or "walk" */
public record TravelModeRequest(String mode) {
}
