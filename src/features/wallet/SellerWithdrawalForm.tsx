"use client";

import { useRef, useState } from "react";
import { Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { ApiError } from "@/lib/api/client";
import { createIntentKeyStore, isDefiniteOutcome } from "@/lib/idempotency/intent-key";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { walletService } from "./services/wallet.service";
import { withdrawalService, withdrawalStatus } from "./services/withdrawal.service";
import type { WithdrawalResponse } from "./types";
import { transactionDate } from "./WalletScreen";

export function SellerWithdrawalForm() {
  const balance = useApiResource("seller-withdrawal-balance", (signal) => walletService.getBalance(signal));
  const [page, setPage] = useState(1);
  const requests = useApiResource(`seller-withdrawals:${page}`, (signal) => withdrawalService.mine(page, 10, undefined, signal));
  const [amount, setAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<WithdrawalResponse | null>(null);
  // One key per intent: a retry after a timeout or a double click is the same request to the server, not a second one.
  const intent = useRef(createIntentKeyStore());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
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
    const request = { amount: value, currency: "VND" as const, bankCode: bankCode.trim(), accountNumber: accountNumber.trim(), accountHolderName: accountHolderName.trim() };
    const key = intent.current.keyFor(JSON.stringify(request));
    setBusy(true); setError(""); setCreated(null);
    try {
      const response = await withdrawalService.create(request, key);
      intent.current.settle();
      setCreated(response);
      setAmount("");
      balance.reload();
      setPage(1);
      requests.reload();
    } catch (cause) {
      const status = cause instanceof ApiError ? cause.status : undefined;
      if (isDefiniteOutcome(status)) {
        intent.current.settle();
        setError(cause instanceof Error ? cause.message : "Không thể gửi yêu cầu rút tiền.");
      } else {
        // The outcome is unknown: the key is kept, so sending again cannot lock the money twice.
        setError("Chưa rõ yêu cầu đã được ghi nhận hay chưa. Bạn có thể bấm gửi lại: hệ thống sẽ không tạo yêu cầu thứ hai.");
      }
    } finally { setBusy(false); }
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
        <button className="button button-primary" type="submit" disabled={busy || !balance.data || balance.data.status.toUpperCase() !== "ACTIVE"}>{busy ? "Đang gửi…" : "Gửi yêu cầu rút"}</button>
      </form>
    </Card><Card className="card-pad seller-withdrawal-balance"><h2>Số dư có thể rút</h2>
      {balance.error && <p className="notice" role="alert">{balance.error.message}</p>}
      {balance.data ? <strong className="seller-money-amount">{formatMoney(balance.data.availableBalance)}</strong> : !balance.error && <NoData title={balance.loading ? "Đang tải số dư…" : "Chưa có dữ liệu"} />}
      {created && <div className="wallet-withdrawal-result" role="status"><h3>{created.status.toUpperCase() === "PENDING" ? "Đang chờ staff xử lý" : "Đã ghi nhận yêu cầu rút"}</h3><p>Mã yêu cầu: <strong>{created.withdrawalId}</strong></p><p>Số tiền: <strong>{formatMoney(created.amount)}</strong></p><p>Phí: {formatMoney(created.fee)}</p><p>Staff sẽ chuyển khoản thủ công sau khi duyệt. Trạng thái đã duyệt chưa xác nhận tiền đã được chuyển.</p></div>}
    </Card></div>

    <h2 className="section-title">Yêu cầu rút của bạn</h2>
    {requests.error && <p className="notice" role="alert">{requests.error.message} <button type="button" className="button button-secondary" onClick={requests.reload}>Thử lại</button></p>}
    {requests.loading && !requests.data ? <NoData title="Đang tải yêu cầu rút…" /> : requests.data?.items.length ? <Card>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Gửi lúc</th><th>Số tiền</th><th>Tài khoản nhận</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>
        {requests.data.items.map((item) => {
          const status = withdrawalStatus(item.status);
          return <tr key={item.withdrawalId}>
            <td>{transactionDate(item.requestedAt)}</td>
            <td>{formatMoney(item.amount)}</td>
            <td>{item.bankName} · {item.maskedAccountNumber}<br /><small>{item.accountHolderName}</small></td>
            <td><Badge tone={status.tone}>{status.label}</Badge></td>
            <td>{item.statusReason ? <>Lý do: {item.statusReason}</> : status.hint}{item.completedAt && <><br /><small>Chuyển lúc {transactionDate(item.completedAt)}</small></>}</td>
          </tr>;
        })}
      </tbody></table></div>
    </Card> : !requests.error && <NoData title="Bạn chưa có yêu cầu rút nào." />}
    {requests.data && requests.data.pagination.totalPages > 1 && <div className="action-row">
      <button className="button button-secondary" type="button" disabled={!requests.data.pagination.hasPreviousPage || requests.loading} onClick={() => setPage(page - 1)}>Trang trước</button>
      <span>Trang {requests.data.pagination.pageIndex}/{requests.data.pagination.totalPages}</span>
      <button className="button button-secondary" type="button" disabled={!requests.data.pagination.hasNextPage || requests.loading} onClick={() => setPage(page + 1)}>Trang sau</button>
    </div>}
  </>;
}
