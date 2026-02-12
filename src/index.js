import {
  ALLOWED_METHODS,
  GRAPHQL_PATH,
  HEALTH_PATH,
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
import { buildUpstreamRequest, buildUpstreamUrl } from "./proxy/upstream.js";

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
      const upstreamResponse = await fetch(upstreamRequest);
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
