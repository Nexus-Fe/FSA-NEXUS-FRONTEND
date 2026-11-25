/* Lucian UX/UI Prompt #069 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#069 */
"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import "./AvatarCropEditor.css";

type Props = {
  initialLetter: string;
  currentAvatar?: string | null;
  onSave: (blob: Blob, previewDataUrl: string) => Promise<void> | void;
  onCancel?: () => void;
};

export function AvatarCropEditor({ initialLetter, currentAvatar, onSave, onCancel }: Props) {
  const [src, setSrc] = useState<string>(currentAvatar ?? "");
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 280, h: 280 });
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [z, setZ] = useState(1);
  const [rot, setRot] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [instant, setInstant] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [saveError, setSaveError] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<HTMLSpanElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragOrigin = useRef({ sx: 0, sy: 0, ox: 0, oy: 0 });
  const wheelTimer = useRef<number>(0);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  useEffect(() => () => window.clearTimeout(wheelTimer.current), []);

  const baseScale = Math.max(280 / (imgSize.w || 280), 280 / (imgSize.h || 280));
  const baseW = (imgSize.w || 280) * baseScale;
  const baseH = (imgSize.h || 280) * baseScale;

  function clampCoords(nx: number, ny: number, nz: number, nrot = rot) {
    const swapped = Math.abs(nrot) % 180 !== 0;
    const effW = (swapped ? baseH : baseW) * nz;
    const effH = (swapped ? baseW : baseH) * nz;
    const maxX = Math.max(0, (effW - 240) / 2);
    const maxY = Math.max(0, (effH - 240) / 2);
    return {
      cx: Math.max(-maxX, Math.min(maxX, nx)),
      cy: Math.max(-maxY, Math.min(maxY, ny)),
    };
  }

  function applyPosition(nx: number, ny: number, nz = z, nrot = rot) {
    const { cx, cy } = clampCoords(nx, ny, nz, nrot);
    setX(cx);
    setY(cy);
    setZ(nz);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !src) return;
    event.preventDefault();
    setDragging(true);
    dragOrigin.current = { sx: event.clientX, sy: event.clientY, ox: x, oy: y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging || !cropRef.current) return;
    const scale = cropRef.current.offsetWidth / cropRef.current.getBoundingClientRect().width;
    const nx = dragOrigin.current.ox + (event.clientX - dragOrigin.current.sx) * scale;
    const ny = dragOrigin.current.oy + (event.clientY - dragOrigin.current.sy) * scale;
    applyPosition(nx, ny);
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    if (!src) return;
    event.preventDefault();
    setInstant(true);
    const nextZ = Math.max(1, Math.min(3, z * (event.deltaY < 0 ? 1.06 : 0.94)));
    applyPosition(x, y, nextZ);
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => setInstant(false), 120);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!src) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileRef.current?.click();
      }
      return;
    }
    const step = event.shiftKey ? 20 : 6;
    if (event.key === "ArrowLeft") applyPosition(x + step, y);
    else if (event.key === "ArrowRight") applyPosition(x - step, y);
    else if (event.key === "ArrowUp") applyPosition(x, y + step);
    else if (event.key === "ArrowDown") applyPosition(x, y - step);
    else if (event.key === "+" || event.key === "=") applyPosition(x, y, Math.min(3, z + 0.1));
    else if (event.key === "-") applyPosition(x, y, Math.max(1, z - 0.1));
    else return;
    event.preventDefault();
  }

  function handleFileSelect(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSrc(reader.result);
        setX(0);
        setY(0);
        setZ(1);
        setRot(0);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    const img = imgRef.current;
    if (!src || !img || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const size = 240;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Không thể khởi tạo bộ xử lý ảnh.");

      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.translate(size / 2 + x, size / 2 + y);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(z, z);

      const naturalW = img.naturalWidth || 280;
      const naturalH = img.naturalHeight || 280;
      const coverScale = Math.max(280 / naturalW, 280 / naturalH);
      const drawW = naturalW * coverScale;
      const drawH = naturalH * coverScale;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

      const previewDataUrl = canvas.toDataURL("image/png");
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("Không xuất được tệp ảnh."))),
          "image/png",
        );
      });

      await onSave(blob, previewDataUrl);

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const root = rootRef.current;
      const crop = cropRef.current;
      const me = meRef.current;
      if (!reduced && root && crop && me) {
        const fly = document.createElement("div");
        fly.className = "u069-fly";
        const previewImg = document.createElement("img");
        previewImg.src = previewDataUrl;
        previewImg.alt = "";
        fly.appendChild(previewImg);
        root.appendChild(fly);
        const fx = crop.offsetLeft + 20;
        const fy = crop.offsetTop + 20;
        const tx = me.offsetLeft;
        const ty = me.offsetTop;
        const k = 52 / 240;
        fly.animate(
          [
            { transform: `translate(${fx}px,${fy}px) scale(1)` },
            { transform: `translate(${tx}px,${ty}px) scale(${k})` },
          ],
          { duration: 600, easing: "cubic-bezier(.6,0,.2,1)", fill: "forwards" },
        ).onfinish = () => fly.remove();
      }

      setSavedOk(true);
      window.setTimeout(() => setSavedOk(false), 1200);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Không thể tải ảnh đại diện lên.");
    } finally {
      setSaving(false);
    }
  }

  const fillPct = (((z - 1) / 2) * 100).toFixed(1);
  const transformValue = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${rot}deg) scale(${z.toFixed(3)})`;

  const dialog = (
    <div
      className="u069-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel?.();
      }}
    >
      <div className="u069" ref={rootRef} role="dialog" aria-modal="true" aria-label="Chỉnh sửa ảnh đại diện">
        <div className="u069-top">
          <span className="u069-me" ref={meRef} aria-hidden="true">
            {currentAvatar ? <img src={currentAvatar} alt="" /> : initialLetter}
          </span>
          <span>
            <b>Ảnh đại diện</b>
            <small>{src ? "Kéo để căn chỉnh khuôn mặt vào vòng tròn" : "Nhấn vào khung tròn để chọn ảnh từ máy"}</small>
          </span>
        </div>

        <div
          ref={cropRef}
          className={`u069-crop${!src ? " is-empty" : ""}${dragging ? " drag" : ""}${instant ? " now" : ""}`}
          tabIndex={0}
          role={!src ? "button" : "application"}
          aria-roledescription={!src ? undefined : "trình cắt ảnh"}
          aria-label={!src ? "Chọn ảnh từ thiết bị" : "Điều chỉnh vị trí ảnh. Di chuyển bằng phím mũi tên và phóng to thu nhỏ bằng phím cộng và trừ"}
          onClick={() => {
            if (!src && !saving) fileRef.current?.click();
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
        >
          <div className="u069-img" style={{ transform: transformValue }} aria-hidden="true">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={src}
                draggable={false}
                crossOrigin={src.startsWith("data:") ? undefined : "anonymous"}
                style={{ width: baseW, height: baseH }}
                onLoad={(event) => {
                  const target = event.currentTarget;
                  if (target.naturalWidth && target.naturalHeight) {
                    setImgSize({ w: target.naturalWidth, h: target.naturalHeight });
                  }
                }}
                alt=""
              />
            ) : (
              <span className="u069-empty">Nhấn để chọn ảnh từ thiết bị</span>
            )}
          </div>
          <span className="u069-shade" aria-hidden="true" />
          <span className="u069-grid" aria-hidden="true" />
          <span className="u069-ring" aria-hidden="true" />
        </div>

        <div className="u069-tools">
          <svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="8" cy="8" r="5" /><path d="M12 12l4 4M6 8h4" /></svg>
          <input
            className="u069-z"
            type="range"
            min="100"
            max="300"
            value={Math.round(z * 100)}
            disabled={!src}
            aria-label="Phóng to / Thu nhỏ"
            aria-valuetext={`${Math.round(z * 100)}%`}
            style={{ ["--f" as string]: `${fillPct}%` }}
            onChange={(event) => {
              setInstant(true);
              applyPosition(x, y, Number(event.target.value) / 100);
            }}
            onMouseUp={() => setInstant(false)}
            onTouchEnd={() => setInstant(false)}
          />
          <svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="8" cy="8" r="5" /><path d="M12 12l4 4M6 8h4M8 6v4" /></svg>
          <button
            className="u069-rot"
            type="button"
            disabled={!src}
            aria-label="Xoay 90°"
            onClick={() => {
              const nextRot = rot + 90;
              setRot(nextRot);
              applyPosition(x, y, z, nextRot);
            }}
          >
            <svg viewBox="0 0 18 18"><path d="M14.5 9A5.5 5.5 0 1 1 9 3.5h3M10.5 1.5L12.5 3.5 10.5 5.5" /></svg>
          </button>
        </div>

        {saveError && <p role="alert" style={{ margin: "10px 0 0", fontSize: 12.5, fontWeight: 600, color: "#D93A55", textAlign: "center" }}>{saveError}</p>}

        <div className="u069-acts">
          <input
            ref={fileRef}
            className="u069-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              handleFileSelect(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button className="u069-b ghost" type="button" disabled={saving} onClick={() => fileRef.current?.click()}>
            {src ? "Chọn ảnh khác" : "Chọn ảnh"}
          </button>
          {onCancel && (
            <button className="u069-b ghost" type="button" disabled={saving} onClick={onCancel}>
              Đóng
            </button>
          )}
          <button
            className={`u069-b main${savedOk ? " ok" : ""}`}
            type="button"
            disabled={!src || saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Đang lưu…" : savedOk ? "Đã lưu" : "Lưu ảnh"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(dialog, document.body) : dialog;
}
