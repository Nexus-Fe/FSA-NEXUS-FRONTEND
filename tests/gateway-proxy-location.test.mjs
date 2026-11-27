import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../src/app/api/gateway/[...path]/route.ts";

const context = (path) => ({ params: Promise.resolve({ path }) });
const request = (url) => ({ url, method: "GET", headers: new Headers({ accept: "application/json" }), arrayBuffer: async () => new ArrayBuffer(0) });

test("the proxy passes the location source headers to the browser", async () => {
  process.env.API_GATEWAY_URL = "http://gateway.test";
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("[]", { status: 200, headers: { "Content-Type": "application/json", "X-Location-Source": "ghn-cache", "X-Location-Observed-At": "2026-11-24T10:00:00Z", "X-Secret-Internal": "no" } });
  try {
    const response = await GET(request("http://localhost/api/gateway/api/v1/shipping/locations/provinces"), context(["api", "v1", "shipping", "locations", "provinces"]));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Location-Source"), "ghn-cache");
    assert.equal(response.headers.get("X-Location-Observed-At"), "2026-11-24T10:00:00Z");
    assert.equal(response.headers.get("X-Secret-Internal"), null, "other upstream headers are still not passed on");
  } finally {
    globalThis.fetch = original;
  }
});

test("without the headers nothing is invented", async () => {
  process.env.API_GATEWAY_URL = "http://gateway.test";
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const response = await GET(request("http://localhost/api/gateway/api/v1/shipping/locations/provinces"), context(["api", "v1", "shipping", "locations", "provinces"]));
    assert.equal(response.headers.get("X-Location-Source"), null);
  } finally {
    globalThis.fetch = original;
  }
});
