import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_GHN_SELECTION, buildShippingAddress, checkGhnSelection, clearGhnFrom, fillGhnNames, formatAddressLine, ghnWriteBlock, selectionFromCodes, parseGhnSelection, validateGhnSelection } from "../src/features/shipping/ghn-address.ts";

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

// ---- checking a saved selection against the lists GHN gave
const lists = (source = "ghn") => ({
  provinces: { source, items: [{ provinceId: 202, provinceName: "Hồ Chí Minh" }] },
  districts: { source, items: [{ districtId: 1442, provinceId: 202, districtName: "Quận 1" }] },
  wards: { source, items: [{ wardCode: "20101", districtId: 1442, wardName: "Phường Bến Nghé" }] },
});
const saved = { provinceId: 202, provinceName: "", districtId: 1442, districtName: "", wardCode: "20101", wardName: "" };

test("codes found in trusted GHN lists are valid, from GHN or from its cache", () => {
  assert.deepEqual(checkGhnSelection(saved, lists("ghn")), { state: "valid" });
  assert.deepEqual(checkGhnSelection(saved, lists("ghn-cache")), { state: "valid" });
  assert.deepEqual(checkGhnSelection(EMPTY_GHN_SELECTION, lists()), { state: "empty" });
});

test("a code missing from a trusted list is stale at its own level", () => {
  assert.deepEqual(checkGhnSelection({ ...saved, provinceId: 999 }, lists()), { state: "stale", level: "province" });
  assert.deepEqual(checkGhnSelection({ ...saved, districtId: 1446 }, lists()), { state: "stale", level: "district" });
  assert.deepEqual(checkGhnSelection({ ...saved, wardCode: "99999" }, lists()), { state: "stale", level: "ward" });
});

test("a district or ward that belongs to another parent is stale, not valid", () => {
  const other = lists();
  other.districts.items = [{ districtId: 1442, provinceId: 201, districtName: "Ba Dinh" }];
  assert.deepEqual(checkGhnSelection(saved, other), { state: "stale", level: "district" });
  const otherWard = lists();
  otherWard.wards.items = [{ wardCode: "20101", districtId: 1446, wardName: "Phuong" }];
  assert.deepEqual(checkGhnSelection(saved, otherWard), { state: "stale", level: "ward" });
});

test("an unknown source or a failed list never marks a code as wrong", () => {
  assert.deepEqual(checkGhnSelection({ ...saved, provinceId: 999 }, lists("unknown")), { state: "unverifiable" });
  assert.deepEqual(checkGhnSelection(saved, { failed: true }), { state: "unverifiable" });
  assert.deepEqual(checkGhnSelection(saved, { provinces: lists().provinces, failed: true }), { state: "unverifiable" });
});

test("lists still loading are pending, not stale", () => {
  assert.deepEqual(checkGhnSelection(saved, {}), { state: "pending" });
  assert.deepEqual(checkGhnSelection(saved, { provinces: lists().provinces }), { state: "pending" });
});

test("clearing a stale level keeps the levels above it", () => {
  const named = { ...saved, provinceName: "HCM", districtName: "Quận 1", wardName: "Bến Nghé" };
  assert.deepEqual(clearGhnFrom(named, "province"), EMPTY_GHN_SELECTION);
  const noDistrict = clearGhnFrom(named, "district");
  assert.equal(noDistrict.provinceId, 202);
  assert.equal(noDistrict.districtId, null);
  assert.equal(noDistrict.wardCode, "");
  const noWard = clearGhnFrom(named, "ward");
  assert.equal(noWard.districtId, 1442);
  assert.equal(noWard.wardCode, "");
});

test("names are filled from the lists for a saved address that carries only codes", () => {
  const filled = fillGhnNames(saved, lists());
  assert.equal(filled.provinceName, "Hồ Chí Minh");
  assert.equal(filled.districtName, "Quận 1");
  assert.equal(filled.wardName, "Phường Bến Nghé");
  assert.equal(fillGhnNames(filled, lists()), null, "nothing left to fill in");
});

test("a write is allowed only when the current codes are confirmed (valid)", () => {
  assert.equal(ghnWriteBlock({ state: "valid" }), undefined);
  for (const check of [{ state: "empty" }, { state: "pending" }, { state: "unverifiable" }, { state: "stale", level: "ward" }]) {
    assert.ok(ghnWriteBlock(check), `${check.state} must block`);
  }
  assert.match(ghnWriteBlock({ state: "stale", level: "district" }), /Quận \/ huyện/);
  assert.match(ghnWriteBlock({ state: "unverifiable" }), /Tải lại danh sách/);
});

test("codes from a saved address become a selection, and a ward without its parents is dropped", () => {
  assert.deepEqual(selectionFromCodes("202", "1442", "20101"), { ...EMPTY_GHN_SELECTION, provinceId: 202, districtId: 1442, wardCode: "20101" });
  assert.deepEqual(selectionFromCodes("", "1442", "20101"), EMPTY_GHN_SELECTION);
  assert.equal(selectionFromCodes("202", "", "20101").wardCode, "");
  assert.equal(selectionFromCodes(202, 1442, " 20101 ").wardCode, "20101");
});

test("the shipping payload carries the GHN province id, and an incomplete selection cannot build one", () => {
  const payload = buildShippingAddress({ receiverName: "A", phone: "0912345678", street: "1 Le Loi" }, { provinceId: 202, provinceName: "Hồ Chí Minh", districtId: 1442, districtName: "Quận 1", wardCode: "20101", wardName: "Bến Nghé" });
  assert.equal(payload.provinceId, 202);
  assert.equal(payload.ghnDistrictId, 1442);
  assert.equal(payload.ghnWardCode, "20101");
  assert.throws(() => buildShippingAddress({ receiverName: "A", phone: "0912345678", street: "1 Le Loi" }, { provinceId: null, provinceName: "", districtId: 1442, districtName: "", wardCode: "20101", wardName: "" }), /GHN_SELECTION_INCOMPLETE/);
});
