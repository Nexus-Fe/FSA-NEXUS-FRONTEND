"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { fulfillmentService } from "../services/fulfillment.service";
import "./shipping-tracking.css";

export function TrackingCodeBar({
  carrierCode,
  carrierName,
  trackingCode,
  labelPrintUrl,
  showPrintLabel = false,
  shipmentId,
}: {
  carrierCode?: string | null;
  carrierName?: string | null;
  trackingCode?: string | null;
  labelPrintUrl?: string | null;
  showPrintLabel?: boolean;
  shipmentId?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [pageSize, setPageSize] = useState<"A5" | "80x80" | "52x70">("A5");

  async function handleCopy() {
    if (!trackingCode) return;
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function handlePrint() {
    if (printing) return;
    setPrinting(true);
    try {
      if (shipmentId) {
        const label = await fulfillmentService.getPrintLabel(shipmentId, pageSize);
        if (label.printUrl) {
          window.open(label.printUrl, "_blank", "noopener,noreferrer");
          return;
        }
      }
      if (labelPrintUrl) {
        window.open(labelPrintUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      if (labelPrintUrl) {
        window.open(labelPrintUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setPrinting(false);
    }
  }

  const carrierLabel = carrierName || carrierCode || "GHN";
  const canPrint = showPrintLabel && (Boolean(labelPrintUrl) || Boolean(shipmentId));

  return (
    <div className="tracking-code-bar">
      <div className="tracking-code-meta">
        <span className="tracking-carrier-pill">
          <Icon name="truck" size={14} />
          {carrierLabel}
        </span>
        {trackingCode ? (
          <>
            <span>Mã vận đơn:</span>
            <strong className="tracking-code-value">{trackingCode}</strong>
          </>
        ) : (
          <span style={{ color: "var(--muted)" }}>Chưa có mã vận đơn</span>
        )}
      </div>

      <div className="tracking-code-actions">
        {trackingCode && (
          <button type="button" className="tracking-icon-btn" onClick={() => void handleCopy()}>
            <Icon name={copied ? "check" : "copy"} size={14} />
            {copied ? "Đã chép" : "Sao chép"}
          </button>
        )}
        {canPrint && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <select
              className="tracking-icon-btn"
              style={{ padding: "5px 6px", cursor: "pointer" }}
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as "A5" | "80x80" | "52x70")}
              title="Chọn khổ giấy in phiếu"
              aria-label="Khổ giấy in phiếu"
            >
              <option value="A5">A5</option>
              <option value="80x80">80×80 mm</option>
              <option value="52x70">52×70 mm</option>
            </select>
            <button
              type="button"
              className="tracking-icon-btn"
              disabled={printing}
              onClick={() => void handlePrint()}
              title="In phiếu giao hàng GHN"
            >
              <Icon name="printer" size={14} />
              {printing ? "Đang tạo phiếu…" : "In phiếu giao hàng"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
