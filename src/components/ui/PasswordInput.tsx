/* Lucian UX/UI Prompt #062 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#062 */
"use client";

import { useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import "@/components/ui/PasswordInput.css";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
  label: string;
  headerAction?: ReactNode;
}

export function PasswordInput({
  id,
  label,
  headerAction,
  className = "",
  placeholder = "••••••••",
  onKeyUp,
  onKeyDown,
  onBlur,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  function trackCaps(event: KeyboardEvent<HTMLInputElement>) {
    if (event.getModifierState) setCapsOn(event.getModifierState("CapsLock"));
  }

  return (
    <div className="field-wrap">
      <div className="field-header-row">
        <label htmlFor={id}>{label}</label>
        {capsOn && <span className="u062-caps" role="status">Đang bật Caps Lock</span>}
        {headerAction}
      </div>
      <div className="input-icon-wrap">
        <span className="input-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <input
          id={id}
          className={`field field-with-icon field-with-toggle ${className}`.trim()}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          onKeyUp={(event) => { trackCaps(event); onKeyUp?.(event); }}
          onKeyDown={(event) => { trackCaps(event); onKeyDown?.(event); }}
          onBlur={(event) => { setCapsOn(false); onBlur?.(event); }}
          {...props}
        />
        <button
          type="button"
          className="input-toggle-btn u062-eye"
          onClick={() => setVisible((prev) => !prev)}
          aria-pressed={visible}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <g className="u062-lid">
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
              <circle cx="12" cy="12" r="3" />
            </g>
            <path className="u062-slash" d="M4 4l16 16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
