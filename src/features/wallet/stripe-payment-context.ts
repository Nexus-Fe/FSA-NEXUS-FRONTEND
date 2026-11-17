export type StripePaymentContext = { kind: "topup"; transactionId: string };

const contextKey = "nexus:stripe-payment-context";
const legacyTopupKey = "nexus:stripe-topup-id";
const draftKey = "nexus:stripe-topup-draft";

export function getTopupIdempotencyKey(amount: number): string {
  const stored = window.sessionStorage.getItem(draftKey);
  if (stored) {
    try {
      const value: unknown = JSON.parse(stored);
      if (value && typeof value === "object" && "amount" in value && "key" in value &&
          value.amount === amount && typeof value.key === "string" && value.key) return value.key;
    } catch {
      // Replace a damaged draft with a fresh key.
    }
  }
  const key = crypto.randomUUID();
  window.sessionStorage.setItem(draftKey, JSON.stringify({ amount, key }));
  return key;
}

export function clearTopupDraft(): void {
  window.sessionStorage.removeItem(draftKey);
}

export function readStripePaymentContext(): StripePaymentContext | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(contextKey);
    if (stored) {
      const value: unknown = JSON.parse(stored);
      if (value && typeof value === "object" && "kind" in value && "transactionId" in value &&
          value.kind === "topup" && typeof value.transactionId === "string" && value.transactionId) {
        return { kind: "topup", transactionId: value.transactionId };
      }
    }
    const legacyId = window.sessionStorage.getItem(legacyTopupKey);
    return legacyId ? { kind: "topup", transactionId: legacyId } : null;
  } catch {
    return null;
  }
}

export function saveStripePaymentContext(value: StripePaymentContext): void {
  window.sessionStorage.setItem(contextKey, JSON.stringify(value));
  window.sessionStorage.removeItem(legacyTopupKey);
}

export function clearStripePaymentContext(): void {
  window.sessionStorage.removeItem(contextKey);
  window.sessionStorage.removeItem(legacyTopupKey);
}
