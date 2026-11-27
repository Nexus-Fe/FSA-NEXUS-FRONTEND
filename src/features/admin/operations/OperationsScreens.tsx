"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { AdminPagination, Badge, Card, NoData, PageHeading, TruncatedText } from "@/components/ui/Primitives";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useApiResource } from "@/lib/api/use-api-resource";
import { describeLookupFailure } from "@/lib/api/lookup-failure";
import { FeatureUnavailable, useFeature } from "@/lib/features/FeatureProvider";
import { healthLabel, jsonDiff, ruleLabel, safeAuditValue, severityLabel } from "./operations-outcome";
import { operationsService, type AuditRecord, type SecurityAlert } from "./operations.service";

const date = (value?: string | null) => value ? new Date(value).toLocaleString("vi-VN") : "—";
const errorView = (error: unknown) => <p role="alert" className="notice">{describeLookupFailure(error, "dữ liệu quản trị")}</p>;
function PageControls({ page, total, totalPages, onChange }: { page: number; total: number; totalPages: number; onChange: (page: number) => void }) { return totalPages > 1 ? <AdminPagination page={page} pageSize={20} totalItems={total} totalPages={totalPages} onPageChange={onChange} itemLabel="mục" /> : null; }

export function AuditLogsScreen() { const enabled = useFeature("audit"); return enabled ? <AuditLogsContent /> : <FeatureUnavailable />; }
function AuditLogsContent() {
  const searchParams = useSearchParams();
  const linkedId = searchParams.get("id");
  const [page, setPage] = useState(1); const [filter, setFilter] = useState({ serviceName: "", entityName: "", entityId: "", userId: "", action: "", traceId: "", fromDate: "", toDate: "" }); const [selected, setSelected] = useState<AuditRecord | null>(null); const [detailError, setDetailError] = useState("");
  const logs = useApiResource(`audit:${page}:${JSON.stringify(filter)}`, (signal) => operationsService.auditLogs({ ...filter, page, pageSize: 20 }, signal));
  const sync = useApiResource("audit-sync-status", operationsService.syncStatus);
  const linked = useApiResource(linkedId ? `audit-detail:${linkedId}` : null, () => operationsService.auditLog(linkedId ?? ""));
  const activeRecord = selected ?? linked.data;
  function field(key: keyof typeof filter, label: string) { return <label key={key}>{label}<input className="field" type={key === "fromDate" || key === "toDate" ? "date" : "text"} value={filter[key]} onChange={(event) => { setFilter({ ...filter, [key]: event.target.value }); setPage(1); }} /></label>; }
  async function open(id: string) { setDetailError(""); try { setSelected(await operationsService.auditLog(id)); } catch (cause) { setDetailError(describeLookupFailure(cause, "bản ghi kiểm toán", ["AUDIT_LOG_NOT_FOUND"])); } }
  return <div className="page-stack">
    <PageHeading title="Nhật ký kiểm toán" description="Theo dõi hành động đã đồng bộ từ các service." />
    <Card className="card-pad" style={{ marginBottom: 16 }}>
      <h2>Trạng thái đồng bộ</h2>
      {sync.error ? errorView(sync.error) : sync.loading ? <TableSkeleton rows={2} cols={3} label="Đang kiểm tra…" /> : sync.data ? <><p>{sync.data.enabled ? "Đồng bộ đang bật" : "Đồng bộ chưa bật"}</p><div className="ops-source-grid">{sync.data.services.map((item) => <div className="ops-source" key={item.serviceName}><strong>{item.serviceName}</strong><span>{item.state === "Known" ? `${item.unsyncedCount ?? "Chưa rõ"} bản ghi chưa đồng bộ` : item.state === "Unavailable" ? `Không đọc được${item.observedAt ? ` từ ${date(item.observedAt)}` : ""}` : "Chưa có dữ liệu"}</span>{item.state === "Unavailable" && item.lastKnownUnsyncedCount != null && <small>Số liệu cũ: {item.lastKnownUnsyncedCount}</small>}</div>)}</div></> : null}
    </Card>
    <Card className="card-pad" style={{ marginBottom: 16 }}>
      <h2 style={{ marginBottom: 12 }}>Bộ lọc bản ghi</h2>
      <div className="ops-filters" style={{ margin: 0 }}>{field("serviceName", "Dịch vụ")}{field("entityName", "Thực thể")}{field("entityId", "Mã thực thể")}{field("userId", "Người làm")}{field("action", "Hành động")}{field("traceId", "Mã vết")}{field("fromDate", "Từ ngày")}{field("toDate", "Đến ngày")}</div>
    </Card>
    <Card>
      {logs.loading && !logs.data ? <TableSkeleton rows={5} cols={6} label="Đang tải nhật ký kiểm toán…" /> : logs.error ? errorView(logs.error) : !logs.data?.items.length ? <NoData title={sync.data?.enabled ? "Không có bản ghi phù hợp" : "Chưa bật đồng bộ nhật ký"} /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Thời điểm</th><th>Dịch vụ</th><th>Hành động</th><th>Thực thể</th><th>Người làm</th><th></th></tr></thead><tbody>{logs.data.items.map((item) => <tr key={item.id}><td>{date(item.createdAt)}</td><td>{item.serviceName}</td><td>{item.action}</td><td><TruncatedText text={`${item.entityName} · ${item.entityId}`} label="Thực thể" maxWidth={220} /></td><td className="mono">{item.userId ?? "Hệ thống"}</td><td><button className="button button-secondary button-small" onClick={() => void open(item.id)}>Chi tiết</button></td></tr>)}</tbody></table></div>}
      {logs.data && <PageControls page={page} total={logs.data.pagination.totalCount} totalPages={logs.data.pagination.totalPages} onChange={setPage} />}
    </Card>
    {detailError && <p role="alert" className="notice">{detailError}</p>}
    {linked.error && errorView(linked.error)}
    {activeRecord && <Card className="card-pad" style={{ marginTop: 16 }}><div className="ops-section-head"><h2>Chi tiết · {activeRecord.action}</h2><button className="button button-secondary button-small" onClick={() => setSelected(null)}>Đóng</button></div><p>Mã vết: <code>{activeRecord.traceId ?? "—"}</code> {activeRecord.traceId && <button className="button button-secondary button-small" onClick={() => void navigator.clipboard.writeText(activeRecord.traceId ?? "")}>Sao chép</button>}</p><div className="table-scroll"><table className="data-table"><thead><tr><th>Trường</th><th>Trước</th><th>Sau</th></tr></thead><tbody>{jsonDiff(activeRecord.oldValues, activeRecord.newValues).map((row) => <tr key={row.key} className={row.changed ? "ops-changed" : undefined}><td>{row.key}</td><td>{safeAuditValue(row.key, row.before)}</td><td>{safeAuditValue(row.key, row.after)}</td></tr>)}</tbody></table></div></Card>}
  </div>;
}

