# Security Policy

## Supported versions

The `main` branch and the latest tagged release receive security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security-sensitive reports. Use
GitHub's private vulnerability reporting:

https://github.com/zakriayousafzai/the-book-heaven-backend/security/advisories/new

Include the affected endpoint, reproduction steps, and the impact you believe
is possible. Reports are acknowledged as soon as possible and investigated
before any public disclosure.

## Areas of interest

- Authentication or role-check bypasses (Clerk session handling)
- Authorization bugs (editing or deleting another user's content)
- Moderation bypasses (making pending/denied books publicly visible)
- NoSQL or regular-expression injection
- Secret or credential exposure
- Denial-of-service vectors in search or pagination

## Out of scope

- Issues that require access to a user's own Clerk account or machine
- Missing rate limiting (tracked as a roadmap item rather than a vulnerability)
- Vulnerabilities in third-party services such as Clerk or MongoDB Atlas
