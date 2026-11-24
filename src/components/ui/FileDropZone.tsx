/* Lucian UX/UI Prompt #432 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#432 */
"use client";

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import "./FileDropZone.css";

export const IMAGE_UPLOAD_PRESET = {
  accept: "image/jpeg,image/png,image/webp",
  multiple: true,
  maxFiles: 5,
  maxSizeBytes: 5 * 1024 * 1024,
  hint: "JPG, PNG hoặc WEBP · tối đa 5 MB/ảnh",
} as const;

const EXT_COLORS: Record<string, string> = {
  pdf: "#E5484D",
  png: "#8E4EC6",
  jpg: "#0090FF",
  jpeg: "#0090FF",
  webp: "#119C72",
  doc: "#2B63D9",
  docx: "#2B63D9",
  zip: "#C27A12",
};

function formatSize(bytes: number): string {
  return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1048576).toFixed(1)}MB`;
}

function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true;
  const allowed = accept.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return true;
  const mime = file.type.toLowerCase();
  const ext = `.${(file.name.split(".").pop() ?? "").toLowerCase()}`;
  return allowed.some((rule) => {
    if (rule === mime || rule === ext) return true;
    if (rule.endsWith("/*") && mime.startsWith(rule.slice(0, -1))) return true;
    return false;
  });
}

export type FileDropZoneProps = {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSizeBytes?: number;
  disabled?: boolean;
  required?: boolean;
  ariaInvalid?: boolean;
  hint?: string;
  onFilesChange: (files: File[]) => void;
};

export function FileDropZone({
  accept,
  multiple = false,
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024,
  disabled = false,
  required = false,
  ariaInvalid = false,
  hint,
  onFilesChange,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const rafRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const [dragActive, setDragActive] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "done" | "error" | "out">("idle");
  const [progress, setProgress] = useState(0);
  const [activeFile, setActiveFile] = useState<{ name: string; ext: string; size: number } | null>(null);
  const [selectedSummary, setSelectedSummary] = useState("");
  const [live, setLive] = useState("");

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      cancelAnimationFrame(rafRef.current);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  function startSelection(fileList: FileList | null) {
    if (disabled || phase === "uploading" || !fileList?.length) return;
    const files = Array.from(fileList);
    const limited = multiple ? files.slice(0, maxFiles) : [files[0]];
    const first = limited[0];
    const ext = (/\.([a-z0-9]+)$/i.exec(first.name)?.[1] ?? "file").toLowerCase();
    const invalidType = limited.some((file) => !matchesAccept(file, accept));
    const tooBig = invalidType || limited.some((file) => file.size > maxSizeBytes) || (multiple && files.length > maxFiles);

    setActiveFile({ name: first.name, ext, size: first.size });
    setPhase("uploading");
    setProgress(0);
    setDragActive(false);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now() + (reduced ? 0 : 280);
    const dur = reduced ? 200 : 1000;

    cancelAnimationFrame(rafRef.current);
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / dur));
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const pct = tooBig ? Math.min(eased, 0.18) : eased;
      setProgress(pct);
      if (k < 1) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      if (tooBig) {
        setPhase("error");
        const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
        const errText = invalidType
          ? "Định dạng tệp không hợp lệ"
          : multiple && files.length > maxFiles
            ? `Tối đa ${maxFiles} tệp`
            : `Vượt quá ${maxMb} MB`;
        setLive(errText);
        onFilesChange([]);
        setSelectedSummary("");
      } else {
        setPhase("done");
        const summary = limited.length > 1 ? `${limited.length} tệp đã chọn` : `${first.name} (${formatSize(first.size)})`;
        setSelectedSummary(summary);
        setLive(`Đã chọn ${summary}`);
        onFilesChange(limited);
      }

      const outTimer = window.setTimeout(() => {
        setPhase("out");
        const resetTimer = window.setTimeout(() => setPhase("idle"), 320);
        timersRef.current.push(resetTimer);
      }, reduced ? 700 : 1300);
      timersRef.current.push(outTimer);
    };
    rafRef.current = requestAnimationFrame(step);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.key === "Enter" || event.key === " ") && !disabled && phase === "idle") {
      event.preventDefault();
      inputRef.current?.click();
    }
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    if (!disabled && phase === "idle") setDragActive(true);
  }

  function handleDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    startSelection(event.dataTransfer?.files ?? null);
  }

  const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
  const isUp = phase !== "idle";
  const strokeDashoffset = (289 * (1 - progress)).toFixed(1);
  const extColor = activeFile ? (EXT_COLORS[activeFile.ext] ?? "#6B7280") : "#6B7280";

  return (
    <div
      className={`u432${dragActive ? " is-drag" : ""}${isUp ? " is-up" : ""}${phase === "done" ? " is-done" : ""}${phase === "error" ? " is-err" : ""}${phase === "out" ? " is-out" : ""}${ariaInvalid ? " is-invalid" : ""}`}
    >
      <div
        className={`u432-dz${disabled ? " is-disabled" : ""}`}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-disabled={disabled || undefined}
        aria-label={selectedSummary ? `Tải tệp lên (${selectedSummary})` : required ? "Kéo thả hoặc chọn tệp (bắt buộc)" : "Kéo thả hoặc chọn tệp"}
        onClick={(event) => {
          if (!disabled && phase === "idle" && event.target !== inputRef.current) inputRef.current?.click();
        }}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={(event) => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="u432-idle">
          <span className="u432-ar" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 16V5M7 9.5 12 4.5l5 5" />
              <path d="M5 15v2.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V15" />
            </svg>
          </span>
          <b>Kéo thả tệp vào đây</b>
          <b aria-hidden="true">Thả để tải lên</b>
          <small>
            hoặc <span className="u432-br">chọn tệp</span> · {hint ?? `tối đa ${maxMb} MB`}
          </small>
          {selectedSummary && <span className="u432-picked">✓ {selectedSummary}</span>}
        </div>

        <div className="u432-up" aria-hidden="true">
          <div className="u432-st">
            <svg className="u432-ring" viewBox="0 0 100 100">
              <circle className="tk" cx="50" cy="50" r="46" />
              <circle className="pg" cx="50" cy="50" r="46" style={{ strokeDashoffset }} />
            </svg>
            <svg className="u432-doc" viewBox="0 0 50 62">
              <path className="pp" d="M6 1h26l15 15v39a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6V7a6 6 0 0 1 6-6z" />
              <path className="fd" d="M32 1v10a5 5 0 0 0 5 5h10z" />
              <rect className="ln" x="9" y="22" width="24" height="3" rx="1.5" />
              <rect className="ln" x="9" y="29" width="30" height="3" rx="1.5" />
              <rect className="tg" x="-4" y="40" width="28" height="14" rx="3.5" style={{ ["--c" as string]: extColor }} />
              <text x="10" y="50" textAnchor="middle">{activeFile ? activeFile.ext.slice(0, 4).toUpperCase() : "FILE"}</text>
            </svg>
            <span className="u432-ok">
              <svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            </span>
          </div>
          {activeFile && (
            <p className="u432-nm">
              {activeFile.name}{" "}
              <small>
                · {phase === "error" ? `Vượt ${maxMb} MB` : phase === "done" ? formatSize(activeFile.size) : `${Math.round(progress * 100)}%`}
              </small>
            </p>
          )}
        </div>

        <input
          ref={inputRef}
          className="u432-file"
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            startSelection(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      <p className="u432-live" role="status">{live}</p>
    </div>
  );
}
