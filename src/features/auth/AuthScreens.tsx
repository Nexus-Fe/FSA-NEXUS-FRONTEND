"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ROUTES } from "@/constants/routes";
import { useSession } from "@/components/auth/SessionProvider";
import { Card, NoData } from "@/components/ui/Primitives";
import { useApiResource } from "@/lib/api/use-api-resource";
import { authService } from "./services/auth.service";
import { ApiError } from "@/lib/api/client";
import { FirebaseClientError, signInWithGooglePopup } from "@/lib/auth/firebase-client";
import { profileService } from "@/features/profile";
import { ReputationScore } from "@/features/profile/ReputationScore";
import type { AuthUser } from "./types";
import { ShopRegistrationForm, ShopRegistrationReview, emptyShopRegistrationFields, validateShopRegistrationFields, type ShopRegistrationFields } from "@/features/seller/components/ShopRegistrationForm";
import { keepSellerRegistrationHandoff } from "@/features/seller/services/seller-registration-handoff";
import { AuthSplitLayout } from "./components/AuthSplitLayout";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { SubmitMorphButton } from "@/components/auth/SubmitMorphButton";
import { OtpCodeInput } from "@/components/ui/OtpCodeInput";
import { EmailInput } from "@/components/ui/EmailInput";
import { PasswordResetCard } from "@/components/auth/PasswordResetCard";
import { AvatarCropEditor } from "@/components/auth/AvatarCropEditor";
import { saveStoredAvatar, useStoredAvatar } from "@/lib/auth/avatar-storage";
import { resolveImageUrl } from "@/lib/presentation";
import { useOtpCooldown, clearStoredCooldown } from "./hooks/useOtpCooldown";

function landingPath(user: AuthUser): string {
  const roles = (user.roles ?? (user.role ? [user.role] : [])).map((role) => {
    const normalized = role.toLocaleLowerCase("en-US");
    return normalized === "supportstaff" ? "staff" : normalized;
  });
  if (roles.includes("admin")) return ROUTES.admin.overview;
  if (roles.includes("staff")) return ROUTES.staff.auctions;
  if (roles.includes("seller")) return ROUTES.seller.products;
  if (roles.includes("buyer") || roles.includes("customer")) return ROUTES.home;
  return ROUTES.home;
}

function safeReturnPath(value: string | null, user: AuthUser): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  const path = value.split(/[?#]/, 1)[0];
  const roles = (user.roles ?? (user.role ? [user.role] : [])).map((role) => role.toLowerCase());
  if ((path === "/buyer" || path.startsWith("/buyer/")) && !roles.some((role) => ["buyer", "customer", "seller"].includes(role))) return null;
  if ((path === "/seller" || path.startsWith("/seller/")) && !roles.includes("seller")) return null;
  if ((path === "/staff" || path.startsWith("/staff/")) && !roles.some((role) => ["staff", "supportstaff", "admin"].includes(role))) return null;
  if ((path === "/admin" || path.startsWith("/admin/")) && !roles.includes("admin")) return null;
  return value;
}

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Email/tên đăng nhập hoặc mật khẩu không đúng. Nếu bạn từng tạo tài khoản bằng Google, hãy thử nút Đăng nhập nhanh với Google hoặc Quên mật khẩu.",
  ACCOUNT_LOCKED_TEMPORARY: "Tài khoản tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau.",
  ACCOUNT_NOT_VERIFIED: "Tài khoản chưa xác thực email. Vui lòng kiểm tra mã OTP hoặc đăng nhập bằng Google.",
  USER_PENDING_VERIFICATION: "Tài khoản chưa xác thực email. Vui lòng kiểm tra mã OTP hoặc đăng nhập bằng Google.",
  INVALID_FIREBASE_TOKEN: "Phiên xác thực Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.",
  FIREBASE_EMAIL_REQUIRED: "Tài khoản Google chưa cung cấp địa chỉ email hợp lệ.",
  FIREBASE_EMAIL_NOT_VERIFIED: "Email Google của bạn chưa được xác minh.",
  FIREBASE_UID_MISMATCH: "Email này đã được liên kết với một tài khoản Google khác.",
  USER_NOT_FOUND: "Tài khoản không tồn tại hoặc đã bị xóa.",
};

