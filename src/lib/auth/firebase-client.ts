"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  inMemoryPersistence,
  signInWithPopup,
  signOut,
  type Auth,
} from "firebase/auth";
import { parseFirebasePublicConfig, type FirebasePublicConfig } from "./firebase-config";

export type FirebaseClientErrorCode =
  | "POPUP_CLOSED"
  | "POPUP_BLOCKED"
  | "UNSUPPORTED_ENVIRONMENT"
  | "NETWORK_ERROR"
  | "TOO_MANY_REQUESTS"
  | "USER_DISABLED"
  | "NOT_CONFIGURED"
  | "FIREBASE_AUTH_FAILED";

export class FirebaseClientError extends Error {
  constructor(
    message: string,
    readonly code: FirebaseClientErrorCode,
  ) {
    super(message);
    this.name = "FirebaseClientError";
  }
}

let cachedConfig: FirebasePublicConfig | null = null;
let configInFlight: Promise<FirebasePublicConfig> | null = null;
let cachedAuth: Auth | null = null;

async function loadFirebaseConfig(): Promise<FirebasePublicConfig> {
  if (cachedConfig) return cachedConfig;
  if (configInFlight) return configInFlight;

  configInFlight = (async () => {
    const response = await fetch("/api/auth/firebase-config", { cache: "no-store" });
    let payload: Record<string, unknown> | null = null;
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const title =
        payload && typeof payload.title === "string" && payload.title.trim()
          ? payload.title
          : "Đăng nhập Google hiện chưa sẵn sàng. Vui lòng đăng nhập bằng tài khoản.";
      throw new FirebaseClientError(title, "NOT_CONFIGURED");
    }

    const config = parseFirebasePublicConfig(payload);
    if (!config) {
      throw new FirebaseClientError(
        "Cấu hình Firebase chưa đầy đủ. Vui lòng liên hệ quản trị viên.",
        "NOT_CONFIGURED",
      );
    }

    cachedConfig = config;
    return cachedConfig;
  })().finally(() => {
    configInFlight = null;
  });

  return configInFlight;
}

function getStatelessFirebaseAuth(config: FirebasePublicConfig): Auth {
  if (cachedAuth) return cachedAuth;

  const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(config);
  try {
    cachedAuth = initializeAuth(app, {
      persistence: inMemoryPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Fallback for HMR or when Auth was already initialized on the app instance.
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}

function mapFirebaseAuthError(error: unknown): FirebaseClientError {
  if (error instanceof FirebaseClientError) return error;

  const rawCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (rawCode) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return new FirebaseClientError("Đã hủy cửa sổ đăng nhập Google.", "POPUP_CLOSED");
    case "auth/popup-blocked":
      return new FirebaseClientError(
        "Trình duyệt đang chặn cửa sổ bật lên (popup). Vui lòng cho phép popup và thử lại.",
        "POPUP_BLOCKED",
      );
    case "auth/operation-not-supported-in-this-environment":
      return new FirebaseClientError(
        "Trình duyệt hiện tại không hỗ trợ cửa sổ đăng nhập Google. Vui lòng mở bằng trình duyệt chuẩn.",
        "UNSUPPORTED_ENVIRONMENT",
      );
    case "auth/network-request-failed":
      return new FirebaseClientError(
        "Không thể kết nối tới Google để xác thực. Vui lòng kiểm tra mạng và thử lại.",
        "NETWORK_ERROR",
      );
    case "auth/too-many-requests":
      return new FirebaseClientError(
        "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.",
        "TOO_MANY_REQUESTS",
      );
    case "auth/user-disabled":
      return new FirebaseClientError(
        "Tài khoản Google này đã bị vô hiệu hóa.",
        "USER_DISABLED",
      );
    default:
      return new FirebaseClientError(
        "Không thể xác thực qua Google. Vui lòng thử lại hoặc đăng nhập bằng tài khoản.",
        "FIREBASE_AUTH_FAILED",
      );
  }
}

/**
 * Opens Google Sign-In via Firebase Auth using in-memory persistence,
 * returns a fresh Firebase ID token, and immediately signs out of Firebase
 * so Nexus relies solely on UserService JWTs.
 */
export async function signInWithGooglePopup(): Promise<string> {
  const config = await loadFirebaseConfig();
  const auth = getStatelessFirebaseAuth(config);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const credential = await signInWithPopup(auth, provider);
    const idToken = await credential.user.getIdToken(true);
    if (!idToken) {
      throw new FirebaseClientError(
        "Không nhận được mã xác thực từ Google. Vui lòng thử lại.",
        "FIREBASE_AUTH_FAILED",
      );
    }
    return idToken;
  } catch (error) {
    throw mapFirebaseAuthError(error);
  } finally {
    await signOut(auth).catch(() => undefined);
  }
}
