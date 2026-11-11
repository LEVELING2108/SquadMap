# Changelog

All notable changes to SquadMap are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Changed

- Browser tests in CI run inside the official Playwright image, so they no longer depend on the
  Ubuntu package mirrors.

### Fixed

- `make help` no longer prints its lines wrapped in quotes on Windows.

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

[Unreleased]: https://github.com/LEVELING2108/SquadMap/compare/main...research
[0.1.0]: https://github.com/LEVELING2108/SquadMap/commits/main
