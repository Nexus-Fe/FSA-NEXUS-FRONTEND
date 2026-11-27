"use client";

import { useState, type FormEvent } from "react";
import { AdminPagination, Badge, Card, NoData, PageHeading, TruncatedText } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatError, describeError } from "@/lib/errors/error-messages";
import { formatMoney } from "@/lib/presentation";
import {
  fulfillmentService,
  shipmentStatusLabel,
  shipmentStatusTone,
  ShipmentTimelineList,
  type PagedShipments,
  type ShipmentDetail,
  type SubOrderShipment,
} from "@/features/fulfillment";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GHN_SIMULATE_STATUS_OPTIONS = [
  {
    value: "picking",
    label: "Đang lấy hàng (picking)",
    description: "Bưu tá GHN đang trên đường tới kho người bán để nhận bưu kiện.",
    tone: "amber" as const,
  },
  {
    value: "storing",
    label: "Đã đóng gói / Nhập kho GHN (storing)",
    description: "Bưu kiện đã được đóng gói hoặc nhập kho phân loại GHN.",
    tone: "amber" as const,
  },
  {
    value: "picked",
    label: "Đã lấy hàng / Bàn giao (picked)",
    description: "Bưu tá GHN đã nhận hàng từ người bán. Hệ thống tự động chuyển SubOrder sang 'Đang giao'.",
    tone: "sky" as const,
  },
  {
    value: "delivering",
    label: "Đang giao hàng (delivering)",
    description: "Bưu tá GHN đang trên đường vận chuyển tới người nhận.",
    tone: "sky" as const,
  },
  {
    value: "delivered",
    label: "Giao thành công (delivered)",
    description: "Giao hàng thành công. SubOrder chuyển sang 'Đã giao' và cho phép người mua xác nhận hoàn tất.",
    tone: "green" as const,
  },
  {
    value: "delivery_fail",
    label: "Giao thất bại (delivery_fail)",
    description: "Khách hẹn lại ngày giao hoặc không liên lạc được. Ghi nhận lần giao hàng thất bại.",
    tone: "red" as const,
  },
  {
    value: "returning",
    label: "Đang chuyển hoàn (returning)",
    description: "Hàng đang được đơn vị vận chuyển gửi trả về kho người bán.",
    tone: "amber" as const,
  },
  {
    value: "returned",
    label: "Đã trả hàng hoàn (returned)",
    description: "Người bán nhận lại hàng hoàn. Tự động phục hồi tồn kho và hoàn tiền ví (nếu đã thanh toán).",
    tone: "slate" as const,
  },
  {
    value: "cancel",
    label: "Hủy vận đơn (cancel)",
    description: "Hủy bỏ yêu cầu giao vận trên hệ thống GHN.",
    tone: "red" as const,
  },
];

const SHIPMENT_FILTER_STATUS_OPTIONS = [
  { value: "ReadyToPick", label: "Chờ lấy hàng" },
  { value: "Picking", label: "Đang lấy hàng" },
  { value: "Packed", label: "Đã đóng gói" },
  { value: "HandedOver", label: "Đã bàn giao" },
  { value: "InTransit", label: "Đang vận chuyển" },
  { value: "Delivered", label: "Đã giao" },
  { value: "DeliveryFailed", label: "Giao lỗi" },
  { value: "Returning", label: "Đang hoàn hàng" },
  { value: "Returned", label: "Đã hoàn hàng" },
  { value: "Cancelled", label: "Đã hủy" },
] as const;

type SortOptionValue = "createdAt:desc" | "createdAt:asc" | "updatedAt:desc" | "updatedAt:asc";

const SORT_OPTIONS: Array<{ value: SortOptionValue; label: string; sortBy: "createdAt" | "updatedAt"; sortOrder: "asc" | "desc" }> = [
  { value: "createdAt:desc", label: "Mới nhất (Ngày tạo ↓)", sortBy: "createdAt", sortOrder: "desc" },
  { value: "createdAt:asc", label: "Cũ nhất (Ngày tạo ↑)", sortBy: "createdAt", sortOrder: "asc" },
  { value: "updatedAt:desc", label: "Cập nhật gần nhất (↓)", sortBy: "updatedAt", sortOrder: "desc" },
  { value: "updatedAt:asc", label: "Cập nhật lâu nhất (↑)", sortBy: "updatedAt", sortOrder: "asc" },
];

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN");
}

