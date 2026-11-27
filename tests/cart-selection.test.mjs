import assert from "node:assert/strict";
import test from "node:test";
import {
  clearCartSelection,
  getCartSelectionStorageKey,
  readCartSelection,
  reconcileCartSelection,
  toggleAllCartSelection,
  toggleCartItemSelection,
  toggleCartShopSelection,
  writeCartSelection,
} from "../src/features/commerce/cart-selection.ts";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

test("first visit with no stored state selects all items and records knownIds", () => {
  const result = reconcileCartSelection(null, ["a", "b", "c"]);
  assert.deepEqual(result, {
    selectedIds: ["a", "b", "c"],
    knownIds: ["a", "b", "c"],
  });
});

test("subsequent visit remembers partial selection and unchecked items", () => {
  const storage = createMemoryStorage();
  const key = getCartSelectionStorageKey("buyer-1", "cart-1");

  const initial = reconcileCartSelection(null, ["a", "b", "c"]);
  const afterUncheckB = toggleCartItemSelection(initial.selectedIds, initial.knownIds, "b");
  writeCartSelection(storage, key, afterUncheckB);

  const restored = reconcileCartSelection(readCartSelection(storage, key), ["a", "b", "c"]);
  assert.deepEqual(restored, {
    selectedIds: ["a", "c"],
    knownIds: ["a", "b", "c"],
  });
});

test("unchecking all items stays empty when returning to cart", () => {
  const storage = createMemoryStorage();
  const key = getCartSelectionStorageKey("buyer-1", "cart-1");

  const afterUncheckAll = toggleAllCartSelection(["a", "b"], ["a", "b"]);
  writeCartSelection(storage, key, afterUncheckAll);

  const restored = reconcileCartSelection(readCartSelection(storage, key), ["a", "b"]);
  assert.deepEqual(restored, {
    selectedIds: [],
    knownIds: ["a", "b"],
  });
});

test("adding a new item auto-selects only the new item without re-selecting previously unchecked items", () => {
  const stored = { selectedIds: ["a"], knownIds: ["a", "b"] };
  const reconciled = reconcileCartSelection(stored, ["a", "b", "d"]);
  assert.deepEqual(reconciled, {
    selectedIds: ["a", "d"],
    knownIds: ["a", "b", "d"],
  });
});

test("checked-out or deleted items are pruned while remaining unchecked items stay unchecked", () => {
  const stored = { selectedIds: ["a"], knownIds: ["a", "b", "c"] };
  const reconciled = reconcileCartSelection(stored, ["b", "c"]);
  assert.deepEqual(reconciled, {
    selectedIds: [],
    knownIds: ["b", "c"],
  });
});

test("toggleCartShopSelection selects all items of a shop when none or only part is selected, and unselects when all are selected", () => {
  const allItems = ["s1-a", "s1-b", "s2-a"];
  const shop1Items = ["s1-a", "s1-b"];

  // Partial in shop 1 -> select all in shop 1, leave shop 2 untouched
  const afterSelectShop1 = toggleCartShopSelection(["s1-a", "s2-a"], allItems, shop1Items);
  assert.deepEqual(afterSelectShop1.selectedIds, ["s1-a", "s1-b", "s2-a"]);

  // All in shop 1 selected -> unselect only shop 1, leave shop 2 selected
  const afterUnselectShop1 = toggleCartShopSelection(afterSelectShop1.selectedIds, allItems, shop1Items);
  assert.deepEqual(afterUnselectShop1.selectedIds, ["s2-a"]);

  // None in shop 1 selected -> select all in shop 1
  const afterReselectShop1 = toggleCartShopSelection(afterUnselectShop1.selectedIds, allItems, shop1Items);
  assert.deepEqual(afterReselectShop1.selectedIds, ["s1-a", "s1-b", "s2-a"]);
});

test("clearCartSelection removes saved state", () => {
  const storage = createMemoryStorage();
  const key = getCartSelectionStorageKey("buyer-1", "cart-1");
  writeCartSelection(storage, key, { selectedIds: ["a"], knownIds: ["a", "b"] });
  clearCartSelection(storage, key);
  assert.equal(readCartSelection(storage, key), null);
});
