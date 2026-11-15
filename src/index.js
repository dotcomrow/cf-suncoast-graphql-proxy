import {
  ALLOWED_METHODS,
  DIRECTUS_ASSET_PROXY_PREFIX,
  GRAPHQL_PATH,
  HEALTH_PATH,
  UPSTREAM_PROBE_PATH,
} from "./proxy/constants.js";
import {
  createErrorResponse,
  createPreflightResponse,
  isOriginAllowed,
  withResponseHeaders,
} from "./proxy/cors.js";
import { toLoggableError } from "./proxy/errors.js";
import {
  extractGraphQLRequest,
  evaluateOperation,
  normalizePersistedQueryPayload,
} from "./proxy/graphql-request.js";
import {
  buildCacheKey,
  getCacheSettings,
  shouldAttemptCache,
  shouldCacheResponse,
  withEdgeCacheHeaders,
} from "./proxy/cache.js";
import {
  buildUpstreamRequest,
  buildUpstreamProbeRequest,
  buildUpstreamUrl,
  fetchUpstream,
  getUpstreamTimeoutMs,
  isAbortError,
  isWebSocketUpgradeRequest,
} from "./proxy/upstream.js";

export default {
  async fetch(request, env, ctx) {
    const spanId = request.headers.get("SpanId") || crypto.randomUUID();
    const url = new URL(request.url);

    try {
      if (url.pathname === HEALTH_PATH) {
        return withResponseHeaders(
          request,
          env,
          spanId,
          new Response(
            JSON.stringify({
              status: "ok",
              service: "graphql-pull-through-proxy",
              version: env.VERSION || "unknown",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          ),
          "BYPASS"
        );
      }

      const originCheck = isOriginAllowed(request, env);
      if (!originCheck.allowed) {
        return createErrorResponse(
          request,
          env,
          spanId,
          403,
          "Origin is not allowed"
        );
      }

      if (request.method === "OPTIONS") {
        return createPreflightResponse(request, env, spanId);
      }

      if (url.pathname === UPSTREAM_PROBE_PATH) {
        if (request.method !== "GET") {
          const response = createErrorResponse(
            request,
            env,
            spanId,
            405,
            "Method not allowed"
          );
          response.headers.set("Allow", "GET,OPTIONS");
          return response;
        }

        if (!env.UPSTREAM_GRAPHQL_URL) {
          return createErrorResponse(
            request,
            env,
            spanId,
            500,
            "UPSTREAM_GRAPHQL_URL is not configured"
          );
        }

        return await runUpstreamProbe(request, env, spanId);
      }

      if (url.pathname.startsWith(DIRECTUS_ASSET_PROXY_PREFIX)) {
        return await runDirectusAssetProxy(request, env, spanId, url);
      }

      if (url.pathname !== GRAPHQL_PATH) {
        return createErrorResponse(request, env, spanId, 404, "Not found");
      }

      if (request.method !== "GET" && request.method !== "POST") {
        const response = createErrorResponse(
          request,
          env,
          spanId,
          405,
          "Method not allowed"
        );
        response.headers.set("Allow", ALLOWED_METHODS);
        return response;
      }

      if (!env.UPSTREAM_GRAPHQL_URL) {
        return createErrorResponse(
          request,
          env,
          spanId,
          500,
          "UPSTREAM_GRAPHQL_URL is not configured"
        );
      }

      const upstreamUrl = buildUpstreamUrl(request, env.UPSTREAM_GRAPHQL_URL);
      const webSocketUpgrade = isWebSocketUpgradeRequest(request);

      // Browser WebSocket clients cannot reliably set Authorization headers
      // during the handshake. Keep header auth required for HTTP GraphQL and
      // defer WS auth to upstream GraphQL connection initialization.
      if (
        !webSocketUpgrade &&
        !isBearerAuthorization(request.headers.get("Authorization"))
      ) {
        const response = createErrorResponse(
          request,
          env,
          spanId,
          401,
          "Not authorized"
        );
        response.headers.set("WWW-Authenticate", "Bearer");
        return response;
      }

      if (webSocketUpgrade) {
        if (request.method !== "GET") {
          const response = createErrorResponse(
            request,
            env,
            spanId,
            405,
            "Method not allowed"
          );
          response.headers.set("Allow", "GET,OPTIONS");
          return response;
        }

        const upstreamRequest = buildUpstreamRequest(
          request,
          upstreamUrl,
          undefined,
          spanId
        );
        const upstreamTimeoutMs = getUpstreamTimeoutMs(env);

        try {
          const upstreamResponse = await fetchUpstream(
            upstreamRequest,
            upstreamTimeoutMs
          );

          // Preserve the upgraded socket by returning the upstream response as-is.
          if (upstreamResponse.status === 101) {
            return upstreamResponse;
          }

          const response = new Response(upstreamResponse.body, upstreamResponse);
          return withResponseHeaders(request, env, spanId, response, "BYPASS");
        } catch (error) {
          if (isAbortError(error)) {
            return createErrorResponse(
              request,
              env,
              spanId,
              504,
              `Upstream request timed out after ${upstreamTimeoutMs}ms (${sanitizeUpstreamUrl(env.UPSTREAM_GRAPHQL_URL)})`
            );
          }
          throw error;
        }
      }

      const extractedRequestDetails = await extractGraphQLRequest(request);
      const requestDetails = normalizePersistedQueryPayload(
        extractedRequestDetails
      );
      const operationDetails = evaluateOperation(
        requestDetails.query,
        requestDetails.operationName
      );

      const cacheSettings = getCacheSettings(env);
      const cacheCandidate = shouldAttemptCache(
        request,
        operationDetails,
        cacheSettings
      );

      let cacheKey = undefined;
      if (cacheCandidate) {
        cacheKey = await buildCacheKey(
          request,
          upstreamUrl,
          requestDetails.rawBody || ""
        );
        const cachedResponse = await caches.default.match(cacheKey);
        if (cachedResponse) {
          return withResponseHeaders(
            request,
            env,
            spanId,
            new Response(cachedResponse.body, cachedResponse),
            "HIT"
          );
        }
      }

      const upstreamRequest = buildUpstreamRequest(
        request,
        upstreamUrl,
        requestDetails.rawBody,
        spanId
      );
      const upstreamTimeoutMs = getUpstreamTimeoutMs(env);

      let upstreamResponse = undefined;
      try {
        upstreamResponse = await fetchUpstream(upstreamRequest, upstreamTimeoutMs);
      } catch (error) {
        if (isAbortError(error)) {
          return createErrorResponse(
            request,
            env,
            spanId,
            504,
            `Upstream request timed out after ${upstreamTimeoutMs}ms (${sanitizeUpstreamUrl(env.UPSTREAM_GRAPHQL_URL)})`
          );
        }
        throw error;
      }

      const response = new Response(upstreamResponse.body, upstreamResponse);

      if (
        cacheCandidate &&
        cacheKey &&
        (await shouldCacheResponse(response, cacheSettings))
      ) {
        const cacheableResponse = withEdgeCacheHeaders(response, cacheSettings);
        ctx.waitUntil(caches.default.put(cacheKey, cacheableResponse.clone()));
        return withResponseHeaders(
          request,
          env,
          spanId,
          cacheableResponse,
          "MISS"
        );
      }

      return withResponseHeaders(request, env, spanId, response, "BYPASS");
    } catch (error) {
      console.error("GraphQL proxy request failed!", {
        spanId,
        error: toLoggableError(error),
      });
      return createErrorResponse(
        request,
        env,
        spanId,
        500,
        "Proxy request failed"
      );
    }
  },
};

async function runUpstreamProbe(request, env, spanId) {
  const upstreamTimeoutMs = getUpstreamTimeoutMs(env);
  const probeRequest = buildUpstreamProbeRequest(
    request,
    env.UPSTREAM_GRAPHQL_URL,
    spanId
  );
  const probeStartedAt = Date.now();

  try {
    const upstreamResponse = await fetchUpstream(probeRequest, upstreamTimeoutMs);
    const response = new Response(
      JSON.stringify({
        status: "reachable",
        upstream: {
          url: sanitizeUpstreamUrl(env.UPSTREAM_GRAPHQL_URL),
          status: upstreamResponse.status,
          ok: upstreamResponse.ok,
          contentType: upstreamResponse.headers.get("Content-Type") || null,
        },
        upstreamTimeoutMs,
        durationMs: Date.now() - probeStartedAt,
        spanId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );

    return withResponseHeaders(request, env, spanId, response, "BYPASS");
  } catch (error) {
    if (isAbortError(error)) {
      return createErrorResponse(
        request,
        env,
        spanId,
        504,
        `Upstream probe timed out after ${upstreamTimeoutMs}ms (${sanitizeUpstreamUrl(env.UPSTREAM_GRAPHQL_URL)})`
      );
    }

    return createErrorResponse(
      request,
      env,
      spanId,
      502,
      `Upstream probe failed: ${toLoggableError(error).message}`
    );
  }
}

function normalizePathPrefix(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback;
  }
  const noTrailing = raw.replace(/\/+$/, "");
  return noTrailing.startsWith("/") ? noTrailing : `/${noTrailing}`;
}

function normalizeDirectusAssetBaseUrl(env) {
  const explicit = String(env.UPSTREAM_DIRECTUS_ASSET_BASE_URL || "").trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }
  return "";
}

function buildDirectusAssetUpstreamUrl(env, requestUrl) {
  const base = normalizeDirectusAssetBaseUrl(env);
  if (!base) {
    return null;
  }

  const proxyPrefix = normalizePathPrefix(
    env.DIRECTUS_ASSET_PROXY_PREFIX,
    DIRECTUS_ASSET_PROXY_PREFIX
  );
  const upstreamAssetPathPrefix = normalizePathPrefix(
    env.UPSTREAM_DIRECTUS_ASSET_PATH,
    "/assets"
  );

  const assetSuffix = requestUrl.pathname.slice(proxyPrefix.length).replace(/^\/+/, "");
  if (!assetSuffix) {
    return null;
  }

  const encodedSuffix = assetSuffix
    .split("/")
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch (_error) {
        return encodeURIComponent(segment);
      }
    })
    .join("/");

  const upstream = new URL(base);
  upstream.pathname = `${upstreamAssetPathPrefix}/${encodedSuffix}`;
  upstream.search = requestUrl.search;
  return upstream.toString();
}

