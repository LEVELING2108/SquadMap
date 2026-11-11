# 01 · Product and features

## Vision
Get there together. One link, one live map, everyone's ETA. No signup to join, nothing kept after the trip.

## Users
- **Host**: has an account, creates trips, invites friends, can extend or end.
- **Guest**: joins by link or code with only a display name. No account.
- **Member**: any host or guest on a trip.

## Priorities
P0 = launch blocker, P1 = launch if time allows, P2 = after launch.

## Features and acceptance criteria

### A. Accounts
| ID | Feature | P | Acceptance criteria |
|---|---|---|---|
| A1 | Sign up with email + password | P0 | Name, email, password (min 8). Strength meter. Duplicate email gives a clear error. Terms checkbox required. |
| A2 | Log in / log out | P0 | JWT access (15 min) + rotating refresh token (30 days, httpOnly cookie). Wrong password shows one generic error. |
| A3 | Forgot password | P0 | Email with 30 min single-use link. Response is identical whether or not the email exists. |
| A4 | Google sign-in | P1 | OAuth 2 / OIDC. Links to an existing account with the same verified email. |
| A5 | Phone OTP | P2 | 6-digit code, 5 min expiry, 3 tries. |
| A6 | Guest session | P0 | Joining creates a trip-scoped token that dies with the trip. |

### B. Trips
| ID | Feature | P | Acceptance criteria |
|---|---|---|---|
| B1 | Create trip | P0 | Name, optional destination, share duration (1/2/4/8 h), chat on/off. Returns code (8 chars, no look-alike letters) and link. |
| B2 | Destination search | P0 | Mapbox geocoding with debounce 250 ms, recent places, choose on map, skip. |
| B3 | Invite | P0 | Copy link, native share sheet, QR code, boarding-pass ticket view. |
| B4 | Join by link / code / QR | P0 | Name required, consent screen, then live map. Invalid or expired shows the Expired screen. |
| B5 | Extend sharing | P0 | +30 min, +1 h, +2 h, up to 12 h total. Host only. Everyone is notified. |
| B6 | Expiry warning | P0 | 10 min before end, show the warning to every member. |
| B7 | End trip for everyone | P0 | Host only, confirm dialog, instant stop, link dead, WebSocket closed. |
| B8 | Leave trip | P0 | Any member. Removes their live point immediately. |
| B9 | Pause my location | P1 | Friends see "last seen" with time. |
| B10 | Trip history | P1 | Summary only: route length, time, friends. No live points kept. |

### C. Live map
| ID | Feature | P | Acceptance criteria |
|---|---|---|---|
| C1 | Live positions | P0 | Each member's dot with name label. Updates within 3 s p95. Smooth interpolation between points. |
| C2 | You dot | P0 | Pulsing halo, accuracy-aware. Recenter button. |
| C3 | Routes to destination | P0 | Mapbox Directions per member, animated dotted line in the member's color. |
| C4 | Shared ETA list | P0 | Sorted by ETA, distance, mode, "Arrived" badge. Recomputed at most every 20 s per member. |
| C5 | Friend details | P0 | Distance, ETA, speed, progress bar, message, follow, directions deep link. |
| C6 | Arrival detection | P0 | Within 60 m of destination for 20 s = arrived. Toast to all, stamp screen for the arriving member. |
| C7 | Map controls | P0 | Layers, recenter, fit everyone. |
| C8 | Stale and offline | P0 | Dim a dot after 60 s without update and label "N min ago". Offline banner with retry and queued updates. |
| C9 | Battery saver | P1 | Slower updates when battery is under 20% or the app is in background. |
| C10 | Dark map | P1 | Follows system or manual setting. |

### D. Chat and alerts
| ID | Feature | P | Acceptance criteria |
|---|---|---|---|
| D1 | Trip chat | P0 | Text up to 280 chars, typing indicator, unread badge, quick replies (I'm here, Running late, Wait for me). |
| D2 | In-app alerts | P0 | Arrived, joined, chat, expiry. Mark all read. |
| D3 | Web push | P1 | VAPID, opt-in toggle per type (friend arrives, new message). |

### E. Profile and settings
| ID | Feature | P | Acceptance criteria |
|---|---|---|---|
| E1 | Profile | P1 | Name, avatar initial and color, stats (trips, km, friends). |
| E2 | Settings | P1 | Dark map, show speed, distance unit, default share time, battery saver. |
| E3 | Privacy and data | P0 | Precise vs approximate location, auto-stop, keep history, download my data, delete account (DPDP Act 2023). |

## Non-functional requirements
- Location update to friend's screen: p95 under 3 s, p99 under 6 s.
- 200 concurrent trips of 10 members on one 2 vCPU / 4 GB instance with CPU under 60%.
- API p95 under 300 ms. First load under 2.5 s on 4G (LCP). PWA installable, Lighthouse PWA and a11y scores 90 or more.
- Availability target 99.5% at launch.
- Privacy: no coordinates in logs, location TTL 10 min after last update, hard delete of live data at trip end, data export and delete within 30 days of request.

## Out of scope for v1
Native apps, group voice, route recording on a timeline, in-app payments, social feed.
