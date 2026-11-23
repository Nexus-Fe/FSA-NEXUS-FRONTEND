"use client";

import Link from "next/link";
import { Badge, Card, NoData, PageHeading, SectionHeading } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { walletService } from "./services/wallet.service";
import { transactionDirection, transactionTypeLabel } from "./transaction-display";
import { WalletTopUpForm } from "./WalletTopUpFlow";
import { SellerWithdrawalForm } from "./SellerWithdrawalForm";
import { ErrorState } from "@/components/ui/States";


function sellerTransactionType(type: string): string {
  return transactionTypeLabel(type);
}

function sellerTransactionStatus(status: string): string {
  return ({ PENDING: "Đang xử lý", SUCCESS: "Thành công", COMPLETED: "Hoàn tất", FAILED: "Thất bại",
    CANCELLED: "Đã hủy" } as Record<string, string>)[status.toUpperCase()] ?? status;
}

const sellerTransactionDirection = transactionDirection;

function SellerTransactionAmount({ type, status, amount }: { type: string; status: string; amount: number }) {
  const direction = sellerTransactionDirection(type, status, amount);
  return <span className={`seller-money-amount${direction ? ` seller-money-${direction}` : ""}`}>
    {direction === "credit" ? "+" : direction === "debit" ? "−" : ""}{formatMoney(Math.abs(amount))}
  </span>;
}

function sellerTransactionDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "Chưa có dữ liệu";
}


export function BuyerTopUpScreen() {
  return <WalletTopUpForm />;
}

export function SellerWalletScreen() {
  const balance = useApiResource("seller-wallet-balance", (signal) => walletService.getBalance(signal));
  const transactions = useApiResource("seller-wallet-transactions", (signal) =>

    walletService.getTransactions(signal).then((response) => response.items));
  return <><PageHeading overline="Kênh người bán" title="Doanh thu & ví" description="Theo dõi số dư khả dụng, tiền đang giữ và doanh thu sau khi người mua xác nhận nhận hàng." />
    {balance.error && <ErrorState title="Không tải được số dư ví" cause={balance.error} onRetry={balance.reload} />}
    <div className="grid-3 seller-wallet-balances">
      <Card className="card-pad"><h2>Có thể rút</h2>{balance.data ? <strong>{formatMoney(balance.data.availableBalance)}</strong> : <NoData title={balance.loading ? "Đang tải số dư…" : "Chưa có dữ liệu"} />}</Card>
      <Card className="card-pad"><h2>Đang giữ</h2>{balance.data ? <strong>{formatMoney(balance.data.lockedBalance)}</strong> : <NoData title={balance.loading ? "Đang tải số dư…" : "Chưa có dữ liệu"} />}</Card>
      <Card className="card-pad"><h2>Tổng số dư</h2>{balance.data ? <strong>{formatMoney(balance.data.balance)}</strong> : <NoData title={balance.loading ? "Đang tải số dư…" : "Chưa có dữ liệu"} />}</Card>
    </div>
    {balance.data && <p className="status-note">Trạng thái ví: <Badge>{balance.data.status?.toUpperCase() === "ACTIVE" ? "Đang hoạt động" : balance.data.status}</Badge></p>}
    <SectionHeading title="Lịch sử doanh thu & giao dịch ví" />
    {transactions.error && <ErrorState title="Không tải được giao dịch" cause={transactions.error} onRetry={transactions.reload} />}
    {transactions.data?.length ? <Card><div className="table-scroll"><table className="data-table seller-money-table"><thead><tr><th scope="col">Thời gian</th><th scope="col">Loại</th><th scope="col">Nội dung</th><th scope="col" className="seller-money-cell">Số tiền</th><th scope="col">Trạng thái</th></tr></thead><tbody>{transactions.data.map((item) =>
      <tr key={item.id}><td>{sellerTransactionDate(item.createdAt)}</td><td>{sellerTransactionType(item.type)}</td><td>{item.note || "—"}</td><td className="seller-money-cell"><SellerTransactionAmount type={item.type} status={item.status} amount={item.amount} /></td><td>{sellerTransactionStatus(item.status)}</td></tr>)}</tbody></table></div></Card>
      : !transactions.error && <Card><NoData title={transactions.loading ? "Đang tải giao dịch…" : "Chưa có giao dịch"} /></Card>}
    <p className="status-note">Khi người mua xác nhận đã nhận hàng, tiền đơn hàng được giải ngân vào ví Seller. <Link href={ROUTES.seller.withdrawals}>Xem yêu cầu rút tiền</Link></p>
  </>;

}

export function SellerWithdrawalsScreen() {
  return <SellerWithdrawalForm />;
}
