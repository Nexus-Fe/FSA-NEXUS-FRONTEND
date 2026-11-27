"use client";

import { useState } from "react";
import { Badge, Card, NoData } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { useApiResource } from "@/lib/api/use-api-resource";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { formatMoney } from "@/lib/presentation";
import { fulfillmentService } from "../services/fulfillment.service";
import { shipmentStatusLabel } from "../shipment-labels";
import { TrackingCodeBar } from "./TrackingCodeBar";
import { ShipmentTimelineList } from "./ShipmentTimelineList";
import type { SubOrderShipment } from "../types";
import "./shipping-tracking.css";

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function ShipmentTimelinePanel({
  subOrderId,
  trackingCode,
  onReloadParent,
}: {
  subOrderId: string;
  trackingCode: string | null;
  onReloadParent: () => void;
}) {
  const timeline = useApiResource(
    `sub-order-timeline:${subOrderId}`,
    (signal) => fulfillmentService.getSubOrderTimeline(subOrderId, signal),
  );
  const carrier = useApiResource(
    trackingCode ? `buyer-shipment-carrier:${trackingCode}` : null,
    (signal) => fulfillmentService.getShipmentByTracking(trackingCode ?? "", signal),
  );

  if (timeline.error) {
    return (
      <p className="notice" role="alert">
        {formatError(describeError(timeline.error, { operation: "read" }))}
      </p>
    );
  }

  return (
    <ShipmentTimelineList
      events={timeline.data?.timeline ?? []}
      carrierEvents={carrier.data?.events}
      loading={timeline.loading}
      refreshing={timeline.loading || carrier.loading}
      onRefresh={() => {
        timeline.reload();
        if (trackingCode) carrier.reload();
        onReloadParent();
      }}
    />
  );
}

function ShipmentRow({
  shipment,
  defaultOpen,
  onReloadParent,
}: {
  shipment: SubOrderShipment;
  defaultOpen: boolean;
  onReloadParent: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink)" }}>
          <Icon name="package" size={16} />
          {shipment.shopName} · {shipment.subOrderNo}
        </strong>
        <Badge>{shipmentStatusLabel(shipment.status)}</Badge>
      </div>

      <TrackingCodeBar
        carrierCode={shipment.carrierCode}
        trackingCode={shipment.trackingCode}
      />

      {shipment.items && shipment.items.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
            Sản phẩm trong kiện hàng
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>SL</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {shipment.items.map((item, idx) => (
                  <tr key={item.orderItemId ?? `${item.skuId}-${idx}`}>
                    <td>
                      <strong>{item.productName}</strong>
                      {item.skuCode && (
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>SKU: {item.skuCode}</div>
                      )}
                    </td>
                    <td className="tabular-nums">{item.quantity}</td>
                    <td className="tabular-nums">{formatMoney(item.unitPrice)}</td>
                    <td className="tabular-nums"><strong>{formatMoney(item.lineTotal)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {shipment.shippedAt && (
        <div className="info-row">
          <span>Bàn giao vận chuyển</span>
          <strong>{formatTime(shipment.shippedAt)}</strong>
        </div>
      )}
      {shipment.deliveredAt && (
        <div className="info-row">
          <span>Giao hàng lúc</span>
          <strong>{formatTime(shipment.deliveredAt)}</strong>
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          className="tracking-icon-btn"
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? "chevronDown" : "chevron"} size={14} />
          {open ? "Thu gọn hành trình" : "Xem hành trình giao hàng"}
        </button>
      </div>

      {open && (
        <ShipmentTimelinePanel
          subOrderId={shipment.subOrderId}
          trackingCode={shipment.trackingCode}
          onReloadParent={onReloadParent}
        />
      )}
    </div>
  );
}

/** Buyer view of an order's shipments: one entry per shop's sub-order, each with its own status and journey. */
export function OrderShipmentsCard({ orderId }: { orderId: string }) {
  const tracking = useApiResource(
    orderId ? `order-tracking:${orderId}` : null,
    (signal) => fulfillmentService.getOrderTracking(orderId, signal),
  );
  const shipments = tracking.data?.shipments ?? [];

  return (
    <Card className="card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="truck" size={18} />
          Thông tin vận chuyển
        </h2>
        <button
          type="button"
          className="tracking-icon-btn"
          disabled={tracking.loading}
          onClick={tracking.reload}
        >
          <Icon name="refreshCw" size={14} />
          {tracking.loading ? "Đang tải…" : "Tải lại"}
        </button>
      </div>

      {tracking.error && (
        <p className="notice" role="alert" style={{ marginTop: 12 }}>
          {formatError(describeError(tracking.error, { operation: "read" }))}
        </p>
      )}

      {shipments.length > 0 ? (
        shipments.map((shipment) => (
          <ShipmentRow
            key={shipment.subOrderId}
            shipment={shipment}
            defaultOpen={shipments.length === 1}
            onReloadParent={tracking.reload}
          />
        ))
      ) : (
        <NoData
          title={
            tracking.loading
              ? "Đang tải thông tin vận đơn…"
              : "Mã vận đơn sẽ hiện ở đây sau khi người bán xác nhận đơn"
          }
        />
      )}
    </Card>
  );
}
