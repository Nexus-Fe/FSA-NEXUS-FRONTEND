"use client";

import { Fragment, useState, type FormEvent } from "react";
import { AdminPagination, Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { FluidChoiceBar } from "@/components/ui/FluidChoiceBar";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { CopyableId } from "@/components/ui/CopyableId";
import { useSession } from "@/components/auth/SessionProvider";
import { ApiError } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import {
  WITHDRAWAL_ACTIONS,
  WITHDRAWAL_HISTORY_LABEL,
  WITHDRAWAL_STATUS_ORDER,
  withdrawalService,
  withdrawalStatus,
} from "@/features/wallet/services/withdrawal.service";
import type { AdminWithdrawal, ProcessWithdrawalInput, WithdrawalAction } from "@/features/wallet/types";
import { transactionDate } from "@/features/wallet/WalletScreen";

// The same labels the seller sees, so a status never reads differently on the two sides.
const FILTERS = [
  ...WITHDRAWAL_STATUS_ORDER.map((value) => ({ value: value as string, label: withdrawalStatus(value).label })),
  { value: "", label: "Tất cả" },
];

const ERRORS: Record<string, string> = {
  WITHDRAWAL_INVALID_TRANSITION: "Yêu cầu đã được xử lý hoặc đổi trạng thái. Danh sách sẽ được tải lại.",
  TRANSFER_REFERENCE_ALREADY_USED: "Mã tham chiếu này đã xác nhận cho một yêu cầu rút khác.",
  FORBIDDEN: "Chỉ admin được thực hiện thao tác này.",
};

type Panel = { id: string; action: WithdrawalAction } | null;

export function StaffWithdrawalsScreen() {
  const { user } = useSession();
  const isAdmin = (user?.roles ?? [user?.role]).some((role) => String(role ?? "").toLowerCase() === "admin");
  const [status, setStatus] = useState("Pending");
  const [page, setPage] = useState(1);
  const list = useApiResource(`staff-withdrawals:${status}:${page}`, (signal) => withdrawalService.adminList(page, 20, status || undefined, signal));
  const [panel, setPanel] = useState<Panel>(null);
  const [historyId, setHistoryId] = useState("");
  const [success, setSuccess] = useState("");
  const { showToast } = useToast();

  function choose(next: string) { setStatus(next); setPage(1); setPanel(null); setHistoryId(""); }

  return <>
    <PageHeading title="Duyệt rút tiền ví" description="Duyệt yêu cầu, chuyển khoản thủ công rồi xác nhận. Đã duyệt nghĩa là đã trừ ví, chưa phải đã chuyển tiền." />
    <FluidChoiceBar mode="filter" ariaLabel="Lọc theo trạng thái" options={FILTERS} value={status} onChange={choose} />
    {success && <p className="form-success" role="status">{success}</p>}
    {list.error && <p className="notice" role="alert">{list.error.message} <button type="button" className="button button-secondary" onClick={list.reload}>Thử lại</button></p>}
    {list.loading && !list.data ? <TableSkeleton rows={5} cols={5} label="Đang tải yêu cầu rút…" /> : list.data?.items.length ? <Card>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Gửi lúc</th><th>Số tiền</th><th>Chuyển tới</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
        {list.data.items.map((item) => {
          const state = withdrawalStatus(item.status);
          const actions = (WITHDRAWAL_ACTIONS[item.status] ?? []).filter((entry) => !entry.adminOnly || isAdmin);
          return <Fragment key={item.withdrawalId}>
            <tr>
              <td>{transactionDate(item.requestedAt)}<br /><CopyableId id={item.withdrawalId} /></td>
              <td><strong>{formatMoney(item.amount)}</strong></td>
              <td>{item.bankName}<br /><CopyableId id={item.bankAccountNumber} length={20} showFull /><br /><small>{item.accountHolderName}</small></td>
              <td><Badge tone={state.tone}>{state.label}</Badge>{item.statusReason && <><br /><small>Lý do: {item.statusReason}</small></>}{item.transferReference && <><br /><small>Mã CK: {item.transferReference}</small></>}</td>
              <td>
                <RowActionsMenu
                  ariaLabel={`Thao tác rút tiền ${item.withdrawalId}`}
                  primary={
                    actions.length > 0
                      ? {
                          label: actions[0].label,
                          variant: "primary",
                          onClick: () => { setPanel({ id: item.withdrawalId, action: actions[0].action }); setSuccess(""); },
                        }
                      : {
                          label: historyId === item.withdrawalId ? "Ẩn lịch sử" : "Lịch sử",
                          onClick: () => setHistoryId(historyId === item.withdrawalId ? "" : item.withdrawalId),
                        }
                  }
                  items={
                    actions.length > 0
                      ? [
                          ...actions.slice(1).map((entry) => ({
                            label: entry.label,
                            onClick: () => { setPanel({ id: item.withdrawalId, action: entry.action }); setSuccess(""); },
                          })),
                          {
                            label: historyId === item.withdrawalId ? "Ẩn lịch sử" : "Lịch sử",
                            dividerBefore: actions.length > 1,
                            onClick: () => setHistoryId(historyId === item.withdrawalId ? "" : item.withdrawalId),
                          },
                        ]
                      : []
                  }
                />
              </td>
            </tr>
            {panel?.id === item.withdrawalId && <tr><td colSpan={5}><ActionPanel item={item} action={panel.action} onCancel={() => setPanel(null)}
              onDone={(message) => { setPanel(null); setSuccess(message); showToast(message, "success"); list.reload(); }} onConflict={() => { setPanel(null); list.reload(); }} /></td></tr>}
            {historyId === item.withdrawalId && <tr><td colSpan={5}><History id={item.withdrawalId} /></td></tr>}
          </Fragment>;
        })}
      </tbody></table></div>
      {list.data && list.data.pagination.totalPages > 1 && (
        <AdminPagination
          page={list.data.pagination.pageIndex}
          pageSize={list.data.pagination.pageSize}
          totalItems={list.data.pagination.totalCount}
          totalPages={list.data.pagination.totalPages}
          loading={list.loading}
          onPageChange={setPage}
          itemLabel="yêu cầu"
        />
      )}
    </Card> : !list.error && <NoData title="Không có yêu cầu nào ở trạng thái này." />}
  </>;
}

function History({ id }: { id: string }) {
  const history = useApiResource(`withdrawal-history:${id}`, (signal) => withdrawalService.adminHistory(id, signal));
  if (history.loading) return <p>Đang tải lịch sử…</p>;
  if (history.error) return <p className="notice" role="alert">{history.error.message}</p>;
  if (!history.data?.length) return <p>Chưa có lịch sử.</p>;
  return <ol className="timeline">
    {history.data.map((entry, index) => <li key={index}>
      <strong>{WITHDRAWAL_HISTORY_LABEL[entry.action] ?? entry.action}</strong> · {withdrawalStatus(entry.toStatus).label} · {transactionDate(entry.occurredAt)}
      {entry.actorId && <><br /><small>Người thực hiện: {entry.actorId}</small></>}
      {entry.reason && <><br /><small>Lý do: {entry.reason}</small></>}
      {entry.transferReference && <><br /><small>Mã chuyển khoản: {entry.transferReference}</small></>}
      {entry.verificationEvidence && <><br /><small>Bằng chứng xác minh ngân hàng: {entry.verificationEvidence}</small></>}
    </li>)}
  </ol>;
}

const TITLES: Record<WithdrawalAction, string> = {
  Approve: "Duyệt yêu cầu",
  Reject: "Từ chối yêu cầu",
  StartProcessing: "Đánh dấu đang chuyển khoản",
  Complete: "Xác nhận đã chuyển tiền",
  Fail: "Chuyển khoản thất bại, hoàn tiền vào ví",
  ResolveFailed: "Xử lý thất bại cho yêu cầu đang chuyển (admin)",
};

function ActionPanel({ item, action, onCancel, onDone, onConflict }: {
  item: AdminWithdrawal; action: WithdrawalAction; onCancel: () => void; onDone: (message: string) => void; onConflict: () => void;
}) {
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [evidence, setEvidence] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needsReason = action === "Reject" || action === "Fail" || action === "ResolveFailed";
  const reversal = action === "Fail" || action === "ResolveFailed";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (needsReason && note.trim().length < 3) { setError("Nhập lý do (ít nhất 3 ký tự)."); return; }
    if (action === "Complete" && (!confirmed || !reference.trim())) { setError("Tick xác nhận đã chuyển khoản và nhập mã tham chiếu của ngân hàng."); return; }
    if (reversal && !confirmed) { setError("Chỉ hoàn tiền sau khi đã xác minh với ngân hàng là tiền CHƯA được chuyển."); return; }
    if (action === "ResolveFailed" && evidence.trim().length < 3) { setError("Nhập bằng chứng đã xác minh với ngân hàng."); return; }

    const input: ProcessWithdrawalInput = { action, adminNote: note.trim() || undefined };
    if (action === "Complete") { input.transferConfirmed = true; input.transferReference = reference.trim(); }
    if (reversal) input.bankVerifiedNotTransferred = true;
    if (action === "ResolveFailed") input.verificationEvidence = evidence.trim();

    setBusy(true); setError("");
    try {
      await withdrawalService.process(item.withdrawalId, input);
      onDone(`${TITLES[action]}: đã thực hiện cho yêu cầu ${item.withdrawalId.slice(0, 8)}…`);
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.errorCode : undefined;
      setError((code && ERRORS[code]) || (cause instanceof Error ? cause.message : "Không thể xử lý yêu cầu."));
      if (code === "WITHDRAWAL_INVALID_TRANSITION") onConflict();
    } finally { setBusy(false); }
  }

  return <form className="auth-fields" onSubmit={(event) => void submit(event)} aria-label={TITLES[action]}>
    <h3>{TITLES[action]} · {formatMoney(item.amount)} · {item.bankName} {item.bankAccountNumber}</h3>
    {reversal && <p className="notice">Hoàn tiền vào ví seller chỉ khi chắc chắn ngân hàng chưa chuyển. Nếu đã chuyển hoặc chưa rõ kết quả, không dùng thao tác này.</p>}
    {action === "Complete" && <label className="field-wrap">Mã tham chiếu chuyển khoản<input className="field" maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} /></label>}
    {(action === "Complete" || reversal) && <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> {action === "Complete" ? "Tôi xác nhận ngân hàng đã chuyển tiền thành công." : "Tôi đã xác minh với ngân hàng: tiền CHƯA được chuyển."}</label>}
    {action === "ResolveFailed" && <label className="field-wrap">Bằng chứng xác minh với ngân hàng<input className="field" maxLength={500} value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>}
    <label className="field-wrap">{needsReason ? "Lý do (bắt buộc, seller sẽ thấy)" : "Ghi chú (không bắt buộc)"}<textarea className="field" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label>
    {error && <p className="notice" role="alert">{error}</p>}
    <div className="action-row"><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang xử lý…" : "Xác nhận"}</button><button className="button button-secondary" type="button" onClick={onCancel} disabled={busy}>Hủy</button></div>
  </form>;
}
