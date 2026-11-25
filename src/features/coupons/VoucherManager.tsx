"use client";

import { useState, type FormEvent } from "react";
import { AdminPagination, Badge, Card, PageHeading } from "@/components/ui/Primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { useToast } from "@/components/ui/Toast";
import { DataState, ErrorState } from "@/components/ui/States";
import { FeatureUnavailable, useFeature } from "@/lib/features/FeatureProvider";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { sellerCatalogService } from "@/features/seller/services/catalog.service";
import { discountService, type CreateDiscountInput, type DiscountScopeType, type DiscountStatus, type DiscountSummary, type DiscountType } from "./services/discount.service";
import { validateVoucherForm } from "./voucher-outcome";

const blank: CreateDiscountInput = { code: "", name: "", scopeType: "Shop", discountType: "Percentage", discountValue: 10, minOrderAmount: 0, maxDiscountAmount: null, maxUsesTotal: null, maxUsesPerUser: 1, isVisible: true, startsAt: null, endsAt: null };
const scopeName: Record<DiscountScopeType, string> = { System: "Toàn sàn", Shop: "Gian hàng", Product: "Sản phẩm" };
const statusName: Record<DiscountStatus, string> = { Draft: "Bản nháp", Active: "Đang hoạt động", Inactive: "Tạm dừng", Expired: "Hết hạn" };

const localDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "Không giới hạn");
const numberOrNull = (value: string) => (value.trim() ? Number(value) : null);

type Pending = { kind: "status"; item: DiscountSummary; next: DiscountStatus } | { kind: "delete"; item: DiscountSummary } | null;

