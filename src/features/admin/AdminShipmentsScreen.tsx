"use client";

import { useState, type FormEvent } from "react";
import { AdminPagination, Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatError, describeError } from "@/lib/errors/error-messages";
import {
  fulfillmentService,
  shipmentStatusLabel,
  shipmentStatusTone,
  ShipmentTimelineList,
  type PagedShipments,
  type ShipmentDetail,
} from "@/features/fulfillment";

const GHN_SIMULATE_STATUS_OPTIONS = [
  {
    value: "picked",
    label: "Đã lấy hàng (picked)",
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
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const shipmentsResource = useApiResource(
    `admin-shipments:${page}:${statusFilter}:${refreshTrigger}`,
    (signal) =>
      fulfillmentService.listShipments(
        { page, pageSize: 10, status: statusFilter || undefined },
        signal,
      ),
  );

  async function handleLookup(codeToSearch?: string) {
    const code = (codeToSearch ?? inputCode).trim();
    if (!code) {
      setErrorMessage("Vui lòng nhập mã vận đơn GHN hoặc SubOrder ID để tra cứu.");
      return;
    }
    setLookupLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const detail = await fulfillmentService.getShipmentByTracking(code);
      setActiveShipment(detail);
      setInputCode(detail.trackingNumber ?? detail.id);
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
      setErrorMessage("Vui lòng nhập mã vận đơn GHN để cập nhật trạng thái.");
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

      // Auto-reload shipment details and table
      setRefreshTrigger((v) => v + 1);
      try {
        const updated = await fulfillmentService.getShipmentByTracking(tracking);
        setActiveShipment(updated);
      } catch {
        // Fallback: keep current view
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
    const code = shipment.trackingNumber ?? shipment.id;
    setInputCode(code);
    setActiveShipment(shipment);
    setErrorMessage("");
    setSuccessMessage(`Đã chọn vận đơn ${code}. Bạn có thể thay đổi trạng thái bên dưới.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const pagedData: PagedShipments | null = shipmentsResource.data ?? null;

  return (
    <div className="page-stack">
      <PageHeading
        title="Quản lý Vận đơn & Giả lập Shipper (GHN)"
        description="Tra cứu vận đơn, cập nhật các mốc trạng thái giao vận GHN Sandbox và đồng bộ tức thì sang Commerce."
        action={
          <div className="action-row">
            <a
              href="https://5sao.ghn.dev/"
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
              <span>Mã vận đơn GHN hoặc SubOrder ID (*)</span>
              <input
                className="field"
                placeholder="Nhập mã vận đơn (VD: LY9WHT) hoặc SubOrder ID..."
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
              <strong>Bắt buộc chuyển trạng thái (Force override)</strong>: Bỏ qua kiểm tra tuần tự vòng đời để test nhảy cóc trạng thái.
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
              {/* Nút In phiếu GHN */}
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
                <strong>{activeShipment.trackingNumber ?? "—"}</strong>
              </div>
              <div className="info-row">
                <span>Mã đơn hàng con (SubOrder ID)</span>
                <span className="mono" style={{ fontSize: 13 }}>{activeShipment.orderId}</span>
              </div>
              <div className="info-row">
                <span>Kho lấy hàng</span>
                <strong>{activeShipment.warehouseId}</strong>
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
                <span>{activeShipment.estimatedDeliveryAt ? new Date(activeShipment.estimatedDeliveryAt).toLocaleString("vi-VN") : "—"}</span>
              </div>
            </div>
          </div>

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

      {/* KHỐI 3: DANH SÁCH CÁC VẬN ĐƠN GẦN ĐÂY */}
      <Card className="card-pad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Danh sách vận đơn toàn sàn</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Lọc trạng thái:</label>
            <select
              className="select-field"
              style={{ width: "auto", height: 36, padding: "0 10px" }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ReadyToPick">Chờ lấy hàng</option>
              <option value="Picking">Đang lấy hàng</option>
              <option value="Packed">Đã đóng gói</option>
              <option value="HandedOver">Đã lấy hàng (bàn giao)</option>
              <option value="InTransit">Đang vận chuyển</option>
              <option value="Delivered">Đã giao thành công</option>
              <option value="DeliveryFailed">Giao không thành công</option>
              <option value="Returning">Đang hoàn hàng</option>
              <option value="Returned">Đã hoàn hàng</option>
              <option value="Cancelled">Đã hủy</option>
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

        {shipmentsResource.loading && !pagedData ? (
          <p>Đang tải danh sách vận đơn…</p>
        ) : shipmentsResource.error ? (
          <p className="notice" role="alert">
            {formatError(describeError(shipmentsResource.error, { operation: "read" }))}
          </p>
        ) : !pagedData?.items.length ? (
          <NoData title="Chưa có vận đơn nào được tạo. Các đơn hàng được người bán tiếp nhận sẽ xuất hiện tại đây." />
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã vận đơn GHN</th>
                    <th>SubOrder ID</th>
                    <th>Người nhận</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedData.items.map((s) => {
                    const isSelected = activeShipment?.id === s.id;
                    return (
                      <tr key={s.id} style={isSelected ? { backgroundColor: "var(--accent-subtle, rgba(59,130,246,0.06))" } : undefined}>
                        <td>
                          <strong>{s.trackingNumber ?? "—"}</strong>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                            {s.carrierId}
                          </div>
                        </td>
                        <td>
                          <span className="mono" style={{ fontSize: 12 }}>{s.orderId}</span>
                        </td>
                        <td>
                          <div><strong>{s.receiverName}</strong> · {s.receiverPhone}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)", maxWidth: 280, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {s.receiverAddress}
                          </div>
                        </td>
                        <td>
                          <Badge tone={shipmentStatusTone(s.status)}>
                            {shipmentStatusLabel(s.status)}
                          </Badge>
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
