/* Lucian UX/UI Prompt #062 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#062 */
"use client";

import type { ReactNode } from "react";
import "./SignInFeedback.css";

export type SubmitMorphStatus = "idle" | "busy" | "ok";

/** Submit button that shrinks into a spinner while busy and a check on success. */
export function SubmitMorphButton({ status, disabled, children }: { status: SubmitMorphStatus; disabled?: boolean; children: ReactNode }) {
  const busy = status === "busy";
  const ok = status === "ok";
  return (
    <button
      className={`auth-submit-btn u062-go${busy || ok ? " is-morph" : ""}${busy ? " is-busy" : ""}${ok ? " is-ok" : ""}`}
      type="submit"
      disabled={disabled}
      aria-label={busy ? "Đang đăng nhập" : ok ? "Đã đăng nhập" : undefined}
    >
      <span className="u062-label">{children}</span>
      <i className="u062-spin" aria-hidden="true" />
      <svg className="u062-check" viewBox="0 0 26 26" aria-hidden="true"><path d="M6 13.5l4.5 4.5L20 8.5" /></svg>
    </button>
  );
}
