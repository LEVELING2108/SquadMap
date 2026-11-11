# SquadMap: Zero to Production Roadmap

Nov 11, 2026 · @Sourav suman

This is the company-style plan to take SquadMap from an empty repo to a secured, monitored, domain-hosted production app in about 10 weeks: stack, architecture, database, API, security, logging, domain, deployment and launch procedure.

## 1. Scope and success numbers

v1 is a mobile-first PWA where a host starts a trip, shares a link, and everyone sees each other live with shared ETAs. Guests join without an account. Sharing ends automatically.

|  | In v1 | Not in v1 |
| --- | --- | --- |
| Accounts | Email and password, Google sign-in, guest join by link | Phone OTP, social profiles |
| Trips | Create, invite (link, QR), extend, end, leave, history summary | Recurring trips, public trips |
| Map | Live positions, routes, ETAs, arrival detection, offline and stale states | Turn-by-turn navigation, route recording |
| Chat | Text, quick replies, typing, unread | Photos, voice |
| Platform | Light and dark themes, installable PWA, web push | Native iOS and Android apps |

Targets at launch: location update visible to friends in under 3 s (p95), API p95 under 300 ms, 200 simultaneous trips of 10 people on one small server, availability 99.5%, first load under 2.5 s on 4G.

## 2. Roadmap: 11 stages, each with an exit gate

A stage is done only when its gate is met. One person can follow this in about 10 weeks; a team of three can halve it.

| Stage | Weeks | What gets built or decided | Exit gate |
| --- | --- | --- | --- |
| 0. Discovery and setup | 0 | One-page product brief, PRD (done), design kit (done), accounts: GitHub, Mapbox, domain registrar, cloud, Sentry, email | Brief signed off, accounts created, budget agreed |
| 1. Foundations | 1 | Monorepo on branch, CI, docker compose for Postgres and Redis, design tokens in Tailwind | CI green on a pull request, app boots locally |
| 2. Accounts and auth | 1 | Signup, login, refresh rotation, password reset, guest tokens; Welcome, Login, Signup, Forgot screens | Auth flow works end to end with tests |
| 3. Trips and invites | 2 | Trips, invite codes, join as guest, expiry scheduler, destination search; Home to Invite screens | Host creates a trip, a guest joins from a second browser |
| 4. Real-time location | 3 to 4 | STOMP over WebSocket, Redis fan-out, validation, rate limits, reconnect, offline queue | Two phones see each other in under 3 s, survive a network drop |
| 5. Live map and ETAs | 4 to 5 | Markers, routes, ETA service, arrival detection, friend sheet, offline state | Screens match design, 60 fps with 10 members |
| 6. Chat and alerts | 5 | Chat, typing, unread, in-app alerts, web push, expiry warning | Host-only actions enforced on the server |
| 7. Wrap-up and profile | 6 | Arrived, trip ended, history, settings, privacy, export and delete | Data export and delete work |
| 8. Polish | 7 | Motion system, dark mode, PWA offline, accessibility pass | Lighthouse 90+ for PWA and a11y |
| 9. Hardening | 8 | Security review, dependency scans, load test, observability, chaos tests | No high findings, load targets met |
| 10. Deploy and launch | 9 to 10 | Domain, TLS, staging, production, backups, runbook, beta with 10 to 20 users | Launch checklist (section 17) fully ticked |

## 3. Tech stack

Chosen for one reason each: it is mainstream in industry and well documented.

