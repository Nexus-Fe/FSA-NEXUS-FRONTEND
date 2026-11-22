"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { formatMoney } from "@/lib/presentation";
import { GhnLocationSelect } from "@/features/shipping/GhnLocationSelect";
import { EMPTY_GHN_SELECTION, buildShippingAddress, validateGhnSelection, type GhnErrors, type GhnSelection } from "@/features/shipping/ghn-address";
import { describeFeeChange } from "./order-rules";

type ActionResult = { kind: "ok" | "error" | "unknown"; text: string };

/** Text of a failed write that changes money or addresses. Unknown outcomes tell the buyer to check, never to blindly retry. */
function failure(cause: unknown): ActionResult {
  const described = describeError(cause, { operation: "write" });
  return { kind: described.kind === "unknown-outcome" ? "unknown" : "error", text: formatError(described) };
}

/** Pays an unpaid wallet order again (`POST /orders/{id}/pay`). The order keeps its id, so a second press after success is refused by status. */
export function RepayButton({ orderId, total, onDone }: { orderId: string; total: number; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [locked, setLocked] = useState(false);

  async function repay() {
    if (busy || locked) return;
    setBusy(true);
    setResult(null);
    try {
      await api.post(`/api/v1/orders/${encodeURIComponent(orderId)}/pay`);
      onDone("Đã thanh toán đơn hàng bằng Ví Nexus.");
    } catch (cause) {
      const outcome = failure(cause);
      setResult(outcome);
      // After an unknown result the order is reloaded by the page; paying again waits until the buyer has seen its status.
      if (outcome.kind === "unknown") setLocked(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="button button-primary" disabled={busy || locked} onClick={() => void repay()}>
        {busy ? "Đang thanh toán…" : `Thanh toán lại · ${formatMoney(total)}`}
      </button>
      {result && <p className={result.kind === "ok" ? "form-success" : "notice"} role={result.kind === "ok" ? "status" : "alert"}>{result.text}</p>}
    </>
  );
}

/** Confirms the whole order as completed once every active sub-order is delivered (`POST /orders/{id}/complete`). */
export function CompleteOrderButton({ orderId, onDone }: { orderId: string; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function complete() {
    setBusy(true);
    setResult(null);
    try {
      await api.post(`/api/v1/orders/${encodeURIComponent(orderId)}/complete`);
      setOpen(false);
      onDone("Đã hoàn tất đơn hàng. Tiền hàng được giải ngân cho người bán theo quy định.");
    } catch (cause) {
      setResult(failure(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="button button-secondary" onClick={() => { setResult(null); setOpen(true); }}>Hoàn tất đơn hàng</button>
      <Modal
        open={open}
        title="Hoàn tất đơn hàng?"
        busy={busy}
        onClose={() => setOpen(false)}
        footer={<>
          <button type="button" className="button button-secondary" disabled={busy} onClick={() => setOpen(false)}>Để sau</button>
          <button type="button" className="button button-primary" disabled={busy} onClick={() => void complete()}>{busy ? "Đang xử lý…" : "Xác nhận hoàn tất"}</button>
        </>}
      >
        <p>Chỉ xác nhận khi bạn đã nhận đủ hàng của tất cả gian hàng trong đơn. Sau khi hoàn tất, tiền hàng được giải ngân cho người bán.</p>
        {result && <p className="notice" role="alert">{result.text}</p>}
      </Modal>
    </>
  );
}

type AddressForm = { receiverName: string; phone: string; street: string };
type AddressErrors = Partial<Record<keyof AddressForm, string>> & GhnErrors;
const EMPTY_FORM: AddressForm = { receiverName: "", phone: "", street: "" };

export function validateAddressForm(form: AddressForm, ghn: GhnSelection): AddressErrors {
  const errors: AddressErrors = {};
  if (!form.receiverName.trim()) errors.receiverName = "Nhập tên người nhận.";
  if (!/^(0|\+84)\d{9,10}$/.test(form.phone.trim().replace(/\s/g, ""))) errors.phone = "Số điện thoại chưa hợp lệ.";
  if (!form.street.trim()) errors.street = "Nhập địa chỉ cụ thể.";
  return { ...errors, ...validateGhnSelection(ghn) };
}

/**
 * Changes the shipping address of one sub-order (`PATCH /sub-orders/{id}/shipping-address`) while it has not shipped.
 * Before shipping starts the back end may refuse (`CANNOT_CHANGE_ADDRESS_AFTER_SHIPPING`, `SHIPPING_FEE_INCREASED`); both have their own text.
 */
export function ChangeAddressButton({ subOrderId, onDone }: { subOrderId: string; onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [ghn, setGhn] = useState<GhnSelection>(EMPTY_GHN_SELECTION);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateAddressForm(form, ghn);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setResult(null);
    try {
      const response = unwrap(
        await api.patch<ApiResponse<{ oldShippingFee: number; newShippingFee: number; totalAmount: number }> | { oldShippingFee: number; newShippingFee: number; totalAmount: number }>(
          `/api/v1/sub-orders/${encodeURIComponent(subOrderId)}/shipping-address`,
          {
            shippingAddress: buildShippingAddress({ receiverName: form.receiverName, phone: form.phone, street: form.street }, ghn),
            contactPhone: form.phone.trim(),
          },
        ),
      );
      const change = describeFeeChange(response.oldShippingFee, response.newShippingFee);
      setOpen(false);
      setForm(EMPTY_FORM);
      setGhn(EMPTY_GHN_SELECTION);
      onDone(
        change === "same" ? "Đã đổi địa chỉ giao hàng. Phí giao hàng không đổi."
          : `Đã đổi địa chỉ giao hàng. Phí giao hàng ${change === "up" ? "tăng" : "giảm"} từ ${formatMoney(response.oldShippingFee)} còn ${formatMoney(response.newShippingFee)}.`,
      );
    } catch (cause) {
      setResult(failure(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="button button-secondary button-small" onClick={() => { setResult(null); setOpen(true); }}>Đổi địa chỉ giao hàng</button>
      <Modal
        open={open}
        title="Đổi địa chỉ giao hàng"
        busy={busy}
        onClose={() => setOpen(false)}
      >
        <form className="voucher-form" onSubmit={(event) => void submit(event)} noValidate>
          <label>Họ tên người nhận<input className="field" value={form.receiverName} onChange={(e) => setForm({ ...form, receiverName: e.target.value })} aria-invalid={Boolean(errors.receiverName)} />{errors.receiverName && <small className="checkout-field-error" role="alert">{errors.receiverName}</small>}</label>
          <label>Số điện thoại<input className="field" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-invalid={Boolean(errors.phone)} />{errors.phone && <small className="checkout-field-error" role="alert">{errors.phone}</small>}</label>
          <label>Địa chỉ cụ thể<input className="field" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} aria-invalid={Boolean(errors.street)} />{errors.street && <small className="checkout-field-error" role="alert">{errors.street}</small>}</label>
          <GhnLocationSelect value={ghn} errors={errors} disabled={busy} onChange={setGhn} />
          {result && <p className="notice" role="alert">{result.text}</p>}
          <div className="voucher-dialog-actions">
            <button type="button" className="button button-secondary" disabled={busy} onClick={() => setOpen(false)}>Đóng</button>
            <button type="submit" className="button button-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu địa chỉ mới"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
