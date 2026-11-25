/* Lucian UX/UI Prompt #405 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#405 */
"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import "./PasswordResetCard.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COOLDOWN_MAX = 60;

export type PasswordResetCardProps = {
  email: string;
  onEmailChange: (value: string) => void;
  sent: boolean;
  busy: boolean;
  error: string;
  resendIn: number;
  onSend: () => Promise<boolean>;
  onResend: () => Promise<boolean>;
  onChangeEmail: () => void;
  resetPasswordHref: string;
};

export function PasswordResetCard({
  email,
  onEmailChange,
  sent,
  busy,
  error,
  resendIn,
  onSend,
  onResend,
  onChangeEmail,
  resetPasswordHref,
}: PasswordResetCardProps) {
  const inputId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const resendBtnRef = useRef<HTMLButtonElement>(null);
  const planeRef = useRef<HTMLSpanElement>(null);

  const [focused, setFocused] = useState(false);
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [live, setLive] = useState("");

  function flyPlane(from: HTMLElement | null) {
    const plane = planeRef.current;
    const box = boxRef.current;
    if (!plane || !box || !from || !plane.animate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = from.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const scale = box.offsetWidth / (boxRect.width || 1);
    const x = (rect.left + rect.width / 2 - boxRect.left - boxRect.width / 2) * scale;
    const y = (rect.top + rect.height / 2 - boxRect.top - boxRect.height / 2) * scale;
    plane.animate(
      [
        { opacity: 0, transform: `translate(${x}px,${y}px) rotate(10deg) scale(.6)` },
        { opacity: 1, transform: `translate(${x + 10}px,${y - 18}px) rotate(-6deg) scale(1.1)`, offset: 0.2 },
        { opacity: 1, transform: `translate(${x + 70}px,${y - 70}px) rotate(-18deg) scale(1)`, offset: 0.6 },
        { opacity: 0, transform: `translate(${x + 150}px,${y - 150}px) rotate(-30deg) scale(.55)` },
      ],
      { duration: 1000, easing: "cubic-bezier(.3,.1,.4,1)" },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setInvalidEmail(true);
      setShaking(false);
      window.requestAnimationFrame(() => setShaking(true));
      setLive("Vui lòng kiểm tra địa chỉ email");
      inputRef.current?.focus();
      return;
    }
    setFocused(false);
    const ok = await onSend();
    if (ok) {
      flyPlane(sendBtnRef.current);
      setLive("Đã gửi mã đặt lại mật khẩu");
    }
  }

  async function handleResend() {
    if (busy || resendIn > 0) return;
    const ok = await onResend();
    if (ok) {
      flyPlane(resendBtnRef.current);
      setLive("Đã gửi lại mã đặt lại mật khẩu");
    }
  }

  function handleChange() {
    onChangeEmail();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    }, reduced ? 0 : 300);
  }

  const labelUp = focused || Boolean(email);
  const progressRatio = Math.max(0, Math.min(1, 1 - resendIn / COOLDOWN_MAX));
  const strokeDashoffset = (62.8 * progressRatio).toFixed(1);
  const ready = resendIn <= 0 && !busy;

  return (
    <div className={`u405${sent ? " is-sent" : ""}`}>
      <div className="u405-box" ref={boxRef}>
        <form className="u405-a" noValidate onSubmit={(event) => void handleSubmit(event)} aria-hidden={sent}>
          <div
            className={`u405-f${focused ? " is-f" : ""}${labelUp ? " is-up" : ""}${invalidEmail || Boolean(error) ? " is-err" : ""}${shaking ? " is-shake" : ""}`}
            onAnimationEnd={() => setShaking(false)}
          >
            <input
              ref={inputRef}
              id={inputId}
              className="u405-in"
              type="email"
              autoComplete="email"
              spellCheck={false}
              disabled={sent}
              value={email}
              aria-invalid={invalidEmail || Boolean(error) || undefined}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(event) => {
                setInvalidEmail(false);
                onEmailChange(event.target.value);
              }}
            />
            <label htmlFor={inputId}>Email tài khoản</label>
          </div>
          {!sent && error && <p className="u405-err-note" role="alert">{error}</p>}
          {!sent && invalidEmail && !error && <p className="u405-err-note" role="alert">Email chưa đúng định dạng.</p>}
          <button ref={sendBtnRef} type="submit" className="u405-send" disabled={busy || sent}>
            {busy ? "Đang gửi…" : "Gửi mã OTP đặt lại"}
          </button>
        </form>

        <div className="u405-b" aria-hidden={!sent}>
          <svg className="u405-env" viewBox="0 0 72 60" aria-hidden="true">
            <rect className="bk" x="6" y="16" width="60" height="40" rx="6" />
            <g className="letter">
              <rect className="lt" x="14" y="6" width="44" height="34" rx="4" />
              <path className="ln" d="M21 15h22M21 21h30M21 27h18" />
            </g>
            <path className="fr" d="M6 22v28a6 6 0 0 0 6 6h48a6 6 0 0 0 6-6V22L38.6 40.6a4.5 4.5 0 0 1-5.2 0z" />
            <path className="fl" d="M8 17.5c-1.2-.9-.6-1.5.9-1.5h54.2c1.5 0 2.1.6.9 1.5L38.4 37a4 4 0 0 1-4.8 0z" />
          </svg>
          <b>Kiểm tra email của bạn</b>
          <span className="u405-to">
            <span>{email}</span>
            <button type="button" className="u405-chg" tabIndex={sent ? 0 : -1} aria-label="Đổi địa chỉ email" onClick={handleChange}>
              Đổi
            </button>
          </span>
          {sent && error && <p className="u405-err-note" role="alert">{error}</p>}
          <div className="u405-actions">
            <Link className="u405-otp-link" href={resetPasswordHref} tabIndex={sent ? 0 : -1}>
              Nhập mã OTP
            </Link>
            <button
              ref={resendBtnRef}
              type="button"
              className={`u405-re${ready ? " is-ready" : ""}`}
              disabled={!sent || busy || resendIn > 0}
              tabIndex={sent ? 0 : -1}
              aria-label={resendIn > 0 ? `Gửi lại sau ${resendIn} giây` : "Gửi lại mã OTP"}
              onClick={() => void handleResend()}
            >
              <span className="u405-ring" aria-hidden="true">
                <svg viewBox="0 0 26 26">
                  <circle className="tr" cx="13" cy="13" r="10" />
                  <circle className="pr" cx="13" cy="13" r="10" style={{ strokeDashoffset }} />
                </svg>
                <em>{Math.max(0, resendIn)}</em>
                <i />
              </span>
              <span>{resendIn > 0 ? `Gửi lại (${resendIn}s)` : "Gửi lại"}</span>
            </button>
          </div>
        </div>

        <span ref={planeRef} className="u405-plane" aria-hidden="true">
          <svg viewBox="0 0 30 30">
            <path className="p1" d="M3 14.2 27 4l-7.6 21.6-5.4-6.2z" />
            <path className="p2" d="M14 19.4 27 4 11.2 17.6l1.6 6.4z" />
          </svg>
        </span>
      </div>
      <p className="u405-live" role="status">{live}</p>
    </div>
  );
}
