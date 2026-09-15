# Security Policy

Life Replay handles private memories and account information, so security and privacy issues should be reported responsibly.

## Supported versions

The latest version on the `main` branch is the actively maintained version.

## Reporting a vulnerability

Please do not open a public GitHub issue for a suspected security vulnerability.

Use GitHub's private vulnerability reporting/security advisory mechanism for this repository when available. Include:

- A clear description of the vulnerability.
- Reproduction steps or a minimal proof of concept.
- The affected component or endpoint.
- Potential security impact.
- Any suggested mitigation.

Do not include real passwords, authentication tokens, private photos, personal information, or production database contents in a report.

## Response

Maintainers will review valid reports, work to reproduce the issue, assess impact, develop a fix, and coordinate disclosure when appropriate.

## Security principles

Life Replay should:

- Never store plaintext passwords.
- Keep JWT secrets out of source control.
- Scope private memory access to the authenticated owner.
- Validate uploaded files and metadata.
- Avoid exposing sensitive information in errors or logs.
- Keep production storage persistent and access-controlled.
- Use HTTPS for deployed applications and APIs.
