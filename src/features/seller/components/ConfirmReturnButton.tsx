"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { describeConfirmReturn, type ConfirmReturnResponse } from "../return-rules";

/** "Xác nhận đã nhận hàng hoàn": restores the held stock once. The id is the sub-order id. */
export function ConfirmReturnButton({ subOrderId, onDone }: { subOrderId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState("");

  async function confirm() {
    setBusy(true);
    setFailure(null);
    try {
      const response = unwrap(await api.post<ApiResponse<ConfirmReturnResponse> | ConfirmReturnResponse>(`/api/v1/seller/orders/${encodeURIComponent(subOrderId)}/confirm-return`, {}));
      setNotice(describeConfirmReturn(response).text);
      setOpen(false);
      onDone();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {notice && <p className="form-success" role="status">{notice}</p>}
      <button type="button" className="button button-secondary" onClick={() => { setFailure(null); setOpen(true); }}>Xác nhận đã nhận hàng hoàn</button>
      <ConfirmDialog open={open} title="Xác nhận đã nhận hàng hoàn?" confirmLabel="Xác nhận và cộng lại tồn" busy={busy} error={failure} onConfirm={() => void confirm()} onClose={() => setOpen(false)}>
        <p>Chỉ xác nhận khi bạn đã thực sự nhận lại kiện hàng. Tồn kho đang giữ cho đơn này sẽ được cộng lại một lần; bấm lại không cộng thêm.</p>
      </ConfirmDialog>
    </>
  );
}
