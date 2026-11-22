"use client";

import { useState, type FormEvent } from "react";
import { Card, PageHeading } from "@/components/ui/Primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataState } from "@/components/ui/States";
import { useApiResource } from "@/lib/api/use-api-resource";
import { checkPlatformFee } from "./finance-rules";
import { financeService } from "./finance.service";

/** Current platform fee and the form that changes it. Applies to new wallet orders only; cash on delivery is fixed by the back end. */
export function PlatformFeeScreen() {
  const fee = useApiResource("admin-platform-fee", (signal) => financeService.platformFee(signal));
  const [input, setInput] = useState("");
  const [problem, setProblem] = useState("");
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState("");

  function ask(event: FormEvent) {
    event.preventDefault();
    const check = checkPlatformFee(input);
    if (!check.ok) { setProblem(check.message); return; }
    setProblem("");
    setNotice("");
    setFailure(null);
    setPending(check.percent);
  }

  async function save() {
    if (pending === null) return;
    setBusy(true);
    setFailure(null);
    try {
      const saved = await financeService.updatePlatformFee(pending);
      setNotice(`Đã đặt phí nền tảng ${saved.defaultPercent}%. Chỉ áp dụng cho đơn mới thanh toán bằng ví.`);
      setPending(null);
      setInput("");
      fee.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading title="Phí nền tảng" description="Phần trăm sàn thu trên đơn thanh toán bằng ví." />
      {notice && <p className="form-success" role="status">{notice}</p>}
      <DataState loading={fee.loading} error={fee.error} empty={!fee.data} onRetry={fee.reload}>
        {fee.data && (
          <div className="split">
            <Card className="card-pad">
              <h2>Hiện hành</h2>
              <div className="info-row"><span>Phí đơn ví</span><strong>{fee.data.defaultPercent}%</strong></div>
              <div className="info-row"><span>Đơn thanh toán khi nhận hàng (COD)</span><strong>{fee.data.codPercent}% (cố định)</strong></div>
              <div className="info-row"><span>Cập nhật lần cuối</span><strong>{new Date(fee.data.updatedAt).toLocaleString("vi-VN")} · {fee.data.updatedByRole === "system" ? "hệ thống" : fee.data.updatedByRole}</strong></div>
              <p>Đơn đã tạo giữ nguyên mức phí lúc báo giá. Phí được trừ vào phần người bán nhận, không cộng vào số tiền người mua trả.</p>
            </Card>
            <Card className="card-pad">
              <h2>Đổi phí đơn ví</h2>
              <form onSubmit={ask} noValidate className="voucher-form">
                <label>Tỷ lệ mới (%)<input className="field" inputMode="decimal" value={input} aria-invalid={Boolean(problem)} onChange={(event) => setInput(event.target.value)} placeholder="Ví dụ: 5" /></label>
                {problem && <p className="form-error" role="alert">{problem}</p>}
                <button type="submit" className="button button-primary">Xem lại và lưu</button>
              </form>
            </Card>
          </div>
        )}
      </DataState>
      <ConfirmDialog open={pending !== null} title="Đổi phí nền tảng?" confirmLabel="Lưu phí mới" busy={busy} error={failure} onConfirm={() => void save()} onClose={() => setPending(null)}>
        <p>Phí đơn ví sẽ đổi từ <strong>{fee.data?.defaultPercent}%</strong> thành <strong>{pending}%</strong>. Chỉ đơn mới tạo sau thời điểm này bị ảnh hưởng.</p>
      </ConfirmDialog>
    </>
  );
}
