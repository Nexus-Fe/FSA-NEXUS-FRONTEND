// The two seller registration forms (new seller; a buyer who becomes a seller). Neither case submits a registration: the checks stop at the
// review step and at the state of the submit button, so no account or application is created.
import { config, PLACE } from './config.mjs';
import { launch, uiLogin, chooseAddress, runSpec } from './fixtures.mjs';

await runSpec('registration', async ({ check, skipped }) => {
const { open } = await launch();

// ---- a new seller: account -> shop -> review
{
  const { context, page } = await open();
  const id = Math.random().toString(36).slice(2, 8);
  await page.goto(config.baseUrl + '/register');
  await page.locator('.role-card').nth(1).click();   // seller
  await page.fill('#register-username', `e2e_${id}`);
  await page.fill('#register-email', `e2e.${id}@example.test`);
  await page.fill('#register-first', 'E2E');
  await page.fill('#register-last', 'Browser');
  await page.fill('#register-phone', '0912345678');
  await page.fill('#register-password', config.password);
  await page.fill('#register-confirm-password', config.password);
  await page.getByRole('button', { name: /Tiếp tục điền hồ sơ gian hàng/ }).click();
  await page.waitForSelector('select[name="province"]');
  check('the shop step starts with no province chosen (no default address)', (await page.locator('select[name="province"]').inputValue()) === '' && (await page.locator('select[name="district"]').inputValue()) === '');
  await page.fill('#new-seller-identityCardNumber', '012345678901');
  await page.fill('#new-seller-shopName', `E2E Shop ${id}`);
  await page.fill('#new-seller-streetAddress', '12 Nguyen Hue');
  await page.getByRole('button', { name: /Kiểm tra thông tin shop/ }).click();
  await page.waitForTimeout(800);
  check('without an address chosen the shop step does not go to the review', (await page.locator('.form-error, [role="alert"]').count()) > 0 && (await page.getByText(/Thông tin shop đã nhập/).count()) === 0);
  await chooseAddress(page, PLACE);
  await page.getByRole('button', { name: /Kiểm tra thông tin shop/ }).click();
  await page.getByText(/Thông tin shop đã nhập/).waitFor().catch(() => {});
  check('with the three levels chosen from the GHN lists the review step opens', (await page.getByText(/Thông tin shop đã nhập/).count()) > 0);
  const review = await page.locator('.seller-registration-review').innerText().catch(() => '');
  check('the review shows the codes chosen', review.includes(`${PLACE.provinceId}/${PLACE.districtId}/${PLACE.wardCode}`), review.slice(0, 200));
  await context.close();
}

// ---- a buyer who becomes a seller
if (!config.newBuyerEmail) {
  skipped('become-a-seller form', 'E2E_NEW_BUYER_EMAIL is not set');
} else {
  const { context, page } = await open();
  await uiLogin(page, config.newBuyerEmail);
  await page.goto(config.baseUrl + '/buyer/become-seller');
  await page.waitForSelector('#buyer-seller-shopName');
  await page.waitForSelector('select[name="province"]');
  check('the become-a-seller form starts with no province chosen (no default address)', (await page.locator('select[name="province"]').inputValue()) === '' && (await page.locator('select[name="ward"]').inputValue()) === '');
  const submit = page.getByRole('button', { name: /Nộp hồ sơ/ });
  await page.fill('#buyer-seller-identityCardNumber', '012345678901');
  await page.fill('#buyer-seller-shopName', 'E2E Become Shop');
  await page.fill('#buyer-seller-hotline', '0912345678');
  await page.fill('#buyer-seller-businessEmail', 'e2e.become@example.test');
  await page.fill('#buyer-seller-streetAddress', '12 Nguyen Hue');
  await page.waitForTimeout(500);
  check('"Nộp hồ sơ" stays disabled until an address is confirmed by the GHN lists', await submit.isDisabled());
  await chooseAddress(page, PLACE);
  check('with the address chosen from the GHN lists "Nộp hồ sơ" is enabled', !(await submit.isDisabled()));
  await context.close();
}

});
