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

test("returns 401 when graphql request is missing bearer authorization header", async () => {
  const request = new Request("https://proxy.example.com/graphql", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "query { __typename }",
    }),
  })

  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error("upstream fetch should not run when authorization is missing")
  }

  try {
    const response = await worker.fetch(request, createEnv(), createCtx())
    assert.equal(response.status, 401)
    assert.equal(response.headers.get("WWW-Authenticate"), "Bearer")

    const payload = await response.json()
    assert.equal(payload.error, "Not authorized")
  } finally {
    globalThis.fetch = originalFetch
  }
})
