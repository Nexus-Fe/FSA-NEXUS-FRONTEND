"use client";

import { useParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Card, PageHeading } from "@/components/ui/Primitives";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";

type Violation = { violationId: string; violationType: string | null; auctionId: string | null; streakAfter: number; depositForfeitedAmount: number; createdAt: string };
type Overview = { currentStreak: number; auctionRestriction: { isRestricted: boolean; type: string | null; until: string | null; reason: string | null }; violations: { items: Violation[] } };
type Action = "ResetStreak" | "SetStreak" | "ApplyRestriction" | "LiftRestriction" | "Suspend";

export function AdminAuctionViolations() {
  const userId = String(useParams<{ id: string }>().id ?? "");
  const isAdmin = usePathname().startsWith("/admin/");
  const overview = useApiResource(userId ? `auction-violations:${userId}` : null, (signal) => api.get<ApiResponse<Overview> | Overview>(`/api/v1/admin/users/${encodeURIComponent(userId)}/auction-violations?page=1&pageSize=20`, { signal }).then(unwrap));
  const [action, setAction] = useState<Action>("ResetStreak");
  const [value, setValue] = useState("");
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    if (reason.trim().length < 3 || (action === "SetStreak" && (!Number.isSafeInteger(Number(value)) || Number(value) < 0)) || (action === "ApplyRestriction" && !until)) { setError("Kiểm tra lý do, số lần vi phạm và thời hạn hạn chế."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await api.post(`/api/v1/admin/users/${encodeURIComponent(userId)}/auction-violations/adjust`, { action, value: action === "SetStreak" ? Number(value) : null, until: until ? new Date(until).toISOString() : null, reason: reason.trim() });
      setNotice("Đã cập nhật chế tài đấu giá."); overview.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được chế tài."); }
    finally { setBusy(false); }
  }

  return <><PageHeading title="Vi phạm đấu giá" description={`Tài khoản ${userId}`} />{overview.error && <p className="notice" role="alert">{overview.error.message}</p>}{error && <p className="notice" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    <div className="split"><Card className="card-pad"><h2>Trạng thái hiện tại</h2>{overview.data ? <><div className="info-row"><span>Chuỗi vi phạm</span><strong>{overview.data.currentStreak}</strong></div><div className="info-row"><span>Quyền đấu giá</span><strong>{overview.data.auctionRestriction.isRestricted ? "Đang bị hạn chế" : "Không hạn chế"}</strong></div><div className="info-row"><span>Hạn chế đến</span><strong>{overview.data.auctionRestriction.until ? new Date(overview.data.auctionRestriction.until).toLocaleString("vi-VN") : "—"}</strong></div></> : <p>{overview.loading ? "Đang tải…" : "Chưa có dữ liệu"}</p>}</Card>
      {isAdmin && <Card className="card-pad"><h2>Điều chỉnh chế tài</h2><form className="auth-fields" onSubmit={(event) => void submit(event)}><label className="field-wrap">Hành động<select className="select-field" value={action} onChange={(event) => setAction(event.target.value as Action)}><option value="ResetStreak">Đặt lại chuỗi vi phạm</option><option value="SetStreak">Đặt số lần vi phạm</option><option value="ApplyRestriction">Hạn chế đấu giá</option><option value="LiftRestriction">Gỡ hạn chế</option><option value="Suspend">Tạm đình chỉ</option></select></label>{action === "SetStreak" && <label className="field-wrap">Số lần vi phạm<input className="field" type="number" min="0" step="1" value={value} onChange={(event) => setValue(event.target.value)} /></label>}{["ApplyRestriction", "Suspend"].includes(action) && <label className="field-wrap">Thời hạn<input className="field" type="datetime-local" value={until} onChange={(event) => setUntil(event.target.value)} /></label>}<label className="field-wrap">Lý do<textarea className="textarea-field" required minLength={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu điều chỉnh"}</button></form></Card>}</div>
    <Card className="card-pad"><h2>Lịch sử vi phạm</h2>{overview.data?.violations.items.length ? overview.data.violations.items.map((item) => <div className="info-row" key={item.violationId}><span>{item.violationType ?? "Vi phạm"} · {new Date(item.createdAt).toLocaleDateString("vi-VN")}</span><strong>Streak {item.streakAfter}</strong></div>) : <p>Chưa có vi phạm được ghi nhận.</p>}</Card>
  </>;
}
