# SquadMap

Get there together. One link, one live map, everyone's ETA.

SquadMap is a real-time group location-sharing web app. A host starts a trip and shares a link, friends join as guests with just a name, and everyone sees each other live on one map with shared arrival times. Sharing stops automatically when the trip ends.

> Status: early development. Accounts, trips, invites, the live map with ETAs, trip chat and the trip
> menu work locally; notifications are next. Not deployed yet.

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
| 6. Try the live map (steps 1 to 3 running) | Start a trip, open its invite link in a private window and join as a guest, then open the trip in both | Each window shows the other person within a few seconds, and "Live · … left" in the top bar |
| 7. Try the chat (as in step 6, with "Friends can chat" on) | Open the chat button on the map in one window and send a message | The other window's chat button shows "1" at once; opening it shows the message, and typing in one window shows dots in the other |
| 8. Try the trip menu (as in step 6) | As the host, open the menu (top right on the map), extend sharing by 30 minutes, then end the trip | The guest's window says "The host added more time", and after ending both windows show "This trip has ended" |
| 9. Try pausing (as in step 6, with both windows sharing) | In the guest's window, open the menu and turn on Pause my location | The host's window says "Aman paused their location" and shows the dot dimmed with "Paused"; Resume in the guest's window brings it back |

The live map needs location permission in the browser. Opening the app on `localhost` counts as a secure
page, so browsers allow it there; on another address (say, a phone on your Wi-Fi) they need HTTPS.

Load test for the live connection (stack running; uses the [k6](https://k6.io) Docker image if k6 isn't
installed):

```sh
docker run --rm -i -e BASE=http://host.docker.internal:8480 grafana/k6 run - < infra/k6/ws-load.js
```

Verify: the summary shows `location_round_trip` p(95) under 3 s and `location_refused` under 0.5%.
Raise the load with `-e TRIPS=200 -e MEMBERS=10 -e DURATION=15m` against a staging stack.

Place search (choosing a trip's destination) and routes to it need your own Mapbox tokens; everything
else works without them (ETAs are then rough estimates). Create two public tokens in your [Mapbox account](https://account.mapbox.com/access-tokens/):

| Token | Where it goes | URL restriction | Verify |
| --- | --- | --- | --- |
| Web app | `frontend/.env.local` as `VITE_MAPBOX_PUBLIC_TOKEN=pk...` | `http://localhost:5480` | the map loads in the app |
| Server | `backend/.env.local` as `MAPBOX_SERVER_TOKEN=pk...` | none (the server sends no web address) | `GET /api/v1/places/search?q=pune` in the API docs returns places; on a trip with a destination, friends' dotted routes appear |

Both files are ignored by git. Restart the API after adding the server token.

Other useful addresses: API docs at <http://localhost:8480/swagger-ui.html>, and every email the app sends locally at <http://localhost:8425>.

`make down` stops the services and keeps the data. `make reset` also deletes the local database.

Without `make`, the commands are in the [Makefile](Makefile).

## Privacy by design

- Location is shared only with people who hold the trip link.
- Live positions expire on their own and are deleted when the trip ends.
- Only a trip summary is kept, never a raw location track.
- Trip chat is deleted 7 days after the trip ends.

## Branches

- `main`: stable releases.
- `research`: integration branch; every change arrives here through a pull request.
