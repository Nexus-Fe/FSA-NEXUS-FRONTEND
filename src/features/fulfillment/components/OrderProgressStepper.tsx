"use client";

import { Icon, type IconName } from "@/components/ui/Icon";
import { normalizeStatus } from "@/lib/status-labels";
import { shipmentStatusLabel } from "../shipment-labels";
import "./shipping-tracking.css";

type StepDef = {
  key: string;
  label: string;
  icon: IconName;
  time?: string | null;
};

function formatShortTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function resolveStepIndex(status: string | null | undefined): number {
  const key = normalizeStatus(status);
  if (!key || key === "PENDINGPAYMENT" || key === "AWAITINGPAYMENT" || key === "PENDING" || key === "PAYMENTPROCESSING") return 0;
  if (key === "PAID") return 1;
  if (key === "CONFIRMED" || key === "SELLERACCEPTED" || key === "READYTOPICK" || key === "PICKING" || key === "PACKED") return 2;
  if (key === "SHIPPING" || key === "SHIPPED" || key === "HANDEDOVER" || key === "INTRANSIT" || key === "OUTFORDELIVERY" || key === "DELIVERYATTEMPTFAILED") return 3;
  if (key === "DELIVERED" || key === "COMPLETED") return 4;
  return 0;
}

export function OrderProgressStepper({
  status,
  createdAt,
  shippedAt,
  deliveredAt,
  completedAt,
  orderNo,
}: {
  status: string;
  createdAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  orderNo?: string | null;
}) {
  const key = normalizeStatus(status);
  const isCancelled = key === "CANCELLED" || key === "CANCELED" || key === "EXPIRED" || key === "SELLERREJECTED";
  const isReturning = key === "RETURNING" || key === "RETURNED" || key === "REFUNDED" || key === "DELIVERYFAILED";

  const steps: StepDef[] = [
    { key: "placed", label: "Đơn hàng đã đặt", icon: "receipt", time: createdAt },
    { key: "paid", label: "Đã thanh toán", icon: "wallet" },
    { key: "confirmed", label: "Chờ lấy hàng", icon: "package" },
    { key: "shipping", label: "Đang giao hàng", icon: "truck", time: shippedAt },
    { key: "done", label: key === "COMPLETED" ? "Hoàn tất" : "Đã giao hàng", icon: "packageCheck", time: completedAt ?? deliveredAt },
  ];

  const activeIndex = resolveStepIndex(status);

  return (
    <section className="shipment-stepper-card" aria-label="Tiến độ đơn hàng">
      <div className="shipment-stepper-head">
        <span className="shipment-stepper-title">
          <Icon name="truck" size={18} />
          {orderNo ? `Tiến độ đơn ${orderNo}` : "Tiến độ giao hàng"}
        </span>
        <strong style={{ fontSize: 13.5, color: isCancelled || isReturning ? "var(--red)" : "var(--primary)" }}>
          {shipmentStatusLabel(status)}
        </strong>
      </div>

      {isCancelled ? (
        <div className="shipment-alert-strip is-danger" role="status">
          <Icon name="xCircle" size={18} />
          <div>
            <strong>{shipmentStatusLabel(status)}</strong>
            <div>Đơn hàng đã dừng xử lý và không tiếp tục giao vận.</div>
          </div>
        </div>
      ) : isReturning ? (
        <div className="shipment-alert-strip is-warning" role="status">
          <Icon name="rotateCcw" size={18} />
          <div>
            <strong>{shipmentStatusLabel(status)}</strong>
            <div>
              {key === "RETURNED"
                ? "Kiện hàng đã hoàn về kho người bán."
                : key === "REFUNDED"
                  ? "Đơn hàng đã được hoàn tiền về ví."
                  : "Giao hàng không thành công, kiện hàng đang chuyển hoàn về người bán."}
            </div>
          </div>
        </div>
      ) : (
        <ol className="shipment-stepper">
          {steps.map((step, index) => {
            const isDone = index < activeIndex || (index === 4 && key === "COMPLETED");
            const isCurrent = index === activeIndex && key !== "COMPLETED";
            const timeText = formatShortTime(step.time);
            return (
              <li
                key={step.key}
                className={`shipment-step${isDone ? " is-done" : ""}${isCurrent ? " is-current" : ""}`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className="shipment-step-icon">
                  <Icon name={isDone ? "check" : step.icon} size={18} />
                </span>
                <div>
                  <div className="shipment-step-label">{step.label}</div>
                  {timeText && <div className="shipment-step-time">{timeText}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
