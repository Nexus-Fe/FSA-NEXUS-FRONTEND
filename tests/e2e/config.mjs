// Settings of the browser checks, all from the environment. Nothing secret is kept in the repository.
//
//   E2E_BASE_URL       the web app under test, e.g. http://localhost:3100            (default shown)
//   E2E_API_URL        the API gateway the fixtures call, e.g. http://localhost:28080 (required)
//   E2E_PASSWORD       the password of the test accounts                                (required)
//   E2E_SELLER_EMAIL   an approved seller account with a warehouse                      (required)
//   E2E_BUYER_EMAIL    a buyer account                                                  (required)
//   E2E_SKU_ID         a purchasable sku of that seller (stock > 0); checkout cases are skipped without it
//   E2E_NEW_BUYER_EMAIL a buyer who is not a seller yet; the "become a seller" case is skipped without it
//   E2E_CHROME_CHANNEL the installed browser channel, default "chrome"
//
// The checks expect the GHN province, district and ward lists to be served (real GHN staging, or a test double with the same ids):
// Ho Chi Minh (202) / Quan 1 (1442) / Phuong Ben Nghe (20101).
import { fileURLToPath } from 'node:url';

const read = (name, { required = false, fallback } = {}) => {
  const value = process.env[name];
  if (value) return value;
  if (required) {
    console.error(`Missing environment variable ${name}. See tests/e2e/config.mjs for the list.`);
    process.exit(2);
  }
  return fallback;
};

export const config = {
  baseUrl: read('E2E_BASE_URL', { fallback: 'http://localhost:3100' }),
  apiUrl: read('E2E_API_URL', { required: true }),
  password: read('E2E_PASSWORD', { required: true }),
  sellerEmail: read('E2E_SELLER_EMAIL', { required: true }),
  buyerEmail: read('E2E_BUYER_EMAIL', { required: true }),
  skuId: read('E2E_SKU_ID'),
  newBuyerEmail: read('E2E_NEW_BUYER_EMAIL'),
  channel: read('E2E_CHROME_CHANNEL', { fallback: 'chrome' }),
  resultsDir: fileURLToPath(new URL('./results/', import.meta.url)),
};

/** The address every check chooses from the GHN lists. */
export const PLACE = { province: 'Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Nghé', provinceId: 202, districtId: 1442, wardCode: '20101' };
