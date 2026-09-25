# Error codes

Standard codes emitted by kashi packages (`ErrorCodes` in `@softwareseva/core/contracts`):

| Code | Status | When |
|---|---|---|
| `VALIDATION_ERROR` | 422 | zod parse failed; `fields` maps path -> messages |
| `INVALID_CURSOR` | 422 | pagination cursor unreadable or tampered |
| `UNAUTHORIZED` | 401 | no valid session |
| `FORBIDDEN` | 403 | valid session, insufficient role, or CSRF failure |
| `NOT_FOUND` | 404 | resource missing or soft-deleted |
| `CONFLICT` | 409 | unique constraint or state conflict |
| `RATE_LIMITED` | 429 | window exhausted |
| `INTERNAL_ERROR` | 500 | unexpected; details only in logs with `requestId` |

App-specific codes follow the same shape (`UPPER_SNAKE`), are documented next to the route, and are stable once shipped because clients translate on them.

Messages are English sentences safe to show to a user. Clients may translate by code (`createApiClient({ translate })`).
