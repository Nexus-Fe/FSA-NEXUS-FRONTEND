// Runs every browser check in turn and reports. Usage: npm run test:e2e   (see README.md for the environment)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const specs = ['shop-profile.e2e.mjs', 'checkout.e2e.mjs', 'registration.e2e.mjs'];
let failed = 0;
for (const spec of specs) {
  console.log(`\n=== ${spec}`);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(`./${spec}`, import.meta.url))], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) failed += 1;
}
console.log(failed ? `\n${failed} spec(s) failed` : '\nall specs passed');
process.exit(failed ? 1 : 0);
