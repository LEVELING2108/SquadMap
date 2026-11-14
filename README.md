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

## Run it locally

You need Docker, Java 21 or newer, Node 22 or newer, and `make`.

| Step | Command | Verify |
| --- | --- | --- |
| 1. Start Postgres, Redis and the mail catcher | `make up` | `make ps` shows three services as `healthy` |
| 2. Run the API | `make backend` | <http://localhost:8480/actuator/health> returns `{"status":"UP"}` |
| 3. Install and run the web app (second terminal) | `make install` then `make frontend` | <http://localhost:5480> shows the SquadMap page |
| 4. Run the tests | `make test` and `make e2e` | Both finish without failures |
| 5. Run the full account journey (steps 1 and 2 running) | `make journey` | `1 passed`: sign up, log in, and a password reset through a real email |

Place search (choosing a trip's destination) needs your own Mapbox tokens; everything else works
without them. Create two public tokens in your [Mapbox account](https://account.mapbox.com/access-tokens/):

| Token | Where it goes | URL restriction | Verify |
| --- | --- | --- | --- |
| Web app | `frontend/.env.local` as `VITE_MAPBOX_PUBLIC_TOKEN=pk...` | `http://localhost:5480` | the map loads in the app |
| Server | `backend/.env.local` as `MAPBOX_SERVER_TOKEN=pk...` | none (the server sends no web address) | `GET /api/v1/places/search?q=pune` in the API docs returns places |

Both files are ignored by git. Restart the API after adding the server token.

Other useful addresses: API docs at <http://localhost:8480/swagger-ui.html>, and every email the app sends locally at <http://localhost:8425>.

`make down` stops the services and keeps the data. `make reset` also deletes the local database.

Without `make`, the commands are in the [Makefile](Makefile).

## Privacy by design

- Location is shared only with people who hold the trip link.
- Live positions expire on their own and are deleted when the trip ends.
- Only a trip summary is kept, never a raw location track.

## Branches

- `main`: stable releases.
- `research`: integration branch; every change arrives here through a pull request.
