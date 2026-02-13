import {
  ALLOWED_METHODS,
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
import { extractGraphQLRequest, evaluateOperation } from "./proxy/graphql-request.js";
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

      const requestDetails = await extractGraphQLRequest(request);
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
      const upstreamUrl = buildUpstreamUrl(request, env.UPSTREAM_GRAPHQL_URL);

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
            `Upstream request timed out after ${upstreamTimeoutMs}ms`
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
      console.error("GraphQL proxy request failed", {
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
        `Upstream probe timed out after ${upstreamTimeoutMs}ms`
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
