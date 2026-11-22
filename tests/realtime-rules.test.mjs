import assert from "node:assert/strict";
import test from "node:test";
import { asBidPlaced, extensionChanged, isOutbid, outbidText, refreshIntervalMs } from "../src/features/auction/realtime-rules.ts";

test("an event is accepted only with the fields the room needs", () => {
  assert.ok(asBidPlaced({ auctionId: "a", bidId: "b", amount: 5 }));
  assert.equal(asBidPlaced({ auctionId: "a" }), null);
  assert.equal(asBidPlaced(null), null);
  assert.equal(asBidPlaced("x"), null);
});

test("the buyer is outbid only by another bid that is higher than their own last bid", () => {
  const mine = { bidId: "me", amount: 1_000_000 };
  assert.equal(isOutbid({ bidId: "other", amount: 1_050_000 }, mine), true);
  assert.equal(isOutbid({ bidId: "me", amount: 1_000_000 }, mine), false, "my own bid echoed back");
  assert.equal(isOutbid({ bidId: "other", amount: 900_000 }, mine), false);
  assert.equal(isOutbid({ bidId: "other", amount: 1_050_000 }, null), false, "no bid placed yet");
  assert.match(outbidText(1_050_000), /vượt giá/);
});

test("a live connection slows the safety refresh; no connection keeps the 5 second refresh", () => {
  assert.equal(refreshIntervalMs(false), 5000);
  assert.equal(refreshIntervalMs(true), 30000);
});

test("an extension is noticed when the count goes up", () => {
  assert.equal(extensionChanged(0, { extensionCount: 1 }), true);
  assert.equal(extensionChanged(2, { extensionCount: 2 }), false);
});