export function SecurityAlertsScreen() { const enabled = useFeature("security-alerts"); return enabled ? <SecurityAlertsContent /> : <FeatureUnavailable />; }
function SecurityAlertsContent() {
  const [page, setPage] = useState(1); const [status, setStatus] = useState(""); const [severity, setSeverity] = useState(""); const [rule, setRule] = useState(""); const [selected, setSelected] = useState<SecurityAlert | null>(null); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const alerts = useApiResource(`security:${page}:${status}:${severity}:${rule}`, (signal) => operationsService.alerts({ page, pageSize: 20, status, severity, rule }, signal));
  async function close(event: FormEvent) { event.preventDefault(); if (!selected || !note.trim()) return; if (!window.confirm("Đóng cảnh báo này cùng ghi chú đã nhập?")) return; setBusy(true); setError(""); try { const result = await operationsService.closeAlert(selected.id, note.trim()); setSelected(result); setNotice("Đã đóng cảnh báo."); alerts.reload(); } catch (cause) { setError(describeLookupFailure(cause, "cảnh báo")); } finally { setBusy(false); } }
  return <div className="page-stack">
    <PageHeading title="Cảnh báo bảo mật" description="Kiểm tra và đóng các cảnh báo đã xác minh." />
    {notice && <p className="form-success" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <Card className="card-pad" style={{ marginBottom: 16 }}>
      <div className="ops-filters" style={{ margin: 0 }}>
        <label>Trạng thái<select className="select-field" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả</option><option value="Open">Chưa đóng</option><option value="Resolved">Đã đóng</option></select></label>
        <label>Mức độ<select className="select-field" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }}><option value="">Tất cả</option>{Object.entries(severityLabel).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label>Luật<select className="select-field" value={rule} onChange={(e) => { setRule(e.target.value); setPage(1); }}><option value="">Tất cả</option>{Object.entries(ruleLabel).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
      </div>
    </Card>
    <Card>
      {alerts.loading && !alerts.data ? <TableSkeleton rows={5} cols={5} label="Đang tải cảnh báo bảo mật…" /> : alerts.error ? errorView(alerts.error) : !alerts.data?.items.length ? <NoData title="Không có cảnh báo phù hợp" /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Thời điểm</th><th>Luật</th><th>Mức độ</th><th>Trạng thái</th><th></th></tr></thead><tbody>{alerts.data.items.map((item) => <tr key={item.id}><td>{date(item.createdAt)}</td><td><TruncatedText text={ruleLabel[item.rule] ?? item.rule} label="Quy tắc bảo mật" maxWidth={240} /></td><td>{severityLabel[item.severity] ?? item.severity}</td><td><Badge tone={item.status === "Resolved" ? "green" : "red"}>{item.status === "Resolved" ? "Đã đóng" : "Cần kiểm tra"}</Badge></td><td><button className="button button-secondary button-small" onClick={() => { setSelected(item); setNote(""); }}>Chi tiết</button></td></tr>)}</tbody></table></div>}
      {alerts.data && <PageControls page={page} total={alerts.data.pagination.totalCount} totalPages={alerts.data.pagination.totalPages} onChange={setPage} />}
    </Card>
    {selected && <Card className="card-pad" style={{ marginTop: 16 }}><div className="ops-section-head"><h2>{ruleLabel[selected.rule] ?? selected.rule}</h2><button className="button button-secondary button-small" onClick={() => setSelected(null)}>Đóng xem</button></div><p>{selected.description}</p><p>Bản ghi kiểm toán: {selected.auditLogId ? <Link href={`${ROUTES.admin.auditLogs}?id=${encodeURIComponent(selected.auditLogId)}`}>{selected.auditLogId}</Link> : "—"}</p>{selected.status === "Resolved" ? <p>Đã đóng bởi {selected.resolvedBy ?? "—"} lúc {date(selected.resolvedAt)}. {selected.resolutionNote}</p> : <form onSubmit={(event) => void close(event)}><label>Ghi chú xử lý<textarea className="field" required value={note} onChange={(e) => setNote(e.target.value)} /></label><button className="button button-primary" disabled={busy || !note.trim()}>Đóng cảnh báo</button></form>}</Card>}
  </div>;
}

export function SystemHealthScreen() { const enabled = useFeature("system-health"); return enabled ? <SystemHealthContent /> : <FeatureUnavailable />; }
function SystemHealthContent() {
  const [revision, setRevision] = useState(0); const health = useApiResource(`system-health:${revision}`, operationsService.health);
  useEffect(() => { const timer = window.setInterval(() => { if (document.visibilityState === "visible") setRevision((value) => value + 1); }, 15_000); return () => window.clearInterval(timer); }, []);
  return <div className="page-stack"><PageHeading title="Sức khỏe hệ thống" description="Tự cập nhật mỗi 15 giây khi trang đang mở." /><Card className="card-pad"><div className="ops-section-head"><h2>Tổng quan</h2><button className="button button-secondary button-small" onClick={() => setRevision((value) => value + 1)}>Làm mới</button></div>{health.error ? errorView(health.error) : health.loading ? <p>Đang kiểm tra…</p> : health.data ? <><Badge tone={health.data.status === "Healthy" ? "green" : health.data.status === "Unhealthy" ? "red" : "slate"}>{healthLabel[health.data.status] ?? health.data.status}</Badge><p>Kiểm tra lúc {date(health.data.checkedAt)}</p><div className="ops-source-grid">{health.data.services.map((item) => <div className="ops-source" key={item.serviceName}><strong>{item.serviceName}</strong><Badge tone={item.status === "Healthy" ? "green" : item.status === "Unhealthy" ? "red" : "slate"}>{healthLabel[item.status] ?? item.status}</Badge><span>Độ trễ: {item.latencyMs == null ? "—" : `${item.latencyMs} ms`}</span><small>{item.message}</small>{item.workers?.map((worker) => <small key={worker.name}>{worker.name}: {worker.status}</small>)}</div>)}</div></> : null}</Card></div>;
}
