"use client";

import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { ErrorState } from "./States";

/**
 * Ask-before-doing dialog for actions that change money, status or data. While the request runs the buttons are locked and the
 * dialog cannot be closed, so the outcome is always shown. A failure stays in the dialog with its dictionary text.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Để sau",
  busy = false,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  error?: unknown;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      busy={busy}
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>{cancelLabel}</button>
        <button type="button" className="button button-primary" disabled={busy} onClick={onConfirm}>{busy ? "Đang xử lý…" : confirmLabel}</button>
      </>}
    >
      {children}
      {error != null && <ErrorState cause={error} operation="write" />}
    </Modal>
  );
}
