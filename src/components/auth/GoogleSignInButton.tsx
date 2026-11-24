/* Lucian UX/UI Prompt #401 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#401 */
"use client";

import { useLayoutEffect, useRef } from "react";
import "./GoogleSignInButton.css";

export type GoogleSignInStatus = "idle" | "busy" | "ok";

type Props = {
  status: GoogleSignInStatus;
  /** Disables the button while another sign-in method is running. */
  disabled?: boolean;
  onClick: () => void;
};

const LABEL_INDEX: Record<GoogleSignInStatus, number> = { idle: 0, busy: 1, ok: 2 };

export function GoogleSignInButton({ status, disabled = false, onClick }: Props) {
  const labelRef = useRef<HTMLSpanElement>(null);

  // The button width follows the visible label, so it shrinks and grows with the text.
  useLayoutEffect(() => {
    const label = labelRef.current;
    if (!label) return;
    const span = label.children[LABEL_INDEX[status]] as HTMLElement | undefined;
    const width = span?.offsetWidth ?? 0;
    label.style.width = width ? `${width}px` : "";
  }, [status]);

  const busy = status === "busy";
  const ok = status === "ok";
  const live = busy ? "Đang kết nối tới Google" : ok ? "Đã đăng nhập bằng Google" : "";

  return (
    <div className="u401">
      <button
        type="button"
        className={`u401-b${busy ? " is-busy" : ""}${ok ? " is-ok" : ""}`}
        aria-busy={busy || undefined}
        disabled={disabled || busy || ok}
        onClick={onClick}
      >
        <span className="u401-ic" aria-hidden="true">
          <svg className="u401-g" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>
          <svg className="u401-arc" viewBox="0 0 20 20"><g><circle cx="10" cy="10" r="8" stroke="#EA4335" strokeDashoffset="0" /><circle cx="10" cy="10" r="8" stroke="#4285F4" strokeDashoffset="-12.57" /><circle cx="10" cy="10" r="8" stroke="#34A853" strokeDashoffset="-25.13" /><circle cx="10" cy="10" r="8" stroke="#FBBC05" strokeDashoffset="-37.7" /></g></svg>
          <svg className="u401-ck" viewBox="0 0 20 20"><path d="M4.8 10.4l3.4 3.4 7-7.4" /></svg>
        </span>
        <span className="u401-lb" ref={labelRef}>
          <span className="s0">Đăng nhập nhanh với Google</span>
          <span className="s1" aria-hidden="true">Đang kết nối…</span>
          <span className="s2" aria-hidden="true">Đã đăng nhập</span>
        </span>
      </button>
      <p className="u401-live" role="status">{live}</p>
    </div>
  );
}
