"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminPagination, Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { FluidChoiceBar } from "@/components/ui/FluidChoiceBar";
import { ErrorState } from "@/components/ui/States";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { REFUND_STATUS, statusLabel } from "@/lib/status-labels";
import { REFUND_FILTERS, canDecideRefund, parseRejectReason, type RefundRow } from "./refund-rules";
import { refundService } from "./refund.service";

const DATE = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });
const when = (value: string | null) => (value ? DATE.format(new Date(value)) : "—");

function refundTone(status: string): "slate" | "amber" | "green" | "red" {
  const s = status.toUpperCase();
  if (s === "COMPLETED") return "green";
  if (s === "REJECTED" || s === "FAILED") return "red";
  if (s === "REQUESTED" || s === "WALLETPENDING") return "amber";
  return "slate";
}

type Role = "buyer" | "seller" | "admin" | "staff";
type Decision = { row: RefundRow; kind: "approve" | "reject" } | null;

/** Refund requests. The buyer only reads; seller, admin and staff approve (the wallet refund runs once) or reject with a reason. */
export function RefundsScreen({ role }: { role: Role }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [decision, setDecision] = useState<Decision>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const refunds = useApiResource(`refunds:${role}:${page}:${status}`, (signal) => refundService.list(page, status, signal));

  function open(row: RefundRow, kind: "approve" | "reject") { setDecision({ row, kind }); setReason(""); setProblem(""); setFailure(null); }

  async function confirm() {
    if (!decision || busy) return;
    let rejectReason = "";
    if (decision.kind === "reject") {
      const parsed = parseRejectReason(reason);
      if ("error" in parsed) { setProblem(parsed.error); return; }
      rejectReason = parsed.value;
    }
    setBusy(true);
    setFailure(null);
    try {
      if (decision.kind === "approve") await refundService.approve(decision.row.id);
      else await refundService.reject(decision.row.id, rejectReason);
      setNotice(decision.kind === "approve" ? "Đã duyệt. Tiền được hoàn vào ví người mua." : "Đã từ chối yêu cầu hoàn tiền.");
      setDecision(null);
      refunds.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  const data = refunds.data;
  return <div className="page-stack">
    <PageHeading title="Yêu cầu hoàn tiền" description={role === "buyer" ? "Các yêu cầu hoàn tiền của đơn bạn đã mua." : "Duyệt hoặc từ chối yêu cầu hoàn tiền. Duyệt sẽ hoàn tiền vào ví người mua."} />
    <FluidChoiceBar mode="filter" ariaLabel="Lọc theo trạng thái hoàn tiền" options={REFUND_FILTERS.map(([value, label]) => ({ value, label }))} value={status} onChange={(next) => { setStatus(next); setPage(1); }} />
    {notice && <p className="form-success" role="status">{notice}</p>}
    {refunds.error != null && <ErrorState cause={refunds.error} operation="read" onRetry={refunds.reload} />}
    {refunds.loading && !data ? <TableSkeleton rows={5} cols={5} label="Đang tải yêu cầu hoàn tiền…" /> : data?.items.length ? <Card>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Đơn con</th><th>Số tiền</th><th>Lý do</th><th>Trạng thái</th><th>Thời gian</th>{role !== "buyer" && <th>Xử lý</th>}</tr></thead>
        <tbody>{data.items.map((row) => <tr key={row.id}>
          <td>{row.subOrderNo}</td>
          <td>{formatMoney(row.amount)}</td>
          <td>{row.reason}{row.rejectReason && <><br /><small>Lý do từ chối: {row.rejectReason}</small></>}</td>
          <td><Badge tone={refundTone(row.status)}>{statusLabel(REFUND_STATUS, row.status)}</Badge></td>
          <td><small>Yêu cầu: {when(row.requestedAt)}<br />Xong: {when(row.completedAt)}</small></td>
          {role !== "buyer" && <td>{canDecideRefund(role, row.status) ? <div className="action-row">
            <button type="button" className="button button-primary" onClick={() => open(row, "approve")}>Duyệt hoàn tiền</button>
            <button type="button" className="button button-secondary" onClick={() => open(row, "reject")}>Từ chối</button>
          </div> : "—"}</td>}
        </tr>)}</tbody>
      </table></div>
      {data && data.pagination.totalPages > 1 && (
        <AdminPagination
          page={data.pagination.pageIndex}
          pageSize={data.pagination.pageSize}
          totalItems={data.pagination.totalCount}
          totalPages={data.pagination.totalPages}
          loading={refunds.loading}
          onPageChange={setPage}
          itemLabel="yêu cầu"
        />
      )}
    </Card> : !refunds.error && <NoData title="Chưa có yêu cầu hoàn tiền nào." />}
    <ConfirmDialog open={decision !== null} title={decision?.kind === "approve" ? "Duyệt hoàn tiền?" : "Từ chối hoàn tiền?"} confirmLabel={decision?.kind === "approve" ? "Duyệt và hoàn tiền" : "Từ chối yêu cầu"} busy={busy} error={failure} onConfirm={() => void confirm()} onClose={() => setDecision(null)}>
      {decision?.kind === "approve"
        ? <p>Hoàn {decision ? formatMoney(decision.row.amount) : ""} vào ví người mua cho đơn {decision?.row.subOrderNo}. Không thể hoàn tác.</p>
        : <label className="field-wrap">Lý do từ chối (người mua sẽ thấy)
          <textarea className="field" rows={3} maxLength={500} aria-invalid={Boolean(problem)} value={reason} onChange={(event) => setReason(event.target.value)} />
          {problem && <small className="checkout-field-error" role="alert">{problem}</small>}
        </label>}
    </ConfirmDialog>
  </div>;
}
