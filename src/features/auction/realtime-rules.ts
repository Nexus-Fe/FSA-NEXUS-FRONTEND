/** Rules for what the auction room does with a pushed event. The hub only pushes; the room's own data still comes from the API. */

export type BidPlacedEvent = { auctionId: string; bidId: string; amount: number; currentPriceAmount: number; bidCount: number; scheduledEndAt: string; extensionCount: number };
export type StatusChangedEvent = { auctionId: string; status: string; reason?: string | null };

export function asBidPlaced(payload: unknown): BidPlacedEvent | null {
  const value = payload as Partial<BidPlacedEvent> | null;
  if (!value || typeof value.auctionId !== "string" || typeof value.bidId !== "string" || typeof value.amount !== "number") return null;
  return value as BidPlacedEvent;
}

/** Someone else bid higher than the bid this buyer placed last: the buyer is no longer leading. */
export function isOutbid(event: Pick<BidPlacedEvent, "bidId" | "amount">, myLastBid: { bidId: string; amount: number } | null): boolean {
  return Boolean(myLastBid && event.bidId !== myLastBid.bidId && event.amount > myLastBid.amount);
}

export function outbidText(amount: number): string {
  return `Bạn vừa bị vượt giá: có lượt đặt ${new Intl.NumberFormat("vi-VN").format(amount)} ₫. Hãy đặt giá mới nếu bạn vẫn muốn mua.`;
}

/** The room refreshes every 5 seconds without realtime; with a live connection a slower safety refresh is enough. */
export function refreshIntervalMs(connected: boolean): number {
  return connected ? 30_000 : 5_000;
}

/** The extension notice: a bid inside the anti-sniping window pushed the end time later. */
export function extensionChanged(previousCount: number, event: Pick<BidPlacedEvent, "extensionCount">): boolean {
  return event.extensionCount > previousCount;
}
