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
GET    /trips/{id}/messages POST  /trips/{id}/messages
GET    /places/search?q=    GET   /places/recent
```
Conventions: JSON, ISO-8601 UTC timestamps, ids are UUIDv7 (time-ordered), pagination by cursor, idempotency key header on create endpoints, problem+json errors with `code` such as `TRIP_EXPIRED`, `INVALID_CODE`, `RATE_LIMITED`.

## WebSocket protocol (STOMP over SockJS)
- Connect `/ws` with header `Authorization: Bearer <token>` (user token or trip-scoped guest token).
- Subscribe: `/topic/trip.{id}.locations`, `/topic/trip.{id}.events`, `/topic/trip.{id}.chat`. An interceptor checks membership on every SUBSCRIBE.
- Send: `/app/trip.{id}.loc` payload `{lat, lng, acc, speed, heading, ts}`. Server clamps to 1 update per 2 s, rejects accuracy over 200 m and impossible jumps, stores to Redis `trip:{id}:loc:{memberId}` TTL 600 s, and broadcasts `{memberId, lat, lng, speed, ts}`.
- Events: `MEMBER_JOINED`, `MEMBER_LEFT`, `ARRIVED`, `TRIP_EXTENDED`, `TRIP_ENDING_SOON`, `TRIP_ENDED`, `PAUSED`, `RESUMED`.
- Heartbeats 10 s. Client reconnects with exponential backoff (1, 2, 4, 8, max 15 s) and re-subscribes; on reconnect it fetches `/trips/{id}/members` for the latest snapshot.

## Data model (summary)
`users(id, email, password_hash, name, color, settings jsonb, created_at, deleted_at)`
`trips(id, host_id, name, code, dest_name, dest_lat, dest_lng, chat_enabled, starts_at, expires_at, ended_at, status)`
`trip_members(id, trip_id, user_id null, display_name, color, role, joined_at, left_at, arrived_at, paused)`
`messages(id, trip_id, member_id, body, created_at)`
`trip_summaries(trip_id, distance_m, duration_s, member_count, route_polyline_simplified)`
`refresh_tokens(id, user_id, hash, expires_at, revoked_at)`
`push_subscriptions(id, user_id, endpoint, p256dh, auth)`
`alerts(id, user_id, type, payload jsonb, read_at, created_at)`
Redis: `trip:{id}:loc:{memberId}` (TTL 600 s), `trip:{id}:members` (set), `rl:{key}` (Bucket4j), `eta:{tripId}:{memberId}` (TTL 20 s).

## Scheduling jobs
- Every 30 s: find trips expiring within 10 min (send warning once), expiring now (end, close sockets, write summary, purge Redis).
- Hourly: purge expired refresh tokens and reset tokens. Daily: hard-delete accounts past the 30 day grace period.
Use `@Scheduled` with ShedLock (Postgres) so only one instance runs each job.

## Security
- Passwords: Argon2id (or BCrypt cost 12). Never log credentials.
- JWT access 15 min, refresh 30 days rotating with reuse detection (revoke the family on reuse). Cookies: `HttpOnly; Secure; SameSite=Lax`.
- Guest token: signed, scoped to one trip and one member, expires at trip end.
- Authorization on every REST endpoint and every STOMP destination (membership + role).
- CORS allow-list, CSP (`default-src 'self'`; allow Mapbox hosts), HSTS, no wildcard origins on WebSocket.
- Rate limits (Bucket4j + Redis): login 5/min/IP, join 10/min/IP, location 1 per 2 s/member, chat 20/min/member, forgot 3/hour/email.
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
