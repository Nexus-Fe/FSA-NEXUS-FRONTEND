"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { walletService } from "./services/wallet.service";

function stripeCheckoutUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.href;
  } catch {
    // Keep the validation error consistent for malformed URLs.
  }
  throw new Error("Cổng thanh toán chưa trả đường dẫn HTTPS hợp lệ.");
}

function topupStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Chờ thanh toán",
    SUCCESS: "Thành công",
    FAILED: "Thất bại",
    EXPIRED: "Hết hạn",
  };
  return labels[status.toUpperCase()] ?? status;
}

function topupDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "Chưa rõ";
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function WalletTopUpForm() {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const submitting = useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value < 10000 || value > 99999999) {
      setError("Nhập số tiền nguyên từ 10.000 đến 99.999.999 ₫.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const topup = await walletService.deposit({ amount: value }, idempotencyKey);
      if (!topup.transactionId) throw new Error("Ví chưa trả mã giao dịch nạp tiền.");
      window.location.assign(stripeCheckoutUrl(topup.paymentUrl));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo yêu cầu nạp tiền.");
      setBusy(false);
      submitting.current = false;
    }
  }

  return <>
    <PageHeading title="Nạp tiền vào ví" description="Thanh toán qua Stripe. Số dư chỉ cập nhật sau khi ví xác nhận giao dịch." />
    <div className="split">
      <Card className="card-pad"><h2>Thông tin nạp tiền</h2>
        <form className="auth-fields" onSubmit={(event) => void submit(event)}>
          <label className="field-wrap">Số tiền (₫)<input className="field seller-money-input" type="number" min="10000" max="99999999" step="1" required inputMode="numeric" disabled={busy} value={amount} onChange={(event) => { setAmount(event.target.value); setIdempotencyKey(crypto.randomUUID()); }} /></label>
          {error && <p className="notice" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang tạo giao dịch…" : "Tiếp tục với Stripe"}</button>
        </form>
      </Card>
      <Card className="card-pad"><h2>Sau khi thanh toán</h2><p>Trở lại Nexus để kiểm tra trạng thái nạp. Nếu Stripe xử lý chậm, bạn có thể kiểm tra lại mà không tạo giao dịch mới.</p><Link href={ROUTES.buyer.topUps} className="button button-secondary">Xem lịch sử nạp tiền</Link></Card>
    </div>
  </>;
}

export function WalletTopUpResult({ transactionId = "", cancelled = false }: { transactionId?: string; cancelled?: boolean }) {
  const id = transactionId.trim();
  const validId = UUID_REGEX.test(id);
  const topup = useApiResource(validId ? `stripe-topup:${id}` : null, (signal) => walletService.topupStatus(id, signal));
  const status = topup.data?.status.toUpperCase();
  const success = status === "SUCCESS";
  const failed = status === "FAILED" || status === "EXPIRED";
  return <>
    <PageHeading title="Kết quả nạp tiền" description="Trạng thái được lấy trực tiếp từ ví Nexus." />
    <Card className="card-pad">
      {!validId ? <><p role="alert">{id ? "Mã giao dịch nạp tiền không hợp lệ." : "Chưa có mã giao dịch để kiểm tra."}</p><Link href={ROUTES.buyer.topUps}>Xem lịch sử nạp tiền</Link></>
        : <><h2>{topup.loading && !topup.data ? "Đang kiểm tra…" : topup.error ? "Chưa kiểm tra được giao dịch" : success ? "Nạp tiền thành công" : status === "EXPIRED" ? "Lượt nạp đã hết hạn" : failed ? "Giao dịch không thành công" : cancelled ? "Bạn đã rời Stripe trước khi thanh toán" : "Đang chờ xác nhận"}</h2>
          {cancelled && !success && !failed && <p>Lượt nạp này vẫn chờ xác nhận. Bạn có thể tiếp tục thanh toán trong lịch sử nạp tiền nếu phiên Stripe còn hiệu lực.</p>}
          {!cancelled && status === "PENDING" && <p>Stripe chưa xác nhận giao dịch với ví. Số dư chỉ tăng sau khi hệ thống nhận kết quả thanh toán; hãy kiểm tra lại sau.</p>}
          {topup.data && <><p>Mã giao dịch: <strong>{topup.data.transactionId}</strong></p><p>Số tiền: <strong className="seller-money-amount">{formatMoney(topup.data.amount)}</strong></p><p>Trạng thái: <strong>{topupStatusLabel(topup.data.status)}</strong></p></>}
          {topup.error && <p className="notice" role="alert">{topup.error.message}</p>}
          <div className="action-row"><button className="button button-secondary" type="button" disabled={topup.loading} onClick={topup.reload}>Kiểm tra lại</button><Link className="button button-secondary" href={ROUTES.buyer.topUps}>Lịch sử nạp</Link><Link className="button button-secondary" href={ROUTES.buyer.wallet}>Xem ví</Link></div>
        </>}
    </Card>
  </>;
}

