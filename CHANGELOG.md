# Changelog

All notable changes to SquadMap are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-11-19

Trips: start a trip, invite friends by link, see everyone live on one map with routes and ETAs,
and chat while you travel.

### Added

- Trips: a signed-in person can start a trip with a name, an optional destination, a sharing time
  of 1, 2, 4 or 8 hours and chat on or off, and gets an 8-character code and invite link. Up to
  three trips can run at once. Only people on a trip can see it or its invite.
- Joining a trip from its invite link: a preview of the trip, then joining as a guest with just a
  name (with a pass that works for that trip only, until it ends) or as yourself when signed in. A
  choice to share location is recorded with the policy version. A trip holds up to 10 people.
  Joining is limited to 10 tries a minute per address, and 20 wrong codes in an hour lock an address
  out, so codes can't be guessed.
- Trip lifecycle: the host can extend sharing by 30 minutes, 1 hour or 2 hours (12 hours at most in
  total) and end the trip for everyone; guests renew their pass after an extension; anyone else can
  leave. Trips whose time runs out are marked expired within 30 seconds, and location consent is
  marked withdrawn whenever someone stops sharing. Starting a trip accepts an `Idempotency-Key`, so
  a retried tap doesn't start a second trip.
- Guests stay on their trip across reloads: joining sets an HttpOnly cookie holding their pass,
  and the web app picks the session back up from it, with a pass that also covers any extension.
- Invite screen: the trip's boarding pass with its code, and ways to send the link: the phone's share
  sheet, copy link, or a QR code to scan. The temporary home lists your running trips.
- Join screens: an invite link shows who invited you and to which trip; a guest gives a name, or
  someone signed in joins with their account. The code can be typed or scanned with the camera
  (the browser's own QR reader where there is one, otherwise a small decoder loaded only when
  scanning). A consent screen explains what sharing means and offers "Share my location" or
  "Not now"; if the browser blocks location, the person can still join and only see friends. An
  ended trip's link shows when it ended. A guest can leave the trip, and after a reload a guest
  whose trip is over is told it has ended.
- Place search for a trip's destination: up to 6 matching places from Mapbox, nearest first when
  you share where you are (rounded to about 1 km before it leaves the server), limited to 30
  searches a minute per person. Results are shown, never stored. A searched place chosen for a
  trip is looked up again in Mapbox's permanent mode, which may be stored, and saved only if the
  same place comes back; a dropped pin is saved as given. Recent places list your last 5
  different destinations from your own trips.
- Starting a trip from the app: pick a destination by searching (results sorted by distance when
  location is already allowed; this screen never asks), from recent places, by dropping a pin on
  the map, or skip it. Then name the trip (a name is suggested), choose 1, 2, 4 or 8 hours and
  whether friends can chat, and create it, which opens the invite. Maps use Mapbox GL, loaded
  only on the screens that show one; without a token or when the map can't load, an illustrated
  map is shown instead and picking on the map points to search. A double tap can't start two trips.
- Trip history: every trip you hosted or joined, running or over, newest first, with the day,
  who came along and a Live or Done badge, loaded a page at a time. Trips with a destination show
  a still map of it. Filters for this month and for the friend you travel with most. A running
  trip opens from its card. A bottom navigation bar links Explore and Trips; more tabs join it as
  their screens are built.
- You tab: a profile with your avatar, name and "Explorer since", the number of trips you've been
  on and of different people you've shared one with, links to trip history and settings, and log
  out. Settings are saved to the account and follow you to other devices: Dark map (maps always
  dark), distance unit (km or mi, used for place distances) and the default sharing time a new trip
  starts on; the app's light or dark theme is chosen per device. Changes made in quick succession
  are all kept.
