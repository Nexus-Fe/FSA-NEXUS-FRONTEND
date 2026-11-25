/**
 * The key of the shop profile form. The form's fields are uncontrolled (they start from the saved values), so a new key is how a reload of
 * the profile puts new saved values into them. The key must NOT change while the seller is editing: a new key re-creates the form and the
 * character just typed (or the GHN choice just made) is lost.
 *
 * - not editing: follow the saved data, so a reload or a save shows the saved values;
 * - editing: keep the key the form already has, whatever the reload brought.
 */
export function nextShopFormKey(currentKey: string, savedKey: string, editing: boolean): string {
  return editing ? currentKey : savedKey;
}

/** Every value the shop form starts from. A field missing here would keep showing its old text when only that field changes on a reload. */
export function shopFormSavedKey(saved: {
  shopName: string;
  hotline: string;
  provinceId: string;
  districtId: string;
  wardCode: string;
  streetAddress: string;
}): string {
  return JSON.stringify([saved.shopName, saved.hotline, saved.provinceId, saved.districtId, saved.wardCode, saved.streetAddress]);
}