| Layer | Choice | Why | Alternative |
| --- | --- | --- | --- |
| Language and runtime | Java 21 (virtual threads) | Strong typing, mature ecosystem, hiring signal | Kotlin |
| Backend framework | Spring Boot 3.3, Spring MVC | Standard for company backends, great security and testing support | Quarkus |
| Real-time | Spring WebSocket, STOMP over SockJS | Built in, topic model fits trips | Plain WebSocket, SSE |
| Auth | Spring Security, JWT access plus rotating refresh, Argon2id | Stateless scaling, revocable sessions | Keycloak, Auth0 |
| Database | PostgreSQL 16 | Reliable, JSONB, good indexing | MySQL |
| Cache and live state | Redis 7 (Lettuce), pub/sub | TTL for live points, fan-out across instances | Hazelcast |
| Migrations | Flyway | Versioned, reviewable SQL | Liquibase |
| Rate limiting | Bucket4j on Redis | Distributed limits | Nginx only |
| API docs | springdoc OpenAPI | Generated types for the frontend | Hand-written |
| Frontend | React 19, TypeScript strict, Vite | Fast builds, huge ecosystem | Next.js |
| Styling | Tailwind CSS with design tokens | Consistent light and dark themes | CSS modules |
| Maps | Mapbox GL JS, Directions and Geocoding APIs | Custom styles, vector tiles | MapLibre with another router |
| State | TanStack Query (server), Zustand (live) | Clear split, little boilerplate | Redux Toolkit |
| Motion | Framer Motion plus CSS keyframes | Declarative, reduced-motion support | CSS only |
| PWA | Workbox service worker, web push (VAPID) | Installable, offline shell | Capacitor later |
| Testing | JUnit 5, Mockito, Testcontainers, Vitest, Playwright, k6 | Real databases in tests, E2E and load | Cypress |
| CI/CD | GitHub Actions, Docker, GHCR | Free for small projects, widely used | GitLab CI |
| Hosting | VPS in India or Singapore, Nginx, managed Postgres | Cheap, simple, full control | AWS ECS, Render, Fly.io |
| Edge | Cloudflare (DNS, CDN, WAF) | DDoS protection, free TLS to origin | Route 53 |
| Observability | Micrometer, Prometheus, Grafana, Loki, Sentry | Metrics, logs, errors in one view | Datadog |
| Email | Transactional provider (Amazon SES, Brevo or Resend) | Deliverability for resets | Self-hosted SMTP |

## 4. Architecture

&#91;embedded content: system architecture · client, edge, app, data\]

Every request enters through Cloudflare and Nginx. The app holds no state, so a second instance can be added at any time; Redis relays each live position to every instance, and PostgreSQL stores only what must last. Module boundaries inside the app are auth, user, trip, invite, location, eta, chat and notify.

## 5. Database design

PostgreSQL holds durable data (accounts, trips, summaries, messages). Redis holds live positions that expire on their own. Every change ships as a Flyway migration, written to be backward compatible (add first, switch code, remove later).

| Table | Key columns | Notes |
| --- | --- | --- |
| users | id (UUIDv7), email (unique, lower-case), password\_hash, name, color, settings (jsonb), created\_at, deleted\_at | Soft delete with a 30 day grace, then hard delete |
| refresh\_tokens | id, user\_id, token\_hash, family\_id, expires\_at, revoked\_at | Reuse of a revoked token revokes the whole family |
| trips | id, host\_id, name, code (unique), dest\_name, dest\_lat, dest\_lng, chat\_enabled, starts\_at, expires\_at, ended\_at, status | Status: active, ended, expired |
| trip\_members | id, trip\_id, user\_id (null for guests), display\_name, color, role, joined\_at, left\_at, arrived\_at, paused | One row per person per trip |
| messages | id, trip\_id, member\_id, body (max 280), created\_at | Deleted 7 days after the trip ends |
| trip\_summaries | trip\_id, distance\_m, duration\_s, member\_count, route\_polyline | Simplified route only, no raw track |
| alerts | id, user\_id, type, payload (jsonb), read\_at, created\_at | In-app inbox |
| push\_subscriptions | id, user\_id, endpoint, p256dh, auth | One per device |
| consent\_log | id, user\_id or member\_id, policy\_version, granted\_at, withdrawn\_at | Proof of consent |
| audit\_log | id, actor, action, target, ip\_hash, created\_at | Security-relevant events only |

Indexes: trips(code), trips(status, expires\_at), trip\_members(trip\_id), messages(trip\_id, created\_at), refresh\_tokens(user\_id), alerts(user\_id, read\_at).

Redis keys:

- `trip:{id}:loc:{memberId}`: latest position, TTL 600 s.
- `trip:{id}:members`: set of active member ids.
- `eta:{tripId}:{memberId}`: cached ETA, TTL 20 s.
- `rl:{scope}:{key}`: rate-limit buckets.

Retention: live points are purged at trip end, chat after 7 days, summaries kept until the user deletes them, audit log 12 months. The full SQL lives in the Flyway migrations under `backend/`.

## 6. API design

