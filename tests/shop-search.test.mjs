import assert from "node:assert/strict";
import test from "node:test";
import { toShopSearchPath } from "../src/features/catalog/services/catalog.service.ts";

test("toShopSearchPath builds paginated query without empty search", () => {
  assert.equal(toShopSearchPath(), "/api/v1/sellers?page=1&pageSize=12");
  assert.equal(
    toShopSearchPath({ search: "   ", page: 2, pageSize: 6 }),
    "/api/v1/sellers?page=2&pageSize=6",
  );
});

test("toShopSearchPath trims and encodes shop search keyword", () => {
  assert.equal(
    toShopSearchPath({ search: "  Nexus Official  ", page: 1, pageSize: 6 }),
    "/api/v1/sellers?search=Nexus+Official&page=1&pageSize=6",
  );
});

test("toShopSearchPath normalizes invalid page or pageSize", () => {
  assert.equal(
    toShopSearchPath({ search: "Tech", page: 0, pageSize: -5 }),
    "/api/v1/sellers?search=Tech&page=1&pageSize=12",
  );
});
