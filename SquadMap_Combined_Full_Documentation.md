# SquadMap — Full Project Documentation & UI/UX Design Specification

**Version:** 1.0  
**Year:** 2026  
**Status:** Draft  
**Project:** SquadMap — Group Location Sharing App  
**Author:** Sourav · ECE + DS  

> This document combines the two supplied SquadMap documents: the Full Project Documentation / PRD and the UI/UX Design Specification. The source terminology and requirements have been retained.

---

# Part I — Full Project Documentation / PRD

1. Executive Summary

SquadMap is a real-time group location sharing Progressive Web App (PWA) built for friend groups travelling to a common destination. Unlike WhatsApp's static location share or Google Maps' single-user navigation, SquadMap shows every member's live position on a shared map simultaneously, displays ETAs for each person, and requires no account creation — just an invite link.

2. Project Scope & Goals

2.1 In Scope

Real-time multi-user location display on a shared map

Session rooms created via shareable link (no login required)

Destination pin drop with ETA and distance for each user

Arrived notification when a user reaches the destination

Battery-aware adaptive location update frequency

Mobile-first PWA (works in browser on Android and iOS)

Group chat overlay (text only)

Session auto-expiry after 12 hours

2.2 Out of Scope (v1)

Turn-by-turn navigation (use native Maps app for that)

Audio/video calls

History playback of routes

iOS/Android native apps (Phase 2)

Social profiles or friend lists

2.3 Success Metrics

3. User Stories & Personas

3.1 Personas

3.2 Core User Stories

4. Functional Requirements

5. Non-Functional Requirements

5.1 Performance

5.2 Security

Session codes are cryptographically random (not sequential IDs)

WebSocket connections validated against session membership

Location data never stored in persistent DB; Redis TTL = session lifetime

HTTPS enforced; WSS for WebSocket

Rate limiting: 100 location updates per user per minute

No PII collected beyond display name (discarded at session end)

5.3 Availability & Reliability

Target uptime: 99.5% monthly

Graceful degradation: if WebSocket fails, fall back to HTTP polling every 15s

Session state in Redis with 2-replica replication

5.4 Scalability

Stateless Node.js servers behind a load balancer; horizontal scaling via Docker/Kubernetes

Redis Pub/Sub used for cross-server WebSocket message fan-out

Mapbox tile caching at CDN edge

6. System Architecture

6.1 Architecture Overview

SquadMap uses a three-tier architecture: a React-based PWA frontend, a Node.js real-time backend with Socket.IO, and a Redis + PostgreSQL data layer. The critical path for location updates bypasses the database entirely, using Redis Pub/Sub to broadcast between server instances.

6.2 Component Breakdown

6.3 Data Flow — Location Update

User's browser reads GPS via navigator.geolocation.watchPosition()

Client emits location_update event over WebSocket with {lat, lng, accuracy, speed}

Server validates session membership, updates Redis key: loc:{sessionId}:{userId}

Server broadcasts to Socket.IO room: location_broadcast to all except sender

Each client updates the map marker for that user

Every 30s, server reads all location keys for session, calculates ETAs via Mapbox Directions API, broadcasts eta_update

6.4 Database Schema

7. API Design

7.1 REST Endpoints

7.2 WebSocket Events

8. UI/UX Design Specification

8.1 Design Principles

Map-first: the map fills the screen; UI is minimal and overlaid

Zero friction: no signup, no tutorial — join and see the map instantly

Glanceable: most important info (who is close) visible without tapping anything

Accessible: minimum 44×44pt touch targets, 4.5:1 contrast ratio

Offline-aware: show last-known locations with a staleness indicator when reconnecting

8.2 Color System

8.3 Typography

8.4 Screen Inventory

Screen 1 — Home / Create Session

Full-screen illustration with app logo and tagline. Single primary CTA: Start a Trip. Secondary link: Join with code. Display name entry shown inline before proceeding.

Components: LogoMark, Headline, PrimaryButton, TextInput (display name), LinkButton

Interactions: Tap Start a Trip -> enter name -> session created -> transition to Map screen

Screen 2 — Join Screen

Shown when a user opens an invite link. Pre-filled with session destination name. User only needs to enter their display name and tap Join.

Components: SessionCard (destination, participant count), TextInput (name), JoinButton

Edge cases: Session expired → show error with option to create new; Session full → waitlist message

Screen 3 — Live Map (Primary Screen)

The core experience. Full-screen Mapbox map with overlaid UI elements. Map auto-fits to show all participants and the destination.

Top bar (overlay): session code, participant count, menu icon (end session / share link)

Map layer: destination pin (red star marker), participant dots (coloured circle + name pill), dashed route lines from each dot to destination

Bottom sheet (collapsed by default, draggable): ETA list sorted by arrival time; Arrived members shown with green check

FAB (bottom right): centre map on all participants

Chat button (bottom left): opens chat sheet with unread badge

Share button (top right): native share sheet with invite link

Screen 4 — ETA Bottom Sheet

Expanded state shows a list card per participant with: coloured avatar dot, name, ETA countdown (e.g. 8 min), distance (e.g. 3.2 km), and an Arrived badge when within 100m.

Screen 5 — Chat Overlay

Slide-up sheet 60% of screen height. Messages list (newest at bottom). Input field with send button at bottom. Quick-reply chips: On my way, Almost there, Where are you?.

Screen 6 — Session Ended

Shown to all users when session ends (expiry or host ending it). Shows summary: duration, participants, destination name. CTA to Start New Trip.

