"use client";

import { useState, type FormEvent } from "react";
import { Card } from "@/components/ui/Primitives";
import { ErrorState } from "@/components/ui/States";
import { GhnLocationSelect } from "@/features/shipping/GhnLocationSelect";
import { EMPTY_GHN_SELECTION, validateGhnSelection, type GhnErrors, type GhnSelection } from "@/features/shipping/ghn-address";
import { sellerCatalogService, type WarehouseInfo } from "../services/catalog.service";
import type { WarehouseReadiness } from "../warehouse-readiness";

export type WarehouseAddressPrefill = { provinceId: string; districtId: string; wardCode: string; streetAddress: string; phone: string };

/**
 * Completes the warehouse the seller already has (the server never lets the seller create a second one from here). The district and ward
 * come from the GHN lists the back end serves, so the codes the carrier needs are always real.
 * With no warehouse there is nothing to edit: the seller is told staff must restore it, and no button creates one.
 */
export function SellerWarehouseGate({ readiness, warehouse, onSaved }: {
  readiness: WarehouseReadiness;
  warehouse: WarehouseInfo | null;
  /** The shop profile address; kept in the props for callers, the selection is made from the GHN lists. */
  profile?: WarehouseAddressPrefill;
  onSaved: () => void;
}) {
  const [name, setName] = useState(warehouse?.name ?? "");
  const [phone, setPhone] = useState(warehouse?.contactPhone ?? "");
  const [street, setStreet] = useState(warehouse?.address ?? "");
  const [ghn, setGhn] = useState<GhnSelection>(EMPTY_GHN_SELECTION);
  const [ghnErrors, setGhnErrors] = useState<GhnErrors>({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [saved, setSaved] = useState("");
  // The warehouse can arrive after the form first renders or change after a save; the fields follow it until the user starts typing.
  const [touched, setTouched] = useState(false);
  const warehouseKey = [warehouse?.id, warehouse?.name, warehouse?.contactPhone, warehouse?.address].join("|");
  const [seenWarehouseKey, setSeenWarehouseKey] = useState(warehouseKey);
  if (seenWarehouseKey !== warehouseKey) {
    setSeenWarehouseKey(warehouseKey);
    if (!touched) {
      setName(warehouse?.name ?? "");
      setPhone(warehouse?.contactPhone ?? "");
      setStreet(warehouse?.address ?? "");
    }
  }

  if (readiness === "ready") return null;
  if (readiness === "none" || !warehouse) {
    return <p className="notice" role="alert" id="warehouse-gate" style={{ marginBottom: 16 }}>
      Gian hàng chưa có kho. Nhân viên cần khôi phục kho cho gian hàng của bạn, hãy liên hệ hỗ trợ. Trong lúc đó bạn chưa nhận được đơn hàng.
    </p>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !warehouse) return;
    const found = validateGhnSelection(ghn);
    setGhnErrors(found);
    if (Object.keys(found).length > 0 || !ghn.districtId) return;
    if (!street.trim()) { setProblem("Nhập địa chỉ cụ thể của kho."); return; }
    setProblem("");
    setBusy(true);
    setFailure(null);
    setSaved("");
    try {
      await sellerCatalogService.updateWarehouse(warehouse.id, {
        name: name.trim() || warehouse.name,
        address: street.trim(),
        contactPhone: phone.trim() || undefined,
        provinceName: ghn.provinceName,
        provinceId: ghn.provinceId ?? undefined,
        districtId: ghn.districtId,
        wardCode: ghn.wardCode,
      });
      setSaved("Đã cập nhật kho. Bạn có thể nhận đơn và tạo vận đơn.");
      onSaved();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return <Card className="card-pad" style={{ marginBottom: 16 }}>
    <h2>Hoàn thiện địa chỉ kho</h2>
    <p className="notice" role="status">Kho của bạn chưa có đủ quận và phường lấy hàng nên chưa giao được đơn. Chọn địa chỉ rồi lưu.</p>
    <form className="auth-fields" onSubmit={(event) => void submit(event)} noValidate>
      <label className="field-wrap">Tên kho<input className="field" maxLength={150} disabled={busy} value={name} onChange={(event) => { setTouched(true); setName(event.target.value); }} /></label>
      <label className="field-wrap">Số điện thoại kho<input className="field" inputMode="tel" maxLength={20} disabled={busy} value={phone} onChange={(event) => { setTouched(true); setPhone(event.target.value); }} /></label>
      <label className="field-wrap">Địa chỉ cụ thể (số nhà, đường)<input className="field" disabled={busy} aria-invalid={Boolean(problem)} value={street} onChange={(event) => { setTouched(true); setStreet(event.target.value); }} />{problem && <small className="checkout-field-error" role="alert">{problem}</small>}</label>
      <GhnLocationSelect value={ghn} errors={ghnErrors} disabled={busy} onChange={(next) => { setGhn(next); setGhnErrors({}); }} />
      <div className="action-row">
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu kho"}</button>
      </div>
      {failure != null && <ErrorState cause={failure} operation="write" />}
      {saved && <p className="form-success" role="status">{saved}</p>}
    </form>
  </Card>;
}
