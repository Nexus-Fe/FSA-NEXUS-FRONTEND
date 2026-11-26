"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { auctionService } from "../services/auction.service";
import type { AuctionReportReason } from "../types";

const REASON_OPTIONS: Array<{ value: AuctionReportReason; label: string }> = [
  { value: "SuspectedShillBidding", label: "Nghi vấn kích giá ảo / thông đồng đẩy giá" },
  { value: "CounterfeitOrFake", label: "Nghi vấn hàng giả / hàng nhái" },
  { value: "MisleadingInfo", label: "Thông tin mô tả sai lệch / gian lận" },
  { value: "ExternalContact", label: "Lôi kéo giao dịch ngoài sàn" },
  { value: "Other", label: "Lý do vi phạm khác" },
];

export function AuctionReportModal({
  open,
  auctionId,
  auctionTitle,
  onClose,
  onReported,
}: {
  open: boolean;
  auctionId: string;
  auctionTitle?: string | null;
  onClose: () => void;
  onReported?: () => void;
}) {
  const [reason, setReason] = useState<AuctionReportReason>("SuspectedShillBidding");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleClose() {
    if (busy) return;
    setError("");
    setSuccess("");
    setDescription("");
    setReason("SuspectedShillBidding");
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const trimmed = description.trim();
    if (trimmed.length < 10) {
      setError("Mô tả báo cáo cần ít nhất 10 ký tự để quản trị viên có đủ thông tin xác minh.");
      return;
    }
    if (trimmed.length > 1000) {
      setError("Mô tả báo cáo tối đa 1000 ký tự.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await auctionService.report(auctionId, {
        reason,
        description: trimmed,
      });
      setSuccess("Đã gửi báo cáo vi phạm phiên đấu giá thành công. Quản trị viên sẽ xem xét và xử lý.");
      onReported?.();
      window.setTimeout(() => {
        handleClose();
      }, 1800);
    } catch (cause) {
      if (cause instanceof ApiError && cause.errorCode === "REPORT_ALREADY_EXISTS") {
        setError("Bạn đã gửi báo cáo cho phiên đấu giá này rồi.");
      } else if (cause instanceof ApiError && cause.errorCode === "SELLER_CANNOT_REPORT") {
        setError("Người bán không thể tự báo cáo phiên đấu giá của chính mình.");
      } else if (cause instanceof ApiError && cause.errorCode === "INVALID_STATE_TRANSITION") {
        setError("Chỉ phiên sắp diễn ra hoặc đang diễn ra mới có thể gửi báo cáo vi phạm.");
      } else {
        setError(formatError(describeError(cause, { operation: "write" })));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Báo cáo vi phạm phiên đấu giá"
      busy={busy}
      onClose={handleClose}
      footer={
        <div className="action-row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button type="button" className="button button-secondary" disabled={busy} onClick={handleClose}>
            Đóng
          </button>
          {!success && (
            <button
              type="submit"
              form="auction-report-form"
              className="button button-primary"
              disabled={busy || description.trim().length < 10}
            >
              {busy ? "Đang gửi báo cáo…" : "Gửi báo cáo"}
            </button>
          )}
        </div>
      }
    >
      <form id="auction-report-form" onSubmit={(e) => void submit(e)}>
        {auctionTitle && (
          <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--muted)" }}>
            Phiên đấu giá: <strong style={{ color: "var(--ink)" }}>{auctionTitle}</strong>
          </p>
        )}

        <label className="field-wrap" style={{ marginBottom: 12 }}>
          <span>Lý do vi phạm <abbr className="checkout-required" title="Bắt buộc">*</abbr></span>
          <select
            className="select-field"
            value={reason}
            onChange={(e) => setReason(e.target.value as AuctionReportReason)}
            disabled={busy || Boolean(success)}
          >
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-wrap" style={{ marginBottom: 12 }}>
          <span>Mô tả chi tiết <abbr className="checkout-required" title="Bắt buộc">*</abbr></span>
          <textarea
            className="textarea-field"
            rows={4}
            required
            minLength={10}
            maxLength={1000}
            disabled={busy || Boolean(success)}
            placeholder="Mô tả cụ thể hành vi nghi vấn vi phạm (tối thiểu 10 ký tự)..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (error) setError("");
            }}
          />
          <small style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>
            {description.trim().length}/1000 ký tự (tối thiểu 10 ký tự)
          </small>
        </label>

        {error && <p className="notice" role="alert" style={{ marginTop: 10 }}>{error}</p>}
        {success && <p className="form-success" role="status" style={{ marginTop: 10 }}>{success}</p>}
      </form>
    </Modal>
  );
}
