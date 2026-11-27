import assert from "node:assert/strict";
import test from "node:test";
import { adminNavigation, adminNavigationSections } from "../src/constants/navigation.ts";
import { FEATURE_KEYS, filterByFeature, filterSectionsByFeature, parseFeatureList } from "../src/lib/features/feature-flags.ts";

test("an unset, empty or blank FEATURES value switches everything off", () => {
  assert.deepEqual(parseFeatureList(undefined), []);
  assert.deepEqual(parseFeatureList(null), []);
  assert.deepEqual(parseFeatureList(""), []);
  assert.deepEqual(parseFeatureList("  , ,"), []);
});

test("names are trimmed, lower-cased and de-duplicated; unknown names are dropped", () => {
  assert.deepEqual(parseFeatureList(" Vouchers , audit,AUDIT,not-a-feature,time-controls "), ["vouchers", "audit", "time-controls"]);
});

test("time-controls is a known feature and only that exact name enables it", () => {
  assert.ok(FEATURE_KEYS.includes("time-controls"));
  assert.deepEqual(parseFeatureList("time-control"), []);
  assert.deepEqual(parseFeatureList("time_controls"), []);
  assert.deepEqual(parseFeatureList("time-controls"), ["time-controls"]);
});

test("a menu entry with a feature is hidden until that feature is on; entries without one always show", () => {
  const items = [
    { label: "Always", href: "/a" },
    { label: "Audit", href: "/b", feature: "audit" },
    { label: "Ledger", href: "/c", feature: "ledger" },
  ];
  assert.deepEqual(filterByFeature(items, new Set()).map((i) => i.label), ["Always"]);
  assert.deepEqual(filterByFeature(items, new Set(["audit"])).map((i) => i.label), ["Always", "Audit"]);
  assert.deepEqual(filterByFeature(items, new Set(["audit", "ledger"])).map((i) => i.label), ["Always", "Audit", "Ledger"]);
});

test("filterSectionsByFeature filters nested group items and hides empty groups", () => {
  const filtered = filterSectionsByFeature(adminNavigationSections, new Set());
  const financeGroup = filtered.find((s) => s.kind === "group" && s.group.id === "finance-wallet");
  assert.ok(financeGroup && financeGroup.kind === "group");
  assert.equal(financeGroup.group.items.some((i) => i.feature === "ledger"), false);
  assert.equal(financeGroup.group.items.some((i) => i.href === "/admin/withdrawals"), true);

  const onlyOptionalGroup = [
    {
      kind: "group",
      group: {
        id: "opt",
        items: [{ label: "Audit", feature: "audit" }],
      },
    },
  ];
  assert.equal(filterSectionsByFeature(onlyOptionalGroup, new Set()).length, 0);
  assert.equal(filterSectionsByFeature(onlyOptionalGroup, new Set(["audit"])).length, 1);
});

test("adminNavigation assigns a unique icon to every admin menu entry", () => {
  const icons = adminNavigation.map((item) => item.icon);
  const uniqueIcons = new Set(icons);
  assert.equal(uniqueIcons.size, icons.length);
});
