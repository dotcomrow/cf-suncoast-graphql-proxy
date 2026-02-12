import {
  DEFAULT_CACHE_TTL_SECONDS,
  DEFAULT_CACHE_SWR_SECONDS,
} from "./constants.js";

function asBoolean(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function asPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

async function sha256Hex(input) {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function getCacheSettings(env) {
  return {
    enabled: asBoolean(env.CACHE_ENABLED, true),
    ttlSeconds: asPositiveInteger(
      env.CACHE_TTL_SECONDS,
      DEFAULT_CACHE_TTL_SECONDS
    ),
    staleWhileRevalidateSeconds: asPositiveInteger(
      env.CACHE_STALE_WHILE_REVALIDATE_SECONDS,
      DEFAULT_CACHE_SWR_SECONDS
    ),
    includeGraphQLErrors: asBoolean(env.CACHE_INCLUDE_GRAPHQL_ERRORS, false),
  };
}

export function shouldAttemptCache(request, operationDetails, cacheSettings) {
  if (!cacheSettings.enabled) return false;
  if (!operationDetails.isQueryOnly) return false;
  if (request.headers.get("Authorization")) return false;
  if (request.headers.get("Cookie")) return false;

  const cacheControl = request.headers.get("Cache-Control") || "";
  if (/no-store|no-cache/i.test(cacheControl)) {
    return false;
  }

  return true;
}

export async function buildCacheKey(request, upstreamUrl, rawBody) {
  if (request.method === "GET") {
    return new Request(upstreamUrl.toString(), { method: "GET" });
  }

  const requestHash = await sha256Hex(rawBody);
  const cacheKeyUrl = new URL(upstreamUrl.toString());
  cacheKeyUrl.search = "";
  cacheKeyUrl.searchParams.set("cache_method", request.method);
  cacheKeyUrl.searchParams.set("cache_sha256", requestHash);

  return new Request(cacheKeyUrl.toString(), { method: "GET" });
}

export async function shouldCacheResponse(response, cacheSettings) {
  if (response.status !== 200) return false;
  if (response.headers.get("Set-Cookie")) return false;

  const upstreamCacheControl = response.headers.get("Cache-Control") || "";
  if (/no-store|private/i.test(upstreamCacheControl)) {
    return false;
  }

  if (cacheSettings.includeGraphQLErrors) {
    return true;
  }

  const contentType = (response.headers.get("Content-Type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return true;
  }

  try {
    const responseBody = await response.clone().json();
    if (Array.isArray(responseBody)) {
      return responseBody.every(
        (item) => !Array.isArray(item?.errors) || item.errors.length === 0
      );
    }
    return !Array.isArray(responseBody?.errors) || responseBody.errors.length === 0;
  } catch (_e) {
    return false;
  }
}

export function withEdgeCacheHeaders(response, cacheSettings) {
  const headers = new Headers(response.headers);
  headers.set(
    "Cache-Control",
    `public, max-age=0, s-maxage=${cacheSettings.ttlSeconds}, stale-while-revalidate=${cacheSettings.staleWhileRevalidateSeconds}`
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
