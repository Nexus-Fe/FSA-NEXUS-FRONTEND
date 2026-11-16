import assert from "node:assert/strict";
import test from "node:test";
import { createIntentKeyStore, isDefiniteOutcome } from "../src/lib/idempotency/intent-key.ts";

function counter() {
  let n = 0;
  return () => `key-${++n}`;
}

test("the same content keeps the same key while the outcome is unknown", () => {
  const store = createIntentKeyStore(counter());
  const first = store.keyFor("50000|VCB|123|A");
  assert.equal(store.keyFor("50000|VCB|123|A"), first);
  assert.equal(store.keyFor("50000|VCB|123|A"), first);
});

test("changed content is a new intent with a new key", () => {
  const store = createIntentKeyStore(counter());
  const first = store.keyFor("50000|VCB|123|A");
  const second = store.keyFor("60000|VCB|123|A");
  assert.notEqual(first, second);
  assert.equal(store.keyFor("60000|VCB|123|A"), second);
});

test("going back to the earlier content does not resurrect the earlier key", () => {
  const store = createIntentKeyStore(counter());
  const first = store.keyFor("a");
  store.keyFor("b");
  assert.notEqual(store.keyFor("a"), first);
});

test("once the outcome is known, the same content is a new intent", () => {
  const store = createIntentKeyStore(counter());
  const first = store.keyFor("same");
  store.settle();
  assert.notEqual(store.keyFor("same"), first);
});

test("a definite answer from the server releases the key, an unknown outcome keeps it", () => {
  assert.equal(isDefiniteOutcome(200), true);
  assert.equal(isDefiniteOutcome(201), true);
  assert.equal(isDefiniteOutcome(400), true);
  assert.equal(isDefiniteOutcome(403), true);
  assert.equal(isDefiniteOutcome(409), true);
  assert.equal(isDefiniteOutcome(422), true);
  assert.equal(isDefiniteOutcome(408), false);
  assert.equal(isDefiniteOutcome(429), false);
  assert.equal(isDefiniteOutcome(500), false);
  assert.equal(isDefiniteOutcome(503), false);
  assert.equal(isDefiniteOutcome(undefined), false);
  assert.equal(isDefiniteOutcome(null), false);
});

test("the default key is a safe token the server accepts", () => {
  const key = createIntentKeyStore().keyFor("x");
  assert.match(key, /^[A-Za-z0-9_-]{1,100}$/);
});