REST under `/api/v1`, JSON, ISO-8601 UTC times, UUIDv7 ids, cursor pagination. Errors use RFC 7807 problem+json with a stable `code` (`TRIP_EXPIRED`, `INVALID_CODE`, `RATE_LIMITED`). Create endpoints accept an `Idempotency-Key` header. The OpenAPI file is generated from the code and the frontend types are generated from it, so a mismatch fails the build.

| Area | Endpoints | Auth |
| --- | --- | --- |
| Auth | POST /auth/signup, /login, /refresh, /logout, /forgot, /reset, /oauth/google | Public, rate limited |
| Me | GET /me, PATCH /me/settings, GET /me/trips, /me/stats, /me/export, DELETE /me | User |
| Alerts | GET /me/alerts, POST /me/alerts/read, POST /me/push/subscribe | User |
| Trips | POST /trips, GET /trips, GET and PATCH /trips/{id}, POST /trips/{id}/extend, /end, GET /trips/{id}/summary | Host or member |
| Members | GET /trips/{id}/members, GET /trips/{id}/members/{uid}, DELETE /trips/{id}/members/me | Member |
| Invite and join | GET /trips/{id}/invite, GET /join/{code}/preview, POST /join/{code} | Host, public with rate limit |
| Location | POST /trips/{id}/locations (fallback to WebSocket) | Member |
| ETA | GET /trips/{id}/eta | Member |
| Chat | GET and POST /trips/{id}/messages | Member |
| Places | GET /places/search, GET /places/recent | User |
| Ops | GET /actuator/health, /actuator/prometheus | Internal network only |

Versioning: breaking changes go to `/api/v2`; additive changes stay in v1. Deprecations are announced in the changelog for at least one release.

## 7. Real-time location pipeline

The phone sends a position at most every 2 s while moving (10 s when still, 30 s on low battery). The server checks, stores and fans it out; friends receive it within about a second.

1. Client connects to `/ws` with its token. An interceptor authenticates on CONNECT and checks trip membership on every SUBSCRIBE and SEND.
2. Client sends `{lat, lng, accuracy, speed, heading, ts}` to `/app/trip.{id}.loc`.
3. Server rejects accuracy over 200 m, impossible jumps and more than one update per 2 s per member.
4. Server writes `trip:{id}:loc:{memberId}` to Redis with a 600 s TTL and publishes to a Redis channel.
5. Every app instance relays the message to its local subscribers of `/topic/trip.{id}.locations`.
6. A job on each update checks arrival: within 60 m of the destination for 20 s publishes `ARRIVED` on `/topic/trip.{id}.events`.
7. ETAs are recomputed at most every 20 s per member through Mapbox Directions with a cache.

Other events: `MEMBER_JOINED`, `MEMBER_LEFT`, `TRIP_EXTENDED`, `TRIP_ENDING_SOON`, `TRIP_ENDED`, `PAUSED`, `RESUMED`.

Failure behavior: heartbeats every 10 s; the client reconnects with backoff (1, 2, 4, 8, max 15 s), re-subscribes, then loads a snapshot from `GET /trips/{id}/members`. Offline updates queue in IndexedDB (max 50, dropped after 2 minutes). A dot with no update for 60 s is shown dimmed with its age.

## 8. Security

Treat location as the most sensitive data the app holds. Controls are layered: edge, application, data, and process.

| Threat | Control |
| --- | --- |
| Stolen or guessed passwords | Argon2id hashing, 8+ characters, breach-list check, login limit 5 per minute per IP and per account, generic error messages |
| Session theft | Access token 15 min, refresh token 30 days in an HttpOnly, Secure, SameSite=Lax cookie, rotation with reuse detection, logout revokes the family |
| Guessing trip codes | 8 characters from a 31-letter alphabet, join limit 10 per minute per IP, lockout after 20 bad codes, codes die at trip end |
| Reading another trip | Every REST endpoint and every STOMP destination checks membership and role; guest tokens are scoped to one trip |
| Location spoofing and floods | Accuracy and jump checks, 1 update per 2 s, payload size cap |
| Injection and XSS | Parameterized queries only, input validation, output escaping, strict CSP with no inline scripts |
| CSRF and CORS abuse | SameSite cookies, allow-listed origins, state-changing calls need a bearer token |
| Vulnerable dependencies | Dependabot, OWASP Dependency-Check, npm audit, Trivy image scan in CI; high findings block merge |
| Leaked secrets | Secrets only in a secret manager or CI secrets, gitleaks pre-commit and in CI, rotation plan |
| Transport attacks | TLS 1.2+ everywhere, HSTS, no mixed content, WebSocket over WSS only |
| DDoS and abuse | Cloudflare proxy and WAF rules, Nginx rate limits, Bucket4j limits |
| Server compromise | Non-root containers, read-only filesystem where possible, firewall allowing only 80 and 443, SSH keys only, automatic security updates |
| Insider or log leaks | No coordinates, tokens or passwords in logs, least-privilege database roles, audit log for admin actions |

