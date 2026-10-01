# Admin access hardening

Production admin access is fail-closed and requires all of the following:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` with at least 16 characters (use a long random value)
- `ADMIN_SESSION_SECRET` with at least 32 bytes of random data
- `ADMIN_TOTP_SECRET`, a Base32 secret for a 6-digit authenticator-app code
- `NEXT_PUBLIC_SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY` for admin data actions

If an authentication setting (username, password, signing secret, or TOTP seed) is missing or malformed, login and existing admin sessions are rejected. Missing Supabase service credentials prevents admin data actions from working. Local development may omit TOTP, but use production-shaped secrets when testing MFA.

## Provisioning secrets

Run this on a trusted machine. Do not paste the output into chat, commit it, or put it in a client-side `NEXT_PUBLIC_*` variable:

```sh
node scripts/generate-admin-secrets.mjs
```

Set both generated values in the hosting platform's secret manager. Generate a separate strong password for `ADMIN_PASSWORD`; do not reuse a personal or site-user password. Add `ADMIN_TOTP_SECRET` manually to an authenticator app (keep a secure offline recovery copy). The app accepts RFC 6238 TOTP with a 30-second period and a one-step clock-drift window.

The production cookie is `__Host-anix_admin_session`: Secure, HttpOnly, SameSite=Strict, Path=/, no Domain, and expires after 30 minutes. Rotating `ADMIN_SESSION_SECRET` invalidates every existing admin session. The old unsigned `admin_auth=true` value and earlier token format are rejected.

State-changing requests to `/admin` and `/api/admin/*` require a matching `Origin` in production and an effective HTTPS request. The check compares the exact browser origin with the request `Host`; it deliberately ignores `X-Forwarded-Host`. A TLS-terminating proxy must preserve the public `Host` header and overwrite `X-Forwarded-Proto` with one value (`https`). Requests with missing/malformed Origin or ambiguous forwarding protocol are rejected. Local development may omit Origin. Admin responses are not cached and cannot be framed; CSP form submissions are restricted to the same origin.

Admin-authored news HTML is sanitized both before storage and before rendering. The admin preview renders plain text, and the public news renderer allows only a limited set of formatting/media tags and safe URL schemes.

## Operational limits

The TOTP replay guard and login throttling are process-local, not shared across replicas, and reset on process restart. Keep admin behind the recommended WAF/VPN; multi-instance deployments should also use a shared rate-limit/replay store if they require cross-instance enforcement.

The user-block action applies a long Supabase sign-in ban without deleting user data. Supabase bans do not revoke already-issued access tokens, so an existing session may remain usable until its access token expires; do not treat a ban as immediate session revocation.

## Network controls

The application applies a five-attempt/15-minute process-local backstop to admin login. That in-memory limiter resets on process restart and is not shared across replicas. For production, also configure rate limiting in the trusted CDN/WAF for `/admin` and `/api/admin/*`; ideally place both behind Cloudflare Access, a VPN, or an equivalent identity-aware access proxy.

Optionally set `ADMIN_ALLOWED_IPS` to a comma-separated list of exact IP addresses. The app compares it with `cf-connecting-ip`, `x-real-ip`, then the first `x-forwarded-for` value. Only enable this behind a trusted proxy that overwrites these headers; never trust client-supplied forwarding headers on a directly exposed origin. CIDR ranges are not supported by this setting.

Keep the origin server/firewall inaccessible except through the trusted proxy where possible. Enforce HTTPS, keep dependencies patched, and never expose `SUPABASE_SERVICE_ROLE_KEY` or the TOTP seed to the browser. App-level hardening cannot make an internet-facing admin endpoint literally impossible to compromise; WAF/VPN controls and operational secret hygiene remain important.
