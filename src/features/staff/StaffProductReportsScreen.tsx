"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ThumbnailBox } from "@/components/ui/BackendImage";
import { FluidChoiceBar } from "@/components/ui/FluidChoiceBar";
import { EvidenceThumbnailGrid } from "@/components/ui/ImageLightbox";
import { AdminPagination, Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { resolveImageUrl } from "@/lib/presentation";
import { REPORT_STATUS, semanticStatusTone, statusLabel } from "@/lib/status-labels";
import {
  productReportsService,
  type ProductReportAction,
  type ProductReportItem,
} from "./services/product-reports.service";

const FINALIZED_REPORT_STATUSES = new Set(["RESOLVED", "DISMISSED"]);
const isReportFinalized = (status: string) => FINALIZED_REPORT_STATUSES.has(status.toUpperCase());

const STATUS_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xử lý" },
  { value: "INVESTIGATING", label: "Đang xem xét" },
  { value: "RESOLVED", label: "Đã xử lý" },
  { value: "DISMISSED", label: "Đã bác" },
];

const REASON_OPTIONS = [
  { value: "", label: "Tất cả lý do" },
  { value: "Counterfeit", label: "Hàng giả / Nhái" },
  { value: "ProhibitedItem", label: "Hàng cấm" },
  { value: "IncorrectDescription", label: "Sai mô tả" },
  { value: "OffensiveContent", label: "Nội dung phản cảm" },
  { value: "Other", label: "Khác" },
];

const REASON_LABELS: Record<string, string> = {
  COUNTERFEIT: "Hàng giả / Nhái",
  PROHIBITEDITEM: "Hàng cấm",
  INCORRECTDESCRIPTION: "Sai mô tả",
  OFFENSIVECONTENT: "Nội dung phản cảm",
  OTHER: "Khác",
};

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason.toUpperCase().replace(/[^A-Z]/g, "")] ?? reason;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(d)
    : "—";
}