8.5 Navigation Structure

8.6 Responsive Breakpoints

9. Technology Stack

9.1 Frontend

9.2 Backend

9.3 Infrastructure

10. Project Folder Structure

11. Development Roadmap

Phase 1 — MVP (Weeks 1–3)

Project setup: monorepo, Vite, Node.js, Docker Compose

Session creation and join via link (no auth)

Real-time location broadcast via WebSocket

Basic map with participant dots and destination pin

ETA calculation via Mapbox Directions API

Arrived detection and notification

Phase 2 — Polish (Weeks 4–5)

Group chat overlay

Battery-aware adaptive GPS polling

Offline mode with last-known locations

Quick-reply chips

PWA installability (manifest + service worker)

Error states and reconnection handling

Phase 3 — Production (Week 6)

CI/CD pipeline with GitHub Actions

Sentry error tracking on client and server

Prometheus + Grafana metrics dashboard

Load testing with k6 (target: 100 concurrent sessions, 20 users each)

Security review: rate limiting, CORS, input sanitisation

Deploy to VPS with Nginx + Let's Encrypt SSL

Effort Estimate

12. Testing Strategy

12.1 Unit Tests (Jest)

Session code generation uniqueness

ETA calculation service with mock coordinates

Redis TTL enforcement

Zod schema validation for all API bodies

12.2 Integration Tests

Full session lifecycle: create → join → location update → arrive → end

WebSocket reconnection after server restart

Destination change propagation to all clients

Session expiry broadcast

12.3 End-to-End Tests (Playwright)

Create session on device A, join on device B, verify B appears on A's map

Drop destination pin, verify ETA updates on all clients

Simulate arrived event, verify badge appears

12.4 Load Testing (k6)

100 concurrent sessions, 20 WebSocket connections each

Location update flood: 2000 messages/second, verify < 500ms broadcast

Redis memory usage under max load

13. Risks & Mitigations

14. Appendix

14.1 Third-Party API Reference

14.2 Key Environment Variables

14.3 Glossary

End of Document — SquadMap v1.0 PRD

SquadMap / Group Location Sharing App /  / Product Requirements & Design Document

Version / 1.0 | Date / June 2026 | Status / Draft | Author / Sourav · ECE + DS

Problem Statement / Friend groups travelling separately to the same venue (concert, restaurant, college fest) struggle to coordinate because: /   • WhatsApp location sharing is one-to-one, not group-visible /   • Google 'share location' requires a Google account and manual sharing /   • There is no lightweight, zero-friction app that shows all friends on one map

Solution / SquadMap lets one person create a session room (trip) and share a single link. Anyone who opens the link immediately appears on the shared map. A destination pin is dropped once, and each friend's ETA, distance, and live dot updates every 5 seconds.

Metric | Target | Measurement
Location update latency | < 2 seconds | P95 WebSocket round-trip
Session join time | < 5 seconds | Link tap to map visible
Concurrent users / session | Up to 20 | Load test
Battery drain (1 hr) | < 8% extra vs baseline | Android battery stats
Crash-free sessions | > 99.5% | Sentry error rate

Persona | Description | Primary Need
The Organiser | Creates the trip session, drops the destination pin | Quick setup, invite everyone fast
The Traveller | Joins via link, is on the way | See where friends are, know their ETA
The Late One | Joins after others have already started | Jump in without missing context
The Waiter | Already at destination | See who is close, who is far

ID | As a... | I want to... | Acceptance Criteria
US-01 | Organiser | Create a trip with one tap | Session created, shareable link generated in < 2s
US-02 | Organiser | Drop a destination pin on the map | Pin appears on all friends' maps instantly
US-03 | Traveller | Join by opening a link | No sign-up, name entry only, visible on map in < 5s
US-04 | Traveller | See all friends as labelled dots | Each dot shows friend's name, updates every 5s
US-05 | Traveller | Know each friend's ETA | ETA shown in a side panel, refreshes every 30s
US-06 | Traveller | Get notified when I arrive | Push/banner notification when within 100m of pin
US-07 | Organiser | Remove a participant | Dot disappears from all maps in < 2s
US-08 | Any user | Send a quick text to the group | Messages appear in overlay, max 500 chars
US-09 | Any user | Session ends automatically | Session expires 12h after creation; users get warning
US-10 | Any user | Use app without draining battery | GPS frequency reduces when stationary

FR-1: Session Management

ID | Requirement | Priority
FR-1.1 | User can create a new session without logging in; system generates a unique 8-character alphanumeric session code | Must Have
FR-1.2 | System generates a shareable URL: squadmap.app/join/{sessionCode} | Must Have
FR-1.3 | Session creator is labelled as Host and can drop/move the destination pin | Must Have
FR-1.4 | Session expires after 12 hours; all connected clients receive expiry warning 15 min before | Must Have
FR-1.5 | Host can end session early; all clients redirected to summary screen | Should Have
FR-1.6 | Sessions support up to 20 concurrent participants | Must Have
FR-1.7 | Participant joins by entering their display name (max 20 chars); no password required | Must Have

FR-2: Real-time Location

ID | Requirement | Priority
FR-2.1 | Client broadcasts GPS coordinates to server every 5 seconds when moving | Must Have
FR-2.2 | Server broadcasts updated coordinates to all session participants via WebSocket | Must Have
FR-2.3 | When user is stationary (< 10m movement in 60s), GPS polling reduces to every 30s | Must Have
FR-2.4 | Each participant is shown as a coloured circle with their name label on the map | Must Have
FR-2.5 | Tapping a participant dot shows: name, distance from destination, ETA, battery level | Should Have
FR-2.6 | Location data is stored in Redis only; purged when session ends | Must Have
FR-2.7 | User can temporarily pause their location share (dot shows as greyed-out) | Nice to Have

