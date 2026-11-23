"use client";

import { useState } from "react";
import { ErrorState } from "@/components/ui/States";
import { api, unwrap } from "@/lib/api/client";
import { describeWarehouseRetry } from "./warehouse-retry-rules";

/** Creates the warehouse of an approved seller whose warehouse failed at approval. Safe to repeat; the id is the seller profile id. */
export function StaffWarehouseRetry({ sellerProfileId }: { sellerProfileId: string }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState("");

  async function retry() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    setNotice("");
    try {
      const result = unwrap(await api.post<unknown>(`/api/v1/admin/sellers/${encodeURIComponent(sellerProfileId)}/warehouse/retry`, {}));
      setNotice(describeWarehouseRetry(result as { warehouseReady?: boolean } | null));
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return <div style={{ marginTop: 12 }}>
    <button type="button" className="button button-secondary" disabled={busy} onClick={() => void retry()}>{busy ? "Đang tạo kho…" : "Tạo lại kho cho người bán"}</button>
    {notice && <p className="form-success" role="status">{notice}</p>}
    {failure != null && <ErrorState cause={failure} operation="write" />}
  </div>;
}
