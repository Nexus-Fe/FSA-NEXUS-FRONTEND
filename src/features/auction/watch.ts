/** The watch button is shown to a signed-in buyer or seller who is not the seller of that auction. */
export function canWatchAuction(input: { userId?: string | null; sellerId: string; canBid: boolean }): boolean {
  return Boolean(input.userId && input.canBid && input.userId !== input.sellerId);
}
