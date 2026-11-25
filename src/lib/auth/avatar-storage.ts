"use client";

import { useCallback, useSyncExternalStore } from "react";
import { resolveImageUrl } from "@/lib/presentation";

export const avatarChangedEvent = "nexus:avatar-changed";

export function readStoredAvatar(userId: string | undefined): string | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    return window.localStorage.getItem(`nexus_avatar_${userId}`);
  } catch {
    return null;
  }
}

export function saveStoredAvatar(userId: string | undefined, dataUrl: string) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(`nexus_avatar_${userId}`, dataUrl);
    window.dispatchEvent(new CustomEvent(avatarChangedEvent, { detail: { userId, dataUrl } }));
  } catch {
    // Ignore storage quota errors.
  }
}

export function useStoredAvatar(userId: string | undefined): string | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const onChanged = (event: Event) => {
        const detail = (event as CustomEvent<{ userId?: string }>).detail;
        if (!userId || detail?.userId === userId) onStoreChange();
      };
      const onStorage = (event: StorageEvent) => {
        if (userId && event.key === `nexus_avatar_${userId}`) onStoreChange();
      };
      window.addEventListener(avatarChangedEvent, onChanged);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(avatarChangedEvent, onChanged);
        window.removeEventListener("storage", onStorage);
      };
    },
    [userId],
  );

  return useSyncExternalStore(
    subscribe,
    () => readStoredAvatar(userId),
    () => null,
  );
}

export function useResolvedAvatar(user?: { id?: string; avatarUrl?: string | null } | null): string | null {
  const storedAvatar = useStoredAvatar(user?.id);
  return resolveImageUrl(user?.avatarUrl ?? null) ?? storedAvatar;
}
