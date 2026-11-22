import { describeError, formatError } from "@/lib/errors/error-messages";

/**
 * What the buyer is told when a checkout step fails. The two stages must never be mixed up:
 *  - asking for a quote creates nothing and charges nothing, so a failure here is safe to retry;
 *  - placing the order: the back end removes the quote as soon as it starts (`OrderService`, "ATOMIC POP"), so a lost answer
 *    may hide an order that was created or paid. `QUOTE_EXPIRED` here proves nothing either way.
 * Pure functions, so the wording rules are tested without the screen.
 */

export type QuoteFailure = { message: string };

export type PlaceOrderFailure = {
  message: string;
  /**
   * The result is unknown: the request may have reached the server. The screen must lock ordering and send the buyer to check
   * their orders and wallet. It must NOT fetch a new quote and send again by itself (there is no order identity that proves the
   * earlier attempt failed).
   */
  unknownOutcome: boolean;
  /** A new quote is needed before anything else can be ordered (the old one is used up). */
  needsNewQuote: boolean;
  /** The cart prices changed on the server and the cart must be reloaded so the buyer sees them. */
  reloadCart: boolean;
};

export function describeQuoteFailure(cause: unknown): QuoteFailure {
  return { message: formatError(describeError(cause, { operation: "read" })) };
}

export function describePlaceOrderFailure(cause: unknown): PlaceOrderFailure {
  const described = describeError(cause, { operation: "write", scope: "place-order" });
  const unknownOutcome = described.kind === "unknown-outcome";
  return {
    message: formatError(described),
    unknownOutcome,
    // A definite refusal also used up the quote; only an unknown result leaves the decision to the buyer.
    needsNewQuote: !unknownOutcome,
    reloadCart: described.code === "PRICE_CHANGED",
  };
}

/** Failure while changing the quantity of, or removing, a cart line. */
export function describeCartFailure(cause: unknown): string {
  return formatError(describeError(cause, { operation: "write" }));
}

const UNKNOWN_MARKER_KEY = "nexus_checkout_unknown_outcome";

/**
 * The lock for an unknown order result is kept in this browser tab's session storage so that reloading the page does not reopen
 * the order button. It does not survive closing the tab; a durable guard needs an order identity from the back end.
 */
export function readUnknownOrderMarker(storage: Pick<Storage, "getItem"> | undefined): { at: number } | null {
  try {
    const raw = storage?.getItem(UNKNOWN_MARKER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: unknown };
    return typeof parsed.at === "number" ? { at: parsed.at } : null;
  } catch {
    return null;
  }
}

export function writeUnknownOrderMarker(storage: Pick<Storage, "setItem"> | undefined, at: number): void {
  try {
    storage?.setItem(UNKNOWN_MARKER_KEY, JSON.stringify({ at }));
  } catch {
    // Storage can be unavailable; the lock then lasts only until the page is reloaded.
  }
}

export function clearUnknownOrderMarker(storage: Pick<Storage, "removeItem"> | undefined): void {
  try {
    storage?.removeItem(UNKNOWN_MARKER_KEY);
  } catch {
    // Nothing to clear.
  }
}
