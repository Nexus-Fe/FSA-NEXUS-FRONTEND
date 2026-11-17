"use client";

import { useState } from "react";
import { Card, PageHeading } from "@/components/ui/Primitives";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";

type Policy = { version: number; tiers: Array<{ minReputation: number; maxReputation: number; ratePercent: number }>; newUserRatePercent: number; streakSurcharges: Array<{ streak: number; additionalPercent: number }>; maxRatePercent: number; minDepositAmount: number; forfeiture: { sellerPercent: number; platformPercent: number }; history?: Array<{ version: number; effectiveFrom: string; reason: string | null }> };

export function AdminDepositPolicy() {
  const policy = useApiResource("admin-auction-deposit-policy", (signal) => api.get<ApiResponse<Policy> | Policy>("/api/v1/admin/auction-configs/deposit-policy", { signal }).then(unwrap));
  const [reason, setReason] = useState("");
  const [minimum, setMinimum] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !policy.data) return;
    const minDepositAmount = minimum ? Number(minimum) : policy.data.minDepositAmount;
    if (!Number.isFinite(minDepositAmount) || minDepositAmount <= 0 || reason.trim().length < 5) { setError("Nhập mức cọc tối thiểu hợp lệ và lý do ít nhất 5 ký tự."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const current = policy.data;
      await api.put("/api/v1/admin/auction-configs/deposit-policy", { reason: reason.trim(), tiers: current.tiers, newUserRatePercent: current.newUserRatePercent, streakSurcharges: current.streakSurcharges, maxRatePercent: current.maxRatePercent, minDepositAmount, forfeiture: current.forfeiture }, { headers: { "If-Match": String(current.version) } });
      setNotice("Đã tạo phiên bản chính sách cọc mới."); setReason(""); setMinimum(""); policy.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được chính sách cọc."); }
    finally { setBusy(false); }
  }

  return <><PageHeading title="Chính sách đặt cọc đấu giá" description="Thay đổi chỉ áp dụng cho phiên được tạo sau khi phát hành phiên bản mới." />
    {policy.error && <p className="notice" role="alert">{policy.error.message}</p>}{error && <p className="notice" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    <div className="split"><Card className="card-pad"><h2>Chính sách hiện tại</h2>{policy.data ? <><p>Phiên bản {policy.data.version}</p><div className="info-row"><span>Cọc tối thiểu</span><strong>{formatMoney(policy.data.minDepositAmount)}</strong></div><div className="info-row"><span>Tỷ lệ người dùng mới</span><strong>{policy.data.newUserRatePercent}%</strong></div><div className="info-row"><span>Tỷ lệ tối đa</span><strong>{policy.data.maxRatePercent}%</strong></div><div className="info-row"><span>Phân bổ cọc bị giữ</span><strong>Seller {policy.data.forfeiture.sellerPercent}% · Nền tảng {policy.data.forfeiture.platformPercent}%</strong></div></> : <p>{policy.loading ? "Đang tải…" : "Chưa có chính sách"}</p>}</Card>
      <Card className="card-pad"><h2>Phát hành phiên bản mới</h2><form className="auth-fields" onSubmit={(event) => void submit(event)}><label className="field-wrap">Cọc tối thiểu (₫)<input className="field" type="number" min="1" step="1" placeholder={String(policy.data?.minDepositAmount ?? "")} value={minimum} onChange={(event) => setMinimum(event.target.value)} /></label><label className="field-wrap">Lý do thay đổi<textarea className="textarea-field" minLength={5} required value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="button button-primary" type="submit" disabled={busy || !policy.data}>{busy ? "Đang lưu…" : "Phát hành chính sách"}</button></form></Card></div>
    {policy.data?.history?.length ? <Card className="card-pad"><h2>Lịch sử phiên bản</h2>{policy.data.history.map((entry) => <div className="info-row" key={entry.version}><span>Phiên bản {entry.version}</span><strong>{entry.reason ?? "—"}</strong></div>)}</Card> : null}
  </>;
}
