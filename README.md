# cf-suncoast-graphql-proxy

Cloudflare Worker that acts as a strict pull-through proxy to an upstream GraphQL endpoint in your k8s cluster.

## Behavior

- Accepts GraphQL requests on `/graphql` (`GET` and `POST`).
- Proxies requests to `UPSTREAM_GRAPHQL_URL` without local schema composition/resolvers.
- Preserves upstream schema exposure (including introspection behavior) because the worker does not host schema locally.
- Uses bearer-token passthrough only:
  - `Authorization: Bearer ...` is forwarded to upstream unchanged.
- Forwards client IP metadata to upstream using Cloudflare-trusted source only:
  - Reads only `CF-Connecting-IP` from the Cloudflare edge request.
  - Ignores inbound `X-Forwarded-For`, `Forwarded`, `X-Real-IP`, and `True-Client-IP` values from clients.
  - Sends normalized IP via `X-Client-IP`, `X-Real-IP`, `CF-Connecting-IP`, `True-Client-IP`, `X-Forwarded-For`, and `Forwarded`.
- Provides edge caching for unauthenticated query operations.

## Cache Rules

- Cache is enabled by default and controlled via env vars.
- Only query operations are cache candidates.
- Requests with `Authorization` or `Cookie` are never cached.
- Mutations/subscriptions are never cached.
- POST query responses are cached with a SHA-256 body-based key.
- Responses with `Set-Cookie`, `Cache-Control: private`, or `Cache-Control: no-store` are not cached.
- By default, GraphQL responses containing `errors` are not cached (`CACHE_INCLUDE_GRAPHQL_ERRORS=false`).

## Worker Env Bindings

- `UPSTREAM_GRAPHQL_URL` (required): full upstream GraphQL URL.
- `CORS_DOMAINS` (required): comma-separated allowed origins.
- `CACHE_ENABLED` (default `true`).
- `CACHE_TTL_SECONDS` (default `60`).
- `CACHE_STALE_WHILE_REVALIDATE_SECONDS` (default `30`).
- `CACHE_INCLUDE_GRAPHQL_ERRORS` (default `false`).

## Health Check

- `GET /healthz` returns proxy health and version.