FR-3: Destination & ETA

ID | Requirement | Priority
FR-3.1 | Host can long-press or search to set a destination pin | Must Have
FR-3.2 | Destination pin is visible to all participants with a label | Must Have
FR-3.3 | System calculates ETA for each participant using driving/walking route | Must Have
FR-3.4 | ETA panel lists all participants sorted by ETA (soonest first) | Must Have
FR-3.5 | When a participant is within 100m of destination, system marks them as Arrived | Must Have
FR-3.6 | All participants receive a notification when someone arrives | Should Have
FR-3.7 | Host can change the destination; all ETAs recalculate within 10 seconds | Should Have

FR-4: Group Chat

ID | Requirement | Priority
FR-4.1 | Slide-up chat panel accessible via button in bottom navigation | Should Have
FR-4.2 | Messages include sender name, message text, and timestamp | Should Have
FR-4.3 | Messages limited to 500 characters; emoji supported | Should Have
FR-4.4 | Unread count badge shown on chat button when panel is hidden | Should Have
FR-4.5 | Pre-set quick messages: On my way, Almost there, I'm here! | Nice to Have

Requirement | Target
Location broadcast latency | < 500ms server processing + network
Map render on join | < 3 seconds on 4G
WebSocket reconnect | Automatic, < 2 seconds
API response time (P95) | < 200ms for session endpoints
Concurrent WebSocket connections | Up to 500 across all sessions

Architecture Pattern / Type: Event-driven microservice (monolith-first, splittable) / Communication: WebSocket (primary) + REST (session management) / State: Redis (ephemeral location), PostgreSQL (session metadata) / Deploy target: Docker containers on a single VPS for MVP, Kubernetes for scale

Component | Technology | Responsibility
PWA Client | React 18, Vite, Mapbox GL JS | Map rendering, GPS capture, UI
API Server | Node.js 20, Express 5 | REST endpoints, session CRUD
WS Server | Socket.IO 4 on Node.js | Real-time location broadcast, chat
Cache Layer | Redis 7 | Live locations, session TTL, pub/sub
Database | PostgreSQL 16 | Sessions, participants metadata
Map Tiles | Mapbox GL JS + CDN | Offline-capable vector map tiles
Routing API | Mapbox Directions API | ETA and distance calculations
Reverse Proxy | Nginx | SSL termination, load balancing

Table / Key | Fields | Notes
sessions (PG) | id, code, host_user_id, destination_lat, destination_lng, destination_name, created_at, expires_at, status | Primary session record
participants (PG) | id, session_id, display_name, color_hex, joined_at, left_at | Soft-delete on leave
loc:{sid}:{uid} (Redis) | lat, lng, accuracy, speed, heading, timestamp | TTL = session expiry
chat:{sid} (Redis List) | JSON: {user_id, name, text, ts} | Max 200 messages, LPUSH+LTRIM
session:{sid} (Redis Hash) | code, host_id, dest_lat, dest_lng, expires_at | Fast lookup without PG hit

Method | Endpoint | Auth | Description
POST | /api/sessions | None | Create a new session. Body: { displayName, destination? }. Returns: { sessionId, sessionCode, joinUrl }
GET | /api/sessions/:code | None | Get session info (participants count, destination). Returns 404 if expired
POST | /api/sessions/:code/join | None | Join session. Body: { displayName }. Returns: { userId, token, wsUrl }
DELETE | /api/sessions/:code | Host token | Host ends session early. Broadcasts session_ended to all clients
PATCH | /api/sessions/:code/destination | Host token | Update destination pin. Body: { lat, lng, name }
GET | /api/sessions/:code/participants | Session token | List all active participants with last-known location
POST | /api/sessions/:code/chat | Session token | Send a chat message. Body: { text }
GET | /api/sessions/:code/chat | Session token | Get last 50 chat messages

Direction | Event | Payload | Description
Client → Server | location_update | { lat, lng, accuracy, speed, heading } | Emitted every 5s (moving) or 30s (stationary)
Client → Server | pause_location | { paused: true/false } | Toggle location visibility
Client → Server | chat_message | { text } | Send chat message to room
Server → Client | location_broadcast | { userId, name, lat, lng, color, timestamp } | Other user's location update
Server → Client | eta_update | Array of { userId, name, etaSeconds, distanceMeters, arrived } | Broadcast every 30s
Server → Client | participant_joined | { userId, name, color } | New user joins
Server → Client | participant_left | { userId, name } | User disconnects
Server → Client | destination_updated | { lat, lng, name } | Host changed destination
Server → Client | session_ended | { reason } | Session expired or host ended
Server → Client | arrived | { userId, name } | A participant reached destination

Token | Value & Usage
--primary | #1A73E8 — CTAs, session button, link colour
--surface | #FFFFFF — sheet backgrounds, cards
--map-bg | Mapbox Light v11 — map tiles
--arrived-green | #1E8E3E — arrived badge, success states
--warning-amber | #F29900 — ETA warning (< 5 min away)
--danger-red | #D93025 — session ending, remove user
--text-primary | #202124 — primary labels
--text-secondary | #5F6368 — muted labels, timestamps
User dot colours | 10 distinct hues auto-assigned: Blue, Teal, Purple, Coral, Amber, Pink, Green, Red, Indigo, Cyan

