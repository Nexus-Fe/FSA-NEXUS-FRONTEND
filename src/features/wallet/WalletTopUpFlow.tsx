"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, PageHeading } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { walletService } from "./services/wallet.service";

const pendingKey = "nexus:stripe-topup-id";

export function WalletTopUpForm() {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value < 10000 || value > 99999999) {
      setError("Nhập số tiền nguyên từ 10.000 đến 99.999.999 ₫.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const topup = await walletService.deposit({ amount: value }, idempotencyKey);
      if (!topup.transactionId || !topup.paymentUrl || new URL(topup.paymentUrl).protocol !== "https:") {
        throw new Error("Cổng thanh toán chưa trả đường dẫn hợp lệ.");
      }
      sessionStorage.setItem(pendingKey, topup.transactionId);
      window.location.assign(topup.paymentUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo yêu cầu nạp tiền.");
      setBusy(false);
    }
  }

  return <>
    <PageHeading title="Nạp tiền vào ví" description="Thanh toán qua Stripe. Số dư chỉ cập nhật sau khi ví xác nhận giao dịch." />
    <div className="split">
      <Card className="card-pad"><h2>Thông tin nạp tiền</h2>
        <form className="auth-fields" onSubmit={(event) => void submit(event)}>
          <label className="field-wrap">Số tiền (₫)<input className="field seller-money-input" type="number" min="10000" max="99999999" step="1" required inputMode="numeric" value={amount} onChange={(event) => { setAmount(event.target.value); setIdempotencyKey(crypto.randomUUID()); }} /></label>
          {error && <p className="notice" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang tạo giao dịch…" : "Tiếp tục với Stripe"}</button>
        </form>
      </Card>
      <Card className="card-pad"><h2>Sau khi thanh toán</h2><p>Trở lại Nexus để kiểm tra trạng thái nạp. Nếu Stripe xử lý chậm, bạn có thể kiểm tra lại mà không tạo giao dịch mới.</p><Link href={ROUTES.buyer.topUpResult} className="button button-secondary">Kiểm tra giao dịch gần nhất</Link></Card>
    </div>
  </>;
}

export function WalletTopUpResult() {
  const [id] = useState(() => typeof window === "undefined" ? "" : sessionStorage.getItem(pendingKey) ?? "");
  const topup = useApiResource(id ? `stripe-topup:${id}` : null, (signal) => walletService.topupStatus(id, signal));
  const status = topup.data?.status.toUpperCase();
  const success = status === "SUCCESS";
  const failed = status === "FAILED" || status === "EXPIRED" || status === "CANCELLED";
  return <>
    <PageHeading title="Kết quả nạp tiền" description="Trạng thái được lấy trực tiếp từ ví Nexus." />
    <Card className="card-pad">
      {!id ? <p role="status">Chưa có mã giao dịch trong tab này. Hãy xem số dư ví hoặc bắt đầu yêu cầu nạp mới.</p>
        : <><h2>{topup.loading && !topup.data ? "Đang kiểm tra…" : success ? "Nạp tiền thành công" : failed ? "Giao dịch không thành công" : "Đang chờ xác nhận"}</h2>
          {topup.data && <><p>Mã giao dịch: <strong>{topup.data.transactionId}</strong></p><p>Số tiền: <strong className="seller-money-amount">{formatMoney(topup.data.amount)}</strong></p></>}
          {topup.error && <p className="notice" role="alert">{topup.error.message}</p>}
          <div className="action-row"><button className="button button-secondary" type="button" disabled={topup.loading} onClick={topup.reload}>Kiểm tra lại</button><Link className="button button-secondary" href={ROUTES.buyer.wallet}>Xem ví</Link></div>
        </>}
    </Card>
  </>;
}
