"use client";

import { useState, type FormEvent } from "react";
import { AdminPagination, Badge, PageHeading } from "@/components/ui/Primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { DataState, ErrorState } from "@/components/ui/States";
import { useSession } from "@/components/auth/SessionProvider";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { SUBSIDY_BUDGET_STATUS, statusLabel } from "@/lib/status-labels";
import { EMPTY_BUDGET_FORM, budgetUsagePercent, canApproveBudget, canCloseBudget, toBudgetRequest, validateBudgetForm, type BudgetErrors, type BudgetForm } from "./finance-rules";
import { financeService, type SubsidyBudget } from "./finance.service";

type Pending = { kind: "approve" | "close"; budget: SubsidyBudget } | null;

/** Platform voucher subsidy budgets. A new budget is pending until a DIFFERENT admin approves it. */
export function SubsidyBudgetsScreen() {
  const { user } = useSession();
  const [page, setPage] = useState(1);
  const budgets = useApiResource(`admin-subsidy-budgets:${page}`, (signal) => financeService.budgets(page, 20, signal));
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState("");

  async function run() {
    if (!pending) return;
    setBusy(true);
    setFailure(null);
    try {
      if (pending.kind === "approve") await financeService.approveBudget(pending.budget.id);
      else await financeService.closeBudget(pending.budget.id);
      setNotice(pending.kind === "approve" ? `Đã duyệt ngân sách "${pending.budget.name}".` : `Đã đóng ngân sách "${pending.budget.name}".`);
      setPending(null);
      budgets.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading title="Ngân sách trợ giá voucher sàn" description="Tiền sàn dùng để bù cho mã giảm giá toàn sàn. Ngân sách mới phải được một quản trị viên khác duyệt." action={<button type="button" className="button button-primary" onClick={() => { setNotice(""); setCreating(true); }}>Tạo ngân sách</button>} />
      {notice && <p className="form-success" role="status">{notice}</p>}
      <DataState loading={budgets.loading} error={budgets.error} empty={!budgets.data?.items.length} emptyTitle="Chưa có ngân sách nào" onRetry={budgets.reload}>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Tên</th><th>Hạn mức (tổng · ngày · đơn)</th><th>Sử dụng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {budgets.data?.items.map((budget) => {
                const percent = budgetUsagePercent(budget.totalLimit, budget.reservedAmount, budget.usedAmount);
                const mine = user?.id && budget.createdByAdminId.toLowerCase() === user.id.toLowerCase();
                return (
                  <tr key={budget.id}>
                    <td><strong>{budget.name}</strong><br /><small className="mono">Chứng từ: {budget.evidenceRef}</small></td>
                    <td className="tabular-nums">{formatMoney(budget.totalLimit)}<br /><small>{formatMoney(budget.dailyLimit)} / ngày · {formatMoney(budget.perOrderCap)} / đơn</small></td>
                    <td className="tabular-nums">
                      <progress value={percent} max={100} aria-label={`Đã dùng hoặc giữ ${percent}%`} />
                      <br /><small>Đang giữ {formatMoney(budget.reservedAmount)} · đã dùng {formatMoney(budget.usedAmount)} · còn {formatMoney(budget.availableAmount)}</small>
                    </td>
                    <td><Badge tone={budget.status.toUpperCase() === "ACTIVE" ? "green" : budget.status.toUpperCase() === "CLOSED" ? "slate" : "amber"}>{statusLabel(SUBSIDY_BUDGET_STATUS, budget.status)}</Badge></td>
                    <td>
                      <div className="voucher-row-actions">
                        {canApproveBudget(budget, user?.id) && <button type="button" className="button button-primary button-small" disabled={busy} onClick={() => { setFailure(null); setPending({ kind: "approve", budget }); }}>Duyệt</button>}
                        {budget.status.toUpperCase() === "PENDINGAPPROVAL" && mine && <small>Do bạn tạo, cần admin khác duyệt</small>}
                        {canCloseBudget(budget) && <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => { setFailure(null); setPending({ kind: "close", budget }); }}>Đóng</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataState>
      {budgets.data && budgets.data.pagination.totalPages > 1 && <AdminPagination page={page} pageSize={budgets.data.pagination.pageSize} totalItems={budgets.data.pagination.totalCount} totalPages={budgets.data.pagination.totalPages} onPageChange={setPage} itemLabel="ngân sách" />}
      {creating && <BudgetDialog onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setNotice("Đã tạo ngân sách. Ngân sách chờ một quản trị viên khác duyệt."); budgets.reload(); }} />}
      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "approve" ? "Duyệt ngân sách này?" : "Đóng ngân sách này?"}
        confirmLabel={pending?.kind === "approve" ? "Duyệt ngân sách" : "Đóng ngân sách"}
        busy={busy}
        error={failure}
        onConfirm={() => void run()}
        onClose={() => setPending(null)}
      >
        <p>{pending?.kind === "approve"
          ? `Sau khi duyệt, "${pending.budget.name}" bắt đầu bù cho mã giảm giá toàn sàn, tối đa ${formatMoney(pending.budget.totalLimit)}.`
          : `"${pending?.budget.name}" sẽ ngừng nhận thêm khoản giữ mới. Các khoản đã giữ vẫn được xử lý bình thường.`}</p>
      </ConfirmDialog>
    </>
  );
}

function BudgetDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<BudgetForm>(EMPTY_BUDGET_FORM);
  const [errors, setErrors] = useState<BudgetErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateBudgetForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setFailure(null);
    try {
      await financeService.createBudget(toBudgetRequest(form));
      onSaved();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof BudgetForm, label: string, hint?: string) => (
    <label>{label}
      <input className="field" value={form[key]} disabled={busy} aria-invalid={Boolean(errors[key])} inputMode={key === "name" || key === "evidenceRef" ? "text" : "numeric"} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
      {hint && <small>{hint}</small>}
      {errors[key] && <small className="checkout-field-error" role="alert">{errors[key]}</small>}
    </label>
  );

  return (
    <Modal open title="Tạo ngân sách trợ giá" busy={busy} onClose={onClose}>
      <form className="voucher-form" onSubmit={(event) => void submit(event)} noValidate>
        {field("name", "Tên ngân sách")}
        {field("totalLimit", "Tổng ngân sách (₫)")}
        {field("dailyLimit", "Hạn mức mỗi ngày (₫)", "Không lớn hơn tổng ngân sách.")}
        {field("perOrderCap", "Hạn mức mỗi đơn (₫)", "Không lớn hơn hạn mức mỗi ngày.")}
        {field("evidenceRef", "Mã chứng từ nguồn tiền", "Ví dụ số lệnh chuyển khoản hoặc văn bản phê duyệt.")}
        {failure != null && <ErrorState cause={failure} operation="write" />}
        <div className="voucher-dialog-actions">
          <button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Đóng</button>
          <button type="submit" className="button button-primary" disabled={busy}>{busy ? "Đang tạo…" : "Tạo ngân sách"}</button>
        </div>
      </form>
    </Modal>
  );
}