Process: threat-model each new feature, security review on every pull request that touches auth, a yearly penetration test once there are real users, and a published contact address for vulnerability reports.

## 9. Privacy and legal (India)

India's Digital Personal Data Protection Act, 2023 applies once you handle users' location. The rules and timelines below are a planning summary, not legal advice: have a lawyer review the policy before launch.

- **Consent**: ask clearly, in plain words, before sharing starts (the consent screen). Log the consent with the policy version and time.
- **Purpose limits**: use location only to run the live trip. No ads, no selling, no analytics on raw coordinates.
- **Minimal data**: live points expire after 10 minutes without updates and are deleted at trip end; keep only a simplified summary.
- **User rights**: download my data, correct it, delete my account, withdraw consent at any time (leave trip, pause, delete).
- **Children**: block under-18 signups in the terms, since the Act needs verifiable parental consent for minors.
- **Security and breaches**: reasonable safeguards (section 8) and a written breach response that notifies the Data Protection Board and affected users.
- **Grievance contact**: a named email address in the Privacy Policy with a response time.
- **Documents to publish**: Privacy Policy, Terms of Service, a short "how we use your location" page, cookie and storage notice.
- **Data location**: host in India or Singapore, and list processors (hosting, email, Mapbox, Sentry) in the policy.

## 10. Logging, monitoring and alerting

Three signals, one rule: never log coordinates, tokens, passwords or full emails.

