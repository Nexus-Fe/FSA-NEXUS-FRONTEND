import assert from "node:assert/strict";
import test from "node:test";
import { authService } from "@/features/auth/index";
import { readFirebasePublicConfig } from "../src/lib/auth/firebase-config.ts";
import { ApiError, clearSessionTokens, saveSessionTokens } from "../src/lib/api/client.ts";

function browserSession() {
  const values = new Map();
  const browser = new EventTarget();
  browser.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = browser;
  return browser;
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("loginWithGoogle posts idToken, stores tokens, and returns user without pre-auth /me check", async () => {
  const browser = browserSession();
  clearSessionTokens();
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : null });
    return json({
      accessToken: "gg-access",
      refreshToken: "gg-refresh",
      userId: "user-1",
      roles: ["Buyer"],
      user: {
        id: "user-1",
        email: "buyer@gmail.com",
        firstName: "Test",
        lastName: "Buyer",
        roles: ["Buyer"],
      },
    });
  };

  const res = await authService.loginWithGoogle({ idToken: "firebase-id-token-123", deviceInfo: "TestAgent" });
  assert.equal(res.accessToken, "gg-access");
  assert.equal(res.refreshToken, "gg-refresh");
  assert.equal(res.user.id, "user-1");
  assert.equal(res.user.email, "buyer@gmail.com");
  assert.deepEqual(calls, [
    {
      url: "/api/gateway/api/v1/auth/google",
      method: "POST",
      body: { idToken: "firebase-id-token-123", deviceInfo: "TestAgent" },
    },
  ]);
  assert.equal(browser.localStorage.getItem("nexus_access_token"), "gg-access");
  assert.equal(browser.localStorage.getItem("nexus_refresh_token"), "gg-refresh");
});

test("loginWithGoogle clears tokens if /api/v1/me fallback fails", async () => {
  const browser = browserSession();
  clearSessionTokens();

  globalThis.fetch = async (url) => {
    if (url.endsWith("/auth/google")) {
      return json({ accessToken: "gg-access", refreshToken: "gg-refresh" });
    }
    return json({ title: "Unauthorized", errorCode: "UNAUTHORIZED" }, 401);
  };

  await assert.rejects(
    authService.loginWithGoogle({ idToken: "firebase-id-token-123", deviceInfo: "TestAgent" }),
    (err) => err instanceof ApiError && err.status === 401,
  );
  assert.equal(browser.localStorage.getItem("nexus_access_token"), null);
  assert.equal(browser.localStorage.getItem("nexus_refresh_token"), null);
});

test("loginWithGoogle rejects and stores nothing when response lacks tokens", async () => {
  const browser = browserSession();
  clearSessionTokens();

  globalThis.fetch = async () => json({ accessToken: "only-access" });

  await assert.rejects(
    authService.loginWithGoogle({ idToken: "firebase-id-token-123", deviceInfo: "TestAgent" }),
    /thiếu thông tin phiên/,
  );
  assert.equal(browser.localStorage.getItem("nexus_access_token"), null);
  assert.equal(browser.localStorage.getItem("nexus_refresh_token"), null);
});

test("loginWithGoogle uses skipRefresh: true and does not trigger /auth/refresh on 401", async () => {
  browserSession();
  saveSessionTokens("stale-access", "stale-refresh");
  const urls = [];

  globalThis.fetch = async (url) => {
    urls.push(url);
    return json({ title: "Unauthorized", errorCode: "INVALID_FIREBASE_TOKEN" }, 401);
  };

  await assert.rejects(
    authService.loginWithGoogle({ idToken: "expired-token", deviceInfo: "TestAgent" }),
    (err) => err instanceof ApiError && err.status === 401 && err.errorCode === "INVALID_FIREBASE_TOKEN",
  );
  assert.deepEqual(urls, ["/api/gateway/api/v1/auth/google"]);
});

test("loginWithGoogle propagates backend errorCode on conflict without saving tokens", async () => {
  const browser = browserSession();
  clearSessionTokens();

  globalThis.fetch = async () =>
    json({ title: "Conflict", detail: "Linked to another Google account", errorCode: "FIREBASE_UID_MISMATCH" }, 409);

  await assert.rejects(
    authService.loginWithGoogle({ idToken: "firebase-id-token-123", deviceInfo: "TestAgent" }),
    (err) => err instanceof ApiError && err.status === 409 && err.errorCode === "FIREBASE_UID_MISMATCH",
  );
  assert.equal(browser.localStorage.getItem("nexus_access_token"), null);
  assert.equal(browser.localStorage.getItem("nexus_refresh_token"), null);
});

test("readFirebasePublicConfig returns null when incomplete and trims when complete", () => {
  assert.equal(readFirebasePublicConfig({ FIREBASE_API_KEY: "k", FIREBASE_PROJECT_ID: "p" }), null);
  assert.deepEqual(
    readFirebasePublicConfig({
      FIREBASE_API_KEY: " key ",
      FIREBASE_AUTH_DOMAIN: " nexus-app-b03cb.firebaseapp.com ",
      FIREBASE_PROJECT_ID: " nexus-app-b03cb ",
      FIREBASE_APP_ID: " app-id ",
    }),
    {
      apiKey: "key",
      authDomain: "nexus-app-b03cb.firebaseapp.com",
      projectId: "nexus-app-b03cb",
      appId: "app-id",
    },
  );
});
