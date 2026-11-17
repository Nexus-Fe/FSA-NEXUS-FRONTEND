"use client";

import { useRef, useState } from "react";
import { Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { ApiError } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { walletService } from "./services/wallet.service";
import type { WithdrawalResponse } from "./types";

export function SellerWithdrawalForm() {
  const balance = useApiResource("seller-withdrawal-balance", (signal) => walletService.getBalance(signal));
  const [amount, setAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<WithdrawalResponse | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || outcomeUnknown) return;
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value < 50000 || value > 500000000) {
      setError("Nhập số tiền nguyên từ 50.000 đến 500.000.000 ₫.");
      return;
    }
    if (!balance.data || value > balance.data.availableBalance) {
      setError("Số tiền vượt số dư có thể rút. Hãy kiểm tra lại ví.");
      return;
    }
    if (!bankCode.trim() || !accountNumber.trim() || !accountHolderName.trim()) {
      setError("Điền đầy đủ ngân hàng, số tài khoản và tên chủ tài khoản.");
      return;
    }
    submitting.current = true;
    setBusy(true); setError(""); setCreated(null);
    try {
      const response = await walletService.withdraw({ amount: value, currency: "VND", bankCode: bankCode.trim(), accountNumber: accountNumber.trim(), accountHolderName: accountHolderName.trim() });
      setCreated(response);
      setAmount("");
      balance.reload();
    } catch (cause) {
      if (cause instanceof TypeError || cause instanceof ApiError && cause.status >= 500) {
        setOutcomeUnknown(true);
        setError("Chưa xác định yêu cầu đã được ghi nhận hay chưa do mất kết nối. Không gửi lại trước khi đối chiếu với bộ phận hỗ trợ.");
      } else {
        setError(cause instanceof Error ? cause.message : "Không thể gửi yêu cầu rút tiền.");
      }
    } finally { submitting.current = false; setBusy(false); }
  }

  return <>
    <PageHeading title="Yêu cầu rút tiền" description="Staff sẽ duyệt yêu cầu và chuyển khoản thủ công. Đã duyệt chưa có nghĩa là đã chuyển tiền." />
    <div className="split"><Card className="card-pad"><h2>Tài khoản nhận tiền</h2>
      <form className="auth-fields" onSubmit={(event) => void submit(event)}>
        <div className="form-grid"><label className="field-wrap">Số tiền (₫)<input className="field seller-money-input" type="number" min="50000" max="500000000" step="1" inputMode="numeric" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <label className="field-wrap">Ngân hàng<input className="field" required maxLength={150} value={bankCode} onChange={(event) => setBankCode(event.target.value)} /></label>
          <label className="field-wrap">Số tài khoản<input className="field" required maxLength={100} inputMode="numeric" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} /></label>
          <label className="field-wrap">Tên chủ tài khoản<input className="field" required maxLength={255} value={accountHolderName} onChange={(event) => setAccountHolderName(event.target.value)} /></label></div>
        {error && <p className="notice" role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={busy || outcomeUnknown || !balance.data || balance.data.status.toUpperCase() !== "ACTIVE"}>{busy ? "Đang gửi…" : "Gửi yêu cầu rút"}</button>
      </form>
    </Card><Card className="card-pad seller-withdrawal-balance"><h2>Số dư có thể rút</h2>
      {balance.error && <p className="notice" role="alert">{balance.error.message}</p>}
      {balance.data ? <strong className="seller-money-amount">{formatMoney(balance.data.availableBalance)}</strong> : !balance.error && <NoData title={balance.loading ? "Đang tải số dư…" : "Chưa có dữ liệu"} />}
      {created && <div role="status"><h3>Đang chờ staff xử lý</h3><p>Mã yêu cầu: <strong>{created.withdrawalId}</strong></p><p>Số tiền: {formatMoney(created.amount)} · Phí: {formatMoney(created.fee)}</p></div>}
      <p className="status-note">Lịch sử yêu cầu đang chờ backend cung cấp API. Giao dịch ví chỉ hiển thị khoản đã ghi sổ.</p>
    </Card></div>
  </>;
}
