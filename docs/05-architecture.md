# 05 · Architecture

This document is the working summary of the system. The database and API overview is in `docs/00-zero-to-production-roadmap.md` (sections 5 and 6).

## System
```
Browser PWA (React, Mapbox, STOMP)
   | HTTPS REST /api/v1          | WSS /ws (SockJS fallback)
   v                              v
Nginx (TLS, gzip, rate limit, sticky not required)
   v
Spring Boot app (stateless, N instances)
   |-- PostgreSQL 16  : users, trips, members, messages, summaries, push subs
   |-- Redis 7        : live positions (TTL), pub/sub fan-out, rate-limit buckets, STOMP broker relay
   |-- Mapbox APIs    : geocoding, directions (server-side proxy with cache)
   |-- Web Push (VAPID), SMTP for email
```
Why Redis pub/sub: lets several app instances serve the same trip; each instance relays Redis messages to its local STOMP sessions.

## Modules (package by feature)
| Module | Responsibility |
|---|---|
| `auth` | Signup, login, refresh rotation, guest tokens, password reset, OAuth, rate limits |
| `user` | Profile, settings, export, delete |
| `trip` | Create, expire, extend, end, members, summaries |
| `invite` | Code generation, preview, join, QR payload |
| `location` | Ingest, validate, store in Redis, broadcast, stale detection, arrival detection |
| `eta` | Directions calls, caching, ETA computation, sort |
| `chat` | Messages, typing, quick replies, unread counts |
| `notify` | In-app alerts, web push, email |
| `common` | Errors (problem+json), security config, time, ids, audit |

## REST API (v1)
```
POST   /auth/signup | /auth/login | /auth/refresh | /auth/logout | /auth/forgot | /auth/reset | /auth/oauth/google
GET    /me                  PATCH /me/settings    GET /me/trips   GET /me/stats   GET /me/export   DELETE /me
GET    /me/alerts           POST  /me/alerts/read POST /me/push/subscribe
POST   /trips               GET   /trips?status=  GET /trips/{id}   PATCH /trips/{id}
POST   /trips/{id}/extend   POST  /trips/{id}/end GET /trips/{id}/summary
GET    /trips/{id}/invite   GET   /trips/{id}/members   GET /trips/{id}/members/{uid}
DELETE /trips/{id}/members/me
GET    /join/{code}/preview POST  /join/{code}
POST   /trips/{id}/locations   (fallback to WS)
GET    /trips/{id}/eta
GET    /trips/{id}/messages POST  /trips/{id}/messages   POST /trips/{id}/messages/read
GET    /places/search?q=    GET   /places/recent
```
Conventions: JSON, ISO-8601 UTC timestamps, ids are UUIDv7 (time-ordered), pagination by cursor, idempotency key header on create endpoints, problem+json errors with `code` such as `TRIP_EXPIRED`, `INVALID_CODE`, `RATE_LIMITED`.

- Pause: `PUT /trips/{id}/members/me/pause` `{paused}` (members and guests who are sharing; 10 changes a minute). Pausing keeps consent and marks `trip_members.paused_at`; the last spot stays for friends, the ETA is deleted, the app stops reading the location, and everyone hears `PAUSED` or `RESUMED`. Doing it again changes nothing.

