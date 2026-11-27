import assert from "node:assert/strict";
import test from "node:test";
import { describeBuyNowFailure, canOfferBuyNow, buyNowSuccessText, buyNowConfirmText } from "../src/features/auction/buy-now-outcome.ts";
import { validateAuctionPrices, parseOptionalAmount, describeAuctionPriceFailure } from "../src/features/auction/auction-prices.ts";
import { mayAnswerBelowReserve, declineConsequence, describeReserveApprovalFailure } from "../src/features/auction/reserve-approval.ts";
import { canWatchAuction } from "../src/features/auction/watch.ts";
import { successRateText } from "../src/features/auction/seller-stats.ts";

const api = (status, errorCode) => ({ status, errorCode });

test("Buy Now says the money is locked, never that it is paid", () => {
  assert.match(buyNowSuccessText(), /khóa trong ví/);
  assert.doesNotMatch(buyNowSuccessText(), /đã được trả đủ|đã thanh toán/i);
  assert.match(buyNowConfirmText("1.000.000 ₫"), /chưa phải thanh toán/);
});

test("a lost answer on Buy Now keeps the key and asks to check; a refusal is definite", () => {
  for (const cause of [new TypeError("fetch failed"), api(undefined), api(502), api(503)]) {
    const f = describeBuyNowFailure(cause);
    assert.equal(f.unknownOutcome, true);
    assert.match(f.message, /Chưa xác định/);
  }
  const low = describeBuyNowFailure(api(409, "INSUFFICIENT_AVAILABLE_BALANCE"));
  assert.equal(low.unknownOutcome, false);
  assert.equal(low.needsTopUp, true);
  assert.equal(describeBuyNowFailure(api(409, "CONCURRENT_UPDATE")).reload, true);
  assert.equal(describeBuyNowFailure(api(409, "BUY_NOW_NOT_AVAILABLE")).reload, true);
  assert.equal(describeBuyNowFailure(api(409, "BUY_NOW_NOT_AVAILABLE")).unknownOutcome, false);
});

test("Buy Now is offered only while the server allows it, to a bidder who is not the seller", () => {
  const base = { buyNowAvailable: true, buyNowPriceAmount: 2_000_000, status: "RUNNING", sellerId: "s", userId: "b", canBid: true };
  assert.equal(canOfferBuyNow(base), true);
  assert.equal(canOfferBuyNow({ ...base, buyNowAvailable: false }), false);
  assert.equal(canOfferBuyNow({ ...base, status: "ENDED" }), false);
  assert.equal(canOfferBuyNow({ ...base, userId: "s" }), false);
  assert.equal(canOfferBuyNow({ ...base, userId: null }), false);
  assert.equal(canOfferBuyNow({ ...base, canBid: false }), false);
});

test("prices: reserve >= start, buy now above reserve (or above start without one)", () => {
  assert.equal(validateAuctionPrices({ start: 1_000_000 }), null);
  assert.equal(validateAuctionPrices({ start: 1_000_000, reserve: 1_200_000, buyNow: 1_500_000 }), null);
  assert.ok(validateAuctionPrices({ start: 1_000_000, reserve: 900_000 }));
  assert.ok(validateAuctionPrices({ start: 1_000_000, reserve: 1_200_000, buyNow: 1_200_000 }));
  assert.ok(validateAuctionPrices({ start: 1_000_000, buyNow: 1_000_000 }));
  assert.ok(validateAuctionPrices({ start: 1_000_000, reserve: -5 }));
  assert.ok(validateAuctionPrices({ start: 1_000_000, buyNow: 2_000_000.555 }));
  assert.equal(parseOptionalAmount(" "), null);
  assert.equal(parseOptionalAmount("1500000"), 1_500_000);
});

test("price refusals from the back end have their own text; other errors fall through", () => {
  assert.match(describeAuctionPriceFailure(api(422, "INVALID_PRICE_RELATION")) ?? "", /Quan hệ/);
  assert.match(describeAuctionPriceFailure(api(400, "VAL_INVALID_PRICE")) ?? "", /không hợp lệ/);
  assert.equal(describeAuctionPriceFailure(api(500, undefined)), null);
});

test("selling below the reserve: the choice shows only when the result says so", () => {
  const ended = { status: "ENDED", phase: "AWAITING_WINNER_PAYMENT", hasWinner: true, orderId: null };
  assert.equal(mayAnswerBelowReserve({ ...ended, settlement: { awaitingSellerApproval: true, settlementStatus: "PENDING" } }), true);
  assert.equal(mayAnswerBelowReserve({ ...ended, settlement: { awaitingSellerApproval: false, settlementStatus: "PENDING" } }), false);
  assert.equal(mayAnswerBelowReserve({ ...ended, status: "RUNNING", settlement: { awaitingSellerApproval: true, settlementStatus: "PENDING" } }), false);
});

test("the third decline in a row is warned about as a 14 day lock", () => {
  assert.match(declineConsequence(0), /lần từ chối đầu tiên/);
  assert.match(declineConsequence(1), /thứ 2/);
  assert.match(declineConsequence(2), /khóa 14 ngày/);
  assert.match(describeReserveApprovalFailure(api(409, "SELLER_APPROVAL_EXPIRED")), /quá hạn/);
});

test("the watch button is for a signed-in bidder who is not the seller", () => {
  assert.equal(canWatchAuction({ userId: "b", sellerId: "s", canBid: true }), true);
  assert.equal(canWatchAuction({ userId: "s", sellerId: "s", canBid: true }), false);
  assert.equal(canWatchAuction({ userId: null, sellerId: "s", canBid: true }), false);
  assert.equal(canWatchAuction({ userId: "b", sellerId: "s", canBid: false }), false);
});

test("the success rate reads sensibly with and without finished auctions", () => {
  assert.match(successRateText({ completedAuctions: 239, successRate: 21.76 }), /21,8%/);
  assert.equal(successRateText({ completedAuctions: 0, successRate: null }), "Chưa có phiên kết thúc");
});
