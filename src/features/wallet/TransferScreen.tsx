"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Card, PageHeading } from "@/components/ui/Primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSession } from "@/components/auth/SessionProvider";
import { ROUTES } from "@/constants/routes";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { formatMoney } from "@/lib/presentation";
import { toTransferRequest, validateTransfer, type TransferErrors, type TransferForm } from "./transfer-rules";

type TransferResult = { transactionId: string; amount: number; status: string };

/**
 * Sends money to another wallet. The back end gives this call no Idempotency-Key and a repeat creates a second transfer, so after an
 * answer is lost the form locks and the user is sent to the wallet history instead of being offered a second try.
 */
export function TransferScreen() {
  const { user } = useSession();
  const [form, setForm] = useState<TransferForm>({ recipientUserId: "", amount: "", note: "" });
  const [errors, setErrors] = useState<TransferErrors>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>("");
  const [unknown, setUnknown] = useState(false);
  const [done, setDone] = useState<TransferResult | null>(null);

  function review(event: FormEvent) {
    event.preventDefault();
    const found = validateTransfer(form, user?.id);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setFailure("");
    setConfirming(true);
  }

  async function send() {
    if (busy || unknown) return;
    setBusy(true);
    setFailure("");
    try {
      const idempotencyKey = crypto.randomUUID();
      const result = unwrap(
        await api.post<ApiResponse<TransferResult> | TransferResult>(
          "/api/v1/wallets/transfers",
          toTransferRequest(form),
          { headers: { "Idempotency-Key": idempotencyKey } },
        ),
      );
      setDone(result);
      setConfirming(false);
    } catch (cause) {
      const described = describeError(cause, { operation: "write" });
      setFailure(formatError(described));
      if (described.kind === "unknown-outcome") setUnknown(true);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <PageHeading title="Đã chuyển tiền" />
        <Card className="card-pad">
          <p className="form-success" role="status">Đã chuyển {formatMoney(done.amount)}. Mã giao dịch: <strong className="mono">{done.transactionId}</strong></p>
          <div className="action-row"><Link className="button button-primary" href={ROUTES.buyer.wallet}>Về ví của tôi</Link></div>
        </Card>
      </>
    );
  }

  const field = (key: keyof TransferForm, label: string, props: { placeholder?: string; inputMode?: "numeric" | "text" } = {}) => (
    <label className="field-wrap">{label}
      <input className="field" value={form[key]} disabled={busy || unknown} aria-invalid={Boolean(errors[key])} placeholder={props.placeholder} inputMode={props.inputMode} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
      {errors[key] && <small className="checkout-field-error" role="alert">{errors[key]}</small>}
    </label>
  );

  return (
    <>
      <PageHeading
        title="Chuyển tiền giữa các ví"
        description="Chuyển tiền từ số dư khả dụng sang ví của người dùng khác. Thao tác không hoàn tác được."
        action={<Link className="button button-secondary button-small" href={ROUTES.buyer.wallet}>Quay lại ví</Link>}
      />
      <Card className="card-pad">
        <form className="auth-fields" onSubmit={review} noValidate>
          {field("recipientUserId", "Mã người nhận (UUID)", { placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" })}
          {field("amount", "Số tiền (₫)", { inputMode: "numeric", placeholder: "Từ 1.000 đến 100.000.000" })}
          {field("note", "Ghi chú (không bắt buộc)")}
          {failure && (
            <div className="notice" role="alert">
              <p>{failure}</p>
              {unknown && <p>Để tránh chuyển hai lần, biểu mẫu đã bị khóa. Hãy kiểm tra <Link href={ROUTES.buyer.wallet}>lịch sử ví</Link> trước khi làm gì khác.</p>}
            </div>
          )}
          <button type="submit" className="button button-primary" disabled={busy || unknown}>Xem lại và chuyển</button>
        </form>
      </Card>
      <ConfirmDialog open={confirming} title="Xác nhận chuyển tiền" confirmLabel="Chuyển tiền" busy={busy} onConfirm={() => void send()} onClose={() => setConfirming(false)}>
        <p>Chuyển <strong>{formatMoney(Number(form.amount.replace(/[.,\s]/g, "")) || 0)}</strong> tới người dùng <span className="mono">{form.recipientUserId.trim()}</span>?</p>
        <p>Thao tác không hoàn tác được. Người nhận phải đã có ví.</p>
      </ConfirmDialog>
    </>
  );
}
