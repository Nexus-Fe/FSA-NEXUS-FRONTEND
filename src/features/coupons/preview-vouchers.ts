"use client";

import { useSyncExternalStore } from "react";

export const previewVouchers = [
  { id: "ship15", code: "NEXUSSHIP15", amount: "15%", title: "Giảm phí vận chuyển", detail: "Mã ưu đãi vận chuyển mẫu", tone: "sky", kind: "shipping", percent: 15 },
  { id: "sale10", code: "NEXUSSALE10", amount: "10%", title: "Ưu đãi toàn sàn", detail: "Mã giảm giá sản phẩm mẫu", tone: "peach", kind: "items", percent: 10 },
  { id: "ship20", code: "NEXUSSHIP20", amount: "20%", title: "Thêm ưu đãi vận chuyển", detail: "Mã ưu đãi vận chuyển mẫu", tone: "mint", kind: "shipping", percent: 20 },
] as const;

const storageKey = "nexus-preview-vouchers";
const updateEvent = "nexus-vouchers-updated";

export type PreviewDraftVoucher = {
  code: string;
  scope: "admin" | "seller";
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount: number;
  minOrderAmount: number;
  expiresAt: string;
};

export function findPreviewDraft(code: string): PreviewDraftVoucher | null {
  if (typeof window === "undefined") return null;
  const normalized = code.trim().toUpperCase();
  for (const scope of ["admin", "seller"] as const) {
    try {
      const stored: unknown = JSON.parse(window.sessionStorage.getItem(`nexus:coupon-drafts:${scope}`) ?? "[]");
      if (!Array.isArray(stored)) continue;
      const item = stored.find((entry) => typeof entry === "object" && entry !== null && entry.code === normalized && entry.isActive === true);
      if (!item || typeof item.discountValue !== "number" || typeof item.minOrderAmount !== "number") continue;
      if (typeof item.expiresAt === "string" && item.expiresAt < new Date().toISOString().slice(0, 10)) continue;
      return { code: normalized, scope, discountType: item.discountType, discountValue: item.discountValue, maxDiscountAmount: Number(item.maxDiscountAmount) || 0, minOrderAmount: item.minOrderAmount, expiresAt: item.expiresAt };
    } catch { /* Invalid local drafts are ignored. */ }
  }
  return null;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(updateEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(updateEvent, onChange);
  };
}

function snapshot() {
  try { return window.localStorage.getItem(storageKey) ?? "[]"; }
  catch { return "[]"; }
}

export function useSavedPreviewVouchers(): string[] {
  const value = useSyncExternalStore(subscribe, snapshot, () => "[]");
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((code): code is string => typeof code === "string");
  } catch { /* An invalid local preview is equivalent to an empty selection. */ }
  return [];
}

export function savePreviewVoucher(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (!previewVouchers.some((voucher) => voucher.code === normalized) && !findPreviewDraft(normalized)) return false;
  try {
    const current = JSON.parse(snapshot());
    const codes = Array.isArray(current) ? current.filter((item): item is string => typeof item === "string") : [];
    window.localStorage.setItem(storageKey, JSON.stringify([...new Set([...codes, normalized])]));
    window.dispatchEvent(new Event(updateEvent));
    return true;
  } catch { return false; }
}
