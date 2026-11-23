"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Badge, Card, NoData, PageHeading, SectionHeading } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { ApiError } from "@/lib/api/client";
import { formatMoney } from "@/lib/presentation";
import { adminLedgerService, type BalanceAdjustmentResponse } from "./services/admin-ledger.service";
import { isWalletId } from "./wallet-id";


export function AdminLedgerScreen() {
  const [walletId, setWalletId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"Credit" | "Debit">("Credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [history, setHistory] = useState<Array<BalanceAdjustmentResponse & { adjustmentType: "Credit" | "Debit" }>>([]);

  async function handleAdjustBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const id = walletId.trim();
    const value = Number(amount);
    if (!isWalletId(id)) { setError("Mã ví điện tử phải đúng định dạng UUID."); return; }
    if (!Number.isSafeInteger(value) || value <= 0) { setError("Số tiền điều chỉnh phải là số nguyên dương."); return; }
    if (!reason.trim()) { setError("Vui lòng nhập lý do hoặc căn cứ đối soát."); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      const result = await adminLedgerService.adjustBalance(id, { amount: value, adjustmentType, reason: reason.trim() });
      setHistory((current) => [{ ...result, adjustmentType }, ...current]);
      setSuccess(`Đã ghi bút toán cho ví ${result.walletId}. Số dư mới: ${formatMoney(result.balanceAfter)}.`);
      setWalletId(""); setAmount(""); setReason("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : "Không thể điều chỉnh số dư ví.");
    } finally { setBusy(false); }
  }

  return <>
    <PageHeading overline="Quản trị hệ thống" title="Điều chỉnh số dư ví" description="Ghi nhận bút toán tăng hoặc giảm số dư kèm lý do đối soát." action={<Link className="button button-secondary" href={ROUTES.admin.withdrawals}>Duyệt rút tiền</Link>} />
    <Card className="card-pad">
      <SectionHeading title="Bút toán điều chỉnh" hint="Thay đổi số dư sẽ được ghi nhận vào sổ cái." />
      {error && <p className="notice" role="alert">{error}</p>}
      {success && <p className="form-success" role="status">{success}</p>}
      <form className="auth-fields" onSubmit={(event) => void handleAdjustBalance(event)}>
        <label className="field-wrap">Mã ví điện tử (Wallet ID)<input className="field" required value={walletId} onChange={(event) => setWalletId(event.target.value)} placeholder="UUID của ví" /></label>
        <div className="split">
          <label className="field-wrap">Loại bút toán<select className="select-field" value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as "Credit" | "Debit")}><option value="Credit">Cộng tiền vào ví</option><option value="Debit">Trừ tiền khỏi ví</option></select></label>
          <label className="field-wrap">Số tiền (₫)<input className="field" type="number" min="1" step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        </div>
        <label className="field-wrap">Lý do đối soát<textarea className="textarea-field" required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang ghi sổ cái…" : "Thực thi bút toán điều chỉnh"}</button>
      </form>
    </Card>
    <SectionHeading title="Bút toán vừa thực hiện" hint="Danh sách trong phiên làm việc hiện tại." />
    <Card>{history.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Loại</th><th>Mã bút toán</th><th>Mã ví</th><th>Số dư sau điều chỉnh</th><th>Thời điểm</th></tr></thead><tbody>{history.map((item) => <tr key={item.adjustmentId}><td><Badge tone={item.adjustmentType === "Credit" ? "green" : "amber"}>{item.adjustmentType === "Credit" ? "Cộng tiền" : "Trừ tiền"}</Badge></td><td><code>{item.adjustmentId}</code></td><td><code>{item.walletId}</code></td><td>{formatMoney(item.balanceAfter)}</td><td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td></tr>)}</tbody></table></div> : <NoData title="Chưa có bút toán nào trong phiên này" />}</Card>
  </>;
}
