import assert from "node:assert/strict";
import test from "node:test";
import { notificationTarget, parsePayload } from "../src/features/notification/notification-target.ts";

const NOW = Date.parse("2026-11-17T03:00:00Z");
const item = (notificationType, payload) => ({ notificationType, payload: payload === undefined ? null : JSON.stringify(payload) });
const link = (target) => (target?.kind === "link" ? target.href : null);

test("the payload is only ever a JSON object", () => {
  assert.equal(parsePayload(null), null);
  assert.equal(parsePayload(undefined), null);
  assert.equal(parsePayload(""), null);
  assert.equal(parsePayload("{not json"), null);
  assert.equal(parsePayload("[1,2]"), null);
  assert.equal(parsePayload("42"), null);
  assert.equal(parsePayload("null"), null);
  assert.deepEqual(parsePayload('{"a":1}'), { a: 1 });
});

test("a regular order opens the seller's page by sub-order id and the buyer's through the resolver", () => {
  const payload = (audience) => ({ type: "OrderPaid", audience, orderId: "11111111-1111-1111-1111-111111111111", orderNo: "SUB-1" });

  assert.equal(link(notificationTarget(item("OrderPaid", payload("Seller")), "seller", NOW)), "/seller/orders/11111111-1111-1111-1111-111111111111");
  assert.equal(link(notificationTarget(item("OrderPaid", payload("Buyer")), "buyer", NOW)), "/buyer/orders/by-sub/11111111-1111-1111-1111-111111111111");
});

test("the audience of the notice decides, not the portal it is read in", () => {
  const sellerNotice = item("OrderPaid", { type: "OrderPaid", audience: "Seller", orderId: "S1" });
  const buyerNotice = item("OrderPaid", { type: "OrderPaid", audience: "Buyer", orderId: "S1" });

  assert.equal(link(notificationTarget(sellerNotice, "buyer", NOW)), "/seller/orders/S1");
  assert.equal(link(notificationTarget(buyerNotice, "seller", NOW)), "/buyer/orders/by-sub/S1");
});

test("without an audience the viewer's portal is used", () => {
  const notice = item("OrderPaid", { type: "OrderPaid", orderId: "S1" });

  assert.equal(link(notificationTarget(notice, "seller", NOW)), "/seller/orders/S1");
  assert.equal(link(notificationTarget(notice, "buyer", NOW)), "/buyer/orders/by-sub/S1");
});

test("an auction order never goes to a regular order page", () => {
  const payload = (audience) => ({ type: "OrderPaid", orderKind: "Auction", audience, auctionId: "A1", orderId: "O1" });

  const seller = link(notificationTarget(item("OrderPaid", payload("Seller")), "seller", NOW));
  const buyer = link(notificationTarget(item("OrderPaid", payload("Buyer")), "buyer", NOW));

  assert.equal(seller, "/seller/auctions/A1/result");
  assert.equal(buyer, "/buyer/auctions/A1/payment");
  assert.ok(!seller.includes("/orders/") && !buyer.includes("/orders/"));
});

test("an order notice that misses the id it needs opens nothing", () => {
  assert.equal(notificationTarget(item("OrderPaid", { type: "OrderPaid", audience: "Buyer" }), "buyer", NOW), null);
  assert.equal(notificationTarget(item("OrderPaid", { type: "OrderPaid", orderKind: "Auction", audience: "Seller", orderId: "O1" }), "seller", NOW), null);
  assert.equal(notificationTarget(item("OrderPaid", { type: "OrderPaid", orderId: "  " }), "buyer", NOW), null);
});

test("winning, being outbid, a failed or a cancelled auction", () => {
  assert.equal(link(notificationTarget(item("AuctionWon", { type: "AuctionWon", auctionId: "A1" }), "buyer", NOW)), "/buyer/auctions/A1/payment");
  assert.equal(link(notificationTarget(item("AuctionOutbid", { type: "AuctionOutbid", auctionId: "A1" }), "buyer", NOW)), "/auctions/A1");
  assert.equal(link(notificationTarget(item("AuctionFailed", { auctionId: "A1" }), "seller", NOW)), "/seller/auctions/A1/result");
  assert.equal(link(notificationTarget(item("AuctionCancelled", { auctionId: "A1" }), "seller", NOW)), "/seller/auctions/A1/result");
});

