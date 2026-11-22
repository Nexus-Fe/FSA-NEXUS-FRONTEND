import assert from "node:assert/strict";
import test from "node:test";
import { actionAllowed, buildTimeRequest } from "../src/features/auction/time-controls.ts";

const NOW = new Date("2026-11-23T10:00:00.000Z");

test("every action needs a reason, so the change is recorded with why", () => {
  assert.ok("error" in buildTimeRequest({ kind: "end-now" }, ""));
  assert.ok("error" in buildTimeRequest({ kind: "end-now" }, "ab"));
  assert.ok(!("error" in buildTimeRequest({ kind: "end-now" }, "test chốt")));
});

test("each button builds the call the back end documents", () => {
  assert.deepEqual(buildTimeRequest({ kind: "open-now" }, "mở thử", NOW), { path: "schedule", body: { scheduledStartAt: "2026-11-23T10:00:00.000Z", reason: "mở thử" } });
  assert.deepEqual(buildTimeRequest({ kind: "end-now" }, "chốt thử", NOW), { path: "schedule", body: { remainingSeconds: 0, reason: "chốt thử" } });
  assert.deepEqual(buildTimeRequest({ kind: "remaining", seconds: 90 }, "gia hạn", NOW), { path: "schedule", body: { remainingSeconds: 90, reason: "gia hạn" } });
  assert.deepEqual(buildTimeRequest({ kind: "seller-approval-expired" }, "hết hạn", NOW), { path: "settlement-deadlines", body: { sellerApprovalRemainingSeconds: 0, reason: "hết hạn" } });
  assert.deepEqual(buildTimeRequest({ kind: "payment-expired" }, "hết hạn", NOW), { path: "settlement-deadlines", body: { paymentRemainingSeconds: 0, reason: "hết hạn" } });
  assert.deepEqual(buildTimeRequest({ kind: "second-chance-expired" }, "hết hạn", NOW), { path: "settlement-deadlines", body: { winnerOfferRemainingSeconds: 0, reason: "hết hạn" } });
});

test("the remaining time is a whole number of seconds from 0 to a day", () => {
  for (const seconds of [-1, 1.5, 86_401, Number.NaN]) assert.ok("error" in buildTimeRequest({ kind: "remaining", seconds }, "lý do", NOW), String(seconds));
  assert.ok(!("error" in buildTimeRequest({ kind: "remaining", seconds: 0 }, "lý do", NOW)));
});

test("a button is enabled only for a status where the back end accepts it", () => {
  assert.equal(actionAllowed({ kind: "open-now" }, "Scheduled"), true);
  assert.equal(actionAllowed({ kind: "open-now" }, "Running"), false, "a start time cannot be set on a running auction");
  assert.equal(actionAllowed({ kind: "end-now" }, "Running"), true);
  assert.equal(actionAllowed({ kind: "end-now" }, "Ended"), false);
  assert.equal(actionAllowed({ kind: "remaining", seconds: 30 }, "Scheduled"), false);
});
