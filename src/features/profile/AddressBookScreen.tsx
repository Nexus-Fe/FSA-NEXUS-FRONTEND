"use client";

import { useState, type FormEvent } from "react";
import { Badge, Card, PageHeading } from "@/components/ui/Primitives";
import { Modal } from "@/components/ui/Modal";
import { DataState, ErrorState } from "@/components/ui/States";
import { useApiResource } from "@/lib/api/use-api-resource";
import { GhnLocationSelect } from "@/features/shipping/GhnLocationSelect";
import { EMPTY_GHN_SELECTION, type GhnSelection } from "@/features/shipping/ghn-address";
import { EMPTY_ADDRESS_FORM, describeAddress, sortAddresses, toAddressInput, toGhnSelection, validateAddressBookForm, type AddressFormErrors, type AddressFormValues } from "./address-rules";
import { addressService, type UserAddress } from "./services/address.service";

export function AddressBookScreen() {
  const addresses = useApiResource("my-address-book", (signal) => addressService.list(signal));
  const [editing, setEditing] = useState<UserAddress | "new" | null>(null);
  const [deleting, setDeleting] = useState<UserAddress | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const list = sortAddresses(addresses.data ?? []);

  async function makeDefault(address: UserAddress) {
    setBusyId(address.id);
    setActionError(null);
    try {
      await addressService.setDefault(address.id);
      addresses.reload();
    } catch (cause) {
      setActionError(cause);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ width: "min(960px, 100%)", marginInline: "auto", display: "grid", gap: "18px" }}>
      <PageHeading
        title="Sổ địa chỉ giao hàng"
        description="Lưu địa chỉ để chọn nhanh khi thanh toán."
        action={<button type="button" className="button button-primary" onClick={() => setEditing("new")}>Thêm địa chỉ</button>}
      />
      {actionError != null && <ErrorState cause={actionError} operation="write" />}
      <DataState loading={addresses.loading} error={addresses.error} empty={list.length === 0} emptyTitle="Bạn chưa lưu địa chỉ nào" onRetry={addresses.reload}>
        <div className="order-detail-layout">
          {list.map((address) => (
            <Card className="card-pad" key={address.id}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <h2 style={{ margin: 0 }}>{address.recipientName} · {address.phone}</h2>
                <span>{address.label && <Badge tone="slate">{address.label}</Badge>} {address.isDefault && <Badge tone="green">Mặc định</Badge>}</span>
              </div>
              <p>{describeAddress(address)}</p>
              <div className="action-row">
                <button type="button" className="button button-secondary button-small" onClick={() => setEditing(address)}>Sửa</button>
                {!address.isDefault && <button type="button" className="button button-secondary button-small" disabled={busyId === address.id} onClick={() => void makeDefault(address)}>{busyId === address.id ? "Đang lưu…" : "Đặt làm mặc định"}</button>}
                <button type="button" className="button button-secondary button-small" onClick={() => setDeleting(address)}>Xóa</button>
              </div>
            </Card>
          ))}
        </div>
      </DataState>
      {editing && <AddressDialog address={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); addresses.reload(); }} />}
      {deleting && <DeleteDialog address={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); addresses.reload(); }} />}
    </div>
  );
}

function AddressDialog({ address, onClose, onSaved }: { address: UserAddress | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AddressFormValues>(address ? { recipientName: address.recipientName, phone: address.phone, label: address.label ?? "", addressLine: address.addressLine, isDefault: address.isDefault } : EMPTY_ADDRESS_FORM);
  const [ghn, setGhn] = useState<GhnSelection>(address ? toGhnSelection(address) : EMPTY_GHN_SELECTION);
  const [errors, setErrors] = useState<AddressFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateAddressBookForm(form, ghn);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setFailure(null);
    try {
      const input = toAddressInput(form, ghn);
      if (address) await addressService.update(address.id, input);
      else await addressService.create(input);
      onSaved();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  const text = (field: keyof AddressFormValues, label: string, type = "text") => (
    <label>{label}
      <input className="field" type={type} value={String(form[field])} disabled={busy} aria-invalid={Boolean(errors[field])} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />
      {errors[field] && <small className="checkout-field-error" role="alert">{errors[field]}</small>}
    </label>
  );

  return (
    <Modal open title={address ? "Sửa địa chỉ" : "Thêm địa chỉ"} busy={busy} onClose={onClose}>
      <form className="voucher-form" onSubmit={(event) => void submit(event)} noValidate>
        {text("recipientName", "Họ tên người nhận")}
        {text("phone", "Số điện thoại", "tel")}
        {text("label", "Nhãn (không bắt buộc, ví dụ: Nhà riêng)")}
        {text("addressLine", "Địa chỉ cụ thể")}
        <GhnLocationSelect value={ghn} errors={errors} disabled={busy} onChange={setGhn} />
        <label className="voucher-checkbox"><input type="checkbox" checked={form.isDefault} disabled={busy} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />Đặt làm địa chỉ mặc định</label>
        {failure != null && <ErrorState cause={failure} operation="write" />}
        <div className="voucher-dialog-actions">
          <button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Đóng</button>
          <button type="submit" className="button button-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu địa chỉ"}</button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({ address, onClose, onDeleted }: { address: UserAddress; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  async function remove() {
    setBusy(true);
    setFailure(null);
    try {
      await addressService.remove(address.id);
      onDeleted();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Xóa địa chỉ này?"
      busy={busy}
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Giữ lại</button>
        <button type="button" className="button button-primary" disabled={busy} onClick={() => void remove()}>{busy ? "Đang xóa…" : "Xóa địa chỉ"}</button>
      </>}
    >
      <p>{address.recipientName} · {describeAddress(address)}</p>
      {failure != null && <ErrorState cause={failure} operation="write" />}
    </Modal>
  );
}
