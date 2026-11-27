import { WALLET_TRANSACTION_TYPE, normalizeStatus, statusLabel } from "@/lib/status-labels";

/**
 * How a wallet transaction reads: the label for every `WalletTransactionType` and whether it adds to or takes from the balance.
 * One module for the buyer and the seller wallet, so a type never reads differently on the two screens.
 * `EscrowCredit` has no documented direction, so it is shown without a sign rather than with a guessed one.
 */
const CREDIT = new Set([
  "TOPUPVNPAY", "TOPUPSTRIPE", "REFUNDCREDIT", "ESCROWRELEASE", "ESCROWCANCELLATIONREFUND", "WITHDRAWALREVERSAL", "PLATFORMFEECREDIT",
  "PLATFORMSUBSIDYCREDIT", "ADJUSTMENTCREDIT", "TRANSFERIN", "AUCTIONFORFEITCREDIT", "AUCTIONDEPOSITREFUND", "ORDERPAYMENTADJUSTMENTREFUND",
  // Older names kept for data written before the current enum.
  "DEPOSIT", "REFUND",
]);

const DEBIT = new Set([
  "PURCHASEDEBIT", "WITHDRAWALDEBIT", "ADJUSTMENTDEBIT", "DIRECTGATEWAYPAYMENT", "TRANSFEROUT", "AUCTIONHOLDCAPTURE",
  "ORDERPAYMENTADJUSTMENTDEBIT", "PAYMENT",
]);

export function transactionTypeLabel(type: string | null | undefined): string {
  return statusLabel(WALLET_TRANSACTION_TYPE, type);
}

export type Direction = "credit" | "debit" | null;

/** Only a finished transaction with an amount moves the balance; a pending or failed one shows no sign. */
export function transactionDirection(type: string, status: string, amount: number): Direction {
  if (!Number.isFinite(amount) || amount === 0 || !["SUCCESS", "COMPLETED"].includes(normalizeStatus(status))) return null;
  const key = normalizeStatus(type);
  if (CREDIT.has(key)) return "credit";
  if (DEBIT.has(key)) return "debit";
  return null;
}

/** True when the type has a label and a known direction (or is the documented neutral one), so no raw code reaches the screen. */
export function isFullyDescribed(type: string): boolean {
  const key = normalizeStatus(type);
  return normalizeStatus(transactionTypeLabel(type)) !== key && (CREDIT.has(key) || DEBIT.has(key) || key === "ESCROWCREDIT");
}
