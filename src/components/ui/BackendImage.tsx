"use client";

import { useState } from "react";
import { NoData } from "./Primitives";

export function BackendImage({ src, alt, compact = false }: { src: string | null; alt: string; compact?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || failedSource === src) return <NoData className={compact ? "compact" : ""} />;
  // Backend image hosts are provided at runtime, so Next Image remotePatterns cannot be fixed at build time.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setFailedSource(src)} />;
}

export function ThumbnailBox({
  src,
  alt,
  size = 48,
}: {
  src: string | null;
  alt: string;
  size?: number;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const showImage = Boolean(src && failedSource !== src);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--surface-muted, #f1f5f9)",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        color: "var(--muted, #94a3b8)",
      }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt}
          onError={() => setFailedSource(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <svg
          width={Math.min(24, Math.round(size * 0.42))}
          height={Math.min(24, Math.round(size * 0.42))}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-label="Không có ảnh"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      )}
    </div>
  );
}
