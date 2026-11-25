// The seller's shop profile form: typing, the GHN lists, saved codes, saving. Fixtures use the public API only.
import { config, PLACE } from './config.mjs';
import { launch, login, giveSellerAddress, uiLogin, runSpec, call } from './fixtures.mjs';

await runSpec('shop-profile', async ({ check }) => {
const sellerToken = await login(config.sellerEmail);
const given = await giveSellerAddress(sellerToken, PLACE, { hotline: '0900000001' });
check('fixture: the seller profile has a GHN-confirmed address', given.status === 200, `${given.status} ${given.text.slice(0, 120)}`);

const { open } = await launch();
const { context, page } = await open();
await uiLogin(page, config.sellerEmail);
check('the seller is logged in', !new URL(page.url()).pathname.startsWith('/login'), page.url());

const hotline = page.locator('input[name="hotline"]');
const provinceName = () => page.locator('select[name="province"] option:checked').textContent().then((t) => (t ?? '').trim());
const open_ = async () => { await page.goto(config.baseUrl + '/seller/shop'); await hotline.waitFor(); await page.waitForTimeout(2500); };

// ---- 1. typing, and the saved address shown with its GHN names
await open_();
await page.waitForFunction(() => document.querySelector('select[name="province"]')?.selectedOptions[0]?.textContent?.trim().length > 0);
check('the saved province shows its GHN name', (await provinceName()) === PLACE.province, await provinceName());
await hotline.click();
await hotline.press('End');
await page.keyboard.type('7');
await page.waitForTimeout(800);
check('the first character typed stays', (await hotline.inputValue()).endsWith('7'), await hotline.inputValue());
await page.keyboard.type('89');
await page.waitForTimeout(400);
check('further characters stay too', (await hotline.inputValue()).endsWith('789'));
const options = await page.locator('select[name="province"] option').allTextContents();
const other = options.find((t) => t && !/Chọn/.test(t) && t.trim() !== PLACE.province);
await page.selectOption('select[name="province"]', { label: other });
await page.waitForTimeout(800);
check('the first province chosen stays chosen', (await provinceName()) === other.trim(), `${await provinceName()} vs ${other}`);
check('the typed text survived choosing a province', (await hotline.inputValue()).endsWith('789'));

// ---- 2. GHN source down (the browser blocks the answers): the address is kept, the user is told, a retry is offered
await context.route('**/shipping/locations/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ status: 503, errorCode: 'LOCATION_SOURCE_UNAVAILABLE', title: 'Business rule violation' }) }));
await open_();
const down = await page.locator('body').innerText();
check('a failed GHN list shows "tạm thời không khả dụng" and a retry button', /tạm thời không khả dụng/i.test(down) && (await page.getByRole('button', { name: /Tải lại danh sách/ }).count()) > 0, down.slice(0, 200));
check('the saved codes are kept', (await page.locator('input[name="wardCode"]').inputValue()) === PLACE.wardCode);
check('no "address needs updating" notice for an unavailable source', (await page.getByTestId('ghn-stale-notice').count()) === 0);
await context.unroute('**/shipping/locations/**');

// ---- 3. a trusted list that does not hold the saved province / district: cleared, and the user is told to choose again
const without = (key, wanted) => async (route) => {
  const real = await route.fetch();
  const list = await real.json();
  const items = (Array.isArray(list) ? list : list.data ?? []).filter((x) => x[key] !== wanted);
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'x-location-source': 'ghn', 'x-location-observed-at': new Date().toISOString() }, body: JSON.stringify(items) });
};
await context.route('**/shipping/locations/provinces**', without('provinceId', PLACE.provinceId));
await open_();
check('a saved province missing from a trusted list is cleared with the "choose again" notice', (await page.getByTestId('ghn-stale-notice').count()) > 0 && (await page.locator('input[name="provinceId"]').inputValue()) === '');
await context.unroute('**/shipping/locations/provinces**');

await context.route('**/shipping/locations/districts**', without('districtId', PLACE.districtId));
await open_();
check('a saved district missing from a trusted list is cleared with the notice', (await page.getByTestId('ghn-stale-notice').count()) > 0 && (await page.locator('input[name="districtId"]').inputValue()) === '');
await context.unroute('**/shipping/locations/districts**');

// ---- 4. a list whose origin is unknown never clears the address and offers a retry
await context.route('**/shipping/locations/districts**', async (route) => {
  const real = await route.fetch();
  const list = await real.json();
  const items = (Array.isArray(list) ? list : list.data ?? []).filter((x) => x.districtId !== PLACE.districtId);
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(items) });
});
await open_();
check('an unknown source keeps the saved district', (await page.locator('input[name="districtId"]').inputValue()) === String(PLACE.districtId));
check('and offers "Tải lại danh sách"', (await page.getByRole('button', { name: /Tải lại danh sách/ }).count()) > 0);
await context.unroute('**/shipping/locations/districts**');

// ---- 5. a profile that changed only its hotline elsewhere shows the new value when the form was not being edited
await call(sellerToken, 'PATCH', '/api/v1/sellers/profile', { hotline: '0900000002' });
await open_();
check('a profile that changed only its hotline shows the new value', (await hotline.inputValue()) === '0900000002', await hotline.inputValue());

// ---- 6. edit and save: the form shows the saved value and the profile has the chosen codes
await hotline.click();
await hotline.press('Control+A');
await page.keyboard.type('0900000003');
await page.waitForFunction(() => document.querySelector('select[name="ward"]')?.selectedOptions[0]?.textContent?.trim().length > 0);
await page.getByRole('button', { name: /Lưu hồ sơ shop/ }).click();
await page.waitForTimeout(2500);
check('after the save the form shows the saved hotline', (await hotline.inputValue()) === '0900000003', await hotline.inputValue());
const saved = (await call(sellerToken, 'GET', '/api/v1/sellers/profile')).data;
check('the saved profile has the codes chosen from the GHN lists', saved?.hotline === '0900000003' && String(saved?.provinceId) === String(PLACE.provinceId) && String(saved?.districtId) === String(PLACE.districtId) && saved?.wardCode === PLACE.wardCode, JSON.stringify(saved).slice(0, 200));

// ---- 7. typing while the profile is still loading: the text stays, the saved profile and address still arrive
let release;
const gate = new Promise((resolve) => { release = resolve; });
await context.route('**/api/gateway/api/v1/sellers/profile*', async (route) => { if (route.request().method() !== 'GET') return route.continue(); await gate; await route.continue(); });
await page.goto(config.baseUrl + '/seller/shop');
await page.waitForSelector('input[name="shopName"]');
await hotline.click();
await page.keyboard.type('55');
release();
await page.waitForTimeout(3500);
check('typing while the profile loads: the typed text stays', (await hotline.inputValue()).includes('55'), await hotline.inputValue());
check('typing while the profile loads: the saved shop name still arrives', (await page.locator('input[name="shopName"]').inputValue()).length > 0);
check('typing while the profile loads: the saved address still arrives', (await provinceName()) === PLACE.province && (await page.locator('input[name="wardCode"]').inputValue()) === PLACE.wardCode, `${await provinceName()} / ${await page.locator('input[name="wardCode"]').inputValue()}`);

});
