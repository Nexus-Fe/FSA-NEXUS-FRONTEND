"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  api,
  clearSessionTokens,
  extractUserFromToken,
  getStoredAccessToken,
  hasRefreshToken,
  isAccountCheckRecent,
  saveSessionRoles,
  SESSION_INVALIDATED_EVENT,
  type ApiResponse,
} from "@/lib/api/client";
import type { AuthUser } from "@/features/auth/types";

type SessionContextValue = {
  user: AuthUser | null;
  ready: boolean;
  restoreError: string | null;
  setAuthenticatedUser: (user: AuthUser) => void;
  refreshUser: () => Promise<void>;
  clearSession: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function rolesFromProfile(profile: AuthUser): string[] {
  const roles = Array.isArray(profile.roles)
    ? profile.roles.map((role) => String(role).trim()).filter(Boolean)
    : [];

  if (typeof profile.role === "string" && profile.role.trim()) {
    roles.push(profile.role.trim());
  }

  return [...new Set(roles)];
}

function userFromStoredJwt(): AuthUser | null {
  const claims = extractUserFromToken(getStoredAccessToken());
  if (!claims) return null;
  return {
    id: claims.id,
    email: claims.email,
    displayName: claims.displayName ?? undefined,
    username: claims.username ?? undefined,
    roles: claims.roles,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const sessionVersion = useRef(0);
  const userRef = useRef<AuthUser | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const setAuthenticatedUser = useCallback((authenticatedUser: AuthUser) => {
    sessionVersion.current += 1;

    const roles = rolesFromProfile(authenticatedUser);
    saveSessionRoles(roles);
    const nextUser = { ...authenticatedUser, roles };
    userRef.current = nextUser;
    setUser(nextUser);
    setRestoreError(null);
    setReady(true);
  }, []);

  const clearSession = useCallback(() => {
    sessionVersion.current += 1;
    clearSessionTokens();
    userRef.current = null;
    setUser(null);
    setRestoreError(null);
    setReady(true);
  }, []);

  const refreshUser = useCallback(async () => {
    const version = sessionVersion.current;
    const jwtUser = userFromStoredJwt();

    if (!hasRefreshToken()) {
      if (jwtUser) {
        userRef.current = userRef.current ?? jwtUser;
        setUser((current) => current ?? jwtUser);
        setRestoreError(null);
        setReady(true);
        return;
      }
      userRef.current = null;
      setUser(null);
      setRestoreError(null);
      setReady(true);
      return;
    }

    if (jwtUser && !userRef.current) {
      userRef.current = jwtUser;
      setUser(jwtUser);
      setRestoreError(null);
      setReady(true);
    }

    try {
      const response = await api.get<ApiResponse<AuthUser & { userId?: string }> | (AuthUser & { userId?: string })>(
        "/api/v1/me",
      );

      if (version !== sessionVersion.current || (!hasRefreshToken() && !getStoredAccessToken())) return;

      const profile = "data" in response ? response.data : response;
      const profileId = profile?.id || profile?.userId;
      if (!profileId || !profile?.email) {
        throw new Error("Phản hồi hồ sơ không hợp lệ.");
      }

      if (["BANNED", "DELETED"].includes(profile.status?.toUpperCase() ?? "")) {
        clearSession();
        return;
      }

      const roles = rolesFromProfile(profile);
      saveSessionRoles(roles);
      const nextUser = { ...profile, id: profileId, roles };
      userRef.current = nextUser;
      setUser(nextUser);
      setRestoreError(null);
    } catch (error) {
      if (version !== sessionVersion.current) return;

      if (
        error instanceof ApiError &&
        ["ACCOUNT_BANNED", "USER_BANNED"].includes(error.errorCode ?? "")
      ) {
        clearSession();
        return;
      }

      if (
        error instanceof ApiError &&
        [401, 403].includes(error.status) &&
        !hasRefreshToken()
      ) {
        clearSession();
        return;
      }

      const fallbackUser = userFromStoredJwt();
      if (fallbackUser || (userRef.current && getStoredAccessToken())) {
        const preserved = userRef.current ?? fallbackUser;
        userRef.current = preserved;
        setUser(preserved);
        setRestoreError(null);
        return;
      }

      userRef.current = null;
      setUser(null);
      setRestoreError(
        "Không tải được phiên từ Gateway. Phiên đăng nhập vẫn được giữ; vui lòng thử lại.",
      );
    } finally {
      setReady(true);
    }
  }, [clearSession]);

  useEffect(() => {
    saveSessionRoles([]);

    const timer = window.setTimeout(() => {
      void refreshUser();
    }, 0);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && hasRefreshToken() && !isAccountCheckRecent()) {
        void refreshUser();
      }
    };

    const handleInvalidation = () => clearSession();

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener(SESSION_INVALIDATED_EVENT, handleInvalidation);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener(SESSION_INVALIDATED_EVENT, handleInvalidation);
    };
  }, [clearSession, refreshUser]);

  const value = useMemo(
    () => ({
      user,
      ready,
      restoreError,
      setAuthenticatedUser,
      refreshUser,
      clearSession,
    }),
    [user, ready, restoreError, setAuthenticatedUser, refreshUser, clearSession],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession phải được gọi bên trong SessionProvider.");
  }
  return value;
}