# Browser checks (Chrome through playwright-core)

These checks drive the real web app in an installed Chrome. They use no database access and no test-only endpoint: fixtures call the public
API only. Nothing secret is stored here; every account and password comes from the environment (see `config.mjs`).

```
E2E_API_URL=http://localhost:28080 \
E2E_PASSWORD=... E2E_SELLER_EMAIL=... E2E_BUYER_EMAIL=... \
E2E_SKU_ID=<a purchasable sku of that seller> E2E_NEW_BUYER_EMAIL=<a buyer who is not a seller> \
npm run test:e2e
```

Start the web app yourself first (`E2E_BASE_URL`, default `http://localhost:3100`), pointed at the same gateway (`API_GATEWAY_URL`).
The GHN lists the checks choose from are Ho Chi Minh (202) / Quan 1 (1442) / Phuong Ben Nghe (20101): real GHN staging, or a test double
serving the same ids. Cases that need `E2E_SKU_ID` or `E2E_NEW_BUYER_EMAIL` are skipped (and reported as skipped) when they are not set.

What the checks change: the seller's profile (hotline, pickup address), one cart item, and one or two orders of the buyer. Use test accounts.

Each spec writes `results/<name>.json` (time, base URL and the PASS/FAIL list; no credential). The files in `results/` are the evidence of a run.

Some GHN cases (source down, saved code missing from a trusted list, unknown source) are simulated by blocking or rewriting the browser's
answers: they prove how the page handles such an answer, not that GHN produces it.

A check that fails keeps the first 300 characters of what it saw in `detail` (a page text or a response body). Read a failing results file before
committing it: it can hold test-account data such as a phone number or e-mail, never a password or a token.
