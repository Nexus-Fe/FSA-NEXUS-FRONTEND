"use client";

import Link from "next/link";
import { useState } from "react";
import { BackendImage } from "@/components/ui/BackendImage";
import { Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { formatMoney, resolveImageUrl } from "@/lib/presentation";
import { statusLabel } from "./contract";
import { auctionService } from "./services/auction.service";
import { LoadingState } from "@/components/ui/States";

/** The auctions the buyer follows: turn new-bid notices on or off, or stop following. */
export function MyWatchlistScreen() {
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const list = useApiResource(`my-watchlist:${page}`, (signal) => auctionService.myWatchlist(page, signal));

  async function run(id: string, action: () => Promise<unknown>) {
    if (busyId) return;
    setBusyId(id); setError("");
    try { await action(); list.reload(); }
    catch (cause) { setError(formatError(describeError(cause, { operation: "write" }))); }
    finally { setBusyId(null); }
  }

  return <div className="auction-surface">
    <PageHeading title="Theo dõi phiên" description="Các phiên bạn đang theo dõi. Bật thông báo để nhận tin khi có giá mới." />
    {error && <p className="notice" role="alert">{error}</p>}
    {list.error && <p className="notice" role="alert">{formatError(describeError(list.error, { operation: "read" }))} <button type="button" className="button button-secondary" onClick={list.reload}>Thử lại</button></p>}
    {list.loading && !list.data ? <LoadingState label="Đang tải danh sách theo dõi…" /> : list.data?.items.length ? <div className="auction-list-grid">
      {list.data.items.map((item) => <Card className="card-pad" key={item.auctionId}>
        <div className="auction-detail-image"><BackendImage src={resolveImageUrl(item.primaryImageUrl)} alt={item.productName ?? "Sản phẩm đấu giá"} /></div>
        <h2><Link href={ROUTES.auction.room(item.auctionId)}>{item.productName ?? "Sản phẩm chưa có tên"}</Link></h2>
        <Badge tone="slate">{statusLabel(item.status)}</Badge>
        <div className="info-row"><span>Giá hiện tại</span><strong>{formatMoney(item.currentPriceAmount ?? item.startPriceAmount)}</strong></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={item.notifyOnNewBid} disabled={busyId === item.auctionId} onChange={(event) => void run(item.auctionId, () => auctionService.watch(item.auctionId, event.target.checked))} />
          Nhận thông báo khi có giá mới
        </label>
        <div className="action-row"><button type="button" className="button button-secondary" disabled={busyId === item.auctionId} onClick={() => void run(item.auctionId, () => auctionService.unwatch(item.auctionId))}>Bỏ theo dõi</button></div>
      </Card>)}
    </div> : !list.error && <NoData title="Bạn chưa theo dõi phiên nào." />}
    {list.data && list.data.pagination.totalPages > 1 && <div className="action-row">
      <button className="button button-secondary" type="button" disabled={!list.data.pagination.hasPreviousPage || list.loading} onClick={() => setPage(page - 1)}>Trang trước</button>
      <span>Trang {list.data.pagination.pageIndex}/{list.data.pagination.totalPages}</span>
      <button className="button button-secondary" type="button" disabled={!list.data.pagination.hasNextPage || list.loading} onClick={() => setPage(page + 1)}>Trang sau</button>
    </div>}
  </div>;
}
