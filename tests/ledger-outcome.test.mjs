import assert from "node:assert/strict";
import test from "node:test";
import { balanceTone, transactionTypes, findingLabel } from "@/features/admin/ledger/ledger-outcome.ts";

test("all twenty wallet transaction types have Vietnamese labels", () => {
  assert.equal(Object.keys(transactionTypes).length, 20);
  for (const value of Object.values(transactionTypes)) assert.match(value, /[À-ỹ]/u);
});

test("unknown balances stay unchecked; differences are highlighted", () => {
  assert.equal(balanceTone(null), "slate");
  assert.equal(balanceTone(0), "green");
  assert.equal(balanceTone(100), "red");
  assert.match(findingLabel("I12_MISSING_POSTING"), /Bất biến 12/);
});

import { describeBackfill, describeShadowResult, shadowSwitchTarget } from "@/features/admin/ledger/ledger-control-rules.ts";

test("shadow switch targets the opposite state with the version read", () => {
  assert.deepEqual(shadowSwitchTarget({ enabled: false, version: 71 }), { enable: true, expectedVersion: 71 });
  assert.deepEqual(shadowSwitchTarget({ enabled: true, version: 3 }), { enable: false, expectedVersion: 3 });
  assert.equal(shadowSwitchTarget({ enabled: false }), null);
  assert.equal(shadowSwitchTarget(null), null);
});

test("shadow and backfill messages", () => {
  assert.match(describeShadowResult({ enabled: true, changed: false }), /không có thay đổi/);
  assert.equal(describeShadowResult({ enabled: false, changed: true }), "Đã tắt sổ bóng.");
  assert.match(describeBackfill({ walletsBackfilled: 2, walletsSkipped: 1, entriesCreated: 9 }), /2 ví \(9 bút toán\)/);
});
