# SquadMap

Get there together. One link, one live map, everyone's ETA.

SquadMap is a real-time group location-sharing web app. A host starts a trip and shares a link, friends join as guests with just a name, and everyone sees each other live on one map with shared arrival times. Sharing stops automatically when the trip ends.

> Status: early development. The project is being set up; features are not available yet.

## Planned stack

| Layer | Choice |
| --- | --- |
| Backend | Java 21, Spring Boot 3.3, Spring Security (JWT), STOMP over WebSocket |
| Data | PostgreSQL 16, Redis 7, Flyway migrations |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Mapbox GL JS |
| Platform | Installable PWA, light and dark themes |
| Tooling | Docker, GitHub Actions, JUnit 5, Testcontainers, Vitest, Playwright |

## Privacy by design

- Location is shared only with people who hold the trip link.
- Live positions expire on their own and are deleted when the trip ends.
- Only a trip summary is kept, never a raw location track.

## Branches

- `main`: stable releases.
- `research`: integration branch; every change arrives here through a pull request.
