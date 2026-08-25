import test from "node:test"
import assert from "node:assert/strict"

import worker from "../src/index.js"

const UPSTREAM_URL = "https://graphql-origin.suncoast.systems/v1/graphql"

function createEnv(overrides = {}) {
  return {
    CORS_DOMAINS: "https://app.suncoast.systems",
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

test("allows localhost origin on dev host even when not in CORS_DOMAINS", async () => {
  const origin = "http://localhost:5173"
  const request = new Request(
    "https://cf-suncoast-graphql-proxy.dev.suncoast.systems/graphql",
    {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Headers": "content-type",
      },
    }
  )

  const response = await worker.fetch(request, createEnv(), createCtx())

  assert.equal(response.status, 204)
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin)
})

test("allows wildcard subdomain origins configured in CORS_DOMAINS", async () => {
  const origin = "https://app.suncoast.systems"
  const request = new Request(
    "https://cf-suncoast-graphql-proxy.prod.suncoast.systems/graphql",
    {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Headers": "content-type",
      },
    }
  )

  const response = await worker.fetch(
    request,
    createEnv({ CORS_DOMAINS: "https://*.suncoast.systems" }),
    createCtx()
  )

  assert.equal(response.status, 204)
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin)
})

test("allows wildcard hostname entries without protocol in CORS_DOMAINS", async () => {
  const origin = "https://studio.suncoast.systems"
  const request = new Request(
    "https://cf-suncoast-graphql-proxy.prod.suncoast.systems/graphql",
    {
      method: "OPTIONS",
      headers: {
        Origin: origin,
      },
    }
  )

  const response = await worker.fetch(
    request,
    createEnv({ CORS_DOMAINS: "*.suncoast.systems" }),
    createCtx()
  )

  assert.equal(response.status, 204)
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin)
})

test("rejects apex domain for wildcard subdomain CORS entries", async () => {
  const request = new Request(
    "https://cf-suncoast-graphql-proxy.prod.suncoast.systems/graphql",
    {
      method: "OPTIONS",
      headers: {
        Origin: "https://suncoast.systems",
      },
    }
  )

  const response = await worker.fetch(
    request,
    createEnv({ CORS_DOMAINS: "https://*.suncoast.systems" }),
    createCtx()
  )

  assert.equal(response.status, 403)
  const payload = await response.json()
  assert.equal(payload.error, "Origin is not allowed")
})

test("rejects localhost origin on prod host when not in CORS_DOMAINS", async () => {
  const request = new Request(
    "https://cf-suncoast-graphql-proxy.prod.suncoast.systems/graphql",
    {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
      },
    }
  )

  const response = await worker.fetch(request, createEnv(), createCtx())

  assert.equal(response.status, 403)
  const payload = await response.json()
  assert.equal(payload.error, "Origin is not allowed")
})