async function runDirectusAssetProxy(
  request,
  env,
  spanId,
  url
) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    const response = createErrorResponse(
      request,
      env,
      spanId,
      405,
      "Method not allowed"
    );
    response.headers.set("Allow", "GET,HEAD,OPTIONS");
    return response;
  }

  const upstreamUrl = buildDirectusAssetUpstreamUrl(env, url);
  if (!upstreamUrl) {
    return createErrorResponse(
      request,
      env,
      spanId,
      503,
      "UPSTREAM_DIRECTUS_ASSET_BASE_URL is not configured"
    );
  }

  const headers = new Headers();
  const accept = request.headers.get("Accept");
  if (accept) {
    headers.set("Accept", accept);
  }
  const authorization = request.headers.get("Authorization");
  if (authorization) {
    headers.set("Authorization", authorization);
  }
  const range = request.headers.get("Range");
  if (range) {
    headers.set("Range", range);
  }
  headers.set("X-Proxy-Span-Id", spanId);

  const upstreamRequest = new Request(upstreamUrl, {
    method: request.method,
    headers,
    redirect: "follow",
  });
  const upstreamTimeoutMs = getUpstreamTimeoutMs(env);

  try {
    const upstreamResponse = await fetchUpstream(upstreamRequest, upstreamTimeoutMs);
    const response = new Response(upstreamResponse.body, upstreamResponse);
    return withResponseHeaders(request, env, spanId, response, "BYPASS");
  } catch (error) {
    if (isAbortError(error)) {
      return createErrorResponse(
        request,
        env,
        spanId,
        504,
        `Upstream directus asset request timed out after ${upstreamTimeoutMs}ms (${sanitizeUpstreamUrl(upstreamUrl)})`
      );
    }
    throw error;
  }
}

function isBearerAuthorization(value) {
  return /^Bearer\s+\S+$/i.test(String(value || "").trim());
}

function sanitizeUpstreamUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch (_e) {
    return "invalid-upstream-url";
  }
}
