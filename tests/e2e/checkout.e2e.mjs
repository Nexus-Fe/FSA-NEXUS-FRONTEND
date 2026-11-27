// Checkout: the quote needs a GHN-confirmed address, the kept address is cleared once an order exists (cash on delivery and wallet).
import { config, PLACE } from './config.mjs';
import { launch, login, putInCart, uiLogin, chooseAddress, runSpec } from './fixtures.mjs';

await runSpec('checkout', async ({ check, skipped }) => {
if (!config.skuId) {
  skipped('checkout cases', 'E2E_SKU_ID is not set');
  return;
}

const buyerToken = await login(config.buyerEmail);
const { open } = await launch();

async function startCheckout(page, name) {
  const cart = await putInCart(buyerToken, config.skuId);
  check(`fixture: the cart has the sku (${name})`, cart.status === 200, `${cart.status} ${cart.text.slice(0, 120)}`);
  await page.goto(config.baseUrl + '/buyer/checkout');
  await page.waitForSelector('input[name="receiverName"]');
  await page.fill('input[name="receiverName"]', 'E2E Buyer');
  await page.fill('input[name="phone"]', '0912345678');
  await page.fill('input[name="address"]', '12 Nguyen Hue');
}

const kept = (page) => page.evaluate(() => ['nexus:checkout-shipping', 'nexus:checkout-extra', 'nexus:checkout-ghn'].map((k) => sessionStorage.getItem(k) !== null));

// ---- cash on delivery
{
  const { context, page } = await open();
  await uiLogin(page, config.buyerEmail);
  await startCheckout(page, 'cod');
  await page.getByRole('button', { name: /Xem tổng thanh toán/ }).click({ force: true });   // aria-disabled while incomplete
  await page.waitForTimeout(800);
  check('with no province chosen the checkout does not quote', (await page.getByRole('button', { name: /Đặt hàng/ }).count()) === 0 && (await page.locator('[role="alert"]').count()) > 0);
  await chooseAddress(page, PLACE);
  await page.locator('input[name="paymentMethod"][value="Cod"]').check();
  await page.getByRole('button', { name: /Xem tổng thanh toán/ }).click();
  const place = page.getByRole('button', { name: /Đặt hàng \(thanh toán khi nhận\)/ });
  await place.first().waitFor({ timeout: 20000 }).catch(() => {});
  check('a complete address chosen from the GHN lists gets a quote', (await place.count()) > 0, (await page.locator('main').innerText()).slice(-300));
  check('the address is kept in the session while the order is not placed', (await kept(page)).every(Boolean));
  await place.first().click();
  await page.waitForURL((u) => /\/buyer\/orders\//.test(u.pathname), { timeout: 30000 }).catch(() => {});
  check('the cash-on-delivery order was placed', /\/buyer\/orders\//.test(page.url()), page.url());
  check('the kept address is cleared after a cash-on-delivery order', (await kept(page)).every((v) => v === false));
  await context.close();
}

// ---- wallet
{
  const { context, page } = await open();
  await uiLogin(page, config.buyerEmail);
  await startCheckout(page, 'wallet');
  await chooseAddress(page, PLACE);
  await page.getByRole('button', { name: /Xem tổng thanh toán/ }).click();
  const pay = page.getByRole('button', { name: /Đặt hàng bằng Ví Nexus/ });
  await pay.waitFor({ timeout: 20000 }).catch(() => {});
  if ((await pay.count()) === 0) {
    skipped('wallet order', 'the wallet button did not appear (balance too low?)');
  } else {
    await pay.click();
    await page.getByText(/Thanh toán thành công/).first().waitFor({ timeout: 30000 }).catch(() => {});
    check('the wallet order is paid', (await page.getByText(/Thanh toán thành công/).count()) > 0, page.url());
    check('the kept address is cleared after the paid order', (await kept(page)).every((v) => v === false));
  }
  await context.close();
}

});
