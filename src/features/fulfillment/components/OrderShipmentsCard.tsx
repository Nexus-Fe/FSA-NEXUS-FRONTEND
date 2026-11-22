"use client";

import { useState } from "react";
import { Badge, Card, NoData } from "@/components/ui/Primitives";
import { useApiResource } from "@/lib/api/use-api-resource";
import { fulfillmentService } from "../services/fulfillment.service";
import { returnBanner, shipmentStatusLabel } from "../shipment-labels";
import { describeError, formatError } from "@/lib/errors/error-messages";
import type { SubOrderShipment } from "../types";

function formatTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

function Timeline({ subOrderId }: { subOrderId: string }) {
  const timeline = useApiResource(`sub-order-timeline:${subOrderId}`, (signal) => fulfillmentService.getSubOrderTimeline(subOrderId, signal));
  if (timeline.error) return <p className="notice" role="alert">{formatError(describeError(timeline.error, { operation: "read" }))}</p>;
  if (!timeline.data) return <p>Đang tải hành trình…</p>;
  const events = timeline.data.timeline;
  if (events.length === 0) return <p>Chưa có cập nhật hành trình.</p>;
  const banner = returnBanner(events);
  return (
    <>
    {banner === "returning" && <p className="notice" role="status">Hàng đang được hoàn về người bán.</p>}
    {banner === "returned" && <p className="notice" role="status">Hàng đã hoàn về người bán.</p>}
    <ol style={{ margin: "8px 0 0", paddingLeft: 18 }}>
      {events.map((event, index) => (
        <li key={`${event.status}-${event.occurredAt}-${index}`} style={{ marginBottom: 6 }}>
          <strong>{event.title || shipmentStatusLabel(event.status)}</strong>
          <div>{event.description}</div>
          <small>{formatTime(event.occurredAt)}{event.location ? ` · ${event.location}` : ""}</small>
        </li>
      ))}
    </ol>
    </>
  );
}

function ShipmentRow({ shipment }: { shipment: SubOrderShipment }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 10, marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <strong>{shipment.shopName} · {shipment.subOrderNo}</strong>
        <Badge>{shipmentStatusLabel(shipment.status)}</Badge>
      </div>
      <div className="info-row"><span>Đơn vị vận chuyển</span><strong>{shipment.carrierCode ?? "—"}</strong></div>
      <div className="info-row"><span>Mã vận đơn</span><strong>{shipment.trackingCode ?? "Chưa có mã vận đơn"}</strong></div>
      {shipment.shippedAt && <div className="info-row"><span>Gửi hàng</span><strong>{formatTime(shipment.shippedAt)}</strong></div>}
      {shipment.deliveredAt && <div className="info-row"><span>Giao hàng</span><strong>{formatTime(shipment.deliveredAt)}</strong></div>}
      <button type="button" className="button button-secondary" onClick={() => setOpen((value) => !value)}>
        {open ? "Ẩn hành trình" : "Xem hành trình"}
      </button>
      {open && <Timeline subOrderId={shipment.subOrderId} />}
    </div>
  );
}

/** Buyer view of an order's shipments: one entry per shop's sub-order, each with its own status and journey. */
export function OrderShipmentsCard({ orderId }: { orderId: string }) {
  const tracking = useApiResource(orderId ? `order-tracking:${orderId}` : null, (signal) => fulfillmentService.getOrderTracking(orderId, signal));
  const shipments = tracking.data?.shipments ?? [];
  return (
    <Card className="card-pad">
      <h2>Giao nhận</h2>
      {tracking.error && <p className="notice" role="alert">{formatError(describeError(tracking.error, { operation: "read" }))}</p>}
      {shipments.length > 0 ? (
        shipments.map((shipment) => <ShipmentRow key={shipment.subOrderId} shipment={shipment} />)
      ) : (
        <NoData title={tracking.loading ? "Đang tải vận đơn…" : "Vận đơn sẽ hiển thị khi người bán chấp nhận đơn"} />
      )}
    </Card>
  );
}
