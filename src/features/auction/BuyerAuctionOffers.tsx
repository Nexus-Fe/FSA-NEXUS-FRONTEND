"use client";

import { useEffect, useRef, useState } from "react";
import { AdminPagination, Badge, ButtonLink, Card } from "@/components/ui/Primitives";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { offerStatusLabel } from "./auction-outcome";
import { auctionService } from "./services/auction.service";
import { describeError, formatError } from "@/lib/errors/error-messages";

export function BuyerAuctionOffers() {
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pendingActions = useRef(new Map<string, string>());
  const offers = useApiResource(`buyer-auction-offers:${page}`, (signal) => auctionService.myOffers(page, signal).then((response) => response.data));
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  async function respond(auctionId: string, offerId: string, offerPrice: number, accept: boolean) {
    setBusy(offerId); setError(""); setNotice("");
    try {
      const current = await auctionService.mySecondChance(auctionId);
      if (current.offerId !== offerId || current.status.toUpperCase() !== "OFFERED" || (now > 0 && new Date(current.respondBy).getTime() <= now) || current.offerPrice !== offerPrice) throw new Error("Lời mời đã thay đổi hoặc hết hạn. Hãy tải lại danh sách.");
      const action = `${offerId}:${accept ? "accept" : "decline"}`;
      const key = pendingActions.current.get(action) ?? crypto.randomUUID();
      pendingActions.current.set(action, key);
      if (accept) await auctionService.acceptOffer(auctionId, current.offerPrice, key);
      else await auctionService.declineOffer(auctionId, key);
      pendingActions.current.delete(action);
      setNotice(accept ? "Đã chấp nhận lời mời. Xem kết quả phiên để theo dõi đơn." : "Đã từ chối lời mời.");
      offers.reload();
    } catch (cause) { setError(formatError(describeError(cause, { operation: "write" }))); }
    finally { setBusy(null); }
  }

  return <section className="auction-offers" aria-labelledby="auction-offers-title">
    <div className="auction-section-heading"><div><h2 id="auction-offers-title">Lời mời tiếp nhận kết quả</h2><p>Hệ thống có thể mời bạn khi người thắng trước không hoàn tất.</p></div><button type="button" className="button button-secondary button-small" onClick={offers.reload}>Làm mới</button></div>
    {offers.error && <ErrorState title="Không tải được lời mời" cause={offers.error} onRetry={offers.reload} />}{error && <p className="notice" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {offers.loading && !offers.data ? <LoadingState label="Đang tải lời mời…" /> : offers.data?.items.length ? <div className="auction-offer-list">{offers.data.items.map((offer) => {
      const expired = offer.isExpired || Boolean(now && new Date(offer.expiresAt).getTime() <= now);
      const pending = offer.status.toUpperCase() === "PENDING" && !expired;
      return <Card className="card-pad" key={offer.offerId}><div className="auction-offer-header"><h3>{offer.auctionTitle}</h3><Badge tone={pending ? "sky" : offer.status.toUpperCase() === "ACCEPTED" ? "green" : "slate"}>{pending ? "Chờ phản hồi" : expired && offer.status.toUpperCase() === "PENDING" ? "Đã hết hạn" : offerStatusLabel(offer.status)}</Badge></div><div className="info-row"><span>Giá đặt</span><strong className="tabular-nums">{formatMoney(offer.amount)}</strong></div><div className="info-row"><span>Hạn phản hồi</span><strong>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(offer.expiresAt))}</strong></div><div className="action-row"><ButtonLink href={ROUTES.buyer.auctionResult(offer.auctionId)} variant="secondary" small>Xem kết quả</ButtonLink>{pending && <><button type="button" className="button button-primary button-small" disabled={busy !== null} onClick={() => void respond(offer.auctionId, offer.offerId, offer.amount, true)}>{busy === offer.offerId ? "Đang xử lý…" : "Chấp nhận"}</button><button type="button" className="button button-secondary button-small" disabled={busy !== null} onClick={() => void respond(offer.auctionId, offer.offerId, offer.amount, false)}>Từ chối</button></>}</div></Card>;
    })}</div> : !offers.error && <p className="auction-empty-inline">Bạn chưa có lời mời nào.</p>}
    {offers.data && offers.data.pagination.totalPages > 1 && <AdminPagination page={page} pageSize={offers.data.pagination.pageSize} totalItems={offers.data.pagination.totalCount} totalPages={offers.data.pagination.totalPages} onPageChange={setPage} itemLabel="lời mời" />}
  </section>;
}