Style | Spec
App Name / Hero | Inter 700, 28px
Map Name Label (dot) | Inter 600, 12px, white on coloured pill
ETA Panel — Name | Inter 600, 15px
ETA Panel — Time | Inter 400, 14px, muted
Bottom sheet — Title | Inter 700, 18px
Body / chat message | Inter 400, 15px
Caption / timestamp | Inter 400, 12px, muted

User Action | Navigation Result
Tap Start a Trip | Home → Name Entry → Map (new session)
Open invite link | Deep link → Join Screen → Map (existing session)
Drag bottom sheet up | Map → ETA Sheet (modal, dismissable)
Tap chat button | Map → Chat Sheet (modal, dismissable)
Tap share icon | Native share sheet (overlay)
Session ends / expires | Map → Session Ended screen
Tap Back on Session Ended | Session Ended → Home

Breakpoint | Layout
< 480px (mobile portrait) | Primary target. Full-screen map, sheets slide up from bottom
480–768px (mobile landscape / tablet) | Map fills left 65%, ETA panel pinned right side
> 768px (desktop / tablet) | Two-column: map left, ETA + chat panel right. No bottom sheets

Technology | Version | Purpose | Reason
React | 18 | UI framework | Component model, hooks, PWA support
Vite | 5 | Build tool | Fast HMR, PWA plugin
Mapbox GL JS | 3 | Map rendering | Vector tiles, custom layers, offline
Socket.IO Client | 4 | WebSocket | Auto-reconnect, fallback transport
Zustand | 4 | State management | Lightweight, no boilerplate
TanStack Query | 5 | REST data fetching | Cache, refetch, loading states
Tailwind CSS | 3 | Styling | Utility-first, consistent design
Workbox (PWA) | 7 | Service worker | Offline support, background sync

Technology | Version | Purpose | Reason
Node.js | 20 LTS | Runtime | Non-blocking I/O, WebSocket performance
Express | 5 | HTTP server | REST API routing
Socket.IO | 4 | WebSocket server | Rooms, namespaces, Redis adapter
socket.io-redis-adapter | 8 | Pub/Sub bridge | Multi-server WebSocket fanout
ioredis | 5 | Redis client | Async, pipeline support
pg (node-postgres) | 8 | PostgreSQL client | Session metadata storage
Zod | 3 | Validation | Runtime schema validation for API bodies
Winston | 3 | Logging | Structured JSON logs

Layer | Technology | Notes
Container | Docker + Docker Compose | Single VPS for MVP
Reverse proxy | Nginx | SSL termination, WebSocket upgrade headers
Database | PostgreSQL 16 | Managed via Supabase or self-hosted
Cache | Redis 7 | Local container; Redis Cloud for prod
CI/CD | GitHub Actions | Lint → Test → Build → Deploy
Monitoring | Prometheus + Grafana | WebSocket connection count, ETA latency
Error tracking | Sentry | Frontend and backend
Map tiles | Mapbox (free tier up to 50k loads/mo) | Swap to self-hosted later

Repository Layout / squadmap/ /   apps/ /     client/                 # React PWA (Vite) /       src/ /         components/         # MapView, ETAPanel, ChatSheet, UserDot ... /         hooks/              # useLocation, useWebSocket, useSession ... /         stores/             # Zustand stores: session, participants, chat /         pages/              # Home, Join, Map, SessionEnded /         lib/                # mapbox.ts, socket.ts, api.ts /       public/ /         manifest.json       # PWA manifest /         sw.js               # Workbox service worker /     server/                 # Node.js backend /       src/ /         routes/             # sessions.ts, participants.ts, chat.ts /         sockets/            # location.ts, chat.ts, session.ts handlers /         services/           # redis.ts, postgres.ts, mapbox.ts, eta.ts /         middleware/         # auth.ts, rateLimiter.ts, validate.ts /         utils/              # logger.ts, errors.ts, sessionCode.ts /       tests/                # Jest integration tests /   infra/ /     docker-compose.yml /     nginx.conf /   .github/workflows/        # CI/CD pipelines /   docs/                     # This document, ADRs, wireframes

Phase | Duration | Key Deliverable
Phase 1 — MVP | 3 weeks | Working app: join, see friends, ETA
Phase 2 — Polish | 2 weeks | Chat, battery mode, PWA install
Phase 3 — Production | 1 week | Deployed, monitored, load-tested
Buffer / Bug Fix | 1 week | Hardening and edge cases
Total | 7 weeks | Production-ready v1.0

Risk | Likelihood | Impact | Mitigation
iOS Safari GPS background limitation | High | High | Warn users; use Wake Lock API; suggest PWA install
Mapbox API cost overrun | Medium | Medium | Set billing alert at $50/mo; cache tile requests via SW
Redis memory exhaustion under load | Low | High | Set maxmemory-policy allkeys-lru; monitor with Grafana
WebSocket scaling across servers | Medium | High | Use socket.io-redis-adapter from day 1
GPS inaccuracy in dense urban areas | High | Medium | Show accuracy radius on dot; smooth with Kalman filter
Session abuse / spam creation | Medium | Low | Rate limit session creation per IP to 5/hour

API | Usage
Mapbox GL JS | Vector map tiles, marker rendering, camera animation
Mapbox Directions API | ETA and route distance calculation
Web Geolocation API | GPS coordinate capture (browser native)
Web Push API | Arrived notifications (requires VAPID keys)
Web Share API | Native share sheet for invite link

