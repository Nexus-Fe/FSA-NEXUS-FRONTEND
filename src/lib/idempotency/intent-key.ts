/**
 * Idempotency-Key for one intent of the user (for example one withdrawal request).
 *
 * The key stays the same while the content of the request stays the same and the outcome is unknown, so a retry after a timeout,
 * a dropped connection or a double click is recognised by the server as the same request instead of a second one.
 * It changes when the content changes, and it is released once the outcome is known (accepted, or refused for a business reason).
 */
export type IntentKeyStore = {
  /** The key to send for a request with this content. The same content gets the same key until {@link IntentKeyStore.settle}. */
  keyFor(signature: string): string;
  /** The outcome is known: the next request, even with the same content, is a new intent. */
  settle(): void;
};

export function createIntentKeyStore(newKey: () => string = defaultKey): IntentKeyStore {
  let current: { signature: string; key: string } | null = null;
  return {
    keyFor(signature: string) {
      if (!current || current.signature !== signature) {
        current = { signature, key: newKey() };
      }
      return current.key;
    },
    settle() {
      current = null;
    },
  };
}

/**
 * True when the server gave a definite answer, so the same key must not be reused: any 4xx except 408 (timeout) and 429 (try again).
 * A network failure (no status), a timeout or a 5xx leaves the outcome unknown, so the key is kept for the retry.
 */
export function isDefiniteOutcome(status: number | undefined | null): boolean {
  if (status === undefined || status === null) return false;
  if (status === 408 || status === 429) return false;
  return status >= 200 && status < 500;
}

function defaultKey(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `wd-${random}`;
}
