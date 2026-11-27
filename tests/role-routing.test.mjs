import assert from "node:assert/strict";
import test from "node:test";
import {
  getLandingPathForUser,
  getPortalHomeRoute,
  getPrimaryPortalRole,
  hasStrictPortalAccess,
  isAdminOrStaffUser,
  resolveSafeReturnPath,
} from "../src/lib/auth/role-routing.ts";
import { ROUTES } from "../src/constants/routes.ts";

test("Admin is strictly isolated to Admin and shared account routes", () => {
  const admin = { roles: ["Admin"] };
  const adminWithLegacyExtraRoles = { roles: ["Admin", "Staff", "Buyer"] };

  for (const user of [admin, adminWithLegacyExtraRoles]) {
    assert.equal(getPrimaryPortalRole(user), "admin");
    assert.equal(isAdminOrStaffUser(user), true);
    assert.equal(getLandingPathForUser(user), ROUTES.admin.overview);
    assert.equal(getPortalHomeRoute(user), ROUTES.admin.overview);
    assert.equal(getPortalHomeRoute(user, "Nhân viên"), ROUTES.admin.overview);

    assert.equal(hasStrictPortalAccess(user, ["Admin"]), true);
    assert.equal(hasStrictPortalAccess(user, ["Buyer", "Seller", "Staff", "Admin"]), true);
    assert.equal(hasStrictPortalAccess(user, ["Staff"]), false);
    assert.equal(hasStrictPortalAccess(user, ["Staff", "Admin"]), true); // layout must pass ["Staff"] only
    assert.equal(hasStrictPortalAccess(user, ["Seller"]), false);
    assert.equal(hasStrictPortalAccess(user, ["Buyer", "Customer", "Seller"]), false);

    assert.equal(resolveSafeReturnPath("/admin/users", user), "/admin/users");
    assert.equal(resolveSafeReturnPath("/account/profile", user), "/account/profile");
    assert.equal(resolveSafeReturnPath("/staff/auctions", user), null);
    assert.equal(resolveSafeReturnPath("/seller/products", user), null);
    assert.equal(resolveSafeReturnPath("/buyer/orders", user), null);
    assert.equal(resolveSafeReturnPath("/", user), null);
  }
});

test("Staff is strictly isolated to Staff and shared account routes", () => {
  const staff = { roles: ["Staff"] };
  const supportStaff = { role: "SupportStaff" };

  for (const user of [staff, supportStaff]) {
    assert.equal(getPrimaryPortalRole(user), "staff");
    assert.equal(isAdminOrStaffUser(user), true);
    assert.equal(getLandingPathForUser(user), ROUTES.staff.auctions);
    assert.equal(getPortalHomeRoute(user), ROUTES.staff.auctions);

    assert.equal(hasStrictPortalAccess(user, ["Staff"]), true);
    assert.equal(hasStrictPortalAccess(user, ["Buyer", "Seller", "Staff", "Admin"]), true);
    assert.equal(hasStrictPortalAccess(user, ["Admin"]), false);
    assert.equal(hasStrictPortalAccess(user, ["Seller"]), false);
    assert.equal(hasStrictPortalAccess(user, ["Buyer", "Customer", "Seller"]), false);

    assert.equal(resolveSafeReturnPath("/staff/sellers", user), "/staff/sellers");
    assert.equal(resolveSafeReturnPath("/account/profile", user), "/account/profile");
    assert.equal(resolveSafeReturnPath("/admin/overview", user), null);
    assert.equal(resolveSafeReturnPath("/buyer/cart", user), null);
    assert.equal(resolveSafeReturnPath("/", user), null);
  }
});

test("Seller and Buyer retain Marketplace and Seller access without Admin/Staff access", () => {
  const seller = { roles: ["Seller", "Buyer"] };
  const buyer = { roles: ["Buyer"] };

  assert.equal(getPrimaryPortalRole(seller), "seller");
  assert.equal(isAdminOrStaffUser(seller), false);
  assert.equal(getLandingPathForUser(seller), ROUTES.seller.products);
  assert.equal(getPortalHomeRoute(seller), ROUTES.home);
  assert.equal(getPortalHomeRoute(seller, "Người bán"), ROUTES.seller.products);
  assert.equal(hasStrictPortalAccess(seller, ["Seller"]), true);
  assert.equal(hasStrictPortalAccess(seller, ["Buyer", "Customer", "Seller"]), true);
  assert.equal(hasStrictPortalAccess(seller, ["Staff"]), false);
  assert.equal(hasStrictPortalAccess(seller, ["Admin"]), false);
  assert.equal(resolveSafeReturnPath("/seller/orders", seller), "/seller/orders");
  assert.equal(resolveSafeReturnPath("/buyer/orders", seller), "/buyer/orders");
  assert.equal(resolveSafeReturnPath("/staff/auctions", seller), null);

  assert.equal(getPrimaryPortalRole(buyer), "buyer");
  assert.equal(isAdminOrStaffUser(buyer), false);
  assert.equal(getLandingPathForUser(buyer), ROUTES.home);
  assert.equal(hasStrictPortalAccess(buyer, ["Buyer", "Customer", "Seller"]), true);
  assert.equal(hasStrictPortalAccess(buyer, ["Seller"]), false);
  assert.equal(hasStrictPortalAccess(buyer, ["Staff"]), false);
  assert.equal(hasStrictPortalAccess(buyer, ["Admin"]), false);
  assert.equal(resolveSafeReturnPath("/buyer/cart", buyer), "/buyer/cart");
  assert.equal(resolveSafeReturnPath("/seller/products", buyer), null);
});
