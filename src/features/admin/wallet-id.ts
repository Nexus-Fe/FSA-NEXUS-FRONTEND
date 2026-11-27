// A wallet id is a standard UUID: 8-4-4-4-12 hexadecimal digits.
const WALLET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isWalletId = (value: string) => WALLET_ID.test(value.trim());
