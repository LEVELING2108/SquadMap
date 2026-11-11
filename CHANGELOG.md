# Changelog

All notable changes to SquadMap are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Trips: a signed-in person can start a trip with a name, an optional destination, a sharing time
  of 1, 2, 4 or 8 hours and chat on or off, and gets an 8-character code and invite link. Up to
  three trips can run at once. Only people on a trip can see it or its invite.

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

[Unreleased]: https://github.com/LEVELING2108/SquadMap/compare/v0.2.1...research
[0.2.1]: https://github.com/LEVELING2108/SquadMap/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/LEVELING2108/SquadMap/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/LEVELING2108/SquadMap/releases/tag/v0.1.0
