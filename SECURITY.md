# Security policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a vulnerability

**Do not open a public issue for security reports.**

- Email: **hamid.digitalmarketer@gmail.com**
- Subject: `SECURITY: firebase-ai-starter-kit — <short summary>`
- Include: affected version/commit, reproduction steps, impact, and any proof-of-concept.

You can expect:

| Stage                          | Target                           |
| ------------------------------ | -------------------------------- |
| Acknowledgement                | within 48 hours                  |
| Triage and severity assessment | within 5 business days           |
| Fix or mitigation plan         | within 14 days for high/critical |
| Public disclosure              | coordinated, after a fix ships   |

## In scope

- Bypassing callable authentication or rate limits
- Reading or writing another user's data through the rules
- Exposing `GEMINI_API_KEY` or other secrets
- Injecting content that changes server behaviour (prompt injection with a security effect)
- Denial of service against the functions surface without authentication

## Out of scope

- Findings that require a compromised device or a valid admin account
- Model hallucinations or content-quality issues
- Rate limits being hit by design
- Missing headers on non-production endpoints
- Reports produced solely by an automated scanner without a demonstrated impact

## Safe harbour

Research that stays within your own project instance, avoids real user data, and does not degrade
service is considered authorised. Please do not test against other people's deployments.

## Hardening expectations for forks

If you deploy this kit publicly:

1. Enable App Check and enforce it after monitoring.
2. Set a billing budget alert.
3. Keep `maxInstances` bounded.
4. Never commit `.env`, service-account keys, or `.firebaserc` with production project ids you do not
   want public.
