"use client";

import Link from "next/link";
import { Card, NoData, PageHeading, SectionHeading, Badge } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { walletService } from "./services/wallet.service";
import { transactionDirection, transactionTypeLabel } from "./transaction-display";
import { ErrorState, LoadingState } from "@/components/ui/States";

export function transactionType(type: string): string {
  return transactionTypeLabel(type);
}

export function transactionStatus(status: string): string {
  return (
    {
      PENDING: "Đang xử lý",
      SUCCESS: "Thành công",
      COMPLETED: "Hoàn tất",
      FAILED: "Thất bại",
      CANCELLED: "Đã hủy",
    } as Record<string, string>
  )[status.toUpperCase()] ?? status;
}

export function transactionDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
    : "Chưa có dữ liệu";
}

export function WalletScreen() {
  const balance = useApiResource(
    "buyer-wallet-balance",
    (signal) => walletService.getBalance(signal),
  );
  const transactions = useApiResource(
    "buyer-wallet-transactions",
    (signal) => walletService.getTransactions(signal).then((response) => response.items),
  );
  const topups = useApiResource("buyer-pending-topups", (signal) => walletService.topups(1, 10, signal));
  const holds = useApiResource("buyer-auction-holds", (signal) => walletService.getHolds(signal));
  const pendingTopups = topups.data?.items.filter((item) => item.status.toUpperCase() === "PENDING") ?? [];
  const isReady = balance.data?.status?.toUpperCase() === "ACTIVE";

  return (
    <div className="color-indigo">
      <PageHeading title="Ví & lịch sử giao dịch" />

      <Card className="card-pad wallet-status">
        <div>
          <h2>Số dư ví</h2>
          {balance.error && <ErrorState title="Không tải được số dư" cause={balance.error} onRetry={balance.reload} />}
          {balance.loading ? (
            <LoadingState rows={2} label="Đang kiểm tra ví…" />
          ) : balance.data ? (
            <>
              <strong className="wallet-balance">{formatMoney(balance.data.balance)}</strong>
              <p className="status-note">Đang giữ cọc: <strong>{formatMoney(balance.data.lockedBalance)}</strong> · Có thể dùng: <strong>{formatMoney(balance.data.availableBalance)}</strong></p>
              <p className="status-note">
                Ví {isReady ? "đã sẵn sàng" : `đang ở trạng thái ${balance.data.status}`}
                {" · mã "}{balance.data.walletId}
              </p>
            </>
          ) : (
            !balance.error && <NoData title="Chưa xác nhận được ví" />
          )}
        </div>
      </Card>

      <div className="action-row wallet-actions">
        <Link className="button button-primary" href={ROUTES.buyer.topUp}>Nạp tiền vào ví</Link>
        <Link className="button button-secondary" href={ROUTES.buyer.transfer}>Chuyển tiền</Link>
        <Link className="button button-secondary" href={ROUTES.buyer.topUps}>Lịch sử nạp tiền</Link>
      </div>

      <Card className="card-pad wallet-pending-topups"><div className="section-heading"><div><h2>Cọc đấu giá đang giữ</h2><p>Khoản này chưa bị trừ khỏi ví nhưng không thể dùng để thanh toán hoặc rút.</p></div></div>
        {holds.error ? <ErrorState title="Không tải được danh sách cọc" cause={holds.error} onRetry={holds.reload} /> : holds.loading ? <LoadingState rows={2} label="Đang tải tiền cọc…" /> : holds.data?.items.length ? <ul className="wallet-pending-list">{holds.data.items.map((hold) => <li key={hold.holdId}><Link href={ROUTES.auction.room(hold.auctionId)}>Phiên đấu giá {hold.auctionId.slice(0, 8)}</Link><strong>{formatMoney(hold.amount)}</strong><Badge tone="amber">Đang giữ</Badge></li>)}</ul> : <p>Không có khoản cọc đang giữ.</p>}
      </Card>

      <Card className="card-pad wallet-pending-topups"><div className="section-heading"><div><h2>Lượt nạp đang chờ</h2><p>Thanh toán hoặc webhook có thể vẫn đang được xử lý.</p></div><Link href={ROUTES.buyer.topUps}>Xem tất cả lượt nạp</Link></div>
        {topups.error ? <ErrorState title="Không tải được lượt nạp" cause={topups.error} onRetry={topups.reload} /> : topups.loading ? <LoadingState rows={2} label="Đang tải lượt nạp…" /> : pendingTopups.length ? <ul className="wallet-pending-list">{pendingTopups.map((item) => <li key={item.transactionId}><span><Link href={ROUTES.buyer.topUpDetail(item.transactionId)}>{formatMoney(item.amount)}</Link>{item.createdAt && <small className="wallet-row-time"> · {new Date(item.createdAt).toLocaleString("vi-VN")}</small>}</span><Badge tone="amber">Đang xác nhận</Badge></li>)}</ul> : <p>Không có lượt nạp đang chờ trong 10 lượt gần nhất.</p>}
      </Card>

      <SectionHeading title="10 giao dịch gần nhất" />
      {transactions.error && <ErrorState title="Không tải được lịch sử" cause={transactions.error} onRetry={transactions.reload} />}

      {transactions.loading ? (
        <LoadingState label="Đang tải lịch sử…" />
      ) : transactions.data?.length ? (
        <Card>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Loại giao dịch</th>
                  <th>Nội dung</th>
                  <th style={{ textAlign: "right" }}>Số tiền</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {transactions.data.map((transaction) => {
                  const direction = transactionDirection(
                    transaction.type,
                    transaction.status,
                    transaction.amount,
                  );

                  return (
                    <tr key={transaction.id}>
                      <td>{transactionDate(transaction.createdAt)}</td>
                      <td>{transactionType(transaction.type)}</td>
                      <td>{transaction.note || "—"}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {direction ? (
                          <span className={`wallet-amount-badge wallet-amount-${direction}`}>
                            {direction === "credit" ? "+" : "−"}
                            {formatMoney(Math.abs(transaction.amount))}
                          </span>
                        ) : (
                          formatMoney(Math.abs(transaction.amount))
                        )}
                      </td>
                      <td>{transactionStatus(transaction.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        !transactions.error && <NoData title="Chưa có giao dịch" />
      )}

    </div>
  );
}