function formatLoginError(reason: unknown): string {
  if (reason instanceof FirebaseClientError) {
    return reason.message;
  }
  if (reason instanceof ApiError) {
    if (reason.status === 423) {
      return LOGIN_ERROR_MESSAGES.ACCOUNT_LOCKED_TEMPORARY;
    }
    if (reason.errorCode === "ACCOUNT_BANNED" || reason.errorCode === "USER_BANNED") {
      return reason.message || "Tài khoản của bạn đã bị khóa.";
    }
    if (reason.errorCode && LOGIN_ERROR_MESSAGES[reason.errorCode]) {
      return LOGIN_ERROR_MESSAGES[reason.errorCode];
    }
    return reason.message;
  }
  return reason instanceof Error ? reason.message : "Không thể đăng nhập.";
}

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthenticatedUser } = useSession();
  const passwordChanged = searchParams.get("passwordChanged") === "1";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState<"password" | "google" | null>(null);
  const [shaking, setShaking] = useState(false);
  const authInFlightRef = useRef(false);
  const busy = submitting || googleSubmitting || succeeded !== null;

  async function runAuthAttempt(
    setLoading: (loading: boolean) => void,
    authenticate: () => Promise<{ user: AuthUser }>,
    kind: "password" | "google",
    ignorePopupClose = false,
  ) {
    if (authInFlightRef.current) return;
    authInFlightRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const response = await authenticate();
      setAuthenticatedUser(response.user);
      // Let the success check show briefly before leaving the page (skipped for reduced motion).
      setLoading(false);
      setSucceeded(kind);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduceMotion) await new Promise((resolve) => window.setTimeout(resolve, 650));
      router.replace(safeReturnPath(searchParams.get("returnTo"), response.user) ?? landingPath(response.user));
    } catch (reason) {
      if (ignorePopupClose && reason instanceof FirebaseClientError && reason.code === "POPUP_CLOSED") {
        return;
      }
      setError(formatLoginError(reason));
      setShaking(true);
    } finally {
      authInFlightRef.current = false;
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAuthAttempt(setSubmitting, () => authService.login({ identifier, password }), "password");
  }

  async function handleGoogleLogin() {
    await runAuthAttempt(
      setGoogleSubmitting,
      async () => {
        const idToken = await signInWithGooglePopup();
        return authService.loginWithGoogle({ idToken });
      },
      "google",
      true,
    );
  }

  return (
    <AuthSplitLayout>
      <div className="auth-split-heading auth-login-heading">
        <h1>Chào mừng trở lại!</h1>
      </div>

      {passwordChanged && <p className="form-success" role="status">Đã đổi mật khẩu. Đăng nhập lại bằng mật khẩu mới.</p>}

      {/* Đăng nhập nhanh với Google */}
      <GoogleSignInButton
        status={succeeded === "google" ? "ok" : googleSubmitting ? "busy" : "idle"}
        disabled={busy}
        onClick={() => void handleGoogleLogin()}
      />

      <div className="auth-divider">
        <span>Hoặc bằng tài khoản</span>
      </div>

      <form className={`auth-fields${shaking ? " u062-shake" : ""}`} onSubmit={submit} onAnimationEnd={(event) => { if (event.target === event.currentTarget) setShaking(false); }}>
        <div className="field-wrap">
          <label htmlFor="login-identifier">Email hoặc tên đăng nhập</label>
          <div className="input-icon-wrap">
            <span className="input-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="7" r="4" />
                <path d="M4 21v-2a8 8 0 0 1 16 0v2H4Z" />
              </svg>
            </span>
            <input
              id="login-identifier"
              className="field field-with-icon"
              type="text"
              autoComplete="username"
              placeholder="name@example.com hoặc username"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </div>
        </div>

        <PasswordInput
          id="login-password"
          label="Mật khẩu"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          headerAction={
            <Link className="forgot-password-link" href={ROUTES.auth.forgotPassword}>
              Quên mật khẩu?
            </Link>
          }
        />

        {error && <p className="form-error" role="alert">{error}</p>}

        <SubmitMorphButton status={succeeded === "password" ? "ok" : submitting ? "busy" : "idle"} disabled={googleSubmitting}>
          <span>Đăng nhập</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </SubmitMorphButton>
      </form>

      <p className="auth-single-footnote">
        Chưa có tài khoản? <Link href={ROUTES.auth.register}>Đăng ký ngay</Link>
      </p>
    </AuthSplitLayout>
  );
}

type RegisterFields = { username: string; firstName: string; lastName: string; email: string; phoneNumber: string; password: string; confirmPassword: string };
type RegistrationChoice = "buyer" | "seller";
type RegistrationStep = "account" | "shop" | "review" | "verify" | "signingIn" | "complete";

const roleConfig = {
  buyer: {
    steps: ["Tài khoản", "Xác thực email"],
    cta: "Tạo tài khoản và gửi OTP",
  },
  seller: {
    steps: ["Tài khoản", "Thông tin shop", "Xem lại", "Xác thực email"],
    cta: "Tiếp tục điền hồ sơ gian hàng",
  },
} as const;

