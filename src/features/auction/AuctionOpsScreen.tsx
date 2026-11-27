"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminPagination, Badge, Card, PageHeading, TruncatedText } from "@/components/ui/Primitives";
import { CopyableId } from "@/components/ui/CopyableId";
import { ThumbnailBox } from "@/components/ui/BackendImage";
import { FluidChoiceBar } from "@/components/ui/FluidChoiceBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataState } from "@/components/ui/States";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney, resolveImageUrl } from "@/lib/presentation";
import { auctionStatusTone, statusLabel } from "./contract";
import { attentionReasons, auctionOpsService, checkOpsReason, type AuctionReport } from "./ops.service";

type Tab = "attention" | "reports";

/** Auction operations for admin and staff: auctions needing attention, and the reports buyers filed. Detail actions live on the auction page. */
export function AuctionOpsScreen({ role }: { role: "admin" | "staff" }) {
  const [tab, setTab] = useState<Tab>("attention");
  return (
    <>
      <PageHeading title="Vận hành đấu giá" description="Phiên cần chú ý và báo cáo từ người dùng." />
      <FluidChoiceBar compact ariaLabel="Vận hành đấu giá" options={[{ value: "attention", label: "Cần chú ý" }, { value: "reports", label: "Báo cáo đấu giá" }]} value={tab} onChange={setTab} />
      {tab === "attention" ? <AttentionTab role={role} /> : <ReportsTab />}
    </>
  );
}

function AttentionTab({ role }: { role: "admin" | "staff" }) {
  const [page, setPage] = useState(1);
  const list = useApiResource(`ops-attention:${page}`, (signal) => auctionOpsService.attention(page, signal));
  return (
    <Card>
      <DataState loading={list.loading} error={list.error} empty={!list.data?.items.length} emptyTitle="Không có phiên nào cần chú ý" onRetry={list.reload}>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th style={{ width: 64 }}>Ảnh</th><th>Phiên</th><th>Trạng thái</th><th>Giá hiện tại</th><th>Vấn đề</th><th>Mở</th></tr></thead>
            <tbody>
              {list.data?.items.map((item) => (
                <tr key={item.auctionId}>
                  <td>
                    <ThumbnailBox
                      src={resolveImageUrl(item.primaryImageUrl ?? null)}
                      alt={item.productName ?? "Sản phẩm đấu giá"}
                    />
                  </td>
                  <td>
                    <strong><TruncatedText text={item.productName ?? "Sản phẩm chưa có tên"} label="Sản phẩm đấu giá" maxWidth={240} /></strong>
                    <div style={{ marginTop: 4 }}><CopyableId id={item.auctionId} /></div>
                  </td>
                  <td><Badge tone={auctionStatusTone(item.status)}>{statusLabel(item.status)}</Badge></td>
                  <td className="tabular-nums">{formatMoney(item.currentPriceAmount ?? item.startPriceAmount)}</td>
                  <td>{attentionReasons(item).map((reason) => <Badge key={reason} tone="amber">{reason}</Badge>)}</td>
                  <td><Link className="button button-secondary button-small" href={`/${role}/auctions/${encodeURIComponent(item.auctionId)}`}>Xử lý</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
      {list.data && list.data.pagination.totalPages > 1 && <AdminPagination page={page} pageSize={list.data.pagination.pageSize} totalItems={list.data.pagination.totalCount} totalPages={list.data.pagination.totalPages} onPageChange={setPage} itemLabel="phiên" />}
    </Card>
  );
}

function ReportsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const list = useApiResource(`ops-reports:${page}:${status}`, (signal) => auctionOpsService.reports(page, status, signal));
  const [target, setTarget] = useState<AuctionReport | null>(null);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState("");

  async function dismiss() {
    if (!target) return;
    const issue = checkOpsReason(note);
    if (issue) { setProblem(issue); return; }
    setProblem("");
    setBusy(true);
    setFailure(null);
    try {
      const result = await auctionOpsService.dismissReports(target.auctionId, note.trim());
      setNotice(`Đã bác ${result.dismissedCount} báo cáo của phiên này và báo lại cho người gửi.`);
      setTarget(null);
      setNote("");
      list.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {notice && <p className="form-success" role="status">{notice}</p>}
      <Card className="card-pad" style={{ marginBottom: 16 }}>
        <div className="ops-filters" style={{ margin: 0 }}>
          <label>Trạng thái<input className="field" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} placeholder="Ví dụ: Pending" /></label>
        </div>
      </Card>
      <Card>
        <DataState loading={list.loading} error={list.error} empty={!list.data?.items.length} emptyTitle="Không có báo cáo nào" onRetry={list.reload}>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Phiên</th><th>Lý do</th><th>Mô tả</th><th>Trạng thái</th><th>Gửi lúc</th><th>Thao tác</th></tr></thead>
              <tbody>
                {list.data?.items.map((report) => (
                  <tr key={report.reportId}>
                    <td><TruncatedText text={report.auctionTitle ?? report.auctionId} label="Phiên đấu giá" maxWidth={220} /></td>
                    <td>{report.reason}</td>
                    <td><TruncatedText text={report.description} label="Mô tả báo cáo" maxWidth={240} /></td>
                    <td><Badge tone={report.status === "Pending" ? "amber" : "slate"}>{report.status}</Badge>{report.adminNote && <><br /><small>{report.adminNote}</small></>}</td>
                    <td>{new Date(report.createdAt).toLocaleString("vi-VN")}</td>
                    <td>{report.status === "Pending" && <button type="button" className="button button-secondary button-small" onClick={() => { setFailure(null); setProblem(""); setNote(""); setTarget(report); }}>Bác báo cáo</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
        {list.data && list.data.pagination.totalPages > 1 && <AdminPagination page={page} pageSize={list.data.pagination.pageSize} totalItems={list.data.pagination.totalCount} totalPages={list.data.pagination.totalPages} onPageChange={setPage} itemLabel="báo cáo" />}
        <ConfirmDialog open={target !== null} title="Bác các báo cáo của phiên này?" confirmLabel="Bác báo cáo" busy={busy} error={failure} onConfirm={() => void dismiss()} onClose={() => setTarget(null)}>
          <p>Mọi báo cáo đang chờ của phiên này bị bác và người gửi được thông báo. Chỉ làm khi không thấy vi phạm.</p>
          <label>Ghi chú gửi người báo cáo (bắt buộc)<textarea className="field" rows={3} value={note} disabled={busy} aria-invalid={Boolean(problem)} onChange={(event) => setNote(event.target.value)} /></label>
          {problem && <p className="form-error" role="alert">{problem}</p>}
        </ConfirmDialog>
      </Card>
    </>
  );
}
