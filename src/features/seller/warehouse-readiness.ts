/**
 * Whether the seller's own warehouse can be used to ship an order. A warehouse that exists is not enough: the carrier needs its district and
 * ward. The server also creates a placeholder warehouse without them, so "has a warehouse" must never be read as "can ship".
 */
export type WarehouseReadiness = "ready" | "incomplete" | "none";

export type WarehouseAddressLike = { provinceId?: number | string | null; districtId?: number | string | null; wardCode?: string | null };

export function warehouseReadiness(warehouse: WarehouseAddressLike | null | undefined): WarehouseReadiness {
  if (!warehouse) return "none";
  // The province id is set only by a save that the GHN lists confirmed. A warehouse with a district and ward but no province id (made before
  // the whole chain was kept) cannot quote or ship, so it must show the form to be saved again.
  const province = Number(warehouse.provinceId);
  const district = Number(warehouse.districtId);
  const ward = String(warehouse.wardCode ?? "").trim();
  return Number.isFinite(province) && province > 0 && Number.isFinite(district) && district > 0 && ward ? "ready" : "incomplete";
}

export type AcceptBlock = { message: string; readiness: "incomplete" | "none" };

/** Why "Chấp nhận đơn" is blocked for this readiness, or null when the seller may accept. Unknown (still loading) never blocks: the server checks too. */
export function acceptOrderBlock(readiness: WarehouseReadiness | null | undefined): AcceptBlock | null {
  if (readiness === "incomplete") {
    return { readiness, message: "Kho của bạn chưa có đủ quận và phường lấy hàng nên chưa giao được đơn. Hãy hoàn thiện kho ở trang Quản lý kho." };
  }
  if (readiness === "none") {
    return { readiness, message: "Gian hàng chưa có kho. Nhân viên cần khôi phục kho cho gian hàng của bạn trước khi nhận đơn." };
  }
  return null;
}