export function RegisterScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthenticatedUser } = useSession();
  const searchRole = searchParams.get("role");
  const [overrideRole, setOverrideRole] = useState<RegistrationChoice | null>(null);
  const [prevSearchRole, setPrevSearchRole] = useState(searchRole);

  if (prevSearchRole !== searchRole) {
    setPrevSearchRole(searchRole);
    setOverrideRole(null);
  }

  const choice: RegistrationChoice = overrideRole ?? (searchRole === "seller" ? "seller" : "buyer");
  const setChoice = (newChoice: RegistrationChoice) => setOverrideRole(newChoice);
  const [fields, setFields] = useState<RegisterFields>({ username: "", firstName: "", lastName: "", email: "", phoneNumber: "", password: "", confirmPassword: "" });
  const [shop, setShop] = useState<ShopRegistrationFields>(emptyShopRegistrationFields);
  const [otp, setOtp] = useState("");
  const [otpSignal, setOtpSignal] = useState(0);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [step, setStep] = useState<RegistrationStep>("account");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { cooldown: resendIn, startCooldown } = useOtpCooldown(fields.email);

  function updateField(field: keyof RegisterFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  function validateAccount(): string | null {
    if (fields.username.trim().length < 3 || fields.username.trim().length > 50) return "Tên đăng nhập cần từ 3 đến 50 ký tự.";
    if (!fields.firstName.trim() || !fields.lastName.trim()) return "Vui lòng nhập họ và tên.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email.trim())) return "Email tài khoản chưa đúng định dạng.";
    if (!/^[0-9+() -]{9,15}$/.test(fields.phoneNumber.trim())) return "Số điện thoại cần từ 9 đến 15 ký tự số.";
    if (fields.password.length < 8) return "Mật khẩu cần ít nhất 8 ký tự.";
    if (fields.password !== fields.confirmPassword) return "Mật khẩu xác nhận không khớp.";
    return null;
  }

  async function sendAccountOtp() {
    const validationError = validateAccount();
    if (validationError) { setError(validationError); setStep("account"); return; }
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      await authService.register({
        username: fields.username.trim(),
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
        email: fields.email.trim(),
        phoneNumber: fields.phoneNumber.trim(),
        password: fields.password,
      });
      setStep("verify");
      startCooldown(60);
      setMessage(`Mã xác thực tài khoản đã được gửi tới ${fields.email.trim()}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo tài khoản.");
    } finally {
      setSubmitting(false);
    }
  }

  function continueFromAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const validationError = validateAccount();
    if (validationError) { setError(validationError); return; }
    if (choice === "buyer") {
      void sendAccountOtp();
      return;
    }
    setShop((current) => ({
      ...current,
      hotline: current.hotline || fields.phoneNumber.trim(),
      businessEmail: current.businessEmail || fields.email.trim(),
    }));
    setStep("shop");
  }

  function reviewShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateShopRegistrationFields(shop);
    if (Object.keys(errors).length) {
      setError(Object.values(errors)[0] ?? "Vui lòng kiểm tra lại thông tin shop.");
      return;
    }
    setError(null);
    setStep("review");
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      await authService.verifyOtp(fields.email, otp);
      clearStoredCooldown(fields.email);
      if (choice === "seller") keepSellerRegistrationHandoff(fields.email, shop);
      setOtpSuccess(true);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduceMotion) await new Promise((resolve) => window.setTimeout(resolve, 650));
      setStep("signingIn");
      try {
        const session = await authService.login({ identifier: fields.email.trim(), password: fields.password });
        setAuthenticatedUser(session.user);
        setFields((current) => ({ ...current, password: "", confirmPassword: "" }));
        router.replace(choice === "seller" ? ROUTES.buyer.becomeSeller : ROUTES.home);
      } catch {
        setFields((current) => ({ ...current, password: "", confirmPassword: "" }));
        setStep("complete");
        setMessage("Tài khoản đã xác thực. Hãy đăng nhập để tiếp tục; không cần xác thực OTP lại.");
      }
    } catch (reason) {
      setStep("verify");
      setError(reason instanceof Error ? reason.message : "Mã xác minh không hợp lệ.");
      setOtp("");
      setOtpSignal((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  }

  async function resendOtp() {
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const response = await authService.resendOtp(fields.email, "REGISTER");
      const cooldownSec = ("data" in response ? response.data : response).resendCooldown || 60;
      startCooldown(cooldownSec);
      setMessage("Đã gửi lại mã xác minh.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi lại mã xác minh.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = step === "account" ? "Tạo tài khoản NEXUS" : step === "shop" ? "Hồ sơ gian hàng Seller" : step === "review" ? "Xem lại hồ sơ đăng ký" : step === "verify" ? "Xác thực tài khoản" : step === "signingIn" ? "Đang đăng nhập" : "Tài khoản đã sẵn sàng";
  const description = step === "account" ? "Chọn vai trò và điền thông tin để bắt đầu trải nghiệm hệ sinh thái." : step === "shop" ? "Thiết lập tên gian hàng, hotline và kho hàng GHN để chuẩn bị kinh doanh." : step === "review" ? "Kiểm tra thông tin gian hàng trước khi kích hoạt tài khoản qua OTP." : step === "verify" ? `Nhập mã 6 chữ số gửi tới email ${fields.email}.` : step === "signingIn" ? "Đang mở phiên làm việc an toàn cho bạn…" : "Tài khoản đã xác thực thành công. Bạn có thể đăng nhập ngay.";
  const currentStepsList = roleConfig[choice].steps;
  const currentStep = step === "account" ? 1 : step === "shop" ? 2 : step === "review" ? 3 : currentStepsList.length;

  return (
    <AuthSplitLayout wide>
      <div className="auth-split-heading">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {step !== "complete" && (
        <ol className="registration-stepper" aria-label="Các bước đăng ký">
          {currentStepsList.map((label, index) => (
            <li className={index + 1 === currentStep ? "active" : index + 1 < currentStep ? "complete" : ""} key={label}>
              <span>{index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      )}

      {step === "account" && (
        <>
          {/* Thẻ Chọn Vai Trò Toàn Diện (Icon Vector SVG + Radio + WAI-ARIA) */}
          <div className="role-cards-container" role="radiogroup" aria-label="Hình thức đăng ký tài khoản">
            <div
              className={`role-card ${choice === "buyer" ? "active" : ""}`}
              onClick={() => setChoice("buyer")}
              role="radio"
              aria-checked={choice === "buyer"}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setChoice("buyer"); }}
            >
              <div className="role-card-header">
                <div className="role-card-icon-wrap buyer-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                </div>
                <div className="role-card-title-group">
                  <strong className="role-card-title">Người mua hàng</strong>
                  <span className="role-card-badge">Phổ biến</span>
                </div>
                <span className="role-card-radio" aria-hidden="true" />
              </div>
              <span className="role-card-desc">Khám phá sản phẩm, đấu giá trực tuyến và đặt mua hàng nhanh chóng.</span>
            </div>

            <div
              className={`role-card ${choice === "seller" ? "active" : ""}`}
              onClick={() => setChoice("seller")}
              role="radio"
              aria-checked={choice === "seller"}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setChoice("seller"); }}
            >
              <div className="role-card-header">
                <div className="role-card-icon-wrap seller-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div className="role-card-title-group">
                  <strong className="role-card-title">Mở gian hàng (Seller)</strong>
                  <span className="role-card-badge">Kinh doanh</span>
                </div>
                <span className="role-card-radio" aria-hidden="true" />
              </div>
              <span className="role-card-desc">Đăng bán sản phẩm, mở phiên đấu giá và kết nối bưu cục kho vận GHN.</span>
            </div>
          </div>

          <form className="auth-fields" onSubmit={continueFromAccount}>
            {/* Grid hàng 1: Tên đăng nhập & Email */}
            <div className="form-grid">
              <label className="field-wrap" htmlFor="register-username">
                Tên đăng nhập
                <input
                  id="register-username"
                  className="field"
                  autoComplete="username"
                  minLength={3}
                  maxLength={50}
                  placeholder="alexnguyen99"
                  required
                  value={fields.username}
                  onChange={(event) => updateField("username", event.target.value)}
                />
              </label>

              <EmailInput
                id="register-email"
                label="Email nhận OTP"
                placeholder="name@example.com"
                required
                value={fields.email}
                helpText="Mã OTP xác thực sẽ được gửi tới email này"
                onChange={(next) => updateField("email", next)}
              />
            </div>

            {/* Grid hàng 2: Họ & Tên */}
            <div className="form-grid">
              <label className="field-wrap" htmlFor="register-first">
                Họ
                <input
                  id="register-first"
                  className="field"
                  autoComplete="family-name"
                  placeholder="Nguyễn"
                  required
                  value={fields.firstName}
                  onChange={(event) => updateField("firstName", event.target.value)}
                />
              </label>

              <label className="field-wrap" htmlFor="register-last">
                Tên
                <input
                  id="register-last"
                  className="field"
                  autoComplete="given-name"
                  placeholder="Văn An"
                  required
                  value={fields.lastName}
                  onChange={(event) => updateField("lastName", event.target.value)}
                />
              </label>
            </div>

            {/* Grid hàng 3: Số điện thoại & Mật khẩu */}
            <div className="form-grid">
              <label className="field-wrap" htmlFor="register-phone">
                Số điện thoại
                <input
                  id="register-phone"
                  className="field"
                  type="tel"
                  autoComplete="tel"
                  placeholder="0912345678"
                  required
                  value={fields.phoneNumber}
                  onChange={(event) => updateField("phoneNumber", event.target.value)}
                />
              </label>

              <PasswordInput
                id="register-password"
                label="Mật khẩu (tối thiểu 8 ký tự)"
                autoComplete="new-password"
                minLength={8}
                required
                value={fields.password}
                onChange={(event) => updateField("password", event.target.value)}
              />
            </div>

            {/* Hàng 4: Xác nhận mật khẩu */}
            <PasswordInput
              id="register-confirm-password"
              label="Xác nhận mật khẩu"
              autoComplete="new-password"
              minLength={8}
              placeholder="Nhập lại mật khẩu"
              required
              value={fields.confirmPassword}
              onChange={(event) => updateField("confirmPassword", event.target.value)}
            />

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="auth-submit-btn" type="submit" disabled={submitting}>
              {submitting ? (
                "Đang gửi mã…"
              ) : (
                <>
                  <span>{roleConfig[choice].cta}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </>
      )}

      {step === "shop" && (
        <form className="auth-fields" onSubmit={reviewShop}>
          <ShopRegistrationForm idPrefix="new-seller" value={shop} onChange={setShop} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="action-row auth-action-row">
            <button className="auth-secondary-btn" type="button" onClick={() => setStep("account")}>
              Quay lại
            </button>
            <button className="auth-submit-btn" type="submit">
              <span>Kiểm tra thông tin shop</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </form>
      )}

      {step === "review" && (
        <div className="auth-fields">
          <div className="info-row">
            <span>Tài khoản liên kết</span>
            <strong>{fields.username.trim()} · {fields.email.trim()}</strong>
          </div>
          <ShopRegistrationReview value={shop} />
          <p className="status-note">
            Nhấn Tiếp tục sẽ tạo tài khoản và gửi mã OTP kích hoạt tới email {fields.email.trim()}. Hồ sơ shop sẽ được đồng bộ tự động.
          </p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="action-row auth-action-row">
            <button className="auth-secondary-btn" type="button" onClick={() => setStep("shop")}>
              Sửa thông tin shop
            </button>
            <button className="auth-submit-btn" type="button" disabled={submitting} onClick={() => void sendAccountOtp()}>
              {submitting ? "Đang gửi OTP…" : "Xác nhận & Gửi OTP"}
            </button>
          </div>
        </div>
      )}

      {step === "verify" && (
        <form className="auth-fields" onSubmit={verify}>
          <div className="field-wrap">
            <label htmlFor="register-otp">Mã OTP tài khoản (6 số)</label>
            <OtpCodeInput
              id="register-otp"
              value={otp}
              onChange={(code) => { setOtp(code); if (error) setError(null); }}
              status={otpSuccess ? "success" : submitting ? "busy" : error ? "error" : "idle"}
              errorSignal={otpSignal}
            />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}
          <button className="auth-submit-btn" type="submit" disabled={submitting || otp.length !== 6}>
            {submitting ? "Đang xác thực và đăng nhập…" : "Xác thực và hoàn tất"}
          </button>
          <button className="button button-secondary" type="button" disabled={submitting || resendIn > 0} onClick={() => void resendOtp()}>
            {resendIn > 0 ? `Gửi lại mã sau ${resendIn}s` : "Gửi lại OTP tài khoản"}
          </button>
        </form>
      )}

      {step === "signingIn" && <p className="status-note" role="status">Đang mở phiên làm việc an toàn cho bạn…</p>}

      {step === "complete" && (
        <div className="auth-fields">
          <p className="form-success" role="status">{message}</p>
          <Link className="auth-submit-btn" href={ROUTES.auth.login} style={{ textDecoration: "none" }}>
            Đăng nhập ngay
          </Link>
        </div>
      )}

      {step === "account" && (
        <p className="auth-single-footnote">
          Đã có tài khoản?
          <Link href={ROUTES.auth.login}>Đăng nhập</Link>
        </p>
      )}
    </AuthSplitLayout>
  );
}

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { cooldown: resendIn, startCooldown } = useOtpCooldown(email);

  async function requestPasswordResetOtp(isResend: boolean): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const { api } = await import("@/lib/api/client");
      await api.post("/api/v1/auth/password/forgot", { email });
      if (!isResend) setSent(true);
      startCooldown(60);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : isResend ? "Không thể gửi lại mã OTP." : "Không thể gửi yêu cầu.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitLayout closeHref={ROUTES.auth.login}>
      <div className="auth-split-heading">
        <h1>Quên mật khẩu</h1>
        <p>Nhập email đăng ký để nhận mã OTP đặt lại mật khẩu.</p>
      </div>
      <PasswordResetCard
        email={email}
        onEmailChange={setEmail}
        sent={sent}
        busy={busy}
        error={error}
        resendIn={resendIn}
        onSend={() => requestPasswordResetOtp(false)}
        onResend={() => requestPasswordResetOtp(true)}
        onChangeEmail={() => { setSent(false); setError(""); }}
        resetPasswordHref={ROUTES.auth.resetPassword}
      />
      <p className="auth-single-footnote"><Link href={ROUTES.auth.login}>Quay lại đăng nhập</Link></p>
    </AuthSplitLayout>
  );
}

export function ResetPasswordScreen() {
  const [email, setEmail] = useState("");
  const [otpCode, setOtp] = useState("");
  const [otpSignal, setOtpSignal] = useState(0);
  const [newPassword, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (otpCode.length !== 6) {
      setError("Nhập đủ mã OTP gồm 6 chữ số.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setBusy(true);
    try {
      const { api } = await import("@/lib/api/client");
      await api.put("/api/v1/auth/password/reset", { email, otpCode, newPassword, confirmPassword });
      clearStoredCooldown(email);
      setDone(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đặt lại mật khẩu.");
      setOtp("");
      setOtpSignal((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitLayout closeHref={ROUTES.auth.login}>
      <div className="auth-split-heading">
        <h1>Đặt lại mật khẩu</h1>
        <p>Nhập email, mã OTP xác thực và thiết lập mật khẩu mới.</p>
      </div>

      {done ? (
        <div className="auth-fields">
          <p className="form-success" role="status">Mật khẩu đã được đổi thành công. Vui lòng đăng nhập lại.</p>
          <Link className="auth-submit-btn" href={ROUTES.auth.login} style={{ textDecoration: "none" }}>
            Đăng nhập ngay
          </Link>
        </div>
      ) : (
        <form className="auth-fields" onSubmit={submit}>
          <EmailInput
            id="reset-email"
            label="Email tài khoản"
            placeholder="name@example.com"
            required
            value={email}
            onChange={setEmail}
          />

          <div className="field-wrap">
            <label htmlFor="reset-otp">Mã OTP (6 chữ số)</label>
            <OtpCodeInput
              id="reset-otp"
              value={otpCode}
              onChange={(code) => { setOtp(code); if (error) setError(""); }}
              status={done ? "success" : busy ? "busy" : error ? "error" : "idle"}
              errorSignal={otpSignal}
            />
          </div>

          <PasswordInput
            id="reset-password"
            label="Mật khẩu mới"
            autoComplete="new-password"
            minLength={8}
            placeholder="••••••••"
            required
            value={newPassword}
            onChange={(e) => setPassword(e.target.value)}
          />

          <PasswordInput
            id="reset-confirm"
            label="Nhập lại mật khẩu mới"
            autoComplete="new-password"
            minLength={8}
            placeholder="••••••••"
            required
            value={confirmPassword}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="auth-submit-btn" disabled={busy}>
            {busy ? "Đang cập nhật…" : "Đặt lại mật khẩu"}
          </button>
        </form>
      )}

      <p className="auth-single-footnote">
        <Link href={ROUTES.auth.forgotPassword}>Gửi lại mã OTP</Link>
        <span style={{ margin: "0 8px", color: "var(--line)" }}>•</span>
        <Link href={ROUTES.auth.login}>Đăng nhập</Link>
      </p>
    </AuthSplitLayout>
  );
}

export function ChangePasswordScreen() {
  const router = useRouter();
  const { clearSession } = useSession();
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setErrorCode(null);
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (newPassword === oldPassword) {
      setError("Mật khẩu mới phải khác mật khẩu hiện tại.");
      return;
    }
    setBusy(true);
    try {
      const { api } = await import("@/lib/api/client");
      await api.patch("/api/v1/auth/password", { oldPassword, newPassword, confirmPassword });
      clearSession();
      router.replace(`${ROUTES.auth.login}?passwordChanged=1`);
    } catch (reason) {
      if (reason instanceof ApiError) {
        const messages: Record<string, string> = {
          INVALID_CREDENTIALS: "Mật khẩu hiện tại không đúng.",
          PASSWORD_NOT_SET: "Tài khoản này đăng nhập bằng Google và chưa có mật khẩu. Vui lòng thiết lập mật khẩu qua Email OTP.",
          VAL_INVALID_PASSWORD: "Mật khẩu mới cần ít nhất 8 ký tự.",
          VAL_PASSWORD_MISMATCH: "Mật khẩu xác nhận không khớp.",
          VAL_SAME_PASSWORD: "Mật khẩu mới phải khác mật khẩu hiện tại.",
          UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
          USER_BANNED: "Tài khoản đang bị khóa. Không thể đổi mật khẩu.",
          USER_NOT_FOUND: "Tài khoản không tồn tại hoặc đã bị xóa.",
        };
        setErrorCode(reason.errorCode ?? null);
        setError(messages[reason.errorCode ?? ""] ?? reason.message);
      } else {
        setError(reason instanceof Error ? reason.message : "Không thể đổi mật khẩu.");
      }
    } finally {
      setBusy(false);
    }
  }

  return <Card className="auth-card">
    <h1>Đổi mật khẩu</h1>
    <p>Dùng mật khẩu mới để bảo vệ tài khoản.</p>
    <form className="auth-fields" onSubmit={submit}>
      <PasswordInput
        id="change-old-password"
        label="Mật khẩu hiện tại"
        autoComplete="current-password"
        required
        value={oldPassword}
        onChange={(event) => setOld(event.target.value)}
      />
      <PasswordInput
        id="change-new-password"
        label="Mật khẩu mới"
        autoComplete="new-password"
        minLength={8}
        required
        value={newPassword}
        onChange={(event) => setNew(event.target.value)}
      />
      <PasswordInput
        id="change-confirm-password"
        label="Nhập lại mật khẩu mới"
        autoComplete="new-password"
        minLength={8}
        required
        value={confirmPassword}
        onChange={(event) => setConfirm(event.target.value)}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}{" "}
          {errorCode === "PASSWORD_NOT_SET" && (
            <Link href={ROUTES.auth.forgotPassword}>Thiết lập mật khẩu qua Email OTP</Link>
          )}
        </p>
      )}
      <button className="button button-primary" disabled={busy}>{busy ? "Đang cập nhật…" : "Đổi mật khẩu"}</button>
    </form>
  </Card>;
}

export function AccountProfileScreen() {
  const { user, setAuthenticatedUser } = useSession();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const storedAvatar = useStoredAvatar(user?.id);
  const profile = useApiResource("account-profile:" + revision, (signal) => profileService.getProfile(signal));

  useEffect(() => {
    if (!saved) return;
    const timeout = window.setTimeout(() => setSaved(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [saved]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const updated = await profileService.updateProfile({
        username: String(values.get("username") ?? "").trim() || undefined,
        firstName: String(values.get("firstName") ?? "").trim(),
        lastName: String(values.get("lastName") ?? "").trim(),
        phoneNumber: String(values.get("phoneNumber") ?? "").trim(),
        address: String(values.get("address") ?? "").trim(),
      });
      setAuthenticatedUser({ ...user, ...updated });
      setSaved("Đã cập nhật hồ sơ.");
      setRevision((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật hồ sơ.");
    } finally {
      setBusy(false);
    }
  }

  const p = profile.data ?? { firstName: "", lastName: "", email: "", username: null, phoneNumber: null, address: null, avatarUrl: null, reputationScore: null, trustLevel: "", isSeller: false };
  const avatarUrl = resolveImageUrl(p.avatarUrl ?? null) ?? resolveImageUrl(user?.avatarUrl ?? null) ?? storedAvatar;
  const displayName = [p?.firstName, p?.lastName].filter(Boolean).join(" ") || user?.displayName || user?.username || "Tài khoản Nexus";
  const email = p?.email ?? user?.email ?? "";
  const isSeller = Boolean(p?.isSeller || user?.roles?.some((role) => role.toLowerCase() === "seller") || user?.role?.toLowerCase() === "seller");
  const isStaffOrAdmin = Boolean(
    user?.roles?.some((role) => {
      const r = role.toLowerCase();
      return r === "admin" || r === "staff";
    }) ||
    user?.role?.toLowerCase() === "admin" ||
    user?.role?.toLowerCase() === "staff"
  );
  return <div className="profile-page">
    <div className="profile-layout">
      <aside className="profile-sidebar">
        <div className="profile-identity">
          <span className="profile-avatar" aria-hidden="true" style={{ overflow: "hidden" }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              String(displayName).charAt(0).toLocaleUpperCase("vi-VN")
            )}
          </span>
          <strong>{displayName}</strong>
          {email && <small>{email}</small>}
          <button
            type="button"
            className="button button-secondary button-small"
            style={{ marginTop: 10 }}
            onClick={() => setAvatarOpen((open) => !open)}
          >
            {avatarOpen ? "Đóng chỉnh ảnh" : "Đổi ảnh đại diện"}
          </button>
        </div>
        {avatarOpen && (
          <AvatarCropEditor
            initialLetter={String(displayName).charAt(0).toLocaleUpperCase("vi-VN")}
            currentAvatar={avatarUrl}
            onSave={async (blob, previewDataUrl) => {
              const file = new File([blob], "avatar.png", { type: blob.type || "image/png" });
              const result = await profileService.uploadAvatar(file);
              const resolved = resolveImageUrl(result.avatarUrl) ?? result.avatarUrl ?? previewDataUrl;
              if (user) setAuthenticatedUser({ ...user, avatarUrl: resolved });
              saveStoredAvatar(user?.id, resolved);
              setSaved("Đã cập nhật ảnh đại diện.");
              setRevision((value) => value + 1);
            }}
            onCancel={() => setAvatarOpen(false)}
          />
        )}
        <nav className="profile-nav" aria-label="Điều hướng tài khoản">
          <a href="#profile-information" aria-current="page">Hồ sơ cá nhân</a>
          <Link href={ROUTES.auth.changePassword}>Đổi mật khẩu &amp; bảo mật</Link>
          {isSeller ? (
            <Link className="profile-nav-seller" href={ROUTES.seller.products}>Kênh người bán</Link>
          ) : !isStaffOrAdmin ? (
            <Link href={ROUTES.buyer.becomeSeller}>Đăng ký bán hàng (Become Seller)</Link>
          ) : null}
        </nav>
      </aside>
      <div className="profile-content">
        <section id="profile-information" className="profile-panel"><div className="profile-panel-heading"><div><h1>Hồ sơ cá nhân</h1><p>Cập nhật thông tin cá nhân và phương thức liên hệ.</p></div></div>
          {profile.error&&<div className="profile-load-error"><p role="alert" className="notice">{profile.error.message}</p><button type="button" className="button button-secondary" onClick={() => profile.reload()}>Thử tải lại</button></div>}
          {profile.loading?<NoData title="Đang tải hồ sơ…"/>:profile.error?null:<form className="profile-form" key={revision} onSubmit={e=>void save(e)}>
            <div className="profile-form-grid"><label className="field-wrap">Họ<input className="field" name="firstName" required maxLength={100} autoComplete="family-name" defaultValue={p.firstName}/></label><label className="field-wrap">Tên<input className="field" name="lastName" required maxLength={100} autoComplete="given-name" defaultValue={p.lastName}/></label></div>
            <div className="profile-form-grid"><label className="field-wrap">Email<input className="field" type="email" value={email} readOnly aria-readonly="true" /></label><label className="field-wrap">Số điện thoại liên hệ<input className="field" name="phoneNumber" type="tel" maxLength={20} autoComplete="tel" defaultValue={p.phoneNumber??""}/></label></div>
            <label className="field-wrap">Tên đăng nhập<input className="field" name="username" minLength={3} maxLength={50} autoComplete="username" defaultValue={p.username??""}/></label>
            <label id="profile-address" className="field-wrap">Địa chỉ liên hệ<textarea className="textarea-field" name="address" maxLength={255} autoComplete="street-address" defaultValue={p.address??""}/></label>
            {error&&<p role="alert" className="notice">{error}</p>}
            <div className="profile-actions"><button type="reset" className="button button-secondary" disabled={busy}>Hủy thao tác</button><button type="submit" className="button button-primary" disabled={busy||profile.loading}>{busy?"Đang lưu…":"Lưu thay đổi"}</button></div>
          </form>}
        </section>
        {!isStaffOrAdmin && profile.data && (
          <div id="profile-reputation"><ReputationScore score={p.reputationScore} level={p.trustLevel} /></div>
        )}
        {!isSeller && !isStaffOrAdmin && (
          <section id="profile-selling" className="profile-panel">
            <div className="profile-panel-heading">
              <div>
                <h2>Đăng ký trở thành Seller</h2>
                <p>Mở gian hàng trên NEXUS, xác thực email doanh nghiệp và đồng bộ kho lấy hàng GHN.</p>
              </div>
              <Link className="button button-primary" href={ROUTES.buyer.becomeSeller}>Đăng ký bán hàng</Link>
            </div>
          </section>
        )}
      </div>
    </div>
    {saved && (
      <div className="app-notification" role="status" aria-live="polite" aria-atomic="true">
        <span className="app-notification-mark" aria-hidden="true">✓</span>
        <span className="app-notification-message">{saved}</span>
        <button type="button" className="app-notification-close" aria-label="Đóng thông báo" onClick={() => setSaved("")}>×</button>
      </div>
    )}
  </div>;
}
