import { ROUTES } from "@/constants/routes";

/** Who is looking at the notification: the buyer or the seller portal. Other roles have no deep links. */
export type NotificationViewer = "buyer" | "seller";

/** What an item of the inbox needs to know to open its target. `payload` is the JSON text Notification stored. */
export type NotificationLike = { notificationType: string | null; payload?: string | null };

export type NotificationTarget =
  | { kind: "link"; href: string; label: string }
  /** The target no longer accepts action (for example an invitation that ran out): say so instead of opening a dead end. */
  | { kind: "unavailable"; reason: string };

/** The payload is a JSON object written by another service; anything else (empty, broken, an array, a number) is "no payload". */
export function parsePayload(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function id(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Where a notification leads. Two kinds of notification share the type OrderPaid: a regular order (opened by its sub-order id) and an auction
 * order (opened through its auction); `payload.orderKind` tells them apart, and an auction order never goes to a regular order page.
 * Returns null when the item has nothing to open (unknown type, or the payload misses the id the target needs).
 */
export function notificationTarget(
  item: NotificationLike,
  viewer: NotificationViewer,
  now: number = Date.now(),
): NotificationTarget | null {
  const payload = parsePayload(item.payload) ?? {};

  const type = id(payload, "type") ?? item.notificationType ?? "";
  if (!type) return null;
  const auctionId = id(payload, "auctionId");
  const subOrderId = id(payload, "orderId") ?? id(payload, "subOrderId");
  const productId = id(payload, "productId");
  const audience = (id(payload, "audience") ?? viewer).toLowerCase() === "seller" ? "seller" : "buyer";

  switch (type) {
    case "OrderPaid": {
      if (payload.orderKind === "Auction") {
        if (!auctionId) return null;
        return audience === "seller"
          ? { kind: "link", href: ROUTES.seller.auctionResult(auctionId), label: "Xử lý đơn đấu giá" }
          : { kind: "link", href: ROUTES.buyer.auctionPayment(auctionId), label: "Xem đơn đấu giá" };
      }

      if (!subOrderId) return null;
      return audience === "seller"
        ? { kind: "link", href: ROUTES.seller.order(subOrderId), label: "Xử lý đơn hàng" }
        : { kind: "link", href: ROUTES.buyer.orderBySubOrder(subOrderId), label: "Xem đơn hàng" };
    }

    case "OrderShipped":
    case "OrderDecision":
    case "OrderCompleted":
    case "OrderBuyerCancelled":
    case "OrderPaymentExpired": {
      if (payload.orderKind === "Auction" && auctionId) {
        return audience === "seller"
          ? { kind: "link", href: ROUTES.seller.auctionResult(auctionId), label: "Xem đơn đấu giá" }
          : { kind: "link", href: ROUTES.buyer.auctionPayment(auctionId), label: "Xem đơn đấu giá" };
      }
      if (!subOrderId) {
        return { kind: "link", href: audience === "seller" ? ROUTES.seller.orders : ROUTES.buyer.orders, label: "Xem đơn hàng" };
      }
      return audience === "seller"
        ? { kind: "link", href: ROUTES.seller.order(subOrderId), label: "Xem đơn hàng" }
        : { kind: "link", href: ROUTES.buyer.orderBySubOrder(subOrderId), label: "Xem đơn hàng" };
    }

    case "OrderSellerSettled":
      return { kind: "link", href: ROUTES.seller.wallet, label: "Xem ví người bán" };

    case "AuctionWon":
    case "AuctionPaymentTimedOut":
      return auctionId ? { kind: "link", href: ROUTES.buyer.auctionPayment(auctionId), label: "Thanh toán đơn đấu giá" } : null;

    case "AuctionOutbid":
    case "AuctionStarted":
      return auctionId ? { kind: "link", href: ROUTES.auction.room(auctionId), label: "Vào phòng đấu giá" } : null;

    case "AuctionFailed":
    case "AuctionCancelled":
    case "AuctionSellerResult":
      return auctionId ? { kind: "link", href: ROUTES.seller.auctionResult(auctionId), label: "Xem kết quả phiên" } : null;

    case "AuctionWinnerOffer": {
      if (!auctionId) return null;
      const expiresAt = id(payload, "expiresAt");
      if (expiresAt && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) <= now)
        return { kind: "unavailable", reason: "Lời mời này đã hết hạn." };
      // The invitations (accept or decline) are listed in the buyer's auction page.
      return { kind: "link", href: ROUTES.buyer.auctions, label: "Xem lời mời" };
    }

    case "AuctionWatchlistBid":
      return auctionId ? { kind: "link", href: ROUTES.auction.room(auctionId), label: "Vào phòng đấu giá" } : null;

    case "AuctionDeposit":
      return { kind: "link", href: ROUTES.buyer.deposits, label: "Xem cọc của tôi" };

    // The seller decides a below-reserve price on the result page of the auction.
    case "AuctionReserveApprovalNeeded":
      return auctionId ? { kind: "link", href: ROUTES.seller.auctionResult(auctionId), label: "Duyệt giá dưới sàn" } : null;

    case "AuctionReserveRestriction":
      return { kind: "link", href: ROUTES.seller.auctions, label: "Xem phiên đấu giá của tôi" };

    case "WithdrawalResult":
      return { kind: "link", href: viewer === "seller" ? ROUTES.seller.withdrawals : ROUTES.buyer.wallet, label: "Xem yêu cầu rút tiền" };

    case "ProductBannedByReport":
    case "ProductApproved":
    case "ProductRejected":
    case "ProductSuspended":
    case "ProductBanned":
      return {
        kind: "link",
        href: productId ? ROUTES.seller.product(productId) : ROUTES.seller.products,
        label: "Xem sản phẩm của tôi",
      };

    case "AuctionReportResolved":
    case "ProductReportResolved":
    case "ProductReportDismissed":
      return { kind: "link", href: ROUTES.buyer.reports, label: "Xem báo cáo của tôi" };

    case "OrderRefunded":
      return { kind: "link", href: viewer === "seller" ? ROUTES.seller.refunds : ROUTES.buyer.refunds, label: "Xem hoàn tiền" };

    case "ReputationPenalty":
      return { kind: "link", href: ROUTES.buyer.reputation, label: "Xem điểm uy tín" };

    case "SecurityAlert": {
      const kind = id(payload, "kind");
      if (kind === "SellerDecision") {
        return id(payload, "decision") === "Approved"
          ? { kind: "link", href: ROUTES.seller.shop, label: "Vào kênh người bán" }
          : { kind: "link", href: ROUTES.buyer.becomeSeller, label: "Xem hồ sơ đăng ký" };
      }
      if (kind === "PasswordChange") {
        return { kind: "link", href: ROUTES.auth.sessions, label: "Kiểm tra phiên đăng nhập" };
      }
      if (kind === "AccountStatus") {
        return { kind: "link", href: ROUTES.auth.profile, label: "Xem tài khoản" };
      }
      return null;
    }

    case "NewProductReview":
      return {
        kind: "link",
        href: productId ? ROUTES.seller.product(productId) : ROUTES.seller.reviews,
        label: "Xem đánh giá",
      };

    case "ReviewHidden":
      return {
        kind: "link",
        href: productId ? ROUTES.catalog.product(productId) : ROUTES.buyer.orders,
        label: "Xem chi tiết",
      };

    case "Promotion":
      return { kind: "link", href: ROUTES.home, label: "Khám phá ưu đãi" };

    default:
      return null;
  }
}
