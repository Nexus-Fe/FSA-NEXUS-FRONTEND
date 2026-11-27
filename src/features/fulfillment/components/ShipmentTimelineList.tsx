"use client";

import { Icon, type IconName } from "@/components/ui/Icon";
import { normalizeStatus } from "@/lib/status-labels";
import { returnBanner, shipmentStatusLabel } from "../shipment-labels";
import type { ShipmentEvent, TimelineEvent } from "../types";
import "./shipping-tracking.css";

function formatEventTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function eventIcon(status: string): IconName {
  const key = normalizeStatus(status);
  if (key === "DELIVERED" || key === "COMPLETED") return "packageCheck";
  if (key === "SHIPPING" || key === "SHIPPED" || key === "INTRANSIT" || key === "OUTFORDELIVERY" || key === "HANDEDOVER") return "truck";
  if (key === "DELIVERYFAILED" || key === "DELIVERYATTEMPTFAILED") return "alertTriangle";
  if (key === "RETURNING" || key === "RETURNED") return "rotateCcw";
  if (key === "CANCELLED" || key === "CANCELED") return "xCircle";
  return "package";
}

function eventToneClass(status: string, isLatest: boolean): string {
  const key = normalizeStatus(status);
  if (key === "DELIVERYFAILED" || key === "DELIVERYATTEMPTFAILED" || key === "CANCELLED" || key === "CANCELED") return " is-danger";
  if (key === "DELIVERED" || key === "COMPLETED") return " is-success";
  return isLatest ? " is-latest" : "";
}

export function ShipmentTimelineList({
  events,
  carrierEvents,
  loading = false,
  onRefresh,
  refreshing = false,
  title = "Hành trình vận đơn",
}: {
  events: TimelineEvent[];
  carrierEvents?: ShipmentEvent[] | null;
  loading?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  title?: string;
}) {
  const banner = returnBanner(events);
  // Display newest milestone first like Shopee
  const ordered = [...events].reverse();
  const latestCarrier = [...(carrierEvents ?? [])].reverse()[0];
  const lastFailure = [...(carrierEvents ?? [])].reverse().find(
    (item) => normalizeStatus(item.status) === "DELIVERYATTEMPTFAILED" || normalizeStatus(item.status) === "DELIVERYFAILED",
  );

  return (
    <div className="shipment-timeline-wrap">
      <div className="shipment-timeline-header">
        <h3>
          <Icon name="mapPin" size={16} />
          {title}
        </h3>
        {onRefresh && (
          <button
            type="button"
            className="tracking-icon-btn"
            disabled={refreshing || loading}
            onClick={onRefresh}
          >
            <Icon name="refreshCw" size={14} />
            {refreshing ? "Đang cập nhật…" : "Cập nhật"}
          </button>
        )}
      </div>

      {banner === "returning" && (
        <div className="shipment-alert-strip is-warning" role="status" style={{ marginBottom: 12 }}>
          <Icon name="rotateCcw" size={16} />
          <span>Kiện hàng đang được hoàn về kho người bán.</span>
        </div>
      )}
      {banner === "returned" && (
        <div className="shipment-alert-strip is-warning" role="status" style={{ marginBottom: 12 }}>
          <Icon name="rotateCcw" size={16} />
          <span>Kiện hàng đã hoàn về kho người bán.</span>
        </div>
      )}
      {lastFailure?.reason && (
        <div className="shipment-alert-strip is-danger" role="status" style={{ marginBottom: 12 }}>
          <Icon name="alertTriangle" size={16} />
          <span>Giao hàng chưa thành công: {lastFailure.reason}</span>
        </div>
      )}
      {(latestCarrier?.shipperName || latestCarrier?.shipperPhone) && (
        <div className="shipment-alert-strip is-success" role="status" style={{ marginBottom: 12 }}>
          <Icon name="phone" size={16} />
          <span>
            Bưu tá phụ trách: <strong>{latestCarrier.shipperName ?? "Đang cập nhật"}</strong>
            {latestCarrier.shipperPhone ? ` · ${latestCarrier.shipperPhone}` : ""}
          </span>
        </div>
      )}

      {loading && ordered.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13.5 }}>Đang tải hành trình vận đơn…</p>
      ) : ordered.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13.5 }}>Chưa có cập nhật hành trình từ đơn vị vận chuyển.</p>
      ) : (
        <ol className="shipment-timeline">
          {ordered.map((event, index) => {
            const isLatest = index === 0;
            return (
              <li
                key={`${event.status}-${event.occurredAt}-${index}`}
                className={`shipment-timeline-item${eventToneClass(event.status, isLatest)}`}
              >
                <div className="shipment-timeline-rail">
                  <span className="shipment-timeline-dot">
                    <Icon name={eventIcon(event.status)} size={13} />
                  </span>
                </div>
                <div className="shipment-timeline-body">
                  <div className="shipment-timeline-title">
                    {event.title || shipmentStatusLabel(event.status)}
                  </div>
                  {event.description && (
                    <div className="shipment-timeline-desc">{event.description}</div>
                  )}
                  <div className="shipment-timeline-meta">
                    <span>
                      <Icon name="clock" size={12} />
                      {formatEventTime(event.occurredAt)}
                    </span>
                    {event.location && (
                      <span>
                        <Icon name="mapPin" size={12} />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
