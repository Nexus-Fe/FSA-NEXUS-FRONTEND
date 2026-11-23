"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ApiError } from "@/lib/api/client";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { useFeature } from "@/lib/features/FeatureProvider";
import { actionAllowed, buildTimeRequest, timeControlsService, type TimeAction } from "./time-controls";

const ACTIONS: Array<{ action: TimeAction; label: string }> = [
  { action: { kind: "open-now" }, label: "Mở ngay" },
  { action: { kind: "end-now" }, label: "Kết thúc ngay" },
  { action: { kind: "seller-approval-expired" }, label: "Hết hạn duyệt giá sàn" },
  { action: { kind: "payment-expired" }, label: "Hết hạn thanh toán" },
  { action: { kind: "second-chance-expired" }, label: "Hết hạn Second Chance" },
];

/**
 * QA / Time Controls for ONE auction. Admin only (the screen that hosts it is the admin one) and only while the `time-controls` feature is on.
 * The back end is the guard: where it has the controls switched off it answers 404 and this panel says so and stops.
 */
export function TimeControlsPanel({ auctionId, status, onApplied }: { auctionId: string; status: string; onApplied: () => void }) {
  const enabled = useFeature("time-controls");
  const [pending, setPending] = useState<{ action: TimeAction; label: string } | null>(null);
  const [seconds, setSeconds] = useState("60");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const [off, setOff] = useState(false);
  const [notice, setNotice] = useState("");
  if (!enabled) return null;

  function open(action: TimeAction, label: string) {
    setPending({ action, label });
    setProblem("");
    setFailure(null);
    setNotice("");
  }

  async function run() {
    if (!pending) return;
    const request = buildTimeRequest(pending.action, reason);
    if ("error" in request) { setProblem(request.error); return; }
    setProblem("");
    setBusy(true);
    setFailure(null);
    try {
      await timeControlsService.apply(auctionId, request);
      setNotice(`Đã áp dụng: ${pending.label}.`);
      setPending(null);
      setReason("");
      onApplied();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404 && (cause.errorCode === "NOT_FOUND" || !cause.errorCode)) {
        setOff(true);
        setPending(null);
      } else {
        setFailure(cause);
      }
    } finally {
      setBusy(false);
    }
  }

  const customSeconds: TimeAction = { kind: "remaining", seconds: Number(seconds) };
  return (
    <Card className="card-pad">
      <h2>QA / Time Controls</h2>
      <p className="notice">Chỉ dùng ở môi trường thử. Mỗi thao tác đổi thời gian của phiên thật và được ghi lại cùng lý do.</p>
      {off && <p className="notice" role="alert">Công cụ thử nghiệm chưa được bật ở máy chủ này (BE trả 404). Bật cả cờ BE và cờ FE rồi thử lại.</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}
      <div className="action-row">
        {ACTIONS.map(({ action, label }) => (
          <button key={action.kind} type="button" className="button button-secondary button-small" disabled={off || !actionAllowed(action, status)} onClick={() => open(action, label)}>{label}</button>
        ))}
      </div>
      <div className="action-row" style={{ marginTop: 10 }}>
        <label>Gia hạn còn (giây)<input className="field" type="number" min={0} max={86400} value={seconds} onChange={(event) => setSeconds(event.target.value)} /></label>
        <button type="button" className="button button-secondary button-small" disabled={off || !actionAllowed(customSeconds, status)} onClick={() => open(customSeconds, `Còn ${seconds} giây`)}>Đặt thời gian còn lại</button>
      </div>
      <ConfirmDialog open={pending !== null} title={`Xác nhận: ${pending?.label ?? ""}`} confirmLabel="Áp dụng" busy={busy} error={failure} onConfirm={() => void run()} onClose={() => setPending(null)}>
        <p>Thao tác đổi thời gian của phiên {auctionId.slice(0, 8)} và không hoàn tác được.</p>
        <label>Lý do (bắt buộc)<textarea className="field" rows={2} value={reason} disabled={busy} aria-invalid={Boolean(problem)} onChange={(event) => setReason(event.target.value)} /></label>
        {problem && <p className="form-error" role="alert">{problem}</p>}
        {failure != null && <p className="notice" role="alert">{formatError(describeError(failure, { operation: "write" }))}</p>}
      </ConfirmDialog>
    </Card>
  );
}
