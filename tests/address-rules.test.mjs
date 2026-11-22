import assert from "node:assert/strict";
import test from "node:test";
import { describeAddress, sortAddresses, toAddressInput, toGhnSelection, validateAddressBookForm, EMPTY_ADDRESS_FORM } from "../src/features/profile/address-rules.ts";

const ghn = { provinceId: 202, provinceName: "Hồ Chí Minh", districtId: 1446, districtName: "Quận 1", wardCode: "20201", wardName: "Phường Bến Nghé" };
const ok = { recipientName: "An", phone: "0912345678", label: "Nhà", addressLine: "12 Nguyễn Huệ", isDefault: false };
const saved = (id, isDefault) => ({ id, userId: "u", recipientName: "An", phone: "0912345678", label: null, provinceId: 202, provinceName: "Hồ Chí Minh", districtId: 1446, districtName: "Quận 1", wardCode: "20201", wardName: "Phường Bến Nghé", addressLine: "12 Nguyễn Huệ", isDefault });

test("a complete form is valid; each missing part is reported", () => {
  assert.deepEqual(validateAddressBookForm(ok, ghn), {});
  assert.ok(validateAddressBookForm(EMPTY_ADDRESS_FORM, ghn).recipientName);
  assert.ok(validateAddressBookForm({ ...ok, phone: "123" }, ghn).phone);
  assert.ok(validateAddressBookForm({ ...ok, addressLine: " " }, ghn).addressLine);
  assert.ok(validateAddressBookForm(ok, { ...ghn, wardCode: "", wardName: "" }).ward);
});

test("lengths follow the back end limits", () => {
  assert.ok(validateAddressBookForm({ ...ok, recipientName: "x".repeat(151) }, ghn).recipientName);
  assert.ok(validateAddressBookForm({ ...ok, label: "x".repeat(61) }, ghn).label);
  assert.ok(validateAddressBookForm({ ...ok, addressLine: "x".repeat(501) }, ghn).addressLine);
  assert.deepEqual(validateAddressBookForm({ ...ok, label: "x".repeat(60), addressLine: "x".repeat(500) }, ghn), {});
});

test("the request body carries the GHN ids and codes and an empty label becomes null", () => {
  const body = toAddressInput({ ...ok, label: " " }, ghn);
  assert.equal(body.provinceId, 202);
  assert.equal(body.districtId, 1446);
  assert.equal(body.wardCode, "20201");
  assert.equal(body.label, null);
  assert.throws(() => toAddressInput(ok, { ...ghn, districtId: null }), /GHN_SELECTION_INCOMPLETE/);
});

test("a saved address round-trips into a selection; the default is listed first", () => {
  assert.deepEqual(toGhnSelection(saved("a", false)), ghn);
  assert.deepEqual(sortAddresses([saved("a", false), saved("b", true), saved("c", false)]).map((a) => a.id), ["b", "a", "c"]);
  assert.equal(describeAddress(saved("a", false)), "12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, Hồ Chí Minh");
});
