# 07 · Testing, CI/CD and deployment

## Test pyramid
| Layer | Tools | What to cover | Target |
|---|---|---|---|
| Unit (backend) | JUnit 5, Mockito, AssertJ | Code generation, expiry maths, ETA caching, arrival detection, rate limit rules, token rotation | 80% line on `auth`, `trip`, `location`, `eta` |
| Integration (backend) | Spring Boot Test, Testcontainers (Postgres, Redis), WebSocket test client | Repositories, migrations, REST with security, STOMP authorize/subscribe, Redis pub/sub across two contexts | Every endpoint and destination has an authz test |
| Contract | springdoc OpenAPI snapshot, generated TS types | API and frontend types stay in sync | Build fails on drift |
| Unit (frontend) | Vitest, Testing Library | Hooks (socket, geolocation), interpolation, forms, stores | 70% on `features/*` |
| Component a11y | jest-axe | Every screen in light and dark has zero serious violations | 0 |
| E2E | Playwright (Chromium, WebKit, mobile viewports) | Signup, create trip, guest joins in a second context, locations appear, chat, extend, end | Runs on PR |
| Visual regression | Playwright screenshots (reduced motion) vs `design/screens` baselines | 26 screens x 2 themes | Diff threshold 0.5% |
| Load | k6 (WebSocket + REST) | 200 trips x 10 members for 15 min; spike to 400 | p95 under 3 s end to end, errors under 0.5% |
| Security | OWASP Dependency-Check, npm audit, Trivy, ZAP baseline scan | CVEs, headers, common web flaws | No high/critical |
| Manual | Real phones (Android Chrome, iOS Safari) | GPS accuracy, battery, background, permission flows | Before each release |

### Must-have test cases (write these early)
- Join with invalid, expired, ended, or reused code. Guest token cannot call another trip's endpoints.
- Host-only: extend, end. Non-host gets 403, and the UI hides the buttons.
- Location: rate limit, bad accuracy, impossible jump, paused member, stale after 60 s, TTL purge at trip end.
- Expiry: warning at T minus 10 min is sent once; extension resets it; end closes sockets within 5 s.
- Refresh token reuse revokes the whole family.
- Account deletion removes personal data after the grace period but keeps anonymised summaries.
- Offline queue flushes in order, drops entries older than 2 minutes.

## Environments
| Env | Purpose | Data |
|---|---|---|
| local | Developer machine, docker compose | Seed script with the sample trip |
| ci | GitHub Actions, Testcontainers | Ephemeral |
| staging | Same as prod at smaller size, auto deploy from `research` | Synthetic only |
| production | Real users, manual approval | Real |

## Environment variables (backend)
```
SPRING_PROFILES_ACTIVE=prod
DATABASE_URL, DATABASE_USER, DATABASE_PASSWORD
REDIS_URL
JWT_SECRET (>= 32 bytes) or JWT_PRIVATE_KEY / JWT_PUBLIC_KEY
COOKIE_DOMAIN, ALLOWED_ORIGINS
MAPBOX_SERVER_TOKEN
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (optional)
SENTRY_DSN
```
Frontend (build time): `VITE_API_URL`, `VITE_WS_URL`, `VITE_MAPBOX_PUBLIC_TOKEN` (URL-restricted), `VITE_SENTRY_DSN`, `VITE_VAPID_PUBLIC_KEY`.

## Containers
- `backend/Dockerfile`: multi-stage (Maven build on JDK 21, run on a slim JRE 21), non-root user, `HEALTHCHECK` on `/actuator/health/readiness`, `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=70`.
- `frontend/Dockerfile`: build with Node 20, serve static files from Nginx with long-cache for hashed assets and `no-cache` for `index.html` and the service worker.
- `infra/docker-compose.prod.yml`: nginx, app (2 replicas), postgres, redis, optional prometheus + grafana. Volumes for postgres and redis. Restart policy `unless-stopped`.

## Nginx essentials
TLS via Let's Encrypt (certbot), HTTP to HTTPS redirect, HSTS (6 months, then 1 year), gzip/brotli, `proxy_set_header Upgrade/Connection` for `/ws`, `proxy_read_timeout 75s` for WebSocket, request size limit 1 MB, security headers (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy: `geolocation=(self)`), per-IP rate limit zone on `/api/v1/auth` and `/api/v1/join`.

## CI/CD (GitHub Actions)
1. **PR**: backend verify, frontend lint + typecheck + unit, Playwright E2E, axe, dependency scan, build images (no push). Required to merge.
2. **Research** (integration branch): all of the above, build and push images tagged with the commit SHA, deploy to staging, run smoke tests (`/actuator/health`, create-and-join script).
3. **Release** (pull request `research` into `main`, merge commit only): deploy to production with rolling update (one instance at a time), wait for readiness, run smoke test, rollback automatically on failure. Tag `vX.Y.Z` and publish release notes.
4. Database: Flyway migrations are backward compatible (expand, deploy, contract). Never drop a column in the same release that stops using it.

## Hosting options (decide before the first deployment)
| Option | Good for | Notes |
|---|---|---|
| Single VPS (Hetzner, DigitalOcean) 2 vCPU / 4 GB + managed Postgres | Cheapest start, full control | Docker compose, Nginx, certbot. Add a second VPS later |
| Render / Railway / Fly.io | Least ops | WebSockets supported, watch sticky behavior and cold starts |
| AWS (ECS Fargate + RDS + ElastiCache + ALB) | Scale and compliance | More setup, higher cost. India region (ap-south-1) helps data residency |
Recommendation for launch: a VPS in India or Singapore with managed Postgres and Redis, two app containers, Cloudflare in front for DNS and DDoS protection.

## Observability
- Metrics: active trips, connected sockets, location updates per second, broadcast latency, ETA cache hit rate, Directions calls per minute, JVM and DB pool stats.
- Logs: JSON, request id, no PII and no coordinates. Ship to Loki or the host's log service.
- Alerts: error rate over 2% for 5 min, p95 latency over 1 s, sockets dropping suddenly, DB connections over 80%, disk over 80%, certificate expiring in under 14 days, Mapbox spend 80% of budget.
- Uptime: external ping on `/actuator/health` every minute plus a synthetic "create and join" check every 10 minutes.

## Backups and recovery
Nightly `pg_dump` to object storage, 14 day retention, weekly restore test into a scratch database. Redis holds only ephemeral data (RDB snapshot is optional). Recovery targets: RPO 24 h, RTO 2 h at launch.

## Launch checklist
- [ ] All P0 features pass acceptance criteria. No open blocker bugs.
- [ ] Real-phone test on Android and iPhone, on mobile data, in a moving car with 3 friends.
- [ ] Privacy Policy, Terms, grievance contact, consent copy reviewed.
- [ ] Rate limits, CSP, CORS, cookies, HSTS verified with the ZAP scan.
- [ ] Mapbox tokens restricted by URL, billing alerts on.
- [ ] Backups restore tested. Runbook reviewed. On-call plan (even if it is only you).
- [ ] Sentry receiving events from both sides. Dashboards and alerts live.
- [ ] Store listing assets if installing as PWA: icons 192/512/maskable, screenshots from `design/screens`, short description.
- [ ] Feature flags for risky features (push, Google sign-in) with a kill switch.
- [ ] Beta with 10 to 20 users for a week; collect feedback and crash reports.

## After launch (v1.1 ideas)
Capacitor wrapper for background tracking, SOS and share-my-ETA link, group stops and meet-up points, trip photos, multi-language (Hindi first), widgets, premium: longer duration and history.
