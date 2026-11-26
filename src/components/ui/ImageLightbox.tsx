"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { resolveImageUrl } from "@/lib/presentation";

function filterValidImages(urls?: string[] | null): string[] {
  return (urls ?? []).map((u) => resolveImageUrl(u)).filter((u): u is string => Boolean(u));
}

export function ImageLightbox({
  images,
  initialIndex = 0,
  title = "Xem ảnh chi tiết",
  onClose,
}: {
  images: string[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
}) {
  const validImages = filterValidImages(images);
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, validImages.length - 1)),
  );

  useEffect(() => {
    if (!validImages.length) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && validImages.length > 1) {
        setIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
      } else if (e.key === "ArrowRight" && validImages.length > 1) {
        setIndex((prev) => (prev + 1) % validImages.length);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [validImages.length, onClose]);

  if (!validImages.length) return null;
  const currentUrl = validImages[index] ?? validImages[0];

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.82)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        zIndex: 2000,
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "12px",
          maxWidth: "92vw",
          maxHeight: "90vh",
          width: "min(760px, 92vw)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <div>
            <strong style={{ fontSize: "15px", color: "var(--ink)" }}>{title}</strong>
            {validImages.length > 1 && (
              <span style={{ marginLeft: "8px", fontSize: "12px", color: "var(--muted)" }}>
                ({index + 1} / {validImages.length})
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-secondary button-small"
            >
              Mở tab mới ↗
            </a>
            <button type="button" className="button button-secondary button-small" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            background: "#0f172a",
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            minHeight: "280px",
            maxHeight: "68vh",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt={`${title} #${index + 1}`}
            style={{
              maxWidth: "100%",
              maxHeight: "68vh",
              objectFit: "contain",
              display: "block",
            }}
          />
          {validImages.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Ảnh trước"
                onClick={() => setIndex((prev) => (prev - 1 + validImages.length) % validImages.length)}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.9)",
                  border: "none",
                  borderRadius: "999px",
                  width: "36px",
                  height: "36px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Ảnh tiếp theo"
                onClick={() => setIndex((prev) => (prev + 1) % validImages.length)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.9)",
                  border: "none",
                  borderRadius: "999px",
                  width: "36px",
                  height: "36px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ›
              </button>
            </>
          )}
        </div>

        {validImages.length > 1 && (
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "2px" }}>
            {validImages.map((url, idx) => (
              <button
                key={`${url}-${idx}`}
                type="button"
                onClick={() => setIndex(idx)}
                style={{
                  padding: 0,
                  border: idx === index ? "2px solid var(--primary, #0f172a)" : "1px solid var(--border)",
                  borderRadius: "6px",
                  overflow: "hidden",
                  width: "52px",
                  height: "52px",
                  flexShrink: 0,
                  cursor: "pointer",
                  background: "#f8fafc",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}

export function EvidenceThumbnailGrid({
  urls,
  size = 64,
  title = "Ảnh bằng chứng",
}: {
  urls?: string[] | null;
  size?: number;
  title?: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  const validUrls = filterValidImages(urls);

  if (!validUrls.length) return <span style={{ fontSize: "13px", color: "var(--muted)" }}>Không có ảnh đính kèm</span>;

  return (
    <>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        {validUrls.map((url, idx) =>
          broken[idx] ? (
            <a
              key={`${url}-${idx}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-secondary button-small"
            >
              Tệp #{idx + 1} ↗
            </a>
          ) : (
            <button
              key={`${url}-${idx}`}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              title="Nhấn để phóng to ảnh"
              style={{
                padding: 0,
                border: "1px solid var(--border)",
                borderRadius: "8px",
                overflow: "hidden",
                width: size,
                height: size,
                cursor: "pointer",
                background: "var(--surface-muted, #f1f5f9)",
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${title} #${idx + 1}`}
                onError={() => setBroken((prev) => ({ ...prev, [idx]: true }))}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </button>
          ),
        )}
      </div>
      {lightboxIndex !== null && (
        <ImageLightbox
          images={validUrls}
          initialIndex={lightboxIndex}
          title={title}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
