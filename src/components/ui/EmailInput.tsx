/* Lucian UX/UI Prompt #434 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#434 */
"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import "./EmailInput.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export type EmailInputProps = {
  value: string;
  onChange: (value: string) => void;
  label: ReactNode;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  helpText?: string;
  errorText?: string;
  validText?: string;
  externalError?: string;
  className?: string;
};

export function EmailInput({
  value,
  onChange,
  label,
  id,
  placeholder = "name@example.com",
  required = false,
  disabled = false,
  autoComplete = "email",
  helpText = "Nhập đúng định dạng email (ví dụ: name@example.com)",
  errorText = "Email chưa đúng định dạng",
  validText = "Email hợp lệ",
  externalError,
  className = "",
}: EmailInputProps) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-email`;
  const msgId = `${inputId}-msg`;
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number>(0);

  const [focused, setFocused] = useState(false);
  const [localState, setLocalState] = useState<"idle" | "err" | "ok">("idle");

  const effectiveState: "idle" | "err" | "ok" = externalError ? "err" : localState;
  const activeError = externalError || errorText;

  function validateNow(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setLocalState("idle");
      return;
    }
    setLocalState(EMAIL_RE.test(trimmed) ? "ok" : "err");
  }

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  function handleChange(next: string) {
    onChange(next);
    window.clearTimeout(timerRef.current);
    setLocalState("idle");
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timerRef.current = window.setTimeout(() => validateNow(next), reduced ? 300 : 800);
  }

  return (
    <div className={`u434${className ? ` ${className}` : ""}`}>
      <div className="u434-w" data-s={effectiveState}>
        <label className="u434-lb" htmlFor={inputId}>{label}</label>
        <div
          className={`u434-f${focused ? " is-focus" : ""}${effectiveState === "err" ? " is-err" : ""}${effectiveState === "ok" ? " is-ok" : ""}`}
          onClick={() => { if (!disabled) inputRef.current?.focus({ preventScroll: true }); }}
        >
          <input
            ref={inputRef}
            id={inputId}
            className="u434-in"
            type="email"
            autoComplete={autoComplete}
            spellCheck={false}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            value={value}
            aria-invalid={effectiveState === "err"}
            aria-describedby={msgId}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              window.clearTimeout(timerRef.current);
              validateNow(value);
            }}
            onChange={(event) => handleChange(event.target.value)}
          />
          <span className="u434-ic" aria-hidden="true">
            <span className="ok u434-ok"><svg viewBox="0 0 24 24"><path d="m5.5 12.5 4 4 9-9.5" /></svg></span>
            <span className="no"><svg viewBox="0 0 24 24"><path d="M12 7v6M12 17h.01" /></svg></span>
          </span>
        </div>
        <p className="u434-msg" id={msgId} aria-live="polite">
          <span className="h" aria-hidden={effectiveState !== "idle"}>{helpText}</span>
          <span className="e" aria-hidden={effectiveState !== "err"}>{activeError}</span>
          <span className="s" aria-hidden={effectiveState !== "ok"}>{validText}</span>
        </p>
      </div>
    </div>
  );
}