test("the type of the payload wins over the type column when both exist", () => {
  const notice = item("OrderPaid", { type: "AuctionWon", auctionId: "A1" });

  assert.equal(link(notificationTarget(notice, "buyer", NOW)), "/buyer/auctions/A1/payment");
});

test("a replacement-winner invitation leads to the invitations while it is open", () => {
  const open = item("AuctionWinnerOffer", { auctionId: "A1", offerId: "F1", expiresAt: "2026-11-18T03:00:00Z" });
  const noDeadline = item("AuctionWinnerOffer", { auctionId: "A1", offerId: "F1" });
  const badDeadline = item("AuctionWinnerOffer", { auctionId: "A1", offerId: "F1", expiresAt: "not a date" });

  assert.equal(link(notificationTarget(open, "buyer", NOW)), "/buyer/auctions");
  assert.equal(link(notificationTarget(noDeadline, "buyer", NOW)), "/buyer/auctions");
  assert.equal(link(notificationTarget(badDeadline, "buyer", NOW)), "/buyer/auctions");
});

test("an invitation that ran out says so instead of opening a dead end", () => {
  const expired = item("AuctionWinnerOffer", { auctionId: "A1", offerId: "F1", expiresAt: "2026-11-17T02:59:59Z" });
  const atTheDeadline = item("AuctionWinnerOffer", { auctionId: "A1", offerId: "F1", expiresAt: "2026-11-17T03:00:00Z" });

  const target = notificationTarget(expired, "buyer", NOW);
  assert.equal(target?.kind, "unavailable");
  assert.match(target.reason, /hết hạn/);
  assert.equal(notificationTarget(atTheDeadline, "buyer", NOW)?.kind, "unavailable");
});

test("unknown types and missing or broken payloads open nothing", () => {
  assert.equal(notificationTarget(item("Promotion", { type: "Promotion" }), "buyer", NOW), null);
  assert.equal(notificationTarget(item("Promotion", { orderId: "O1" }), "buyer", NOW), null);
  assert.equal(notificationTarget({ notificationType: "AuctionWon", payload: null }, "buyer", NOW), null);
  assert.equal(notificationTarget({ notificationType: "AuctionWon", payload: "{broken" }, "buyer", NOW), null);
  assert.equal(notificationTarget({ notificationType: null, payload: '{"auctionId":"A1"}' }, "buyer", NOW), null);
  assert.equal(notificationTarget({ notificationType: "AuctionWon" }, "buyer", NOW), null);
});

test("ids are put in the address safely", () => {
  const notice = item("AuctionWon", { type: "AuctionWon", auctionId: "a/b?c" });

  assert.equal(link(notificationTarget(notice, "buyer", NOW)), "/buyer/auctions/a%2Fb%3Fc/payment");
});

test("newer notification types open their screens", () => {
  const link = (type, extra = {}, viewer = "buyer") => notificationTarget({ notificationType: type, payload: JSON.stringify({ type, ...extra }) }, viewer);
  assert.equal(link("AuctionWatchlistBid", { auctionId: "a1" }).href, "/auctions/a1");
  assert.equal(link("AuctionDeposit").href, "/buyer/deposits");
  assert.match(link("AuctionReserveApprovalNeeded", { auctionId: "a1" }, "seller").href, /seller\/auctions\/a1/);
  assert.equal(link("AuctionReserveApprovalNeeded"), null);
  assert.equal(link("WithdrawalResult", {}, "seller").href, "/seller/withdrawals");
  assert.equal(link("ProductBannedByReport").href, "/seller/products");
  assert.equal(link("ProductReportResolved").href, "/buyer/reports");
  assert.equal(link("OrderRefunded", {}, "seller").href, "/seller/refunds");
});