| Signal | Tool | What to capture | Retention |
| --- | --- | --- | --- |
| Logs | JSON logs via Logback, shipped to Loki (or the host's log service) | Request id, user id hash, route, status, latency, error class; audit events for login, reset, delete, host actions | 30 days app, 12 months audit |
| Metrics | Micrometer, Prometheus, Grafana | Active trips, open sockets, updates per second, broadcast latency, ETA cache hit rate, Directions calls per minute, JVM, DB pool, Redis | 90 days |
| Errors | Sentry (backend and frontend) | Exceptions with release and trace id, user-facing errors, slow transactions | 90 days |
| Uptime | External pinger plus a synthetic create-and-join check every 10 min | Health, login, join, location round trip | Continuous |

Every request carries an `X-Request-Id` that appears in logs, Sentry and responses so one failure can be traced end to end.

Alerts (to phone and email):

- Error rate above 2% for 5 minutes, or p95 latency above 1 s.
- Open sockets drop by more than 30% in a minute.
- Database connections above 80%, disk above 80%, memory above 85%.
- TLS certificate expires in under 14 days, backup job failed, Mapbox spend above 80% of budget.

Dashboards to build: Product (active trips, joins, completion rate), Reliability (errors, latency, sockets), Cost (Directions and push usage).

## 11. How a company ships: process and CI/CD

**Work tracking**: one board (GitHub Projects) with columns Backlog, Ready, In progress, In review, Done. Each ticket has acceptance criteria copied from the feature spec. Plan in one-week sprints; demo on Fridays.

**Git workflow** (`main` for releases, `research` for integration):

1. Branch from the latest `origin/research`, named by type: `feat/…`, `fix/…`, `ops/…`, `docs/…`, `chore/…`, `ci/…`. Keep it under two days of work.
2. Commit with Conventional Commits (`feat:`, `fix:`, `docs:`).
3. Open a pull request into `research` using the template: what, why, screenshots, test evidence, risk, rollback.
4. CI must pass: backend verify, frontend lint, types and tests, E2E, accessibility, dependency and secret scans.
5. One review from a teammate (or a careful self-review when solo), then merge with a merge commit.
6. `main` only ever receives `research`, through a pull request merged with a merge commit (never squash or rebase).
7. Both branches are protected: no direct pushes, no force pushes, no deletion, required checks.

**Decisions** are written down as short Architecture Decision Records in `docs/adr/` (context, decision, consequences).

**Environments**:

| Environment | Purpose | Deploys | Data |
| --- | --- | --- | --- |
| local | Development with docker compose | Manual | Seed script |
| ci | Automated tests with Testcontainers | Every pull request | Ephemeral |
| staging | Production twin at smaller size | Automatic on merge to `research` | Synthetic |
| production | Real users | On merge of `research` into `main`, after staging passes | Real |

**Release procedure**: merge to `research`, staging deploy, smoke tests, pull request `research` into `main`, rolling production deploy (one instance at a time), readiness check, smoke test, tag `vX.Y.Z`, release notes. A failed health check rolls back automatically to the previous image.

**Database changes** follow expand, deploy, contract: add the new column, ship code that writes both, backfill, switch reads, and only a later release drops the old column.

**Operations**: a runbook for deploy, rollback, restore and common incidents; an incident template (impact, timeline, cause, fix, follow-ups) with a blameless review for any user-visible outage.

## 12. Domain, DNS, TLS and email: step by step

Replace `[yourdomain]` with the name you register (for example a `.app`, `.in` or `.com`; check availability and any trademark conflict first). `.app` domains require HTTPS, which suits this project.

1. **Register the domain** at a registrar you will keep (Cloudflare Registrar, Namecheap, GoDaddy). Turn on registrar lock and auto-renew, use a shared team email as the contact, and enable two-factor on the registrar account.
2. **Move DNS to Cloudflare** (free plan): add the site, copy the two Cloudflare nameservers into the registrar, wait for the zone to turn active.
3. **Plan the hostnames**:

| Hostname | Points to | Purpose |
| --- | --- | --- |
| `[yourdomain]` and `www` | Frontend host | Marketing page and the PWA |
| `app.[yourdomain]` | Server IP (proxied) | The web app, if you split it from the landing page |
| `api.[yourdomain]` | Server IP (proxied) | REST API and WebSocket `/ws` |
| `staging.[yourdomain]`, `api-staging.[yourdomain]` | Staging server | Pre-release testing |
| `status.[yourdomain]` | Status page provider | Public uptime page |

4. **Create DNS records**: A record per hostname to the server's IPv4 (AAAA for IPv6), proxied through Cloudflare. Keep the SSH hostname unproxied or use the raw IP.
5. **TLS to the visitor**: Cloudflare issues the public certificate automatically. Set SSL mode to **Full (strict)**, enable Always Use HTTPS, TLS 1.2 minimum and HSTS.
6. **TLS to the origin**: on the server install a Cloudflare Origin Certificate (15 years) or run certbot for Let's Encrypt; configure Nginx with it and renew automatically.
7. **WebSocket check**: in Cloudflare confirm WebSockets are on; test `wss://api.[yourdomain]/ws` stays open for 10 minutes.
8. **WAF and limits**: enable managed rules, bot fight mode, and a rate-limit rule for `/api/v1/auth/*` and `/api/v1/join/*`. Restrict the origin firewall to Cloudflare IP ranges.
9. **Transactional email**: verify the domain in your email provider; add SPF, DKIM (three CNAMEs from the provider) and a DMARC record starting at `p=none`, moving to `quarantine` after two clean weeks. Send from `no-reply@[yourdomain]` and publish `support@` and `privacy@` mailboxes.
10. **Third-party settings**: add the domains to Mapbox token URL restrictions, Google OAuth authorized origins and redirect URIs, and Sentry allowed domains.
11. **Security files**: publish `/.well-known/security.txt` with a contact address, and submit the domain to the HSTS preload list only after everything is stable.
12. **Verify**: SSL Labs grade A, securityheaders.com grade A, `dig` shows the expected records, a password-reset email lands in the inbox (not spam).

## 13. Production deployment: step by step

Recommended first setup: one VPS (2 vCPU, 4 GB) running Nginx and two app containers, plus managed PostgreSQL and a Redis container, behind Cloudflare. Prices and regions are in section 15. Do staging first, then repeat for production.

1. **Provision** the server in India or Singapore, Ubuntu LTS, with an SSH key (no password login). Create a non-root `deploy` user.
2. **Harden**: disable root and password SSH, enable `ufw` allowing only 22 (your IP if possible), 80 and 443, install fail2ban and unattended security upgrades, set the time zone to UTC.
3. **Install Docker** and the compose plugin; configure log rotation for containers.
4. **Database**: create a managed PostgreSQL 16 instance in the same region, a private network or IP allow-list, an app user with only the rights it needs, automated daily backups and point-in-time recovery. Redis runs as a container with a password and a persistent volume.
5. **Secrets**: store them outside the repo (server `.env` files owned by `deploy` with mode 600, or a secret manager); GitHub Actions holds only the deploy key and registry token.
6. **Images**: CI builds multi-stage Docker images (non-root, health checks), scans them with Trivy, tags them with the commit SHA and pushes to GitHub Container Registry.
7. **Compose file** on the server defines nginx, `app` (2 replicas), redis, and optional prometheus, grafana, loki. Restart policy `unless-stopped`.
8. **Nginx**: TLS with the origin certificate, HTTP to HTTPS redirect, WebSocket upgrade for `/ws` (read timeout 75 s), gzip or brotli, long-cache hashed assets, `no-cache` for `index.html` and the service worker, request size limit 1 MB, security headers (CSP, nosniff, Referrer-Policy, Permissions-Policy with `geolocation=(self)`).
9. **First deploy**: pull images, start with Flyway migrations on a single instance (a lock prevents races), wait for `/actuator/health/readiness`, then start the second instance.
10. **Smoke test**: sign up, create a trip, join from a second browser, move a test location, send chat, end the trip. Run the scripted version after every deploy.
11. **Backups**: nightly `pg_dump` to object storage with 14 day retention, a weekly restore into a scratch database, and a stored copy of environment templates. Recovery targets at launch: lose at most 24 h of data, back up within 2 h.
12. **Monitoring**: bring up Prometheus, Grafana and Loki, import the dashboards, connect Sentry, set the alerts from section 10, and add the external uptime check.
13. **Automated releases**: the GitHub Actions workflow deploys to staging on every merge to `research`, and on a merge of `research` into `main` deploys to production one instance at a time with automatic rollback when the health check fails.
14. **Rollback**: redeploy the previous image tag (kept for the last 10 releases); database changes are backward compatible so code can roll back without a restore.
15. **Runbook**: write `RUNBOOK.md` covering deploy, rollback, restore, rotating secrets, renewing certificates, scaling to a third instance, and what to do when Redis or the database is down.

Scaling path after launch: second server behind a load balancer, managed Redis, read replica for history queries, then a move to containers on a managed platform if the team grows.

## 14. Testing and quality gates

| Layer | Tools | What it must prove | Gate |
| --- | --- | --- | --- |
| Backend unit | JUnit 5, Mockito | Code generation, expiry maths, ETA cache, arrival detection, token rotation | 80% lines on auth, trip, location, eta |
| Backend integration | Spring Boot Test, Testcontainers (Postgres, Redis), WebSocket client | Migrations, REST security, STOMP authorization, Redis fan-out across two instances | Every endpoint and destination has a 401 and 403 test |
| API contract | OpenAPI snapshot, generated TypeScript types | Frontend and backend never drift | Build fails on diff |
| Frontend unit | Vitest, Testing Library | Hooks (socket, geolocation), marker interpolation, forms, stores | 70% on feature folders |
| Accessibility | axe, keyboard and screen-reader pass | Every screen, both themes | Zero serious violations |
| End to end | Playwright, two browser contexts | Signup, create trip, guest joins, locations move, chat, extend, end | Runs on every pull request |
| Visual | Playwright screenshots vs the design images | 26 screens in light and dark | Under 0.5% pixel difference |
| Load | k6 with WebSocket | 200 trips of 10 people for 15 min, spike to 400 | p95 under 3 s, errors under 0.5% |
| Security | Dependency-Check, npm audit, Trivy, ZAP baseline, gitleaks | Known CVEs, headers, common flaws, leaked secrets | No high or critical |
| Real devices | Android Chrome, iPhone Safari, moving car, mobile data | GPS accuracy, battery, screen lock, permissions | Before each release |

Must-have cases: expired, ended and reused codes; guest token used on another trip; non-host calling extend or end; location rate limit, bad accuracy and teleport jumps; warning sent exactly once before expiry; refresh token reuse revokes the family; account deletion removes personal data; offline queue flushes in order.

## 15. Monthly cost estimate (approximate)

Figures are approximate from memory and change often; confirm current pricing before committing. Assumes the first 1,000 to 5,000 users.

| Item | Launch (USD per month) | Notes |
| --- | --- | --- |
| VPS, 2 vCPU and 4 GB (staging uses a smaller one) | 10 to 25 | Hetzner is cheapest; DigitalOcean or Vultr cost more but have India or Singapore regions |
| Managed PostgreSQL | 15 to 30 | Includes daily backups |
| Domain | about 1 (10 to 15 per year) | Renew yearly |
| Cloudflare | 0 | Free plan covers DNS, CDN and basic WAF |
| Mapbox | 0 to 50 | Free tier covers early usage; cache Directions to stay inside it |
| Transactional email | 0 to 10 | Free tiers or very low per-message cost |
| Sentry and uptime monitoring | 0 to 26 | Free tiers are enough to start |
| Object storage for backups | 1 to 5 |  |
| GitHub Actions and container registry | 0 | Free allowance is enough for one project |
| **Estimated total** | **about 30 to 150** | Grows with active trips, mostly through Mapbox and the database |

Cost controls: cache ETAs, recompute only after 50 m of movement, set Mapbox billing alerts, and review the bill monthly.

## 16. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Browsers stop location updates when the phone is locked, especially iPhone Safari | High | High | Be honest in the UI ("keep the app open"), use Wake Lock during a trip, plan a Capacitor wrapper in v2 for true background tracking |
| Battery drain | Medium | Medium | Adaptive update rate, battery saver, pause button |
| Mapbox cost spikes | Medium | Medium | Caching, movement threshold, budget alerts, fallback to straight-line ETA |
| Privacy incident or leaked location | Low | Very high | Strict authorization tests, no coordinates in logs, short TTL, breach runbook |
| One server fails | Medium | High | Two app instances, restart policies, backups, tested restore |
| WebSocket scaling limits | Low at launch | Medium | Redis fan-out, load test before launch, stateless instances |
| Scope creep | High | Medium | P0 list frozen after Stage 4; new ideas go to the backlog |
| Single developer bottleneck | Medium | Medium | ADRs, runbook, automated tests, small pull requests |
| Legal gaps in policy | Medium | High | Lawyer review of Privacy Policy and Terms before public launch |

## 17. Launch checklist and how to start

Tick each item before public launch.

- [ ] All P0 features meet their acceptance criteria; no open blocker bugs.
- [ ] Tested on real Android and iPhone devices, on mobile data, in a moving car with three friends.
- [ ] Privacy Policy, Terms and consent text reviewed by a lawyer; grievance email works.
- [ ] Security scan clean (ZAP, Trivy, dependency checks); CSP, CORS, cookies and HSTS verified.
- [ ] Rate limits and Cloudflare WAF rules active; origin accepts only Cloudflare traffic.
- [ ] Mapbox tokens URL-restricted; billing alerts set on Mapbox, hosting and email.
- [ ] Backup restore tested end to end; runbook reviewed; on-call plan written (even if it is only you).
- [ ] Sentry receives events from frontend and backend; dashboards and alerts are live; status page set up.
- [ ] SPF, DKIM and DMARC pass; password-reset email reaches the inbox.
- [ ] Load test passed (200 trips of 10 people, p95 under 3 s).
- [ ] Feature flags and a kill switch for push notifications and Google sign-in.
- [ ] Beta week with 10 to 20 people; feedback and crash reports triaged.

**How to start building tomorrow**

1. Read the feature list (`docs/01`), the screens (`docs/03`) and the architecture (`docs/05`).
2. Start Stage 1 on a branch from `research`: monorepo, CI, local Postgres and Redis, design tokens.
3. Work one stage at a time: plan it, build it in small pull requests, run the checks, then tick its exit gate.
4. Start the domain purchase and the Mapbox, Sentry and email accounts in week 1 so DNS and verification delays never block launch.

After launch: weekly metrics review, monthly dependency updates and restore drill, quarterly security review, and v1.1 ideas (background tracking wrapper, SOS and share-my-ETA link, meet-up points, Hindi).
