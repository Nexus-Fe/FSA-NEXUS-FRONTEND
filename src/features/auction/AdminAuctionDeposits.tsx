"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Badge, Card, PageHeading } from "@/components/ui/Primitives";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { AUCTION_DEPOSIT_STATUS, statusLabel } from "@/lib/status-labels";

function depositTone(status: string): "green" | "amber" | "red" | "slate" {
  const s = status.toUpperCase();
  if (s === "RELEASED" || s === "CAPTURED") return "green";
  if (s === "AUTHORIZED" || s === "PENDING") return "amber";
  if (s === "FAILED" || s === "EXPIRED") return "red";
  return "slate";
}

type Deposit = { depositId: string; bidderId: string; amount: number; status: string; needsAttention: boolean; pendingAction: string | null };
type DepositPage = { auctionId: string; summary: { total: number; authorized: number; released: number; captured: number; failed: number; amountHeld: number }; items: Deposit[]; page: number; totalItems: number };

export function AdminAuctionDeposits() {
  const id = String(useParams<{ id: string }>().id ?? "");
  const role = usePathname().startsWith("/staff/") ? "staff" : "admin";
  const deposits = useApiResource(id ? `admin-auction-deposits:${id}` : null, (signal) => api.get<ApiResponse<DepositPage> | DepositPage>(`/api/v1/admin/auctions/${encodeURIComponent(id)}/deposits?page=1&pageSize=100`, { signal }).then(unwrap));
  return <><PageHeading title="Đặt cọc của phiên" description={`Phiên ${id}`} action={<button className="button button-secondary" type="button" disabled={deposits.loading} onClick={deposits.reload}>Kiểm tra lại</button>} />
    {deposits.error && <p className="notice" role="alert">{deposits.error.message}</p>}
    <Card className="card-pad">{deposits.data ? <><div className="info-row"><span>Tổng cọc</span><strong>{deposits.data.summary.total}</strong></div><div className="info-row"><span>Đang giữ</span><strong>{formatMoney(deposits.data.summary.amountHeld)}</strong></div><div className="info-row"><span>Cần kiểm tra</span><strong>{deposits.data.items.filter((item) => item.needsAttention).length}</strong></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Người tham gia</th><th>Số tiền</th><th>Trạng thái</th><th>Đối soát</th></tr></thead><tbody>{deposits.data.items.map((item) => <tr key={item.depositId}><td><Link href={`/${role}/users/${encodeURIComponent(item.bidderId)}/auction-violations`}>{item.bidderId}</Link></td><td>{formatMoney(item.amount)}</td><td><Badge tone={depositTone(item.status)}>{statusLabel(AUCTION_DEPOSIT_STATUS, item.status)}</Badge></td><td>{item.needsAttention ? item.pendingAction ?? "Cần kiểm tra" : "—"}</td></tr>)}</tbody></table></div></> : <p>{deposits.loading ? "Đang tải cọc…" : "Chưa có dữ liệu cọc"}</p>}</Card>
  </>;
}
