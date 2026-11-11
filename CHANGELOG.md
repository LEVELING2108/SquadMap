# Changelog

All notable changes to SquadMap are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- This changelog.

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
