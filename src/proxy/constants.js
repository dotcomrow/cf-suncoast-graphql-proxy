export const GRAPHQL_PATH = "/graphql";
export const HEALTH_PATH = "/healthz";
export const ALLOWED_METHODS = "GET,POST,OPTIONS";

export const DEFAULT_CACHE_TTL_SECONDS = 60;
export const DEFAULT_CACHE_SWR_SECONDS = 30;

export const DEFAULT_ALLOWED_HEADERS = "Authorization,Content-Type,SpanId";

export const FORWARDED_HEADERS = [
  "Accept",
  "Accept-Encoding",
  "Authorization",
  "Content-Type",
  "apollographql-client-name",
  "apollographql-client-version",
  "User-Agent",
  "X-Request-Id",
  "X-Correlation-Id",
  "X-Cloud-Trace-Context",
];
