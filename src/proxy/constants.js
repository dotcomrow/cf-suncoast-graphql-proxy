export const GRAPHQL_PATH = "/graphql";
export const HEALTH_PATH = "/healthz";
export const UPSTREAM_PROBE_PATH = "/upstream-probe";
export const DIRECTUS_ASSET_PROXY_PREFIX = "/directus/assets";
export const ALLOWED_METHODS = "GET,POST,OPTIONS";

export const DEFAULT_CACHE_TTL_SECONDS = 60;
export const DEFAULT_CACHE_SWR_SECONDS = 30;

export const DEFAULT_ALLOWED_HEADERS = "Authorization,Content-Type,SpanId";

export const FORWARDED_HEADERS = [
  "Accept",
  "Accept-Encoding",
  "Authorization",
  "Content-Type",
  "Origin",
  "apollographql-client-name",
  "apollographql-client-version",
  "User-Agent",
  "X-Request-Id",
  "X-Correlation-Id",
  "X-Cloud-Trace-Context",
];

export const FORWARDED_WEBSOCKET_HEADERS = [
  "Connection",
  "Upgrade",
  "Sec-WebSocket-Key",
  "Sec-WebSocket-Version",
  "Sec-WebSocket-Protocol",
  "Sec-WebSocket-Extensions",
];
