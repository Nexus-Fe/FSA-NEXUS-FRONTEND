// What the checks need to prepare, through the public API only (no database access, no test-only endpoint).
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { config } from './config.mjs';

export async function call(token, method, path, body) {
  const response = await fetch(config.apiUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: response.status, json, data: json?.data ?? json, text };
}

export async function login(email) {
  const response = await call(null, 'POST', '/api/v1/auth/login', { identifier: email, password: config.password });
  const token = response.data?.accessToken ?? response.data?.token ?? response.json?.accessToken;
  if (!token) throw new Error(`Cannot log in ${email}: HTTP ${response.status}`);
  return token;
}

/** The seller's profile, saved through the API with a chain the GHN lists confirm. */
export async function giveSellerAddress(sellerToken, place, extra = {}) {
  return call(sellerToken, 'PATCH', '/api/v1/sellers/profile', {
    pickupAddress: '1 Le Loi', provinceId: place.provinceId, districtId: place.districtId, wardCode: place.wardCode, ...extra,
  });
}

export async function putInCart(buyerToken, skuId) {
  return call(buyerToken, 'POST', '/api/v1/carts/me/items', { skuId, quantity: 1 });
}

const launched = [];

export async function launch() {
  const browser = await chromium.launch({ channel: config.channel, headless: true });
  launched.push(browser);
  const open = async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    return { context, page };
  };
  return { browser, open };
}

export async function uiLogin(page, email) {
  await page.goto(config.baseUrl + '/login');
  await page.fill('#login-identifier', email);
  await page.fill('#login-password', config.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {});
}

export async function chooseAddress(page, place) {
  await page.waitForFunction(() => document.querySelector('select[name="province"]')?.options.length > 1);
  await page.locator('select[name="province"]').selectOption({ label: place.province });
  await page.waitForFunction(() => document.querySelector('select[name="district"]')?.options.length > 1);
  await page.locator('select[name="district"]').selectOption({ label: place.district });
  await page.waitForFunction(() => document.querySelector('select[name="ward"]')?.options.length > 1);
  await page.locator('select[name="ward"]').selectOption({ label: place.ward });
  await page.waitForTimeout(500);
}

/** Collects PASS/FAIL lines and writes the evidence file (no credential is ever written). */
export function recorder(name) {
  const results = [];
  const check = (title, ok, detail = '') => {
    results.push({ name: title, ok: Boolean(ok), detail: ok ? '' : String(detail).slice(0, 300) });
    console.log((ok ? 'PASS ' : 'FAIL ') + title + (ok ? '' : ' -> ' + String(detail).slice(0, 300)));
  };
  const skipped = (title, why) => {
    results.push({ name: title, ok: null, detail: why });
    console.log('SKIP ' + title + ' (' + why + ')');
  };
  const finish = () => {
    const failed = results.filter((r) => r.ok === false).length;
    fs.mkdirSync(config.resultsDir, { recursive: true });
    fs.writeFileSync(`${config.resultsDir}${name}.json`, JSON.stringify({ at: new Date().toISOString(), baseUrl: config.baseUrl, results }, null, 1));
    console.log(`\n${name}: ${results.filter((r) => r.ok === true).length} passed, ${failed} failed, ${results.filter((r) => r.ok === null).length} skipped`);
    return failed;
  };
  return { check, skipped, finish };
}

/**
 * Runs a spec: an exception (a selector that never appeared, a timeout) is recorded as a failed check instead of ending the process without
 * a results file, every browser is closed, and the results file is always written. Exits 1 when any check failed.
 */
export async function runSpec(name, main) {
  const recorded = recorder(name);
  try {
    await main(recorded);
  } catch (error) {
    recorded.check('the spec ran to the end', false, error?.message ?? String(error));
  } finally {
    for (const browser of launched) await browser.close().catch(() => {});
  }
  process.exit(recorded.finish() ? 1 : 0);
}
