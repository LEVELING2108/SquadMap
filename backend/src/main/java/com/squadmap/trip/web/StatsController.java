package com.squadmap.trip.web;

import com.squadmap.common.security.CurrentUser;
import com.squadmap.trip.dto.StatsResponse;
import com.squadmap.trip.repo.TripMemberRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Profile numbers, worked out from the account's trips; nothing extra is stored. */
@RestController
@Tag(name = "Me")
public class StatsController {

    private final TripMemberRepository members;

    public StatsController(TripMemberRepository members) {
        this.members = members;
    }

    @GetMapping("/api/v1/me/stats")
    @Operation(summary = "My trip numbers", description = "Trips hosted or joined, and different people met on them.")
    @Transactional(readOnly = true)
    public StatsResponse stats(@AuthenticationPrincipal Jwt token) {
        UUID userId = CurrentUser.id(token);
        return new StatsResponse(members.countTripsOf(userId), members.countFriendsOf(userId));
    }
}
