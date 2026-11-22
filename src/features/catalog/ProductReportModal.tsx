"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/client";

interface ProductReportModalProps {
  productId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductReportModal({
  productId,
  isOpen,
  onClose,
}: ProductReportModalProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (
      !reason.trim() ||
      description.trim().length < 10 ||
      description.trim().length > 2000 ||
      images.length < 1 ||
      images.length > 5 ||
      images.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
      )
    ) {
      setError(
        "Vui lòng chọn lý do, nhập mô tả từ 10–2000 ký tự và chọn 1–5 ảnh minh chứng (JPG, PNG hoặc WEBP tối đa 5 MB/ảnh)."
      );
      return;
    }

    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("reason", reason.trim());
      body.append("description", description.trim());
      images.forEach((file) => body.append("evidenceFiles", file));

      await api.post(`/api/v1/products/${encodeURIComponent(productId)}/reports`, body);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gửi được báo cáo sản phẩm.");
    } finally {
      setBusy(false);
    }
  }

  function handleResetAndClose() {
    setReason("");
    setDescription("");
    setImages([]);
    setError("");
    setSent(false);
    onClose();
  }

  return (
    <div
      className="product-report-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-report-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleResetAndClose();
      }}
    >
      <div className="product-report-modal-box">
        <div className="product-report-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--accent)", display: "flex" }}>
              <Icon name="flag" size={18} />
            </span>
            <h2 id="product-report-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 750 }}>
              Báo cáo sản phẩm
            </h2>
          </div>
          <button
            type="button"
            className="product-report-modal-close"
            onClick={handleResetAndClose}
            aria-label="Đóng bảng báo cáo"
          >
            ✕
          </button>
        </div>

        {sent ? (
          <div className="product-report-modal-success">
            <p className="form-success" role="status" style={{ margin: "0 0 16px" }}>
              Cảm ơn bạn! Đã gửi báo cáo thành công để ban quản trị kiểm duyệt.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="button button-primary button-small"
                onClick={handleResetAndClose}
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <form className="auth-fields product-report-modal-form" onSubmit={handleSubmit}>
            <label className="field-wrap">
              Lý do báo cáo <span style={{ color: "var(--accent)" }}>*</span>
              <select
                className="select-field"
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                <option value="">Chọn lý do vi phạm</option>
                <option value="Counterfeit">Hàng giả / hàng nhái</option>
                <option value="ProhibitedItem">Hàng cấm / vi phạm pháp luật</option>
                <option value="IncorrectDescription">Mô tả sai lệch thực tế</option>
                <option value="OffensiveContent">Hình ảnh hoặc nội dung phản cảm</option>
                <option value="Other">Lý do khác</option>
              </select>
            </label>

            <label className="field-wrap">
              Chi tiết vi phạm (10–2000 ký tự) <span style={{ color: "var(--accent)" }}>*</span>
              <textarea
                className="textarea-field"
                required
                minLength={10}
                maxLength={2000}
                placeholder="Mô tả cụ thể vi phạm của sản phẩm..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
              />
            </label>

            <label className="field-wrap">
              Ảnh minh chứng (1–5 ảnh, tối đa 5 MB/ảnh) <span style={{ color: "var(--accent)" }}>*</span>
              <input
                className="field"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                required
                onChange={(event) => setImages(Array.from(event.target.files ?? []))}
              />
            </label>

            {error && (
              <p className="notice" role="alert" style={{ margin: "6px 0 0" }}>
                {error}
              </p>
            )}

            <div
              className="action-row"
              style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}
            >
              <button
                className="button button-secondary button-small"
                type="button"
                onClick={handleResetAndClose}
                disabled={busy}
              >
                Hủy
              </button>
              <button
                className="button button-primary button-small"
                type="submit"
                disabled={busy}
              >
                {busy ? "Đang gửi…" : "Gửi báo cáo"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