- Account options on the profile: edit your name and colour (used on trips from then on), change
  your password with the current one (other devices are logged out, this one stays in, and any
  reset link already sent stops working), change your email with your password (the old address
  gets a notice), and log out everywhere else. Five wrong current passwords in 15 minutes pause
  further tries. More settings: map style (Streets, Outdoors or Satellite), chat on by default for
  new trips, reduce animations (remembered on the device so a reload starts still), and 12 or
  24-hour time, shown as "Live until …" on running trips.
- Alerts tab: an in-app inbox with Today and Earlier groups, unread dots and Mark all read. A host
  hears when someone joins or leaves their trip and when sharing ends within 10 minutes (once per
  end time, again after an extension); everyone on a trip with an account hears when it ends,
  except the host who ended it. Tapping an alert opens the running trip, or trip history once it's
  over. The Alerts tab and the profile show the unread count. Guests get no alerts. Alerts are
  deleted after 30 days.
- Home with the map: a full-screen map in your map style, a "You" dot where you are (only if
  location is already allowed; the recenter button asks when tapped), a "Where to?" bar that starts
  a trip, Settings and profile buttons, and a "Ready for a trip?" panel with New trip, Join and your
  live trips (name, friends and when sharing ends). The map centres on the part left visible
  between the top bar and the panel. Signed out, it offers Create account, Log in and Join with a
  code; a guest is sent back to their trip. The bottom navigation is now complete.
- Cafes, Stays and Sights chips on Home: up to 10 places of that kind near where the map is, as dots
  on the map and a list with distances, nearest first. Choosing one shows it with "Plan a trip
  here", which opens Choose on map at that spot with its name filled in; it is saved as your own
  pin, since these results may not be stored. The search point is rounded to about 100 m before it
  leaves the server, searches are limited to 20 a minute, and repeating one in the same area within
  2 minutes is answered from memory. An Alerts chip opens the inbox.
- Live map: everyone on a trip sees each other move on one map in real time, with the destination,
  a list of who's on the way and who hasn't shared yet, toasts when people join or leave, dimmed
  dots with "N min ago" when a spot is old, and an offline banner with Retry. Location is sent only
  after consent, at most every 2 seconds (every 15 while standing still), and the app reconnects by
  itself after a drop. Spots that are inaccurate, too old or impossible jumps are refused. Each
  person's last spot is kept for 10 minutes and only in memory, never in the database, and is
  deleted when they leave or the trip ends. The host, or anyone who chose "Not now", can start
  sharing from the map.
- Routes and ETAs: each person's route to the destination along the roads, in their colour, with
  an ETA that follows traffic for cars and bikes. Everyone picks Car, Bike or Walk; until then the
  app guesses from the distance. "Who's on the way" lists everyone by arrival time or name, with
  distance and ETA. Staying within 60 m of the destination for 20 seconds counts as arrived, with
  a toast for everyone and "Everyone has arrived" at the end. To keep costs down, routes are asked
  for again only after moving 100 m or a minute passing, and are estimated when the limit is
  reached or the route service fails.
- Friend details: tapping a friend shows whether they're moving or stopped, their distance, ETA,
  speed and progress to the destination, with Follow (keeps them centred until you drag the map or
  tap Stop) and directions to where they are now in Google Maps. Dots glide to their new spot
  instead of jumping (they jump with reduced motion). A Layers button switches the map between
  Streets, Outdoors and Satellite.
- Trip chat for everyone on a trip, guests included: a chat button with the unread count, Message
  on a friend's details, typing dots, quick replies (I'm here, Running late, Wait for me), and
  "Not sent" with Retry, which never posts the same message twice. Messages are plain text up to
  280 characters, 20 a minute per person. After the trip ends the chat can still be read but not
  written, and it is deleted 7 days later. When the host turns chat off, there is no chat.

### Fixed

- A reload at the wrong moment could log you out. If the page reloaded while the app was renewing
  its sign-in, the server had already replaced the cookie but the browser never got the new one,
  so its next renewal looked like a stolen cookie and the session was ended. A replaced cookie
  presented again within 20 seconds is now treated as a lost reply: the session continues with a
  single usable cookie. Later reuse still ends the session, and a session that was ended (log out,
  password change, log out everywhere else) can't be revived this way.
