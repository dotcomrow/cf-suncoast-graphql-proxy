import {
  ALLOWED_METHODS,
  DEFAULT_ALLOWED_HEADERS,
} from "./constants.js";

function parseDelimitedList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function isOriginAllowed(request, env) {
  const requestOrigin = request.headers.get("Origin");
  if (!requestOrigin) {
    return { allowed: true };
  }

  const allowedOrigins = parseDelimitedList(env.CORS_DOMAINS);
  if (allowedOrigins.length === 0) {
    return { allowed: true };
  }

  if (allowedOrigins.includes("*") || allowedOrigins.includes(requestOrigin)) {
    return { allowed: true };
  }

  return { allowed: false };
}

export function applyCorsHeaders(headers, request, env) {
  const requestOrigin = request.headers.get("Origin");
  if (!requestOrigin) return;

  const allowedOrigins = parseDelimitedList(env.CORS_DOMAINS);
  if (
    allowedOrigins.length > 0 &&
    !allowedOrigins.includes("*") &&
    !allowedOrigins.includes(requestOrigin)
  ) {
    return;
  }

  headers.set("Access-Control-Allow-Origin", requestOrigin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  headers.set(
    "Access-Control-Allow-Headers",
    request.headers.get("Access-Control-Request-Headers") ||
      DEFAULT_ALLOWED_HEADERS
  );
  headers.set("Vary", "Origin");
}

export function withResponseHeaders(request, env, spanId, response, cacheStatus) {
  const headers = new Headers(response.headers);
  headers.set("SpanId", spanId);
  headers.set("X-Cache-Status", cacheStatus);
  applyCorsHeaders(headers, request, env);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createErrorResponse(request, env, spanId, status, message) {
  return withResponseHeaders(
    request,
    env,
    spanId,
    new Response(
      JSON.stringify({
        error: message,
        spanId,
      }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      }
    ),
    "BYPASS"
  );
}

export function createPreflightResponse(request, env, spanId) {
  const headers = new Headers();
  applyCorsHeaders(headers, request, env);
  headers.set("Allow", ALLOWED_METHODS);
  headers.set("SpanId", spanId);
  headers.set("X-Cache-Status", "BYPASS");
  return new Response(null, { status: 204, headers });
}