export function WalletTopUpHistory() {
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const resuming = useRef(false);
  const topups = useApiResource(`wallet-topups:${page}`, (signal) => walletService.listTopups(page, signal));

  async function resume(id: string) {
    if (resuming.current) return;
    resuming.current = true;
    setBusyId(id);
    setError("");
    try {
      const result = await walletService.resumeTopup(id);
      if (result.transactionId.toLowerCase() !== id.toLowerCase()) {
        throw new Error("Mã giao dịch trả về không khớp yêu cầu.");
      }
      window.location.assign(stripeCheckoutUrl(result.paymentUrl));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tiếp tục thanh toán.");
      topups.reload();
      setBusyId("");
      resuming.current = false;
    }
  }

  return <>
    <PageHeading title="Lịch sử nạp tiền" description="Theo dõi từng lượt nạp Stripe và tiếp tục thanh toán khi phiên còn hiệu lực." />
    {error && <p className="notice" role="alert">{error}</p>}
    {topups.error && <p className="notice" role="alert">Không tải được lịch sử nạp: {topups.error.message}</p>}
    {topups.loading && !topups.data ? <NoData title="Đang tải lịch sử nạp…" /> : topups.data?.items.length ? (
      <Card><div className="table-scroll"><table className="data-table">
        <thead><tr><th>Thời gian</th><th>Mã giao dịch</th><th className="seller-money-cell">Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>{topups.data.items.map((item) => <tr key={item.transactionId}>
          <td>{topupDate(item.createdAt)}</td>
          <td><Link href={`${ROUTES.buyer.topUpResult}?transactionId=${encodeURIComponent(item.transactionId)}`}>{item.transactionId.slice(0, 8)}…</Link></td>
          <td className="seller-money-cell"><strong>{formatMoney(item.amount)}</strong></td>
          <td>{topupStatusLabel(item.status)}</td>
          <td>{item.canResume
            ? <button type="button" className="button button-secondary button-small" disabled={Boolean(busyId)} onClick={() => void resume(item.transactionId)}>{busyId === item.transactionId ? "Đang mở Stripe…" : "Tiếp tục thanh toán"}</button>
            : <Link className="button button-secondary button-small" href={`${ROUTES.buyer.topUpResult}?transactionId=${encodeURIComponent(item.transactionId)}`}>Chi tiết</Link>}</td>
        </tr>)}</tbody>
      </table></div></Card>
    ) : !topups.error && <Card><NoData title="Chưa có lượt nạp tiền" /></Card>}
    {topups.data && topups.data.pagination.totalPages > 1 && <nav className="action-row wallet-topups-pagination" aria-label="Trang lịch sử nạp tiền">
      <button type="button" className="button button-secondary" disabled={!topups.data.pagination.hasPreviousPage || topups.loading} onClick={() => setPage((current) => current - 1)}>Trang trước</button>
      <span>Trang {topups.data.pagination.pageIndex}/{topups.data.pagination.totalPages}</span>
      <button type="button" className="button button-secondary" disabled={!topups.data.pagination.hasNextPage || topups.loading} onClick={() => setPage((current) => current + 1)}>Trang sau</button>
    </nav>}
    <div className="action-row"><Link className="button button-primary" href={ROUTES.buyer.topUp}>Nạp tiền mới</Link><Link className="button button-secondary" href={ROUTES.buyer.wallet}>Về ví của tôi</Link></div>
  </>;
}