Required Environment Variables / # Client (Vite) / VITE_MAPBOX_TOKEN=pk.eyJ1... / VITE_API_BASE_URL=https://api.squadmap.app /  / # Server / DATABASE_URL=postgres://user:pass@localhost:5432/squadmap / REDIS_URL=redis://localhost:6379 / MAPBOX_SECRET_TOKEN=sk.eyJ1... / VAPID_PUBLIC_KEY=... / VAPID_PRIVATE_KEY=... / SESSION_EXPIRY_HOURS=12 / MAX_PARTICIPANTS_PER_SESSION=20

Term | Definition
Session | A temporary shared map instance created for one trip, expires after 12 hours
Session Code | 8-character alphanumeric ID used in the join URL
Host | The user who created the session; can set destination and remove participants
Participant Dot | Coloured circle on the map representing a user's real-time GPS position
ETA | Estimated time of arrival at the destination via the Mapbox Directions API
Arrived | Status when a participant's GPS is within 100 metres of the destination pin
Battery-aware polling | Reducing GPS update frequency from 5s to 30s when the device is stationary
Redis TTL | Time-to-live on a Redis key; used to auto-delete location data when session ends
Socket.IO Room | A named channel on the server; all participants in a session join the same room

---

# Part II — UI/UX Design Specification

1. Design Principles

Every design decision in SquadMap must serve one goal: let a group of friends see each other on a map and get to the same place with zero friction. The following five principles govern all UI and UX choices.

2. Visual Identity

2.1 Logo & Name

App name: SquadMap. Tagline: Get there together.

