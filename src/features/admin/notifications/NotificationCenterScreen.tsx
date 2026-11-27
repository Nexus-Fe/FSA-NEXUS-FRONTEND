"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminPagination, Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { FluidChoiceBar } from "@/components/ui/FluidChoiceBar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useApiResource } from "@/lib/api/use-api-resource";
import { semanticStatusTone } from "@/lib/status-labels";
import { notificationAdminService } from "./notification-admin.service";
import { canRetryDelivery, deliveryStatusLabel, newRequestId, validateRetryReason, validateTemplate, MAX_BODY, MAX_SUBJECT, type Channel, type Delivery, type Template } from "./notification-admin-rules";

const when = (value: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "—");
type Tab = "deliveries" | "templates" | "channels";
const TABS: ReadonlyArray<readonly [Tab, string]> = [["deliveries", "Lượt gửi"], ["templates", "Mẫu thông báo"], ["channels", "Kênh gửi"]];

/** Admin writes (edit templates, switch channels, resend a failed delivery); staff only reads, so the write buttons are hidden for staff. */
export function NotificationCenterScreen({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<Tab>("deliveries");
  return <div className="page-stack">
    <PageHeading title="Trung tâm thông báo" description="Theo dõi lượt gửi, sửa mẫu và bật tắt kênh. Nội dung gửi tới người dùng không hiển thị ở đây." />
    <FluidChoiceBar ariaLabel="Mục quản trị thông báo" options={TABS.map(([value, label]) => ({ value, label }))} value={tab} onChange={setTab} />
    {tab === "deliveries" && <Deliveries canWrite={canWrite} />}
    {tab === "templates" && <Templates canWrite={canWrite} />}
    {tab === "channels" && <Channels canWrite={canWrite} />}
  </div>;
}

function Pager({ page, setPage, info }: { page: number; setPage: (page: number) => void; info: { totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean } }) {
  if (info.totalPages <= 1) return null;
  return <AdminPagination page={page} totalPages={info.totalPages} onPageChange={setPage} itemLabel="mục" />;
}

function Deliveries({ canWrite }: { canWrite: boolean }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<Delivery | null>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const requestId = useRef("");
  const list = useApiResource(`notif-deliveries:${page}:${status}:${channel}`, (signal) => notificationAdminService.deliveries({ page, status, channel }, signal));
  const logs = useApiResource(logsFor ? `notif-logs:${logsFor}` : null, (signal) => notificationAdminService.logs(logsFor ?? "", signal));

  function openRetry(row: Delivery) { requestId.current = newRequestId(); setRetrying(row); setReason(""); setProblem(""); setFailure(null); }

  async function confirmRetry() {
    if (!retrying || busy) return;
    const found = validateRetryReason(reason);
    if (found) { setProblem(found); return; }
    setProblem("");
    setBusy(true);
    setFailure(null);
    try {
      await notificationAdminService.retry(retrying.id, { requestId: requestId.current, expectedRowVersion: retrying.rowVersion, reason: reason.trim() });
      setNotice("Đã nhận yêu cầu gửi lại. Trạng thái sẽ cập nhật sau ít phút.");
      setRetrying(null);
      list.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Card className="card-pad" style={{ marginBottom: 16 }}>
      <div className="ops-filters" style={{ margin: 0 }}>
        <label>Trạng thái<select className="field" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả</option>{["Pending", "Sending", "Sent", "Failed", "Skipped"].map((item) => <option key={item} value={item}>{deliveryStatusLabel(item)}</option>)}</select></label>
        <label>Kênh<input className="field" value={channel} onChange={(event) => { setChannel(event.target.value); setPage(1); }} placeholder="Email, Push…" /></label>
      </div>
    </Card>
    {notice && <p className="form-success" role="status">{notice}</p>}
    {list.error != null && <ErrorState cause={list.error} operation="read" onRetry={list.reload} />}
    <Card>
      {list.loading && !list.data ? <TableSkeleton rows={5} cols={7} label="Đang tải lượt gửi…" /> : list.data?.items.length ? <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Kênh</th><th>Trạng thái</th><th>Lần thử</th><th>Mã lỗi</th><th>Gửi tới</th><th>Cập nhật</th><th></th></tr></thead>
        <tbody>{list.data.items.map((row) => <tr key={row.id}>
          <td>{row.channel}</td><td><Badge tone={semanticStatusTone(row.status)}>{deliveryStatusLabel(row.status)}</Badge></td><td>{row.attemptCount}</td><td>{row.errorCode ?? "—"}</td><td>{row.destinationHint}</td><td>{when(row.updatedAt)}</td>
          <td><div className="action-row" style={{ marginTop: 0 }}>
            <button type="button" className="button button-secondary button-small" onClick={() => setLogsFor(logsFor === row.id ? null : row.id)}>Nhật ký</button>
            {canWrite && canRetryDelivery(row.status) && <button type="button" className="button button-primary button-small" onClick={() => openRetry(row)}>Gửi lại</button>}
          </div></td>
        </tr>)}</tbody>
      </table></div> : !list.error && <NoData title="Chưa có lượt gửi nào." />}
      {list.data && <Pager page={page} setPage={setPage} info={list.data.pagination} />}
    </Card>
    {logsFor && <Card className="card-pad" style={{ marginTop: 16 }}>
      <h3>Nhật ký lượt gửi</h3>
      {logs.error != null ? <ErrorState cause={logs.error} operation="read" onRetry={logs.reload} /> : logs.loading && !logs.data ? <TableSkeleton rows={3} cols={2} label="Đang tải nhật ký…" /> : logs.data?.items.length ? logs.data.items.map((log) => <div className="info-row" key={log.id}><span>{when(log.createdAt)} · {log.action}{log.attempt != null ? ` · lần ${log.attempt}` : ""}</span><strong>{log.message}{log.errorCode && <small> ({log.errorCode})</small>}</strong></div>) : <p className="muted">Chưa có nhật ký.</p>}
    </Card>}
    <ConfirmDialog open={retrying !== null} title="Gửi lại thông báo?" confirmLabel="Gửi lại" busy={busy} error={failure} onConfirm={() => void confirmRetry()} onClose={() => setRetrying(null)}>
      <label className="field-wrap">Lý do gửi lại
        <textarea className="field" rows={3} maxLength={500} aria-invalid={Boolean(problem)} value={reason} onChange={(event) => setReason(event.target.value)} />
        {problem && <small className="checkout-field-error" role="alert">{problem}</small>}
      </label>
    </ConfirmDialog>
  </>;
}

function Templates({ canWrite }: { canWrite: boolean }) {
  const [page, setPage] = useState(1);
  const [code, setCode] = useState("");
  const [editing, setEditing] = useState<Template | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [active, setActive] = useState(true);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const list = useApiResource(`notif-templates:${page}:${code}`, (signal) => notificationAdminService.templates({ page, code }, signal));

  function open(row: Template) { setEditing(row); setSubject(row.subjectTemplate ?? ""); setBody(row.bodyTemplate ?? ""); setActive(row.isActive); setProblem(""); setFailure(null); }

  async function save() {
    if (!editing || busy) return;
    const found = validateTemplate(subject, body);
    if (found) { setProblem(found); return; }
    setProblem("");
    setBusy(true);
    setFailure(null);
    try {
      await notificationAdminService.updateTemplate(editing.id, { expectedUpdatedAt: editing.updatedAt, subjectTemplate: subject, bodyTemplate: body, isMandatory: editing.isMandatory, isActive: editing.isMandatory ? true : active });
      setEditing(null);
      list.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Card className="card-pad" style={{ marginBottom: 16 }}>
      <div className="ops-filters" style={{ margin: 0 }}><label>Mã mẫu<input className="field" value={code} onChange={(event) => { setCode(event.target.value); setPage(1); }} /></label></div>
    </Card>
    {list.error != null && <ErrorState cause={list.error} operation="read" onRetry={list.reload} />}
    <Card>
      {list.loading && !list.data ? <TableSkeleton rows={5} cols={7} label="Đang tải mẫu thông báo…" /> : list.data?.items.length ? <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Mã</th><th>Kênh</th><th>Loại</th><th>Bắt buộc</th><th>Đang bật</th><th>Cập nhật</th><th></th></tr></thead>
        <tbody>{list.data.items.map((row) => <tr key={row.id}>
          <td>{row.code}</td><td>{row.channelCode}</td><td>{row.notificationType}</td><td>{row.isMandatory ? "Có" : "Không"}</td><td>{row.isActive ? "Bật" : "Tắt"}</td><td>{when(row.updatedAt)}</td>
          <td>{canWrite ? <button type="button" className="button button-secondary button-small" onClick={() => open(row)}>Sửa</button> : "—"}</td>
        </tr>)}</tbody>
      </table></div> : !list.error && <NoData title="Không có mẫu phù hợp." />}
      {list.data && <Pager page={page} setPage={setPage} info={list.data.pagination} />}
    </Card>
    <ConfirmDialog open={editing !== null} title={`Sửa mẫu ${editing?.code ?? ""}`} confirmLabel="Lưu mẫu" busy={busy} error={failure} onConfirm={() => void save()} onClose={() => setEditing(null)}>
      <label className="field-wrap">Tiêu đề<input className="field" maxLength={MAX_SUBJECT} value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
      <label className="field-wrap">Nội dung<textarea className="field" rows={8} maxLength={MAX_BODY} value={body} onChange={(event) => setBody(event.target.value)} /></label>
      <label className="voucher-checkbox"><input type="checkbox" checked={editing?.isMandatory ? true : active} disabled={editing?.isMandatory} onChange={(event) => setActive(event.target.checked)} /> <span>Đang bật{editing?.isMandatory ? " (mẫu bắt buộc, không tắt được)" : ""}</span></label>
      {problem && <small className="checkout-field-error" role="alert">{problem}</small>}
    </ConfirmDialog>
  </>;
}

function Channels({ canWrite }: { canWrite: boolean }) {
  const list = useApiResource("notif-channels", (signal) => notificationAdminService.channels(signal));
  const [target, setTarget] = useState<Channel | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  async function toggle() {
    if (!target || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      await notificationAdminService.updateChannel(target.code, { name: target.name, isDisabled: !target.isDisabled, expectedUpdatedAt: target.updatedAt });
      setTarget(null);
      list.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return <Card>
    {list.error != null && <ErrorState cause={list.error} operation="read" onRetry={list.reload} />}
    {list.loading && !list.data ? <TableSkeleton rows={4} cols={5} label="Đang tải kênh gửi…" /> : list.data?.items.length ? <div className="table-scroll"><table className="data-table">
      <thead><tr><th>Mã</th><th>Tên</th><th>Nhà cung cấp</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>{list.data.items.map((row) => <tr key={row.id}>
        <td>{row.code}</td><td>{row.name}</td><td>{row.provider ?? "—"}</td><td>{row.isDisabled ? "Đang tắt" : "Đang bật"}</td>
        <td>{canWrite ? <button type="button" className="button button-secondary button-small" onClick={() => { setFailure(null); setTarget(row); }}>{row.isDisabled ? "Bật kênh" : "Tắt kênh"}</button> : "—"}</td>
      </tr>)}</tbody>
    </table></div> : !list.error && <NoData title="Chưa có kênh nào." />}
    <ConfirmDialog open={target !== null} title={target?.isDisabled ? "Bật kênh gửi?" : "Tắt kênh gửi?"} confirmLabel={target?.isDisabled ? "Bật kênh" : "Tắt kênh"} busy={busy} error={failure} onConfirm={() => void toggle()} onClose={() => setTarget(null)}>
      <p>{target?.isDisabled ? `Kênh ${target?.code} sẽ gửi thông báo trở lại.` : `Kênh ${target?.code} ngừng gửi. Thông báo bắt buộc qua kênh này sẽ không tới người dùng cho đến khi bật lại.`}</p>
    </ConfirmDialog>
  </Card>;
}
