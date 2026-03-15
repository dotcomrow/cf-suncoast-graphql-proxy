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

function tryParseHttpOrigin(origin) {
  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.protocol !== "http:" && parsedOrigin.protocol !== "https:") {
      return null;
    }
    return parsedOrigin;
  } catch {
    return null;
  }
}

function getDefaultPort(protocol) {
  if (protocol === "http:") return "80";
  if (protocol === "https:") return "443";
  return "";
}

function getEffectivePort(originUrl) {
  return originUrl.port || getDefaultPort(originUrl.protocol);
}

function parseWildcardOriginPattern(configuredOrigin) {
  const wildcardOrigin = configuredOrigin.trim();
  let protocol;
  let wildcardHost = wildcardOrigin;

  const protocolSeparatorIndex = wildcardOrigin.indexOf("://");
  if (protocolSeparatorIndex >= 0) {
    const normalizedProtocol = wildcardOrigin
      .slice(0, protocolSeparatorIndex)
      .toLowerCase();
    if (normalizedProtocol !== "http" && normalizedProtocol !== "https") {
      return null;
    }

    protocol = `${normalizedProtocol}:`;
    wildcardHost = wildcardOrigin.slice(protocolSeparatorIndex + 3);
  }

  if (
    wildcardHost.includes("/") ||
    wildcardHost.includes("?") ||
    wildcardHost.includes("#")
  ) {
    return null;
  }

  let port;
  let wildcardHostname = wildcardHost;
  const portMatch = wildcardHost.match(/^(.*):(\d+)$/);
  if (portMatch) {
    wildcardHostname = portMatch[1];
    port = portMatch[2];
  }

  if (!wildcardHostname.startsWith("*.")) {
    return null;
  }

  const hostnameSuffix = wildcardHostname.slice(1).toLowerCase();
  if (hostnameSuffix.length < 3) {
    return null;
  }

  return { protocol, port, hostnameSuffix };
}

function isWildcardOriginMatch(configuredOrigin, requestOriginUrl) {
  const wildcardPattern = parseWildcardOriginPattern(configuredOrigin);
  if (!wildcardPattern || !requestOriginUrl) {
    return false;
  }

  if (
    wildcardPattern.protocol &&
    wildcardPattern.protocol !== requestOriginUrl.protocol
  ) {
    return false;
  }

  if (wildcardPattern.port && wildcardPattern.port !== getEffectivePort(requestOriginUrl)) {
    return false;
  }

  const requestHostname = requestOriginUrl.hostname.toLowerCase();
  return requestHostname.endsWith(wildcardPattern.hostnameSuffix);
}

function isExactOriginMatch(configuredOrigin, requestOrigin, requestOriginUrl) {
  if (configuredOrigin === requestOrigin) {
    return true;
  }

  if (!requestOriginUrl) {
    return false;
  }

  const configuredOriginUrl = tryParseHttpOrigin(configuredOrigin);
  if (!configuredOriginUrl) {
    return false;
  }

  return configuredOriginUrl.origin === requestOriginUrl.origin;
}

function isConfiguredOriginAllowed(requestOrigin, env) {
  const allowedOrigins = parseDelimitedList(env.CORS_DOMAINS);
  if (allowedOrigins.length === 0) {
    return true;
  }

  const requestOriginUrl = tryParseHttpOrigin(requestOrigin);

  return allowedOrigins.some((configuredOrigin) => {
    if (configuredOrigin === "*") {
      return true;
    }

    return (
      isExactOriginMatch(configuredOrigin, requestOrigin, requestOriginUrl) ||
      isWildcardOriginMatch(configuredOrigin, requestOriginUrl)
    );
  });
}

function isDevHostname(hostname) {
  return hostname.split(".").includes("dev");
}

function isLocalhostHostname(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function isLocalhostOrigin(origin) {
  try {
    const originUrl = new URL(origin);
    const isHttpOrigin =
      originUrl.protocol === "http:" || originUrl.protocol === "https:";
    return isHttpOrigin && isLocalhostHostname(originUrl.hostname);
  } catch {
    return false;
  }
}

function isRequestOriginAllowed(request, env, requestOrigin) {
  if (isConfiguredOriginAllowed(requestOrigin, env)) {
    return true;
  }

  // Allow localhost origins only when requests target the dev hostname.
  try {
    const requestHostname = new URL(request.url).hostname.toLowerCase();
    return isDevHostname(requestHostname) && isLocalhostOrigin(requestOrigin);
  } catch {
    return false;
  }
}

export function isOriginAllowed(request, env) {
  const requestOrigin = request.headers.get("Origin");
  if (!requestOrigin) {
    return { allowed: true };
  }

  if (isRequestOriginAllowed(request, env, requestOrigin)) {
    return { allowed: true };
  }

  return { allowed: false };
}

export function applyCorsHeaders(headers, request, env) {
  const requestOrigin = request.headers.get("Origin");
  if (!requestOrigin) return;

  if (!isRequestOriginAllowed(request, env, requestOrigin)) {
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
