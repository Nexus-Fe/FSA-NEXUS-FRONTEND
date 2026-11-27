export type CartSelectionRecord = {
  selectedIds: string[];
  knownIds: string[];
};

export type CartStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const CART_SELECTION_PREFIX = "nexus:cart-selection";

export function getCartSelectionStorageKey(buyerId?: string | null, cartId?: string | null): string {
  const buyerPart = buyerId?.trim() || "guest";
  const cartPart = cartId?.trim() || "active";
  return `${CART_SELECTION_PREFIX}:${buyerPart}:${cartPart}`;
}

export function getBrowserCartStorage(): CartStorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function dedupeStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" || !value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function readCartSelection(storage: CartStorageLike | null, key: string): CartSelectionRecord | null {
  if (!storage || !key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CartSelectionRecord> | null;
    if (!parsed || !Array.isArray(parsed.selectedIds) || !Array.isArray(parsed.knownIds)) {
      return null;
    }
    return {
      selectedIds: dedupeStrings(parsed.selectedIds),
      knownIds: dedupeStrings(parsed.knownIds),
    };
  } catch {
    return null;
  }
}

export function writeCartSelection(storage: CartStorageLike | null, key: string, record: CartSelectionRecord): void {
  if (!storage || !key) return;
  try {
    storage.setItem(
      key,
      JSON.stringify({
        selectedIds: dedupeStrings(record.selectedIds),
        knownIds: dedupeStrings(record.knownIds),
      }),
    );
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function clearCartSelection(storage: CartStorageLike | null, key: string): void {
  if (!storage || !key) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Reconciles remembered cart selection against the live cart item IDs:
 * - First visit (no stored record): selects all current items so behavior matches a fresh cart.
 * - Subsequent visits: keeps each previously known item's checked/unchecked state (including 0 selected),
 *   auto-selects brand-new items added elsewhere, and prunes items removed or already checked out.
 */
export function reconcileCartSelection(
  stored: CartSelectionRecord | null,
  currentItemIds: readonly string[],
): CartSelectionRecord {
  const current = dedupeStrings(currentItemIds);
  if (current.length === 0) {
    return { selectedIds: [], knownIds: [] };
  }
  if (!stored) {
    return { selectedIds: [...current], knownIds: [...current] };
  }

  const prevSelected = new Set(stored.selectedIds);
  const prevKnown = new Set(stored.knownIds);
  const nextSelected: string[] = [];

  for (const id of current) {
    if (!prevKnown.has(id)) {
      // Newly added item since last cart view: select it without re-checking previously unchecked items.
      nextSelected.push(id);
    } else if (prevSelected.has(id)) {
      nextSelected.push(id);
    }
  }

  return {
    selectedIds: nextSelected,
    knownIds: [...current],
  };
}

export function areCartSelectionRecordsEqual(
  a: CartSelectionRecord | null,
  b: CartSelectionRecord | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.selectedIds.length !== b.selectedIds.length || a.knownIds.length !== b.knownIds.length) {
    return false;
  }
  for (let i = 0; i < a.selectedIds.length; i += 1) {
    if (a.selectedIds[i] !== b.selectedIds[i]) return false;
  }
  for (let i = 0; i < a.knownIds.length; i += 1) {
    if (a.knownIds[i] !== b.knownIds[i]) return false;
  }
  return true;
}

export function toggleCartItemSelection(
  currentSelectedIds: readonly string[],
  allItemIds: readonly string[],
  itemId: string,
): CartSelectionRecord {
  const validSet = new Set(allItemIds);
  const next = new Set(currentSelectedIds.filter((id) => validSet.has(id)));
  if (next.has(itemId)) {
    next.delete(itemId);
  } else if (validSet.has(itemId)) {
    next.add(itemId);
  }
  return {
    selectedIds: allItemIds.filter((id) => next.has(id)),
    knownIds: dedupeStrings(allItemIds),
  };
}

export function toggleCartShopSelection(
  currentSelectedIds: readonly string[],
  allItemIds: readonly string[],
  shopItemIds: readonly string[],
): CartSelectionRecord {
  const validSet = new Set(allItemIds);
  const shopIds = dedupeStrings(shopItemIds).filter((id) => validSet.has(id));
  const next = new Set(currentSelectedIds.filter((id) => validSet.has(id)));
  const allShopSelected = shopIds.length > 0 && shopIds.every((id) => next.has(id));

  if (allShopSelected) {
    for (const id of shopIds) next.delete(id);
  } else {
    for (const id of shopIds) next.add(id);
  }

  return {
    selectedIds: allItemIds.filter((id) => next.has(id)),
    knownIds: dedupeStrings(allItemIds),
  };
}

export function toggleAllCartSelection(
  currentSelectedIds: readonly string[],
  allItemIds: readonly string[],
): CartSelectionRecord {
  const all = dedupeStrings(allItemIds);
  const selectedSet = new Set(currentSelectedIds);
  const allSelected = all.length > 0 && all.every((id) => selectedSet.has(id));
  return {
    selectedIds: allSelected ? [] : [...all],
    knownIds: [...all],
  };
}
