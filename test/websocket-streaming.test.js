import test from "node:test"
import assert from "node:assert/strict"

import worker from "../src/index.js"

const ORIGIN = "https://cf-suncoast-graphql-proxy.dev.suncoast.systems"
const UPSTREAM_URL = "https://graphql-origin.suncoast.systems/v1/graphql"

function createEnv(overrides = {}) {
  return {
    CORS_DOMAINS: ORIGIN,
    UPSTREAM_GRAPHQL_URL: UPSTREAM_URL,
    UPSTREAM_TIMEOUT_MS: "15000",
    ...overrides,
  }
}

function createCtx() {
  return {
    waitUntil() {},
  }
}

function createWebSocketRequest(method = "GET") {
  return new Request("https://proxy.example.com/graphql?subscription=1", {
    method,
    headers: {
      Origin: ORIGIN,
      SpanId: "span-test-1",
      Authorization: "Bearer test-token",
      Connection: "Upgrade",
      Upgrade: "websocket",
      "Sec-WebSocket-Key": "dGVzdC1rZXk=",
      "Sec-WebSocket-Version": "13",
      "Sec-WebSocket-Protocol": "graphql-transport-ws",
      "Sec-WebSocket-Extensions": "permessage-deflate",
      "CF-Connecting-IP": "198.51.100.20",
    },
  })
}

test("proxies websocket upgrade requests to upstream graphql and preserves 101 response", async () => {
  const request = createWebSocketRequest("GET")
  const env = createEnv()
  const ctx = createCtx()

  let upstreamRequest
  const upstreamUpgradeResponse = {
    status: 101,
    headers: new Headers({
      Upgrade: "websocket",
      Connection: "Upgrade",
    }),
    body: null,
  }

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (requestArg) => {
    upstreamRequest = requestArg
    return upstreamUpgradeResponse
  }

  try {
    const response = await worker.fetch(request, env, ctx)

    assert.equal(response, upstreamUpgradeResponse)
    assert.ok(upstreamRequest instanceof Request)
    assert.equal(upstreamRequest.url, `${UPSTREAM_URL}?subscription=1`)
    assert.equal(upstreamRequest.method, "GET")

    assert.equal(upstreamRequest.headers.get("Authorization"), "Bearer test-token")
    assert.equal(upstreamRequest.headers.get("Upgrade"), "websocket")
    assert.equal(upstreamRequest.headers.get("Connection"), "Upgrade")
    assert.equal(upstreamRequest.headers.get("Sec-WebSocket-Key"), "dGVzdC1rZXk=")
    assert.equal(upstreamRequest.headers.get("Sec-WebSocket-Version"), "13")
    assert.equal(
      upstreamRequest.headers.get("Sec-WebSocket-Protocol"),
      "graphql-transport-ws"
    )
    assert.equal(
      upstreamRequest.headers.get("Sec-WebSocket-Extensions"),
      "permessage-deflate"
    )
    assert.equal(upstreamRequest.headers.get("X-Proxy-Span-Id"), "span-test-1")

    // For upgrade requests, proxy should not inject JSON-centric defaults.
    assert.equal(upstreamRequest.headers.get("Accept"), null)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("rejects websocket upgrade when method is not GET", async () => {
  const request = createWebSocketRequest("POST")
  const env = createEnv()
  const ctx = createCtx()

  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error("fetch should not be called for invalid websocket method")
  }

  try {
    const response = await worker.fetch(request, env, ctx)

    assert.equal(response.status, 405)
    assert.equal(response.headers.get("Allow"), "GET,OPTIONS")

    const payload = await response.json()
    assert.equal(payload.error, "Method not allowed")
  } finally {
    globalThis.fetch = originalFetch
  }
})
