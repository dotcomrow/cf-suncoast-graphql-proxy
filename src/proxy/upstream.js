import { FORWARDED_HEADERS } from "./constants.js";
import { applyClientIpHeaders } from "./client-ip.js";

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