export function StaffProductReportsScreen() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [keyword, setKeyword] = useState("");

  const [selected, setSelected] = useState<ProductReportItem | null>(null);
  const [action, setAction] = useState<ProductReportAction>("INVESTIGATE");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reports = useApiResource(
    `staff-product-reports:${page}:${status}:${reasonFilter}`,
    (signal) =>
      productReportsService.list(
        {
          page,
          pageSize: 20,
          status: status || undefined,
          reason: reasonFilter || undefined,
        },
        signal,
      ),
  );

  const items = useMemo(() => {
    const raw = reports.data?.items ?? [];
    const q = keyword.trim().toLowerCase();
    if (!q) return raw;
    return raw.filter(
      (r) =>
        r.productName.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.productId.toLowerCase().includes(q),
    );
  }, [reports.data?.items, keyword]);

  function openModal(report: ProductReportItem) {
    setSelected(report);
    setAction("INVESTIGATE");
    setNote("");
    setError("");
  }

  async function handleDecide(event: FormEvent) {
    event.preventDefault();
    if (!selected || busy) return;
    const trimmed = note.trim();
    if (trimmed.length < 5) {
      setError("Vui lòng nhập lý do xử lý ít nhất 5 ký tự.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await productReportsService.moderate(selected.id, action, trimmed);
      setNotice(`Đã cập nhật xử lý báo cáo cho "${selected.productName}".`);
      setSelected(null);
      reports.reload();
    } catch (cause) {
      const msg = formatError(describeError(cause, { operation: "write" }));
      setError(cause instanceof ApiError && cause.traceId ? `${msg} (Trace: ${cause.traceId})` : msg);
    } finally {
      setBusy(false);
    }
  }

  const pagination = reports.data?.pagination;
  const totalCount = pagination?.totalCount ?? items.length;
  const pageSize = pagination?.pageSize ?? 20;

  return (
    <>
      <PageHeading
        overline="Nghiệp vụ Staff"
        title="Báo cáo sản phẩm"
        description="Kiểm tra bằng chứng vi phạm, ảnh sản phẩm và đưa ra quyết định xử lý."
      />

      <Card className="card-pad" style={{ marginBottom: "16px", display: "grid", gap: "12px" }}>
        <FluidChoiceBar
          mode="filter"
          ariaLabel="Lọc theo trạng thái báo cáo"
          options={STATUS_FILTERS}
          value={status}
          onChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
        />
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="field-wrap" style={{ margin: 0, flex: "1 1 260px" }}>
            <span>Tìm nhanh</span>
            <input
              className="field"
              placeholder="Tên sản phẩm, nội dung mô tả..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </label>
          <label className="field-wrap" style={{ margin: 0, flex: "0 1 220px", minWidth: 180 }}>
            <span>Lý do vi phạm</span>
            <select
              className="select-field"
              value={reasonFilter}
              onChange={(e) => {
                setReasonFilter(e.target.value);
                setPage(1);
              }}
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button button-secondary"
            style={{ width: "auto", whiteSpace: "nowrap" }}
            onClick={() => {
              setStatus("");
              setReasonFilter("");
              setKeyword("");
              setPage(1);
            }}
          >
            Xóa lọc
          </button>
        </div>
      </Card>

      {notice && (
        <p className="form-success" role="status">
          {notice}
        </p>
      )}

      <Card>
        {reports.error && (
          <p className="notice" role="alert">
            {reports.error.message} Cần kiểm tra định tuyến Gateway cho CatalogService.
          </p>
        )}

        {reports.loading && !reports.data ? (
          <TableSkeleton rows={5} cols={6} label="Đang tải báo cáo sản phẩm…" />
        ) : items.length ? (
          <div className="table-scroll">
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 64 }}>Ảnh</th>
                  <th>Sản phẩm</th>
                  <th>Lý do</th>
                  <th>Mô tả</th>
                  <th>Bằng chứng</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((report) => {
                  const thumb = resolveImageUrl(report.productPrimaryImageUrl ?? report.evidenceImages?.[0] ?? null);
                  const finalized = isReportFinalized(report.status);
                  const evidenceCount = report.evidenceImages?.length ?? 0;
                  return (
                    <tr
                      key={report.id}
                      className="clickable-row"
                      onClick={() => openModal(report)}
                      title="Nhấn để xem chi tiết & xử lý báo cáo"
                    >
                      <td>
                        <ThumbnailBox src={thumb} alt={report.productName} />
                      </td>
                      <td style={{ minWidth: 180, maxWidth: 260 }}>
                        <strong style={{ display: "block", lineHeight: 1.35 }}>{report.productName}</strong>
                        <small className="mono" style={{ color: "var(--muted)" }}>
                          {report.productId.slice(0, 8)}…
                        </small>
                      </td>
                      <td>
                        <Badge tone="slate">{reasonLabel(report.reason)}</Badge>
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            lineHeight: 1.4,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {report.description}
                        </p>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {evidenceCount > 0 && (
                          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                            {evidenceCount} ảnh
                          </div>
                        )}
                        <EvidenceThumbnailGrid
                          urls={report.evidenceImages}
                          size={40}
                          title={`Bằng chứng: ${report.productName}`}
                        />
                      </td>
                      <td>
                        <Badge tone={semanticStatusTone(report.status)}>{statusLabel(REPORT_STATUS, report.status)}</Badge>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {formatDate(report.createdAt)}
                      </td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={`button button-small ${finalized ? "button-secondary" : "button-primary"}`}
                          onClick={() => openModal(report)}
                        >
                          {finalized ? "Xem chi tiết" : "Xử lý"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !reports.error && <NoData title="Chưa có báo cáo phù hợp" />
        )}

        {pagination && (pagination.totalPages ?? 1) > 1 && (
          <AdminPagination
            page={page}
            pageSize={pageSize}
            totalItems={totalCount}
            totalPages={pagination.totalPages}
            loading={reports.loading}
            onPageChange={setPage}
            itemLabel="báo cáo"
          />
        )}
      </Card>

      {selected && (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-report-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setSelected(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) setSelected(null);
          }}
        >
          <section className="admin-modal" style={{ maxWidth: "680px" }}>
            <div className="admin-modal-heading">
              <div>
                <h2 id="product-report-modal-title">{selected.productName}</h2>
                <p className="admin-modal-desc">
                  Mã báo cáo: <code>{selected.id}</code> · Mã SP: <code>{selected.productId}</code>
                </p>
              </div>
              <button
                type="button"
                className="admin-modal-close-btn"
                aria-label="Đóng"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: "14px", marginBottom: "16px" }}>
              <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
                <ThumbnailBox
                  src={resolveImageUrl(selected.productPrimaryImageUrl ?? null)}
                  alt={selected.productName}
                  size={72}
                />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="info-row">
                    <span>Trạng thái</span>
                    <Badge tone={semanticStatusTone(selected.status)}>{statusLabel(REPORT_STATUS, selected.status)}</Badge>
                  </div>
                  <div className="info-row">
                    <span>Lý do vi phạm</span>
                    <strong>{reasonLabel(selected.reason)}</strong>
                  </div>
                  <div className="info-row">
                    <span>Ngày gửi</span>
                    <span>{formatDate(selected.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div>
                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
                  Mô tả chi tiết từ người báo cáo
                </span>
                <p
                  style={{
                    margin: "6px 0 0",
                    padding: "10px 12px",
                    background: "var(--surface-2, #f8fafc)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "14px",
                    lineHeight: 1.5,
                  }}
                >
                  {selected.description}
                </p>
              </div>

              <div>
                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Ảnh bằng chứng ({selected.evidenceImages?.length ?? 0})
                </span>
                <EvidenceThumbnailGrid
                  urls={selected.evidenceImages}
                  size={84}
                  title={`Bằng chứng: ${selected.productName}`}
                />
              </div>

              {selected.resolutionNote && (
                <div
                  style={{
                    padding: "12px",
                    background: "#f0fdf4",
                    borderRadius: "8px",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  <strong style={{ display: "block", color: "#166534", fontSize: "13px", marginBottom: "4px" }}>
                    Kết quả xử lý {selected.reviewedAt ? `(${formatDate(selected.reviewedAt)})` : ""}
                  </strong>
                  <p style={{ margin: 0, fontSize: "13px", color: "#15803d" }}>{selected.resolutionNote}</p>
                </div>
              )}
            </div>

            {error && (
              <p className="notice" role="alert">
                {error}
              </p>
            )}

            {!isReportFinalized(selected.status) ? (
              <form onSubmit={handleDecide} style={{ display: "grid", gap: "12px" }}>
                <label className="field-wrap" style={{ margin: 0 }}>
                  <span>Quyết định kiểm duyệt</span>
                  <select
                    className="select-field"
                    value={action}
                    disabled={busy}
                    onChange={(e) => setAction(e.target.value as ProductReportAction)}
                  >
                    <option value="INVESTIGATE">Tiếp tục xem xét</option>
                    <option value="DISMISS">Bác báo cáo</option>
                    <option value="BAN_PRODUCT">Cấm bán sản phẩm</option>
                  </select>
                </label>
                <label className="field-wrap" style={{ margin: 0 }}>
                  <span>Lý do xử lý (tối thiểu 5 ký tự)</span>
                  <textarea
                    className="textarea-field"
                    rows={3}
                    minLength={5}
                    maxLength={2000}
                    required
                    disabled={busy}
                    placeholder="Nhập ghi chú xử lý cho báo cáo này..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <div className="action-row" style={{ marginTop: 4 }}>
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={busy || note.trim().length < 5}
                  >
                    {busy ? "Đang xử lý…" : "Lưu quyết định"}
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => setSelected(null)}
                  >
                    Đóng
                  </button>
                </div>
              </form>
            ) : (
              <div className="action-row">
                <button className="button button-secondary" type="button" onClick={() => setSelected(null)}>
                  Đóng
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
