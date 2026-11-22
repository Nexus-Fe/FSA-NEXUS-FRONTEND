"use client";

import { useState } from "react";
import { Card, PageHeading } from "@/components/ui/Primitives";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { describeError, formatError } from "@/lib/errors/error-messages";

type Report = { id: string; productId: string; productName: string; reason: string; description: string; status: string; evidenceImages: string[] | null; createdAt: string };
type ReportPage = { items: Report[]; pagination: { hasNextPage: boolean } };
type Action = "BAN_PRODUCT" | "DISMISS" | "INVESTIGATE";

export function StaffProductReportsScreen() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const reports = useApiResource(`staff-product-reports:${page}:${status}`, (signal) => api.get<ApiResponse<ReportPage> | ReportPage>(`/api/v1/admin/reports/products?page=${page}&pageSize=20${status ? `&status=${encodeURIComponent(status)}` : ""}`, { signal }).then(unwrap));

  async function decide(id: string, action: Action, resolutionNote: string) {
    if (busyId) return;
    setBusyId(id); setError(""); setNotice("");
    try {
      await api.put(`/api/v1/admin/reports/products/${encodeURIComponent(id)}/action`, { action, resolutionNote });
      setNotice("Đã cập nhật kết quả kiểm duyệt báo cáo.");
      reports.reload();
    } catch (cause) { setError(formatError(describeError(cause, { operation: "write" }))); }
    finally { setBusyId(""); }
  }

  return <><PageHeading title="Báo cáo sản phẩm" description="Xem bằng chứng và đưa ra quyết định cho từng báo cáo." />
    <label className="field-wrap">Trạng thái<select className="select-field" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả</option><option value="PENDING">Chờ xử lý</option><option value="INVESTIGATING">Đang xem xét</option><option value="RESOLVED">Đã xử lý</option><option value="DISMISSED">Đã bác</option></select></label>
    {error && <p className="notice" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}{reports.error && <p className="notice" role="alert">{reports.error.message} Cần kiểm tra định tuyến Gateway cho CatalogService.</p>}
    {reports.data?.items.length ? reports.data.items.map((report) => <ReportCard key={report.id} report={report} busy={Boolean(busyId)} decide={decide} />) : !reports.error && <Card className="card-pad"><p>{reports.loading ? "Đang tải báo cáo…" : "Chưa có báo cáo phù hợp."}</p></Card>}
    <div className="action-row"><button className="button button-secondary" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span><button className="button button-secondary" type="button" disabled={!reports.data?.pagination.hasNextPage} onClick={() => setPage(page + 1)}>Trang sau</button></div>
  </>;
}

function ReportCard({ report, busy, decide }: { report: Report; busy: boolean; decide: (id: string, action: Action, note: string) => Promise<void> }) {
  const [action, setAction] = useState<Action>("INVESTIGATE");
  const [note, setNote] = useState("");
  return <Card className="card-pad"><h2>{report.productName}</h2><p>{report.reason} · {report.status}</p><p>{report.description}</p><div className="action-row">{report.evidenceImages?.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">Xem ảnh bằng chứng</a>)}</div>
    <form className="auth-fields" onSubmit={(event) => { event.preventDefault(); void decide(report.id, action, note.trim()); }}><label className="field-wrap">Quyết định<select className="select-field" value={action} onChange={(event) => setAction(event.target.value as Action)}><option value="INVESTIGATE">Tiếp tục xem xét</option><option value="DISMISS">Bác báo cáo</option><option value="BAN_PRODUCT">Cấm bán sản phẩm</option></select></label><label className="field-wrap">Lý do xử lý<textarea className="textarea-field" minLength={5} maxLength={2000} required value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="button button-primary" type="submit" disabled={busy || note.trim().length < 5}>{busy ? "Đang xử lý…" : "Lưu quyết định"}</button></form>
  </Card>;
}
