/* Lucian UX/UI Prompt #406 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#406 */
"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type Ref } from "react";
import "./OtpCodeInput.css";

const LENGTH = 6;

export type OtpStatus = "idle" | "busy" | "error" | "success";

type Props = {
  /** Digits entered so far (0–6). */
  value: string;
  onChange: (code: string) => void;
  status?: OtpStatus;
  disabled?: boolean;
  /** Increase this number after a rejected code to replay the shake and refocus the first box. */
  errorSignal?: number;
  /** Id of the first box, so an external <label htmlFor> can point at it. */
  id?: string;
  firstInputRef?: Ref<HTMLInputElement>;
  ariaLabel?: string;
};

export function OtpCodeInput({ value, onChange, status = "idle", disabled = false, errorSignal = 0, id, firstInputRef, ariaLabel = "Mã xác thực 6 chữ số" }: Props) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [current, setCurrent] = useState(-1);
  const [shaking, setShaking] = useState(false);
  const [seenSignal, setSeenSignal] = useState(errorSignal);
  if (seenSignal !== errorSignal) {
    setSeenSignal(errorSignal);
    setShaking(true);
  }

  useEffect(() => {
    if (errorSignal > 0) inputs.current[0]?.focus({ preventScroll: true });
  }, [errorSignal]);

  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");
  const locked = disabled || status === "busy" || status === "success";

  function focusBox(index: number) {
    const box = Math.max(0, Math.min(LENGTH - 1, index));
    setCurrent(box);
    inputs.current[box]?.focus({ preventScroll: true });
  }

  function fill(index: number, text: string) {
    const typed = text.replace(/\D/g, "");
    if (!typed) return;
    const start = typed.length >= LENGTH ? 0 : index;
    const next = digits.slice();
    typed.split("").forEach((digit, offset) => {
      if (start + offset < LENGTH) next[start + offset] = digit;
    });
    const joined = next.join("");
    onChange(joined);
    const firstEmpty = next.indexOf("");
    focusBox(firstEmpty < 0 ? LENGTH - 1 : Math.max(firstEmpty, Math.min(LENGTH - 1, start + typed.length)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (locked) return;
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = digits.slice();
      if (next[index]) {
        next[index] = "";
        onChange(next.join(""));
        focusBox(index);
      } else if (index > 0) {
        next[index - 1] = "";
        onChange(next.join(""));
        focusBox(index - 1);
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight" && index < LENGTH - 1) {
      event.preventDefault();
      focusBox(index + 1);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    const text = event.clipboardData.getData("text");
    if (!text) return;
    event.preventDefault();
    if (!locked) fill(index, text);
  }

  const live = status === "error" ? "Mã xác thực chưa chính xác" : status === "success" ? "Đã xác thực" : "";
  return (
    <div className="u406">
      <div className="u406-wrap">
        <div
          className={`u406-row${status === "busy" ? " is-busy" : ""}${status === "error" ? " is-err" : ""}${status === "success" ? " is-merge" : ""}${shaking ? " is-shake" : ""}`}
          role="group"
          aria-label={ariaLabel}
          onAnimationEnd={(event) => { if (event.target === event.currentTarget) setShaking(false); }}
        >
          {digits.map((digit, index) => (
            <div
              key={index}
              className={`u406-b${digit ? " is-fill" : ""}${current === index ? " is-cur" : ""}`}
              style={{ ["--i" as string]: index, ["--mx" as string]: `${(2.5 - index) * 50}px`, ["--d" as string]: Math.abs(2.5 - index) * 2 }}
            >
              <input
                id={index === 0 ? id : undefined}
                ref={(node) => {
                  inputs.current[index] = node;
                  if (index === 0 && firstInputRef) {
                    if (typeof firstInputRef === "function") firstInputRef(node);
                    else (firstInputRef as { current: HTMLInputElement | null }).current = node;
                  }
                }}
                className="u406-in"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                aria-label={`Chữ số ${index + 1}`}
                value={digit}
                disabled={disabled}
                readOnly={locked}
                onChange={(event) => { if (!locked) fill(index, event.target.value.slice(-LENGTH)); }}
                onFocus={() => setCurrent(index)}
                onBlur={() => setCurrent((now) => (now === index ? -1 : now))}
                onKeyDown={(event) => onKeyDown(event, index)}
                onPaste={(event) => onPaste(event, index)}
              />
              {digit && <span key={digit} className="u406-g is-pop" aria-hidden="true">{digit}</span>}
            </div>
          ))}
        </div>
        <svg className="u406-ck" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="30" /><path d="M18 30.5l8 8L42.5 22" /></svg>
      </div>
      <p className="u406-live" role="status">{live}</p>
    </div>
  );
}
