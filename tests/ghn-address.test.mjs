import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_GHN_SELECTION, buildShippingAddress, formatAddressLine, parseGhnSelection, validateGhnSelection } from "../src/features/shipping/ghn-address.ts";

const full = { provinceId: 202, provinceName: "Hồ Chí Minh", districtId: 1446, districtName: "Quận 1", wardCode: "20201", wardName: "Phường Bến Nghé" };

test("an address is complete only with province, district and ward", () => {
  assert.deepEqual(validateGhnSelection(full), {});
  assert.ok(validateGhnSelection(EMPTY_GHN_SELECTION).province);
  assert.ok(validateGhnSelection({ ...full, districtId: null, districtName: "", wardCode: "", wardName: "" }).district);
  assert.ok(validateGhnSelection({ ...full, wardCode: "", wardName: "" }).ward);
});

test("the payload carries the GHN ids the back end requires, with the names", () => {
  const a = buildShippingAddress({ receiverName: " An ", phone: " 0912345678 ", street: " 12 Nguyễn Huệ " }, full);
  assert.equal(a.ghnDistrictId, 1446);
  assert.equal(a.ghnWardCode, "20201");
  assert.equal(a.district, "Quận 1");
  assert.equal(a.ward, "Phường Bến Nghé");
  assert.equal(a.province, "Hồ Chí Minh");
  assert.equal(a.receiverName, "An");
  assert.equal(a.contactPhone, "0912345678");
  assert.equal(a.street, "12 Nguyễn Huệ");
});

test("building a payload from an incomplete selection throws instead of sending an address the back end refuses", () => {
  assert.throws(() => buildShippingAddress({ receiverName: "A", phone: "0912345678", street: "x" }, EMPTY_GHN_SELECTION), /GHN_SELECTION_INCOMPLETE/);
  assert.throws(() => buildShippingAddress({ receiverName: "A", phone: "0912345678", street: "x" }, { ...full, wardCode: "" }), /GHN_SELECTION_INCOMPLETE/);
});

test("the single-line address skips empty parts", () => {
  assert.equal(formatAddressLine(" 12 Nguyễn Huệ ", full), "12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, Hồ Chí Minh");
  assert.equal(formatAddressLine("x", EMPTY_GHN_SELECTION), "x");
});

test("a saved selection is read back, and anything malformed or inconsistent is dropped", () => {
  assert.deepEqual(parseGhnSelection(JSON.stringify(full)), full);
  assert.deepEqual(parseGhnSelection(null), EMPTY_GHN_SELECTION);
  assert.deepEqual(parseGhnSelection("not json"), EMPTY_GHN_SELECTION);
  // A ward without its district, or a district without its province, cannot be trusted.
  const orphan = parseGhnSelection(JSON.stringify({ ...full, provinceId: null }));
  assert.equal(orphan.districtId, null);
  assert.equal(orphan.wardCode, "");
});