- The web app could not send PUT requests: the browser call rules allowed GET, POST, PATCH and
  DELETE only, so the first PUT route answered 403. A test now checks every method the API uses.
- Logging in right as the app opened could log you straight out again: a late "no session" answer
  from the startup check overwrote the new sign-in. It is now ignored once someone has logged in.

### Security

- The code checker's file-matching library (minimatch) is pinned to 11, which fixes a published
  denial-of-service advisory. It is a development tool only and never ships in the app.

## [0.2.1] - 2026-11-12

Security update.

### Security

- Upgraded BouncyCastle, the password-hashing library, from 1.80 to 1.87, fixing five published
  advisories (two critical). None affected the Argon2 hashing SquadMap uses, and existing password
  hashes keep working.

## [0.2.0] - 2026-11-12

Accounts: people can sign up, log in, stay signed in, and reset a forgotten password.

### Added

- This changelog.
- Accounts: sign up with name, email and password, log in, and fetch your own profile. Passwords are
  hashed with Argon2id; access tokens last 15 minutes.
- Staying signed in: a 30-day refresh cookie, replaced on every use. Presenting a cookie that was
  already replaced ends that whole session, and logging out ends the session on that device.
- Forgot password: an email with a link that works once, for 30 minutes. Asking again cancels the
  older link, and setting a new password signs the account out on every device. The request answers
  the same way whether or not the email has an account.
- Rate limits on the account routes, shared across app instances through Redis: log in 5 a minute
  per address and per account, forgot password 3 an hour per email and 10 per address, sign up and
  reset 10 an hour per address, refresh 60 a minute. Limited requests get `429` with `Retry-After`.
- Welcome screen, in light and dark, with its sunrise and night scenes. The web app restores a
  session on load and refreshes it in one tab at a time, so several open tabs never sign each
  other out.
- Log in, Sign up, Forgot password and a new "Set a new password" screen, in light and dark. Errors
  appear on the field they belong to and are read out with it; the password field has a show/hide
  button and a strength meter that says its rating in words. A temporary home page greets you by
  name and lets you log out until the real home arrives.

### Changed

- Browser tests in CI run inside the official Playwright image, so they no longer depend on the
  Ubuntu package mirrors.
- A new required CI check, `journey`, runs the whole account flow in a real browser against the
  real backend, database and mail catcher on every pull request. `make journey` runs it locally.

### Fixed

- `make help` no longer prints its lines wrapped in quotes on Windows.
- Sizes in the web app were 1/16 smaller than designed (buttons 48.75 px instead of 52, tap
  targets 41.25 px instead of 44), because the root font size was set to 15 px.

## [0.1.0] - 2026-11-11

Project foundations. No user-facing features yet.

### Added

- Product documentation: roadmap, feature list, design system, screen specs, architecture, and the
  testing and deployment plan.
- Design reference: tokens, map assets and all 26 screens in light and dark.
- Backend service (Spring Boot 3.3, Java 21) with deny-by-default security, `application/problem+json`
  error responses carrying a stable `code`, per-profile configuration and a Flyway baseline.
- Web app (React 19, TypeScript, Vite) with Tailwind mapped to the design tokens, self-hosted fonts and
  a light, dark or system theme that is remembered per device.
- Local development stack (PostgreSQL 16, Redis 7, a mail catcher) with a Makefile for common tasks.
- Continuous integration: backend tests, frontend lint, type-check, unit tests and build, browser
  tests, a secret scan, and a guard that only lets `research` merge into `main`.

[Unreleased]: https://github.com/LEVELING2108/SquadMap/compare/v0.3.0...research
[0.3.0]: https://github.com/LEVELING2108/SquadMap/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/LEVELING2108/SquadMap/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/LEVELING2108/SquadMap/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/LEVELING2108/SquadMap/releases/tag/v0.1.0