function getLatestEventTime(shipment: ShipmentDetail): string | null {
  if (!shipment.events?.length) return null;
  const sorted = [...shipment.events].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  return sorted[0]?.occurredAt ?? null;
}

export function AdminShipmentsScreen() {
  const [inputCode, setInputCode] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("picked");
  const [shipperName, setShipperName] = useState("Nguyễn Văn Shipper");
  const [shipperPhone, setShipperPhone] = useState("0901234567");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [printPageSize, setPrintPageSize] = useState<"A5" | "80x80" | "52x70">("A5");

  const [activeShipment, setActiveShipment] = useState<ShipmentDetail | null>(null);
  const [masterOrderShipments, setMasterOrderShipments] = useState<SubOrderShipment[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOptionValue>("createdAt:desc");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const activeSort = SORT_OPTIONS.find((s) => s.value === sortOption) ?? SORT_OPTIONS[0];
  const statusQuery = selectedStatuses.join(",");

  const shipmentsResource = useApiResource(
    `admin-shipments:${page}:${appliedSearch}:${statusQuery}:${sortOption}:${refreshTrigger}`,
    (signal) =>
      fulfillmentService.listShipments(
        {
          page,
          pageSize: 10,
          search: appliedSearch || undefined,
          status: statusQuery || undefined,
          sortBy: activeSort.sortBy,
          sortOrder: activeSort.sortOrder,
        },
        signal,
      ),
  );

  async function resolveShipmentByAnyCode(rawCode: string): Promise<ShipmentDetail | null> {
    const code = rawCode.trim();
    if (!code) return null;

    // 1. Direct lookup via Fulfillment /tracking/{code} (supports GHN code, SubOrderNo SUB-.../AO-..., SubOrderId GUID, ShipmentId GUID)
    try {
      return await fulfillmentService.getShipmentByTracking(code);
    } catch {
      // Continue to fallback lookups
    }

    // 2. If UUID, try Fulfillment /sub-orders/{id}, list filter by SubOrderId, then Commerce Master Order tracking
    if (UUID_REGEX.test(code)) {
      try {
        return await fulfillmentService.getShipmentBySubOrderId(code);
      } catch {
        // Continue
      }

      try {
        const byOrder = await fulfillmentService.listShipments({ orderId: code, page: 1, pageSize: 1 });
        if (byOrder.items.length > 0) {
          return byOrder.items[0];
        }
      } catch {
        // Continue to Commerce master order lookup
      }

      try {
        const masterTracking = await fulfillmentService.getOrderTracking(code);
        const subs = masterTracking.shipments ?? [];
        if (subs.length > 0) {
          setMasterOrderShipments(subs);
          const firstWithCode = subs.find((s) => s.trackingCode) ?? subs[0];
          const lookupKey = firstWithCode.trackingCode ?? firstWithCode.subOrderId;
          try {
            return await fulfillmentService.getShipmentByTracking(lookupKey);
          } catch {
            const listRes = await fulfillmentService.listShipments({
              orderId: firstWithCode.subOrderId,
              page: 1,
              pageSize: 1,
            });
            if (listRes.items.length > 0) return listRes.items[0];
          }
        }
      } catch {
        // Fall through to general search
      }
    }

    // 3. Fallback search in Fulfillment list (partial tracking code / phone / receiver name)
    try {
      const searchRes = await fulfillmentService.listShipments({
        search: code,
        page: 1,
        pageSize: 5,
      });
      if (searchRes.items.length > 0) {
        return searchRes.items[0];
      }
    } catch {
      // No match
    }

    return null;
  }

  async function handleLookup(codeToSearch?: string) {
    const code = (codeToSearch ?? inputCode).trim();
    if (!code) {
      setErrorMessage("Vui lòng nhập mã vận đơn GHN, SubOrder ID hoặc Order ID để tra cứu.");
      return;
    }
    setLookupLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    setMasterOrderShipments([]);
    try {
      const detail = await resolveShipmentByAnyCode(code);
      if (!detail) {
        setActiveShipment(null);
        setErrorMessage(`Không tìm thấy vận đơn nào khớp với mã "${code}".`);
        return;
      }
      setActiveShipment(detail);
      setInputCode(detail.trackingNumber ?? detail.orderId ?? detail.id);
    } catch (cause) {
      setActiveShipment(null);
      setErrorMessage(
        cause instanceof Error && cause.message
          ? cause.message
          : `Không tìm thấy vận đơn nào khớp với mã "${code}".`,
      );
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleSimulateSubmit(event: FormEvent) {
    event.preventDefault();
    const tracking = inputCode.trim();
    if (!tracking) {
      setErrorMessage("Vui lòng nhập mã vận đơn GHN hoặc SubOrder ID để cập nhật trạng thái.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const selectedOption = GHN_SIMULATE_STATUS_OPTIONS.find((opt) => opt.value === selectedStatus);
      const desc = description.trim() || selectedOption?.description || `Mô phỏng trạng thái ${selectedStatus}`;

      const res = await fulfillmentService.simulateShipperStatus({
        trackingNumber: tracking,
        status: selectedStatus,
        description: desc,
        shipperName: shipperName.trim() || "Nguyễn Văn Shipper",
        shipperPhone: shipperPhone.trim() || "0901234567",
        reason: reason.trim() || undefined,
        force,
      });

      setSuccessMessage(
        `Cập nhật trạng thái thành công! Trạng thái vận đơn: "${shipmentStatusLabel(res.currentStatus ?? res.newStatus)}". ${
          res.commerceStatusNotified ? `Đã đồng bộ sang Commerce đơn hàng (${res.commerceStatusNotified}).` : ""
        }`,
      );

      setRefreshTrigger((v) => v + 1);
      const updated = await resolveShipmentByAnyCode(res.trackingNumber || tracking);
      if (updated) {
        setActiveShipment(updated);
      }
    } catch (cause) {
      setErrorMessage(formatError(describeError(cause, { operation: "write" })));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePrintLabel(shipmentId?: string) {
    const id = shipmentId ?? activeShipment?.id;
    if (!id || printLoading) return;
    setPrintLoading(true);
    setErrorMessage("");
    try {
      const label = await fulfillmentService.getPrintLabel(id, printPageSize);
      if (label.printUrl) {
        window.open(label.printUrl, "_blank", "noopener,noreferrer");
      } else {
        setErrorMessage("Không nhận được đường dẫn in phiếu giao hàng từ GHN.");
      }
    } catch (cause) {
      setErrorMessage(formatError(describeError(cause, { operation: "read" })));
    } finally {
      setPrintLoading(false);
    }
  }

  function selectShipmentFromTable(shipment: ShipmentDetail) {
    const code = shipment.trackingNumber ?? shipment.subOrderNo ?? shipment.orderId ?? shipment.id;
    setInputCode(code);
    setActiveShipment(shipment);
    setMasterOrderShipments([]);
    setErrorMessage("");
    setSuccessMessage(`Đã chọn vận đơn ${code}. Bạn có thể thay đổi trạng thái bên dưới.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleTableSearchSubmit(event: FormEvent) {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(1);
  }

  function toggleStatusFilter(statusValue: string) {
    setSelectedStatuses((prev) =>
      prev.includes(statusValue)
        ? prev.filter((s) => s !== statusValue)
        : [...prev, statusValue],
    );
    setPage(1);
  }

  function clearTableFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setSelectedStatuses([]);
    setSortOption("createdAt:desc");
    setPage(1);
  }

  const pagedData: PagedShipments | null = shipmentsResource.data ?? null;
  const hasActiveFilters = Boolean(appliedSearch || selectedStatuses.length > 0 || sortOption !== "createdAt:desc");

  return (
    <div className="page-stack">
      <PageHeading
        title="Quản lý Vận đơn & Giả lập Shipper (GHN)"
        description="Tra cứu vận đơn, cập nhật các mốc trạng thái giao vận GHN Sandbox và đồng bộ tức thì sang Commerce."
        action={
          <div className="action-row">
            <a
              href="https://5sao.ghn.dev/ops-live"
              target="_blank"
              rel="noopener noreferrer"
              className="button button-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Icon name="externalLink" size={15} />
              Cổng GHN 5 Sao
            </a>
            <a
              href="https://developer.ghn.dev/vi"
              target="_blank"
              rel="noopener noreferrer"
              className="button button-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Icon name="externalLink" size={15} />
              Tài liệu API GHN
            </a>
          </div>
        }
      />

      {successMessage && <p className="form-success" role="status">{successMessage}</p>}
      {errorMessage && <p className="notice" role="alert">{errorMessage}</p>}

      {/* KHỐI 1: FORM CẬP NHẬT TRẠNG THÁI SHIPPER */}
      <Card className="card-pad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="truck" size={20} />
            Giả lập hành trình Shipper (Sandbox Testing)
          </h2>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Môi trường GHN: <strong>dev-online-gateway.ghn.vn</strong>
          </span>
        </div>

        <form onSubmit={(e) => void handleSimulateSubmit(e)} className="page-stack" style={{ gap: 14 }}>
          {/* Ô nhập mã & Tra cứu */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
            <label className="field-wrap" style={{ margin: 0 }}>
              <span>Mã vận đơn GHN, mã đơn con (SubOrder) hoặc Order ID (*)</span>
              <input
                className="field"
                placeholder="Nhập mã vận đơn GHN (VD: LY9WHT), mã SubOrder (VD: SUB-... / AO-...) hoặc ID..."
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                required
              />
            </label>
            <button
              type="button"
              className="button button-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 42 }}
              disabled={lookupLoading || !inputCode.trim()}
              onClick={() => void handleLookup()}
            >
              <Icon name="search" size={16} />
              {lookupLoading ? "Đang tra cứu…" : "Tra cứu"}
            </button>
          </div>

          {masterOrderShipments.length > 1 && (
            <div style={{ padding: "10px 12px", borderRadius: 8, backgroundColor: "var(--surface-2, rgba(0,0,0,0.03))", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Đơn hàng cha có {masterOrderShipments.length} đơn con, chọn để kiểm tra:
              </span>
              {masterOrderShipments.map((sub) => (
                <button
                  key={sub.subOrderId}
                  type="button"
                  className="button button-secondary button-small"
                  onClick={() => void handleLookup(sub.trackingCode ?? sub.subOrderId)}
                >
                  {sub.subOrderNo} ({sub.trackingCode ?? "Chưa có mã GHN"})
                </button>
              ))}
            </div>
          )}

          {/* Trạng thái GHN muốn chuyển */}
          <label className="field-wrap">
            <span>Trạng thái muốn cập nhật (*)</span>
            <select
              className="select-field"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              {GHN_SIMULATE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <small style={{ color: "var(--muted)", marginTop: 4 }}>
              {GHN_SIMULATE_STATUS_OPTIONS.find((opt) => opt.value === selectedStatus)?.description}
            </small>
          </label>

          {/* Thông tin Shipper giả lập */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <label className="field-wrap">
              <span>Tên shipper thực hiện</span>
              <input
                className="field"
                value={shipperName}
                onChange={(e) => setShipperName(e.target.value)}
                placeholder="Nguyễn Văn Shipper"
              />
            </label>
            <label className="field-wrap">
              <span>Số điện thoại shipper</span>
              <input
                className="field"
                value={shipperPhone}
                onChange={(e) => setShipperPhone(e.target.value)}
                placeholder="0901234567"
              />
            </label>
          </div>

          {/* Ghi chú & Lý do */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <label className="field-wrap">
              <span>Mô tả sự kiện hành trình</span>
              <input
                className="field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ví dụ: Bưu tá đã lấy hàng thành công từ kho người bán"
              />
            </label>
            {["delivery_fail", "returning", "cancel"].includes(selectedStatus) && (
              <label className="field-wrap">
                <span>Lý do thất bại / hoàn hàng</span>
                <input
                  className="field"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ví dụ: Khách hẹn giao lại ca chiều"
                />
              </label>
            )}
          </div>

          {/* Force override checkbox */}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
            />
            <span>
              <strong>Bắt buộc chuyển trạng thái (Force override)</strong>: Bỏ qua kiểm tra tuần tự vòng đời để test nhảy cóc hoặc lùi trạng thái.
            </span>
          </label>

          {/* Nút Submit */}
          <div className="action-row" style={{ marginTop: 6 }}>
            <button
              type="submit"
              className="button button-primary"
              disabled={submitting || !inputCode.trim()}
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Icon name="truck" size={16} />
              {submitting ? "Đang cập nhật…" : "Cập nhật trạng thái Shipper"}
            </button>
          </div>
        </form>
      </Card>

      {/* KHỐI 2: XEM NHANH VẬN ĐƠN ĐANG CHỌN */}
      {activeShipment && (
        <Card className="card-pad">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="package" size={18} />
              Chi tiết vận đơn: {activeShipment.trackingNumber ?? activeShipment.id}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge tone={shipmentStatusTone(activeShipment.status)}>
                {shipmentStatusLabel(activeShipment.status)}
              </Badge>
              <select
                className="select-field"
                style={{ width: "auto", height: 34, padding: "0 8px", fontSize: 13 }}
                value={printPageSize}
                onChange={(e) => setPrintPageSize(e.target.value as "A5" | "80x80" | "52x70")}
              >
                <option value="A5">Khổ A5</option>
                <option value="80x80">Khổ 80x80 (Nhiệt)</option>
                <option value="52x70">Khổ 52x70</option>
              </select>
              <button
                type="button"
                className="button button-secondary"
                disabled={printLoading}
                onClick={() => void handlePrintLabel()}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 10px" }}
              >
                <Icon name="printer" size={14} />
                {printLoading ? "Đang lấy link in…" : "In phiếu GHN"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            <div>
              <div className="info-row">
                <span>Mã vận đơn GHN</span>
                <strong className="mono">{activeShipment.trackingNumber ?? "—"}</strong>
              </div>
              <div className="info-row">
                <span>Mã đơn hàng (SubOrder)</span>
                <strong>{activeShipment.subOrderNo ?? "—"}</strong>
              </div>
              <div className="info-row">
                <span>SubOrder ID</span>
                <span className="mono" style={{ fontSize: 13 }}>{activeShipment.orderId}</span>
              </div>
              <div className="info-row">
                <span>Kho lấy hàng</span>
                <strong>{activeShipment.warehouseId}</strong>
              </div>
              <div className="info-row">
                <span>Ngày tạo vận đơn</span>
                <span>{formatDateTime(activeShipment.createdAt)}</span>
              </div>
            </div>
            <div>
              <div className="info-row">
                <span>Người nhận</span>
                <strong>{activeShipment.receiverName} · {activeShipment.receiverPhone}</strong>
              </div>
              <div className="info-row">
                <span>Địa chỉ giao hàng</span>
                <span style={{ fontSize: 13, textAlign: "right" }}>{activeShipment.receiverAddress}</span>
              </div>
              <div className="info-row">
                <span>Thời gian giao dự kiến</span>
                <span>{formatDateTime(activeShipment.estimatedDeliveryAt)}</span>
              </div>
              <div className="info-row">
                <span>Cập nhật gần nhất</span>
                <span>{formatDateTime(activeShipment.updatedAt ?? getLatestEventTime(activeShipment))}</span>
              </div>
            </div>
          </div>

          {activeShipment.items && activeShipment.items.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 15 }}>Sản phẩm trong đơn ship ({activeShipment.items.length})</h4>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th>SKU ID</th>
                      <th>Số lượng</th>
                      <th>Đơn giá</th>
                      <th>Khối lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeShipment.items.map((item, idx) => (
                      <tr key={`${item.skuId}-${idx}`}>
                        <td><strong><TruncatedText text={item.name} label="Tên sản phẩm" maxWidth={240} /></strong></td>
                        <td><span className="mono" style={{ fontSize: 12 }}>{item.skuId}</span></td>
                        <td className="tabular-nums">{item.quantity}</td>
                        <td className="tabular-nums">{formatMoney(item.price)}</td>
                        <td className="tabular-nums">{item.weight ? `${item.weight}g` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lịch sử sự kiện (Events timeline) */}
          {activeShipment.events && activeShipment.events.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 15 }}>Hành trình bưu tá ghi nhận</h4>
              <ShipmentTimelineList
                events={activeShipment.events.map((e) => ({
                  status: e.status,
                  title: shipmentStatusLabel(e.status),
                  description: e.description ?? e.reason ?? "Cập nhật trạng thái",
                  occurredAt: e.occurredAt,
                  location: e.warehouseName ?? null,
                }))}
              />
            </div>
          )}
        </Card>
      )}

      {/* KHỐI 3: DANH SÁCH CÁC VẬN ĐƠN TOÀN SÀN */}
      <Card className="card-pad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Danh sách vận đơn toàn sàn</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Sắp xếp:</label>
            <select
              aria-label="Sắp xếp vận đơn theo thời gian"
              className="select-field"
              style={{ width: "auto", height: 36, padding: "0 10px" }}
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value as SortOptionValue);
                setPage(1);
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={() => setRefreshTrigger((v) => v + 1)}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Icon name="refreshCw" size={13} />
              Làm mới
            </button>
          </div>
        </div>

        {/* Thanh tìm kiếm đơn hàng / mã vận đơn */}
        <form
          onSubmit={handleTableSearchSubmit}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 14 }}
        >
          <label className="field-wrap" style={{ flex: "1 1 280px", margin: 0 }}>
            <span>Tìm kiếm đơn vận chuyển</span>
            <input
              type="search"
              className="field"
              placeholder="Tìm theo mã vận đơn GHN, mã SubOrder (SUB-... / AO-...), tên hoặc SĐT người nhận..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="button button-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 42 }}
          >
            <Icon name="search" size={15} />
            Tìm kiếm
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              className="button button-secondary"
              style={{ height: 42 }}
              onClick={clearTableFilters}
            >
              Xóa lọc
            </button>
          )}
        </form>

        {/* Bộ lọc đa trạng thái */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "var(--muted)", marginRight: 4 }}>Trạng thái:</span>
          <button
            type="button"
            className={selectedStatuses.length === 0 ? "button button-primary button-small" : "button button-secondary button-small"}
            onClick={() => {
              setSelectedStatuses([]);
              setPage(1);
            }}
          >
            Tất cả
          </button>
          {SHIPMENT_FILTER_STATUS_OPTIONS.map((opt) => {
            const active = selectedStatuses.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                className={active ? "button button-primary button-small" : "button button-secondary button-small"}
                onClick={() => toggleStatusFilter(opt.value)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {shipmentsResource.loading && !pagedData ? (
          <p>Đang tải danh sách vận đơn…</p>
        ) : shipmentsResource.error ? (
          <p className="notice" role="alert">
            {formatError(describeError(shipmentsResource.error, { operation: "read" }))}
          </p>
        ) : !pagedData?.items.length ? (
          <NoData
            title={
              hasActiveFilters
                ? "Không tìm thấy vận đơn nào khớp bộ lọc hiện tại."
                : "Chưa có vận đơn nào được tạo. Các đơn hàng được người bán tiếp nhận sẽ xuất hiện tại đây."
            }
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã vận đơn GHN</th>
                    <th>Đơn hàng (SubOrder)</th>
                    <th>Sản phẩm</th>
                    <th>Người nhận</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedData.items.map((s) => {
                    const isSelected = activeShipment?.id === s.id;
                    const createdLabel = formatDateTime(s.createdAt);
                    const updatedLabel = formatDateTime(s.updatedAt ?? getLatestEventTime(s));
                    const itemsPreview = s.items?.length
                      ? s.items.slice(0, 2).map((i) => `${i.name} ×${i.quantity}`).join(", ") +
                        (s.items.length > 2 ? ` (+${s.items.length - 2})` : "")
                      : "—";
                    return (
                      <tr key={s.id} style={isSelected ? { backgroundColor: "var(--primary-soft)" } : undefined}>
                        <td>
                          <strong className="mono">{s.trackingNumber ?? "—"}</strong>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                            {s.carrierId}
                          </div>
                        </td>
                        <td>
                          {s.subOrderNo && <div style={{ fontWeight: 700 }}>{s.subOrderNo}</div>}
                          <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{s.orderId}</span>
                        </td>
                        <td>
                          <div style={{ fontSize: 13, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {itemsPreview}
                          </div>
                        </td>
                        <td>
                          <div><strong>{s.receiverName}</strong> · {s.receiverPhone}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)", maxWidth: 260, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {s.receiverAddress}
                          </div>
                        </td>
                        <td>
                          <Badge tone={shipmentStatusTone(s.status)}>
                            {shipmentStatusLabel(s.status)}
                          </Badge>
                        </td>
                        <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                          <div>Tạo: {createdLabel}</div>
                          <div style={{ color: "var(--muted)", marginTop: 2 }}>Cập nhật: {updatedLabel}</div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="button button-secondary button-small"
                            onClick={() => selectShipmentFromTable(s)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <Icon name="truck" size={12} />
                            Chọn đơn này
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagedData.pagination.totalPages > 1 && (
              <AdminPagination
                page={page}
                pageSize={pagedData.pagination.pageSize}
                totalItems={pagedData.pagination.totalCount}
                totalPages={pagedData.pagination.totalPages}
                loading={shipmentsResource.loading}
                onPageChange={setPage}
                itemLabel="vận đơn"
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
