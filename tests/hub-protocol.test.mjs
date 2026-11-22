import assert from "node:assert/strict";
import test from "node:test";
import { HANDSHAKE_REQUEST, RECORD_SEPARATOR, connectionTokenOf, decodeFrames, encodeFrame, handshakeError, invocation, reconnectDelay, toSocketUrl } from "../src/lib/realtime/hub-protocol.ts";

test("a frame is JSON ended by the record separator", () => {
  assert.equal(HANDSHAKE_REQUEST, `{"protocol":"json","version":1}${RECORD_SEPARATOR}`);
  assert.equal(encodeFrame({ type: 6 }), `{"type":6}${RECORD_SEPARATOR}`);
  assert.deepEqual(JSON.parse(invocation("JoinAuction", ["abc"], "1").slice(0, -1)), { type: 1, invocationId: "1", target: "JoinAuction", arguments: ["abc"] });
});

test("received text is split into complete messages and the unfinished rest", () => {
  const one = `{"type":6}${RECORD_SEPARATOR}{"type":1,"target":"BidPlaced","arguments":[{"amount":5}]}${RECORD_SEPARATOR}{"type":1,"tar`;
  const { messages, rest } = decodeFrames(one);
  assert.equal(messages.length, 2);
  assert.equal(messages[1].target, "BidPlaced");
  assert.equal(rest, `{"type":1,"tar`);
  const joined = decodeFrames(rest + `get":"X","arguments":[]}${RECORD_SEPARATOR}`);
  assert.equal(joined.messages[0].target, "X");
  assert.equal(joined.rest, "");
});

test("a malformed frame is skipped and the next one still arrives", () => {
  const { messages } = decodeFrames(`not json${RECORD_SEPARATOR}{"type":6}${RECORD_SEPARATOR}`);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 6);
});

test("the handshake answer is an empty object or an error", () => {
  assert.equal(handshakeError({}), null);
  assert.equal(handshakeError({ error: "Requested protocol not available" }), "Requested protocol not available");
});

test("the reconnect delay grows and stops at 30 seconds", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(reconnectDelay), [1000, 2000, 4000, 8000, 16000, 30000, 30000]);
});

test("the negotiate answer and the socket address", () => {
  assert.equal(connectionTokenOf({ connectionToken: "t", connectionId: "c" }), "t");
  assert.equal(connectionTokenOf({ connectionId: "c" }), "c");
  assert.equal(connectionTokenOf({}), null);
  assert.equal(toSocketUrl("https://gw.example/x"), "wss://gw.example/x");
  assert.equal(toSocketUrl("http://localhost:28080"), "ws://localhost:28080");
});