## WebSocket protocol (STOMP over SockJS)
- Connect `/ws` (plain WebSocket at `/ws/websocket`, SockJS for clients that can't use one) with the STOMP CONNECT header `Authorization: Bearer <token>` (user token or trip-scoped guest token). The connection must sign in again once that token runs out.
- Subscribe: `/topic/trip.{id}.locations`, `/topic/trip.{id}.events`, `/topic/trip.{id}.eta` (ETA changes, `{memberId, distanceM, durationS, mode, route (polyline6), progress, estimated, computedAt}`), `/topic/trip.{id}.chat`, and `/user/queue/errors` for the client's own refused updates. An interceptor checks membership of a running trip on every SUBSCRIBE; any other destination, and any SEND other than a location or a "typing" signal, is refused.
- Refusals close the connection with an ERROR frame whose message is a stable code: `UNAUTHENTICATED` (sign in again and reconnect), `TRIP_NOT_FOUND`, `TRIP_EXPIRED`, `FORBIDDEN` (stop).
- Send: `/app/trip.{id}.loc` payload `{lat, lng, acc, speed, heading, ts}` (`ts` ISO-8601). Only from a member who agreed to share (`POST /trips/{id}/sharing` records it for the host and for people who chose "Not now"). Server allows 1 update per 2 s on average, rejects accuracy over 200 m, readings over 5 min old or in the future, and impossible jumps (over 70 m/s once accuracy is allowed for), ignores readings older than the one kept, stores to Redis `trip:{id}:loc:{memberId}` TTL 600 s, and broadcasts `{memberId, lat, lng, acc, speed, heading, ts}`. While the sender has paused, readings are refused with `PAUSED`. Refusals go to the sender's error queue as `{code, message, retryAfter}`.
- Chat: messages are sent with `POST /trips/{id}/messages` `{text, clientId}` (plain text, 1 to 280 characters after control characters are stripped; the same `clientId` again returns the first message instead of posting twice; 20 a minute per member; 410 `TRIP_EXPIRED` after the trip ends; 403 `CHAT_OFF` when the host turned chat off). Each new message is broadcast on `/topic/trip.{id}.chat` as `{type: "MESSAGE", message: {id, memberId, displayName, color, text, sentAt, clientId}}`. Send `/app/trip.{id}.typing` (empty body) while writing, at most every 2 s (more are dropped quietly); others receive `{type: "TYPING", memberId, at}` and show dots for 5 s. `GET /trips/{id}/messages?before=&limit=` pages newest first and includes `unread` (messages from others after the member's `chat_read_upto`) and the caller's own `memberId`; `POST /trips/{id}/messages/read {lastSeenId}` moves `chat_read_upto` forward only. The chat stays readable after the trip ends and is deleted 7 days later.
- Fan-out: every instance publishes to the Redis channel `squadmap:live` and relays what it hears to its own clients, so several instances serve the same trip.
- Events: `MEMBER_JOINED`, `MEMBER_LEFT`, `SHARING_STARTED`, `ARRIVED`, `PAUSED`, `RESUMED`, `TRIP_EXTENDED`, `TRIP_ENDED`. There is no `TRIP_ENDING_SOON` event: every app knows the trip's end time, warns 10 minutes before it (E1), and re-reads the trip on `TRIP_EXTENDED`. Leaving deletes that member's spot and ETA; ending or expiry deletes every spot and ETA on the trip.
- ETAs and arrival: after each stored spot, in the background, if the trip has a destination. Within 60 m of it for 20 s sets `trip_members.arrived_at` once and sends `ARRIVED`; leaving the 60 m circle restarts the 20 s. Otherwise a new route (the full line) is asked of Mapbox Directions only after 100 m moved, 60 s passed or a change of mode. The mode is what the member chose (`PUT /trips/{id}/members/me/travel-mode`: car or bike use `driving-traffic`, walk uses `walking`); before they choose, car beyond 2 km and walk nearer, kept for the trip; routes are shared for 20 s by everyone starting from the same ~50 m square; at most 300 Directions calls per trip per hour. Without a fresh route (over budget, Mapbox down, no token) the ETA is scaled from the last route, or estimated from the straight line, and marked `estimated`. ETAs live in Redis `eta:{tripId}:{memberId}` (TTL 10 min). `GET /trips/{id}/eta` is the snapshot.
- Heartbeats 10 s. Client reconnects with exponential backoff (1, 2, 4, 8, max 15 s) and re-subscribes; on reconnect it fetches `/trips/{id}/members` (everyone, whether they share, and spots under 10 min old) for the latest snapshot.

## Data model (summary)
`users(id, email, password_hash, name, color, settings jsonb, created_at, deleted_at)`
`trips(id, host_id, name, code, dest_name, dest_lat, dest_lng, chat_enabled, starts_at, expires_at, ended_at, status)`
`trip_members(id, trip_id, user_id null, display_name, color, role, joined_at, left_at, arrived_at, travel_mode, chat_read_upto, paused_at)`
`chat_messages(id, trip_id, member_id, client_id, body, created_at)`
`trip_summaries(trip_id, distance_m, duration_s, member_count, route_polyline_simplified)`
`refresh_tokens(id, user_id, hash, expires_at, revoked_at)`
`push_subscriptions(id, user_id, endpoint, p256dh, auth)`
`alerts(id, user_id, type, payload jsonb, read_at, created_at)`
Redis: `trip:{id}:loc:{memberId}` (TTL 600 s; no TTL while the member has paused, deleted when they leave or the trip ends or expires, and back to 600 s when they resume), `trip:{id}:members` (set), `rl:{key}` (Bucket4j), `eta:{tripId}:{memberId}` (TTL 20 s).

## Scheduling jobs
- Every 30 s: find trips expiring within 10 min (send warning once), expiring now (end, close sockets, write summary, purge Redis).
- Hourly: purge expired refresh tokens and reset tokens. Nightly: delete alerts over 30 days old and the chat of trips that ended over 7 days ago. Daily: hard-delete accounts past the 30 day grace period.
Use `@Scheduled` with ShedLock (Postgres) so only one instance runs each job.

## Security
- Passwords: Argon2id (or BCrypt cost 12). Never log credentials.
- JWT access 15 min, refresh 30 days rotating with reuse detection (revoke the family on reuse). Cookies: `HttpOnly; Secure; SameSite=Lax`.
- Guest token: signed, scoped to one trip and one member, expires at trip end.
- Authorization on every REST endpoint and every STOMP destination (membership + role).
- CORS allow-list, CSP (`default-src 'self'`; allow Mapbox hosts), HSTS, no wildcard origins on WebSocket.
- Rate limits (Bucket4j + Redis): login 5/min/IP, join 10/min/IP, location 1 per 2 s/member, chat 20/min/member, typing 1 per 2 s/member, forgot 3/hour/email.
- Input: validate lengths, strip control characters, escape on render. Invite codes: 8 chars from a 31-letter alphabet (no 0, O, 1, I, L), 31^8 combinations, lock out an IP after 20 bad codes.
- Secrets in env or a secret manager, never in the repo. Dependabot + `mvn dependency-check` + `npm audit` in CI.

## Privacy and compliance (DPDP Act 2023)
- Lawful basis: explicit consent on the consent screen, recorded with timestamp and policy version.
- Purpose limitation: location used only for the live trip. TTL 10 min on live points, purge at trip end.
- User rights: export (JSON), delete (30 day grace then hard delete), withdraw consent (leave trip / pause / account delete).
- Minimal retention: trip summaries only (no raw track), chat deleted 7 days after trip end.
- Breach runbook and a named grievance contact in the Privacy Policy.

## Performance notes
- Batch broadcasts per trip at most every 1 s if a trip has more than 10 members.
- Directions cache by (origin rounded to 50 m, destination) for 20 s; per-trip budget to protect Mapbox quota.
- Index `trips(code)`, `trips(status, expires_at)`, `trip_members(trip_id)`, `messages(trip_id, created_at)`.
- JVM: `-XX:MaxRAMPercentage=70`, virtual threads enabled for blocking I/O (`spring.threads.virtual.enabled=true`).