function VoucherManagerContent({ scope }: { scope: "admin" | "seller" }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [scopeType, setScopeType] = useState("");
  const [editing, setEditing] = useState<DiscountSummary | "new" | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const { showToast } = useToast();
  const resource = useApiResource(`vouchers:${scope}:${page}:${search}:${status}:${scopeType}`, (signal) => discountService.list({ page, pageSize: 20, search, status, scopeType }, signal));
  const scopeOptions = Object.entries(scopeName).filter(([key]) => scope === "admin" || key !== "System");

  async function runPending() {
    if (!pending) return;
    setBusy(true);
    setFailure(null);
    try {
      if (pending.kind === "status") {
        await discountService.setStatus(pending.item.id, pending.next);
        const msgText = `Đã cập nhật trạng thái mã ${pending.item.code}.`;
        setNotice(msgText);
        showToast(msgText, "success");
      } else {
        await discountService.remove(pending.item.id);
        const msgText = `Đã xóa mã ${pending.item.code}.`;
        setNotice(msgText);
        showToast(msgText, "success");
      }
      setPending(null);
      resource.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack voucher-page">
      <PageHeading title="Mã giảm giá" description={scope === "admin" ? "Quản lý ưu đãi trên toàn sàn và từng gian hàng." : "Tạo và theo dõi ưu đãi của gian hàng."} action={<button type="button" className="button button-primary" onClick={() => { setNotice(""); setEditing("new"); }}>Tạo mã giảm giá</button>} />
      {notice && <p className="form-success" role="status">{notice}</p>}
      <Card className="card-pad">
        <div className="voucher-filters">
          <label>Tìm mã hoặc tên<input className="field" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nhập từ khóa" /></label>
          <label>Phạm vi<select className="select-field" value={scopeType} onChange={(event) => { setScopeType(event.target.value); setPage(1); }}><option value="">Tất cả</option>{scopeOptions.map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
          <label>Trạng thái<select className="select-field" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả</option>{Object.entries(statusName).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        </div>
        <DataState loading={resource.loading} error={resource.error} empty={!resource.data?.items.length} emptyTitle="Chưa có mã phù hợp" onRetry={resource.reload}>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Mã</th><th>Phạm vi</th><th>Giảm</th><th>Lượt dùng</th><th>Hiệu lực</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {resource.data?.items.map((item) => {
                  const expired = item.status === "Expired";
                  const left = item.maxUsesTotal != null ? Math.max(0, item.maxUsesTotal - item.usedCount - item.reservedCount) : null;
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.code}</strong><br /><span className="text-muted">{item.name}</span></td>
                      <td>{scopeName[item.scopeType] ?? item.scopeType}</td>
                      <td className="tabular-nums">{item.discountType === "Percentage" ? `${item.discountValue}%` : formatMoney(item.discountValue)}</td>
                      <td className="tabular-nums">{item.usedCount} dùng · {item.reservedCount} giữ{left !== null ? ` · ${left} còn` : ""}</td>
                      <td>{localDate(item.startsAt)} – {localDate(item.endsAt)}{expired && <><br /><Badge tone="red">Đã hết hạn</Badge></>}</td>
                      <td><Badge tone={item.status === "Active" ? "green" : "slate"}>{statusName[item.status] ?? item.status}</Badge></td>
                      <td>
                        <RowActionsMenu
                          ariaLabel={`Thao tác cho mã ${item.code}`}
                          primary={{ label: "Sửa", disabled: busy, onClick: () => setEditing(item) }}
                          items={[
                            ...(!expired ? [{
                              label: item.status === "Active" ? "Tạm dừng" : "Kích hoạt",
                              disabled: busy,
                              onClick: () => { setFailure(null); setPending({ kind: "status", item, next: item.status === "Active" ? "Inactive" : "Active" }); },
                            }] : []),
                            {
                              label: "Xóa",
                              danger: true,
                              dividerBefore: !expired,
                              disabled: busy,
                              onClick: () => { setFailure(null); setPending({ kind: "delete", item }); },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataState>
        {resource.data && resource.data.pagination.totalPages > 1 && <AdminPagination page={page} pageSize={resource.data.pagination.pageSize} totalItems={resource.data.pagination.totalCount} totalPages={resource.data.pagination.totalPages} onPageChange={setPage} itemLabel="mã" />}
      </Card>
      {editing && <VoucherFormDialog scope={scope} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); setNotice(message); showToast(message, "success"); resource.reload(); }} />}
      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "delete" ? `Xóa mã ${pending.item.code}?` : pending?.kind === "status" ? `${pending.next === "Active" ? "Kích hoạt" : "Tạm dừng"} mã ${pending.item.code}?` : ""}
        confirmLabel={pending?.kind === "delete" ? "Xóa mã" : "Xác nhận"}
        busy={busy}
        error={failure}
        onConfirm={() => void runPending()}
        onClose={() => setPending(null)}
      >
        <p>{pending?.kind === "delete" ? "Mã bị xóa không dùng được nữa. Thao tác này không hoàn tác được." : "Người mua sẽ thấy thay đổi ngay."}</p>
      </ConfirmDialog>
    </div>
  );
}

function VoucherFormDialog({ scope, item, onClose, onSaved }: { scope: "admin" | "seller"; item: DiscountSummary | null; onClose: () => void; onSaved: (message: string) => void }) {
  const editing = item !== null;
  const [form, setForm] = useState<CreateDiscountInput>(item ? { code: item.code, name: item.name, scopeType: item.scopeType, ownerSellerId: item.ownerSellerId, discountType: item.discountType, discountValue: item.discountValue, minOrderAmount: item.minOrderAmount, maxDiscountAmount: item.maxDiscountAmount, maxUsesTotal: item.maxUsesTotal, maxUsesPerUser: item.maxUsesPerUser ?? 1, isVisible: item.isVisible, startsAt: item.startsAt, endsAt: item.endsAt, scopes: item.scopes } : { ...blank });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const needsSku = form.scopeType === "Product" && !editing;
  const skus = useApiResource(needsSku && scope === "seller" ? "voucher-own-skus" : null, async (signal) => {
    const details = await sellerCatalogService.listAllProductDetails(signal);
    return details.flatMap((detail) => detail.variants.filter((sku) => sku.isActive).map((sku) => ({ id: sku.variantId, label: `${detail.name} · ${sku.skuCode}` })));
  });

  async function save(event: FormEvent) {
    event.preventDefault();
    const issue = validateVoucherForm(form);
    if (issue) { setProblem(issue); return; }
    if (needsSku && !form.scopes?.some((entry) => entry.scopeRefId)) { setProblem("Chọn ít nhất một SKU cho mã sản phẩm."); return; }
    setProblem("");
    setFailure(null);
    setBusy(true);
    try {
      if (item) {
        await discountService.update(item.id, { name: form.name, isVisible: form.isVisible, maxUsesPerUser: form.maxUsesPerUser, maxUsesTotal: form.maxUsesTotal, endsAt: form.endsAt });
        onSaved("Đã cập nhật mã giảm giá.");
      } else {
        await discountService.create({ ...form, code: form.code.trim().toUpperCase(), ownerSellerId: scope === "seller" ? null : form.ownerSellerId });
        onSaved("Đã tạo mã giảm giá.");
      }
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={editing ? "Sửa mã giảm giá" : "Tạo mã giảm giá"} busy={busy} onClose={onClose}>
      <form onSubmit={(event) => void save(event)} className="voucher-form" noValidate>
        <label>Mã<input className="field" maxLength={50} disabled={editing || busy} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
        <label>Tên chương trình<input className="field" maxLength={150} disabled={busy} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <div className="voucher-form-grid">
          <label>Phạm vi<select className="select-field" disabled={editing || busy} value={form.scopeType} onChange={(event) => setForm({ ...form, scopeType: event.target.value as DiscountScopeType, scopes: [] })}>{Object.entries(scopeName).filter(([key]) => scope === "admin" || key !== "System").map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
          <label>Loại giảm<select className="select-field" disabled={editing || busy} value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value as DiscountType })}><option value="Percentage">Phần trăm</option><option value="FixedAmount">Số tiền</option></select></label>
        </div>
        {form.scopeType !== "System" && scope === "admin" && <label>Mã người bán (UUID)<input className="field" disabled={editing || busy} value={form.ownerSellerId ?? ""} onChange={(event) => setForm({ ...form, ownerSellerId: event.target.value })} /></label>}
        {needsSku && (
          <label>SKU áp dụng
            {scope === "seller" ? (
              <select className="select-field" disabled={busy || skus.loading} value={form.scopes?.[0]?.scopeRefId ?? ""} onChange={(event) => setForm({ ...form, scopes: event.target.value ? [{ scopeRefType: "Sku", scopeRefId: event.target.value }] : [] })}>
                <option value="">{skus.loading ? "Đang tải SKU…" : "Chọn SKU của bạn"}</option>
                {skus.data?.map((sku) => <option key={sku.id} value={sku.id}>{sku.label}</option>)}
              </select>
            ) : (
              <input className="field" disabled={busy} value={form.scopes?.[0]?.scopeRefId ?? ""} onChange={(event) => setForm({ ...form, scopes: [{ scopeRefType: "Sku", scopeRefId: event.target.value }] })} placeholder="Mã SKU (UUID)" />
            )}
          </label>
        )}
        <div className="voucher-form-grid">
          <label>Giá trị giảm<input className="field" type="number" min="1" max={form.discountType === "Percentage" ? 100 : undefined} disabled={editing || busy} value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: Number(event.target.value) })} /></label>
          <label>Đơn tối thiểu<input className="field" type="number" min="0" disabled={editing || busy} value={form.minOrderAmount} onChange={(event) => setForm({ ...form, minOrderAmount: Number(event.target.value) })} /></label>
        </div>
        <div className="voucher-form-grid">
          <label>Giảm tối đa<input className="field" type="number" min="0" disabled={editing || busy} value={form.maxDiscountAmount ?? ""} onChange={(event) => setForm({ ...form, maxDiscountAmount: numberOrNull(event.target.value) })} /></label>
          <label>Tổng lượt dùng<input className="field" type="number" min="1" disabled={busy} value={form.maxUsesTotal ?? ""} onChange={(event) => setForm({ ...form, maxUsesTotal: numberOrNull(event.target.value) })} /></label>
        </div>
        <div className="voucher-form-grid">
          <label>Lượt mỗi người<input className="field" type="number" min="1" disabled={busy} value={form.maxUsesPerUser} onChange={(event) => setForm({ ...form, maxUsesPerUser: Number(event.target.value) })} /></label>
          <label>Ngày kết thúc<input className="field" type="datetime-local" disabled={busy} value={form.endsAt?.slice(0, 16) ?? ""} onChange={(event) => setForm({ ...form, endsAt: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
        </div>
        {!editing && <label>Ngày bắt đầu<input className="field" type="datetime-local" disabled={busy} value={form.startsAt?.slice(0, 16) ?? ""} onChange={(event) => setForm({ ...form, startsAt: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>}
        <label className="voucher-checkbox"><input type="checkbox" disabled={busy} checked={form.isVisible} onChange={(event) => setForm({ ...form, isVisible: event.target.checked })} />Hiển thị với người mua</label>
        {problem && <p role="alert" className="form-error">{problem}</p>}
        {failure != null && <ErrorState cause={failure} operation="write" />}
        <div className="voucher-dialog-actions">
          <button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Đóng</button>
          <button type="submit" className="button button-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu mã"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function VoucherManager({ scope }: { scope: "admin" | "seller" }) {
  const enabled = useFeature("vouchers");
  return enabled ? <VoucherManagerContent scope={scope} /> : <FeatureUnavailable />;
}
