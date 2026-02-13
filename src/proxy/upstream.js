import { FORWARDED_HEADERS } from "./constants.js";
import { applyClientIpHeaders } from "./client-ip.js";

const DEFAULT_UPSTREAM_TIMEOUT_MS = 15000;
const UPSTREAM_PROBE_QUERY = "query __ProxyUpstreamProbe { __typename }";

export function buildUpstreamUrl(request, configuredUpstreamUrl) {
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(configuredUpstreamUrl);
  upstreamUrl.search = requestUrl.search;
  return upstreamUrl;
}

export function buildUpstreamRequest(request, upstreamUrl, rawBody, spanId) {
  const headers = new Headers();

  for (const headerName of FORWARDED_HEADERS) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  if (!headers.get("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (request.method === "POST" && !headers.get("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  applyClientIpHeaders(request, headers);

  headers.set("X-Proxy-Span-Id", spanId);

  return new Request(upstreamUrl.toString(), {
    method: request.method,
    headers,
    body: request.method === "POST" ? rawBody || "" : undefined,
  });
}

export function buildUpstreamProbeRequest(
  request,
  configuredUpstreamUrl,
  spanId
) {
  const headers = new Headers();

  for (const headerName of FORWARDED_HEADERS) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  applyClientIpHeaders(request, headers);
  headers.set("X-Proxy-Span-Id", spanId);

  return new Request(configuredUpstreamUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: UPSTREAM_PROBE_QUERY,
      operationName: "__ProxyUpstreamProbe",
    }),
  });
}

function parseTimeoutMs(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function getUpstreamTimeoutMs(env) {
  return parseTimeoutMs(env.UPSTREAM_TIMEOUT_MS, DEFAULT_UPSTREAM_TIMEOUT_MS);
}

export async function fetchUpstream(upstreamRequest, upstreamTimeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("upstream-timeout"), upstreamTimeoutMs);

  try {
    return await fetch(upstreamRequest, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isAbortError(error) {
  const raw = typeof error === "string" ? error : "";
  const message = typeof error?.message === "string" ? error.message : "";
  const causeMessage =
    typeof error?.cause?.message === "string" ? error.cause.message : "";

  return (
    /abort|timeout/i.test(raw) ||
    (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error?.name === "string" && error.name === "AbortError") ||
    /abort|timeout/i.test(message) ||
    /abort|timeout/i.test(causeMessage)
  );
}