Logo mark: two overlapping location pins forming a stylised S shape, in Primary Blue (#1A73E8)

Wordmark: Inter 700, sentence case, Primary Dark (#0D47A1)

Clear space: minimum 16px on all sides of the logo mark

Minimum size: 24px height for digital use

2.2 Personality Descriptors

When designing any screen, UI element, or illustration, keep these five words in mind:

3. Color System

3.1 Primary Palette

3.2 Friend Dot Color Pool

Each participant is auto-assigned one of 10 distinct colours. Assignment is sequential — first joiner gets Blue, second Teal, and so on. Colours are chosen for maximum contrast against the Mapbox Light map tile background.

3.3 Semantic Colors

4. Typography

4.1 Typeface

Primary: Inter (Google Fonts, self-hosted via Vite). Fallback: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif.

4.2 Type Scale

4.3 Writing Style

Sentence case everywhere — never Title Case or ALL CAPS

Short and action-oriented: Start a trip, not Create New Session

Use contractions: You're, Can't, It's

No exclamation marks in system UI — only allowed in quick-reply chips

Empty states: friendly invitation, not an apology

5. Spacing, Layout & Grid

5.1 Base Grid

5.2 Border Radius

5.3 Touch Targets

Minimum touch target: 44×44pt on all interactive elements

FABs: 56×56pt, circular

Bottom sheet drag handle: 40×4pt, centered, 8px from top of sheet

Map dots: 40pt diameter (minimum) with invisible 12pt padding around

6. Component Specifications

7. Screen-by-Screen Specification

Purpose: Entry point. User creates a new session or joins via code.

Purpose: Shown when user opens an invite link. Confirms trip details before joining.

Purpose: Core experience. Full-screen real-time map showing all participants and destination.

8. Animation & Motion

9. Responsive Design

9.1 Breakpoints

9.2 Mobile-specific Patterns

iOS: respect env(safe-area-inset-*) for notch + home bar

Bottom sheet must not overlap home indicator — minimum 34px clearance

All tap targets minimum 44×44pt per Apple HIG

Pull-to-refresh disabled on map screen (conflicts with drag gesture)

Long-press on map to drop destination pin — 400ms hold with haptic feedback

10. AI Design Tool Prompts

10.1 Figma / FigJam Prompt

Use this prompt when describing the app to an AI design assistant inside Figma or when using v0.dev or Framer AI:

10.2 Midjourney / DALL-E Prompt — Onboarding Illustration

10.3 v0.dev / React Prompt — Live Map Screen

10.4 Framer AI Prompt — Onboarding Flow

11. Accessibility

11.1 Contrast Requirements

11.2 Interaction Accessibility

All interactive elements have aria-label or visible text

Focus ring: 2px #1A73E8 offset 2px on all focusable elements

Map dots are keyboard-navigable (Tab) with Enter to open detail

Bottom sheet dismissible via Escape key or swipe down

Reduce motion: CSS @media (prefers-reduced-motion) disables all animations

Screen reader: map announces participant count and destination on load

11.3 iOS & Android Specifics

Dynamic Type support: body text scales with system font size setting

High Contrast mode: borders increase to 2px, all tints darken by 20%

VoiceOver / TalkBack: each friend dot labeled Friend: [Name], [ETA] away

12. Dark Mode

SquadMap ships with full dark mode support, driven by CSS variables that automatically adapt via prefers-color-scheme media query and a manual toggle in the session menu.

End of Document — SquadMap UI/UX Design Specification v1.0

SquadMap / UI / UX Design Specification & Prompt Guide /  / Screens · Components · Color System · Typography · AI Tool Prompts

Type / PWA (mobile-first) | Platform / iOS Safari + Android Chrome | Design Tool / Figma / v0 / Framer | Version / 1.0

Principle | Tagline | What it means in practice
Map-first | Chrome is a guest | The map fills 100% of the screen. Every control is an overlay, never a page that replaces the map.
Zero friction | Open and go | No sign-up, no app install, no tutorial. Tap a link, enter a name, appear on the map in under 5 seconds.
Glanceable | One look = full picture | All critical info — who is close, who is far, ETA — visible without tapping or scrolling.
Inclusive motion | Move together | Animations confirm state (dot pulse = updated, sheet slide = natural gesture). Never decorative.
Battery-aware | Respect the device | GPS polling slows when stationary. Battery % shown in friend detail. App never silently drains.

Word | Means | Avoid
Friendly | Warm colours, round shapes, casual language | Cold grays, sharp corners, corporate tone
Immediate | No loading states longer than 2s, instant map open | Splash screens, interstitial ads, forced tutorials
Playful | Colourful friend dots, subtle animations | Excessive motion, emoji overload, cartoon-heavy
Trustworthy | Accurate ETAs, honest battery warnings | Fake precision, hidden data sharing
Lightweight | Minimal chrome, nothing unnecessary | Feature creep, cluttered overlays

 |  |  |  |  | 
Primary / #1A73E8 | Primary Dark / #0D47A1 | Primary Tint / #E8F0FE | Arrived / #1E8E3E | Warning / #F29900 | Danger / #D93025

 |  |  |  |  | 
Text / #202124 | Muted / #5F6368 | Border / #DADCE0 | Surface / #F8F9FA | White / #FFFFFF | Black / #000000

 |  |  |  | 
Blue / #185FA5 | Teal / #0F6E56 | Purple / #534AB7 | Coral / #993C1D | Amber / #854F0B

 |  |  |  | 
Pink / #993556 | Green / #3B6D11 | Red / #A32D2D | Cyan / #0D7A8A | Slate / #444D5E

Token | Usage + Value
--arrived | User reached destination · #1E8E3E (Green)
--arrived-bg | Arrived badge background · #E6F4EA
--warning | ETA warning (< 5 min) · #F29900 (Amber)
--warning-bg | Warning state background · #FEF3E2
--danger | Session ending, remove user · #D93025
--danger-bg | Danger state background · #FCE8E6
--host-crown | Host indicator overlay · #F29900
--paused-dot | Location paused dot · #DADCE0 (Gray)
--destination-pin | Destination marker fill · #D93025

Style | Specification
Hero / App name | Inter 700, 28px, color: #0D47A1
Screen title | Inter 600, 20px, color: #202124
Section heading | Inter 600, 18px, color: #202124
Card title / name | Inter 600, 15px, color: #202124
Body / chat message | Inter 400, 15px, line-height: 1.6, color: #202124
Label / caption | Inter 400, 13px, color: #5F6368
Map dot label | Inter 600, 12px, color: #FFFFFF (on coloured pill)
Micro / timestamp | Inter 400, 11px, color: #5F6368
Button text | Inter 500, 15px, letter-spacing: 0.01em
Code / session code | JetBrains Mono 600, 14px, color: #1A73E8 on #E8F0FE bg

Token | Value
Base unit | 4px
xs | 4px
sm | 8px
md | 16px
lg | 24px
xl | 40px
xxl | 64px

Element | Radius
Buttons | 12px
Input fields | 10px
Bottom sheets | 20px top corners, 0px bottom
Friend dot | 50% (circle)
Chips / pills | 100px (fully rounded)
Cards | 12px
Toast / snackbar | 10px
Session code badge | 6px

6.1 Map Dot (Friend Marker)

Property | Spec
Shape | Circle, 40pt diameter (mobile), 48pt (desktop)
Fill | Auto-assigned from friend dot colour pool
Label | Name pill below dot: 12pt Inter 600, white text on same colour bg
Selected state | 2pt white ring + same colour outer ring
Arrived state | Green fill (#1E8E3E) + white checkmark icon
Paused state | Gray fill (#DADCE0), name in muted gray
Animation | CSS pulse (box-shadow scale 1→1.4, opacity 1→0) on update
Tap action | Expand bottom sheet card with: name, ETA, distance, battery %

6.2 Bottom Sheet

Property | Spec
Top radius | 20px (left + right), 0px bottom
Drag handle | 40×4px, #DADCE0, centered, 8px from top
Collapsed height | 72px (shows handle + 2 ETA rows)
Expanded height | 55% of screen height
Background | #FFFFFF with 1px top shadow
Backdrop | Semi-transparent overlay NOT used (map stays visible)
Animation | spring easing, 300ms, overshoot 0.1
Scroll | Internal scroll when content exceeds expanded height

6.3 Buttons

Variant | Spec
Primary CTA | 48pt height, 12px radius, fill: #1A73E8, text: #FFFFFF, Inter 500 15px
Secondary | 48pt height, 12px radius, border: 1px #DADCE0, fill: transparent, text: #202124
Destructive | Same as Primary but fill: #D93025
FAB (circular) | 56pt diameter, fill: #FFFFFF, shadow: 0 2px 8px rgba(0,0,0,0.15), icon: 24pt
Quick-reply chip | 32pt height, fully rounded, border: 1px #DADCE0, fill: #F8F9FA, text: 13px
Icon button | 44×44pt touch area, icon centered, no border by default

6.4 Top Overlay Bar

Property | Spec
Background | rgba(255,255,255,0.92) with backdrop-filter: blur(8px)
Height | 52pt
Left content | Session code pill: Inter Mono 600, 14px, #1A73E8 on #E8F0FE bg, 6px radius
Center content | Participant count: icon + number, Inter 400 14px, #5F6368
Right content | Share icon (24pt) + overflow menu icon (24pt)
Border | 0.5px bottom border #DADCE0
Position | Absolute, top: 0, left: 0, right: 0 (safe area top inset)

S-01  Home Screen

Element | Specification
Background | White (#FFFFFF)
Illustration | Isometric map with 3 coloured dots converging on a pin — centred, 280pt wide, top 40% of screen
App logo | SquadMap wordmark — Inter 700 28px, #0D47A1, centred below illustration
Tagline | Get there together. — Inter 400 17px, #5F6368, centred, 8px below logo
Name input | Full-width, 48pt height, placeholder: Your name, border: 1px #DADCE0, 12px radius
Primary CTA | Start a trip — full-width, 48pt, #1A73E8 fill, rounded 12px, 16px below input
Secondary link | Join with a code — Inter 400 15px, #1A73E8, centred, 12px below CTA
Bottom safe area | Minimum 34px iOS home bar clearance

S-02  Join Screen

Element | Specification
Back chevron | Top-left, 44×44pt tap target, navigates to Home
Session card | 12px radius card, border 0.5px #DADCE0, padding 16px
Destination icon | Map pin icon 24pt, #1A73E8, left of destination text
Destination name | Inter 600 17px, #202124
Destination address | Inter 400 14px, #5F6368, 4px below name
Participant count | 3 friends are already on the way — Inter 400 14px, #5F6368, icon + text
Divider | 0.5px #DADCE0 inside card
Name input | Your name — 48pt height, 12px radius, full-width
Join CTA | Join the trip — full-width primary button, 48pt
Error state (expired) | Red banner: This trip has ended. + Start new trip link

S-03  Live Map Screen (Primary)

Element | Specification
Map | Mapbox Light v11, full-screen, no UI chrome from Mapbox (disable default controls)
Top bar | See Component 6.4 — session code + count + share + menu
Friend dots | See Component 6.1 — coloured circles with name pills
Destination pin | Custom SVG: #D93025 teardrop pin, white star inside, 48pt tall
Route lines | SVG polyline: dashed (8px dash, 4px gap), 1.5px stroke, colour matches dot
Chat FAB | Bottom-left, 56pt circle, chat bubble icon, white bg + shadow
Unread badge | Red circle 18pt, white Inter 600 11px count, top-right of chat FAB
Centre map FAB | Bottom-right, 44pt circle, crosshair icon, white bg + shadow
ETA sheet | Collapsed (72pt) by default, drag to expand — see Component 6.2
Arrived toast | Green banner slides from top: [Name] arrived! — 3s auto-dismiss

S-04  ETA Bottom Sheet (Expanded)

Element | Specification
Sheet header | Heading: Who's on the way — Inter 600 17px, 16px from drag handle
Sort order | Ascending by ETA (soonest first); arrived users pinned to bottom
Participant row | 56pt height, left dot (32pt) + name column + ETA right-aligned
Dot | 32pt circle, participant colour, initial letter centered
Name | Inter 600 15px, #202124
Distance sub-label | Inter 400 13px, #5F6368 — e.g. 2.3 km away
ETA | Inter 600 15px, #202124 — e.g. 8 min; turns #F29900 when < 5 min
Arrived badge | Green pill: Arrived · Inter 500 12px, #1E8E3E on #E6F4EA, replaces ETA
Divider | 0.5px #DADCE0 between rows
Destination row (pinned top) | Star icon + destination name + You're here (if arrived)

S-05  Chat Overlay

Element | Specification
Sheet height | 60% of screen, drag handle at top
Message bubble (others) | Left-aligned, colour matches dot, white text, 8px radius (2px bottom-left)
Message bubble (self) | Right-aligned, #E8F0FE fill, #202124 text, 8px radius (2px bottom-right)
Sender name | Inter 500 12px, above bubble, colour matches dot
Timestamp | Inter 400 11px, #5F6368, below bubble
Quick-reply chips | Scrollable horizontal row above input: On my way, Almost there!, Where are you?
Input bar | 48pt height, border 1px #DADCE0, 12px radius, placeholder: Message...
Send button | 32pt circle, #1A73E8, arrow icon, right of input
Max messages shown | 200 (LIFO); auto-scroll to newest on receive

S-06  Session Ended

Element | Specification
Illustration | Checkered flag illustration or group arrival graphic, centred, 200pt
Title | Trip complete — Inter 700 24px, centred
Summary card | 12px radius card, border 0.5px #DADCE0, padding 16px
Duration row | Clock icon + Trip duration: 42 minutes — Inter 400 15px
Destination row | Pin icon + destination name
Participants grid | Horizontal row of dot avatars with name below, green check if arrived
Primary CTA | Start new trip — full-width primary button
Secondary link | Share trip summary — text link, optional

Interaction | Animation Spec
Screen transition | Slide up (y: 100% → 0), 280ms, ease-out cubic
Bottom sheet open | Spring: stiffness 300, damping 30, mass 1
Bottom sheet close | Ease-in 200ms
Dot update (location) | CSS pulse: box-shadow scale 1→1.6, opacity 1→0, 600ms ease-out
Arrived toast | Slide from top 60px, 300ms spring; fade out at 3s
Participant joined | Dot fade-in + scale 0→1, 400ms spring
Participant left | Dot fade out, 250ms ease-in
ETA countdown change | Number crossfade, 200ms ease
Chat message appear | Slide from bottom + fade, 200ms ease-out
Loading spinner | Circular stroke dash offset, 1s linear infinite

Breakpoint | Range | Layout
Mobile portrait | < 480px | Full-screen map · bottom sheets · stacked FABs · single column
Mobile landscape | 480–767px | Map 65% left · ETA panel pinned right 35% · no bottom sheet
Tablet portrait | 768–1023px | Map 60% left · wider panel right · chat inline
Desktop | ≥ 1024px | Two column: map left · panel right 380px fixed · no sheets · sidebar nav

Figma Prompt — Full App / Design a mobile-first Progressive Web App called SquadMap — a real-time / group location sharing app for friends travelling to a common destination. /  / Visual style: clean map-first UI, minimal chrome, no gradients. Google Maps / Light map tiles as background. White bottom sheets, flat design, 0.5px borders. /  / Primary: #1A73E8. Text: #202124. Muted: #5F6368. Arrived: #1E8E3E. / Font: Inter. Bold 700 for hero, 600 for names, 400 for body. /  / Design for iPhone 14 Pro (393x852pt @3x). Create these screens: / 1. Home — illustration of map with dots, app name, name input, Start a trip CTA / 2. Join — session card + participant count + name input + Join button / 3. Live map — full-screen Mapbox Light, friend dots, destination pin, ETA sheet / 4. ETA sheet expanded — list: avatar + name + ETA + distance + arrived badge / 5. Chat — bubble messages, quick-reply chips, input bar / 6. Session ended — summary card, participant grid, Start new trip CTA

Image Generation Prompt / Flat vector illustration, isometric view, clean minimal style. / A city map from above with winding roads and blocks. / Three colourful circular location pins (blue, teal, orange) moving along / different roads, all converging toward a single red destination star marker. / Soft muted pastel map tones: light sage green roads, cream blocks, pale sky. / No people, no text. 2:1 aspect ratio. White background. / Style: Google Maps illustration, Notion-style flat icon, Material Design 3.

v0.dev Component Prompt / Build a mobile map screen component for a group location sharing app. /  / Layout: full-screen container (100dvh), overflow hidden. /  / Top overlay bar (position absolute, top 0, full-width): /   - Semi-transparent white bg (rgba 255,255,255,0.92), backdrop blur 8px /   - Left: session code pill (monospace, #1A73E8 on #E8F0FE, 6px radius) /   - Center: people icon + count (Inter 400 14px #5F6368) /   - Right: share icon + menu icon (each 44x44pt tap target) /  / Map area: placeholder div with light gray-green gradient background. / 3 coloured circles (40pt) positioned absolutely: You (blue), Raj (teal), Priya (amber). / Each circle has a name label pill below it (white text, same colour bg, 12px radius). / Red destination pin at upper-right of map area. /  / Bottom sheet (position absolute, bottom 0, full-width): /   - White bg, border-radius 20px 20px 0 0, padding 8px 16px 24px /   - Drag handle: 40x4px, #DADCE0, centered, margin-top 8px /   - 3 ETA rows: dot avatar (24pt) + name + ETA right-aligned (Inter 600 15px) /  / Bottom-left FAB: 56pt white circle, chat icon, box-shadow, unread badge. / Use Tailwind CSS. Mobile width 390px. No map library needed — just styled divs.

Framer Prompt / Create a 2-screen onboarding flow for SquadMap, a group location app. /  / Screen 1 (Home): /   - White background, centered layout /   - Large illustration placeholder (280pt square, light blue bg with rounded corners) /   - App name: SquadMap in Inter Bold 28px #0D47A1 /   - Tagline: Get there together. in Inter 17px #5F6368 /   - Text input: Your name, 48pt height, 1px #DADCE0 border, 12px radius, full-width /   - Primary button: Start a trip, full-width, 48pt, #1A73E8 bg, white Inter 500 15px /   - Text link below: Join with a code, #1A73E8 14px /  / Screen 2 (Join — appears on button tap): /   - Same white bg /   - Card: 1px #DADCE0 border, 12px radius, 16px padding /   - Inside card: pin icon + destination name (Inter 600 17px) + address (14px muted) /   - Divider 0.5px inside card /   - Participant count row: people icon + 3 friends are already on the way /   - Text input: Your name /   - Primary button: Join the trip /  / Transition: Screen 1 slides up as Screen 2 comes in from below. Spring easing 280ms.

Element | Minimum Contrast Ratio
Body text on white | 4.5:1 (WCAG AA)
Large text (> 18px bold) | 3:1
White text on coloured dot | 4.5:1 — all 10 dot colours verified
Blue text on tint (#E8F0FE) | 4.5:1 — #1A73E8 on #E8F0FE passes at 4.6:1
Muted text (#5F6368 on white) | 4.5:1 — passes at 5.9:1
Map labels | Mapbox Light ensures minimum 3:1 for all tile labels

Token | Light → Dark
Map tiles | Mapbox Light v11 → Mapbox Dark v11
Surface / sheet bg | #FFFFFF → #1C1C1E
Card bg | #F8F9FA → #2C2C2E
Top bar bg | rgba(255,255,255,0.92) → rgba(28,28,30,0.92)
Text primary | #202124 → #F2F2F7
Text muted | #5F6368 → #8E8E93
Border | #DADCE0 → #3A3A3C
Session code pill | #E8F0FE / #1A73E8 → #1C3557 / #6EB5FF
Friend dots | Colours unchanged (same hues work on dark map bg)
Arrived badge | #E6F4EA / #1E8E3E → #0A2E14 / #34A853

---

# End of Combined Document

SquadMap v1.0 · Combined PRD + UI/UX Specification
