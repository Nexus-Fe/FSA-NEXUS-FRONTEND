"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { ThumbnailBox } from "@/components/ui/BackendImage";
import { AdminPagination, Badge, Card, PageHeading, TruncatedText } from "@/components/ui/Primitives";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { EmailInput } from "@/components/ui/EmailInput";
import { ROUTES } from "@/constants/routes";
import { ApiError, api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney, resolveImageUrl } from "@/lib/presentation";
import { Icon } from "@/components/ui/Icon";
import "@/features/fulfillment/components/shipping-tracking.css";
import { walletService } from "@/features/wallet";
import { CheckoutVoucherPanel } from "@/features/coupons/CheckoutVoucherPanel";
import { estimateCheckoutDiscounts, type VoucherCalcInput } from "@/features/coupons/voucher-calculator";
import { describeRejectedVoucher } from "@/features/coupons/voucher-outcome";
import { Modal } from "@/components/ui/Modal";
import { cartService } from "@/features/commerce/services/cart.service";
import {
  areCartSelectionRecordsEqual,
  clearCartSelection,
  getBrowserCartStorage,
  getCartSelectionStorageKey,
  readCartSelection,
  reconcileCartSelection,
  toggleAllCartSelection,
  toggleCartItemSelection,
  toggleCartShopSelection,
  writeCartSelection,
  type CartSelectionRecord,
} from "@/features/commerce/cart-selection";
import { canContinueToCheckout, describeCartIssue, type CartValidation } from "@/features/commerce/cart-rules";
import { CompleteOrderButton, RepayButton } from "@/features/commerce/OrderActions";
import { ProductQuickPreviewModal, type OrderItemPreviewSnapshot } from "@/features/commerce/ProductQuickPreviewModal";
import { canCompleteOrder, canRepay, describeBuyerOrderStatus, isCodPaymentMethod } from "@/features/commerce/order-rules";
import { clearUnknownOrderMarker, describeCartFailure, describePlaceOrderFailure, describeQuoteFailure, readUnknownOrderMarker, writeUnknownOrderMarker } from "@/features/commerce/checkout-outcome";
import { GhnLocationSelect } from "@/features/shipping/GhnLocationSelect";
import { SavedAddressPicker } from "@/features/profile/SavedAddressPicker";
import { toGhnSelection } from "@/features/profile/address-rules";
import { EMPTY_GHN_SELECTION, buildShippingAddress, formatAddressLine, ghnWriteBlock, parseGhnSelection, validateGhnSelection, type GhnCheck, type GhnSelection } from "@/features/shipping/ghn-address";
import { EmptyState } from "@/components/ui/EmptyState";
import { notifyNotificationsChanged } from "@/features/notification";


type CartItem = { id: string; productId: string; skuId: string; sellerId: string; productName: string; quantity: number; unitPriceSnapshot: number };
type Cart = { id: string; buyerId: string; status: string; itemCount: number; subtotalAmount: number; items: CartItem[] };
type AppliedVoucherDetail = { code: string; scopeType: string; ownerSellerId?: string | null; discountAmount: number };
type SubOrderItem = { orderItemId?: string; itemId?: string; productId: string; skuId: string; productName: string; skuCode?: string | null; quantity: number; unitPrice: number; lineTotal: number; unitPriceAfterDiscount?: number | null };
type ShippingAddressSnapshot = { receiverName: string; receiverPhone: string; street: string; ward: string; district?: string | null; province: string; fullAddress?: string | null };
type SubOrderDetail = {
  subOrderId: string;
  subOrderNo: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  shopName: string;
  status: string;
  paymentMethod: string;
  shippingAddress: ShippingAddressSnapshot;
  contactPhone: string;
  itemsAmount: number;
  productDiscountAmount?: number;
  shopDiscountAmount?: number;
  systemDiscountAmount?: number;
  discountAmount?: number;
  shippingFeeAmount: number;
  totalAmount: number;
  createdAt: string;
  items: SubOrderItem[];
  appliedVouchers?: AppliedVoucherDetail[] | null;
};
type Order = {
  id?: string;
  orderId?: string;
  orderNo?: string;
  buyerId?: string;
  status: string;
  totalAmount: number;
  paymentDeadlineAt: string;
  createdAt?: string;
  subOrders?: SubOrderDetail[];
  appliedVouchers?: AppliedVoucherDetail[] | null;
};
type CheckoutQuoteResponse = {
  quoteId: string;
  grandTotal: number;
  walletBalance: number;
  shops: Array<{
    sellerId: string;
    shopName: string;
    itemsAmount: number;
    productDiscountAmount?: number;
    shopDiscountAmount?: number;
    systemDiscountAmount?: number;
    discountAmount: number;
    shippingFeeAmount: number;
    totalAmount: number;
  }>;
  expiredAt: string;
  /** Vouchers the back end really applied, with what each took off. A code asked for but not listed here was left out. */
  appliedVouchers?: string[] | null;
  appliedVoucherDetails?: AppliedVoucherDetail[] | null;
  rejectedVouchers?: Array<{ code: string; reasonCode: string }> | null;
};
type CreateOrderResponse = {
  orderId: string;
  orderNo: string;
  totalAmount: number;
  status: string;
  paymentDeadlineAt: string;
  subOrderIds: string[];
  createdAt: string;
};
type Paged<T> = { items: T[]; pagination: { pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasNextPage: boolean } };

export function describeOrderStatus(status: string, paymentMethod?: string | null): string {
  return describeBuyerOrderStatus(status, paymentMethod);
}

function canBuyerCancelOrder(orderStatus: string, subOrders: SubOrderDetail[]): boolean {
  const orderKey = orderStatus.replace(/[^a-z]/gi, "").toUpperCase();
  if (["CANCELLED", "REFUNDED", "COMPLETED", "DELIVERED", "SHIPPING", "SHIPPED"].includes(orderKey)) {
    return false;
  }
  if (subOrders.length === 0) {
    return ["PENDINGPAYMENT", "PAID", "PENDINGCONFIRMATION", "CONFIRMED"].includes(orderKey);
  }
  const hasBlockedSubOrder = subOrders.some((sub) => {
    const key = sub.status.replace(/[^a-z]/gi, "").toUpperCase();
    return ["SHIPPING", "SHIPPED", "DELIVERED", "COMPLETED"].includes(key);
  });
  const allCancelledOrRejected = subOrders.every((sub) => {
    const key = sub.status.replace(/[^a-z]/gi, "").toUpperCase();
    return ["CANCELLED", "SELLERREJECTED", "REFUNDED"].includes(key);
  });
  return !hasBlockedSubOrder && !allCancelledOrRejected;
}

function useCart() {
  return useApiResource("buyer-active-cart", (signal) => api.get<ApiResponse<Cart> | Cart>("/api/v1/carts/me", { signal }).then(unwrap));
}

const SHIPPING_STORAGE_KEY = "nexus:checkout-shipping";
const SHIPPING_EXTRA_KEY = "nexus:checkout-extra";
const SHIPPING_GHN_KEY = "nexus:checkout-ghn";
type ShippingForm = { receiverName: string; phone: string; address: string };
type ShippingExtra = { email: string; note: string };
type ShippingErrors = Partial<Record<keyof ShippingForm | "province" | "district" | "ward", string>>;
const emptyShipping: ShippingForm = { receiverName: "", phone: "", address: "" };

function loadShipping(): ShippingForm {
  if (typeof window === "undefined") return emptyShipping;
  try {
    const raw = window.sessionStorage.getItem(SHIPPING_STORAGE_KEY);
    if (!raw) return emptyShipping;
    const parsed = JSON.parse(raw) as Partial<ShippingForm>;
    return { receiverName: String(parsed.receiverName ?? ""), phone: String(parsed.phone ?? ""), address: String(parsed.address ?? "") };
  } catch {
    return emptyShipping;
  }
}

function loadShippingExtra(): ShippingExtra {
  const empty = { email: "", note: "" };
  if (typeof window === "undefined") return empty;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SHIPPING_EXTRA_KEY) ?? "null") as Partial<ShippingExtra> | null;
    return parsed ? { email: String(parsed.email ?? ""), note: String(parsed.note ?? "") } : empty;
  } catch { return empty; }
}

function loadGhn(): GhnSelection {
  if (typeof window === "undefined") return EMPTY_GHN_SELECTION;
  try { return parseGhnSelection(window.sessionStorage.getItem(SHIPPING_GHN_KEY)); } catch { return EMPTY_GHN_SELECTION; }
}

function validateShipping(form: ShippingForm, ghn: GhnSelection): ShippingErrors {
  const errors: ShippingErrors = {};
  if (form.receiverName.trim().length < 2) errors.receiverName = "Nhập họ tên người nhận.";
  if (!/^(0|\+84)\d{9}$/.test(form.phone.replace(/[\s.-]/g, ""))) errors.phone = "Nhập số điện thoại Việt Nam hợp lệ, ví dụ 0901234567.";
  if (form.address.trim().length < 5) errors.address = "Nhập địa chỉ nhận hàng cụ thể.";
  Object.assign(errors, validateGhnSelection(ghn));
  return errors;
}

const CART_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function CartScreen() {
  const router = useRouter();
  const cart = useCart();
  const items = cart.data?.items ?? [];
  const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
  const imageKey = productIds.length ? `cart-images:${productIds.join(",")}` : null;
  const productDetails = useApiResource(imageKey, async (signal) => {
    const results = await Promise.all(productIds.map(async (id) => {
      try {
        const detail = unwrap(await api.get<ApiResponse<CartProductDetail> | CartProductDetail>(`/api/v1/products/${encodeURIComponent(id)}`, { signal }));
        return [id, detail] as const;
      } catch {
        return [id, null] as const;
      }
    }));
    return Object.fromEntries(results) as Record<string, CartProductDetail | null>;
  });
  const skuIds = [...new Set(items.map((item) => item.skuId).filter(Boolean))].sort();
  const stockKey = skuIds.length ? `cart-stock:${skuIds.join(",")}` : null;
  const stock = useApiResource(stockKey, async (signal) => {
    const result = unwrap(await api.request<ApiResponse<InventoryBalance[]> | InventoryBalance[]>("/api/v1/inventories/by-skus", "POST", {
      body: JSON.stringify(skuIds), headers: { "Content-Type": "application/json" }, signal,
    }));
    if (!Array.isArray(result)) throw new Error("Không đọc được tồn kho sản phẩm.");
    return result.reduce<Record<string, number>>((totals, row) => {
      if (row && typeof row.skuId === "string" && typeof row.availableQuantity === "number") {
        totals[row.skuId] = (totals[row.skuId] ?? 0) + row.availableQuantity;
      }
      return totals;
    }, {});
  });
  const [selectionState, setSelectionState] = useState<{ key: string; record: CartSelectionRecord } | null>(null);
  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const shops = useApiResource(items.length ? "cart-shop-names" : null, (signal) => cartService.shops(signal));
  const [validation, setValidation] = useState<CartValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const itemIds = items.map((item) => item.id);
  const storageKey = cart.data ? getCartSelectionStorageKey(cart.data.buyerId, cart.data.id) : null;
  const storedSelection =
    storageKey === null
      ? null
      : selectionState?.key === storageKey
        ? selectionState.record
        : readCartSelection(getBrowserCartStorage(), storageKey);
  const reconciledSelection = storageKey !== null ? reconcileCartSelection(storedSelection, itemIds) : null;
  const activeSelectedIds = new Set(reconciledSelection?.selectedIds ?? []);

  useEffect(() => {
    if (!storageKey || !reconciledSelection) return;
    const diskRecord = readCartSelection(getBrowserCartStorage(), storageKey);
    if (!areCartSelectionRecordsEqual(diskRecord, reconciledSelection)) {
      writeCartSelection(getBrowserCartStorage(), storageKey, reconciledSelection);
    }
  }, [storageKey, reconciledSelection]);

  const selectedItems = items.filter((item) => activeSelectedIds.has(item.id));
  const allSelected = items.length > 0 && selectedItems.length === items.length;
  const someSelected = selectedItems.length > 0 && !allSelected;
  const selectedTotal = selectedItems.reduce((sum, item) => sum + item.unitPriceSnapshot * item.quantity, 0);
  const sellerGroups = items.reduce<Record<string, CartItem[]>>((groups, item) => {
    const key = item.sellerId || "Gian hàng";
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
  const hasQuantityError = selectedItems.some((item) => {
    const draft = draftQuantities[item.id];
    const desired = draft !== undefined ? Number(draft) : item.quantity;
    const available = stock.data?.[item.skuId];
    return Boolean(quantityErrors[item.id]) || !Number.isInteger(desired) || desired < 1 || (stock.data !== null && (available === undefined || desired > available));
  });

  function commitSelection(nextRecord: CartSelectionRecord) {
    if (storageKey) {
      writeCartSelection(getBrowserCartStorage(), storageKey, nextRecord);
      setSelectionState({ key: storageKey, record: nextRecord });
    }
  }

  function toggleAll() {
    commitSelection(toggleAllCartSelection(reconciledSelection?.selectedIds ?? [], itemIds));
  }
  function toggleShop(shopItemIds: string[]) {
    commitSelection(toggleCartShopSelection(reconciledSelection?.selectedIds ?? [], itemIds, shopItemIds));
  }
  function toggleItem(itemId: string) {
    commitSelection(toggleCartItemSelection(reconciledSelection?.selectedIds ?? [], itemIds, itemId));
  }
  function validateQuantity(item: CartItem, raw: string): number | null {
    const trimmed = raw.trim();
    const parsed = Number(trimmed);
    const available = stock.data?.[item.skuId];
    if (!trimmed || !Number.isInteger(parsed)) {
      setQuantityErrors((current) => ({ ...current, [item.id]: "Nhập số lượng nguyên hợp lệ." }));
      return null;
    }
    if (parsed < 1) {
      setQuantityErrors((current) => ({ ...current, [item.id]: "Số lượng phải từ 1 trở lên." }));
      return null;
    }
    if (available === undefined) {
      setQuantityErrors((current) => ({ ...current, [item.id]: "Chưa kiểm tra được tồn kho của biến thể này." }));
      return null;
    }
    if (parsed > available) {
      setQuantityErrors((current) => ({ ...current, [item.id]: `Kho chỉ còn ${available} sản phẩm.` }));
      return null;
    }
    setQuantityErrors((current) => ({ ...current, [item.id]: "" }));
    return parsed;
  }
  async function updateQuantity(item: CartItem, nextQuantity: number) {
    const valid = validateQuantity(item, String(nextQuantity));
    if (valid === null || valid === item.quantity) return;
    setActionError("");
    setBusyId(item.id);
    try {
      await api.patch(`/api/v1/carts/me/items/${encodeURIComponent(item.id)}`, { quantity: valid });
      setDraftQuantities((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      cart.reload();
    } catch (reason) {
      setActionError(describeCartFailure(reason));
    } finally {
      setBusyId(null);
    }
  }
  async function removeItem(item: CartItem) {
    setActionError("");
    setBusyId(item.id);
    try {
      await api.delete(`/api/v1/carts/me/items/${encodeURIComponent(item.id)}`);
      const remainingIds = itemIds.filter((id) => id !== item.id);
      const currentSelected = reconciledSelection?.selectedIds ?? [];
      commitSelection({
        selectedIds: currentSelected.filter((id) => id !== item.id),
        knownIds: remainingIds,
      });
      cart.reload();
    } catch (reason) {
      setActionError(describeCartFailure(reason));
    } finally {
      setBusyId(null);
    }
  }
  function setDraft(item: CartItem, value: string) {
    setDraftQuantities((current) => ({ ...current, [item.id]: value }));
    validateQuantity(item, value);
  }
  function commitDraft(item: CartItem) {
    const raw = draftQuantities[item.id];
    if (raw === undefined) return;
    const valid = validateQuantity(item, raw);
    if (valid === item.quantity) {
      setDraftQuantities((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      return;
    }
    if (valid !== null) void updateQuantity(item, valid);
  }
  async function continueToCheckout() {
    if (!selectedItems.length || hasQuantityError || stock.loading || stock.error || validating) return;
    setValidating(true);
    setActionError("");
    setValidation(null);
    try {
      // The back end checks price and stock of the selected lines before the buyer leaves the cart.
      const result = await cartService.validate(selectedItems.map((item) => item.id));
      if (!canContinueToCheckout(result)) {
        setValidation(result);
        cart.reload();
        return;
      }
      const query = selectedItems.length === items.length ? "" : `?items=${encodeURIComponent(selectedItems.map((item) => item.id).join(","))}`;
      router.push(`${ROUTES.buyer.checkout}${query}`);
    } catch (reason) {
      setActionError(describeCartFailure(reason));
    } finally {
      setValidating(false);
    }
  }
  async function removeSelected() {
    if (!selectedItems.length || bulkBusy) return;
    setBulkBusy(true);
    setActionError("");
    try {
      const removedIds = selectedItems.map((item) => item.id);
      const removedSet = new Set(removedIds);
      await cartService.bulkRemove(removedIds);
      const remainingIds = itemIds.filter((id) => !removedSet.has(id));
      commitSelection({ selectedIds: [], knownIds: remainingIds });
      setValidation(null);
      cart.reload();
    } catch (reason) {
      setActionError(describeCartFailure(reason));
    } finally {
      setBulkBusy(false);
    }
  }
  async function clearCart() {
    if (bulkBusy) return;
    setBulkBusy(true);
    setActionError("");
    try {
      await cartService.clear();
      if (storageKey) {
        clearCartSelection(getBrowserCartStorage(), storageKey);
      }
      setSelectionState(null);
      setValidation(null);
      setClearOpen(false);
      cart.reload();
    } catch (reason) {
      setActionError(describeCartFailure(reason));
    } finally {
      setBulkBusy(false);
    }
  }
  async function changeVariant(item: CartItem, newSkuId: string) {
    if (!newSkuId || newSkuId === item.skuId) return;
    setBusyId(item.id);
    setActionError("");
    try {
      await cartService.changeVariant(item.id, newSkuId);
      cart.reload();
    } catch (reason) {
      setActionError(describeCartFailure(reason));
    } finally {
      setBusyId(null);
    }
  }

  return <div className="buyer-cart-shell">
    <nav className="checkout-breadcrumb" aria-label="Đường dẫn"><Link href={ROUTES.home}>Trang chủ</Link><span aria-hidden="true">›</span><span aria-current="page">Giỏ hàng</span></nav>
    <div className="cart-page-heading"><div><h1>Giỏ hàng</h1><p>{items.length ? `${items.length} sản phẩm trong giỏ` : "Chọn sản phẩm cần mua trước khi đặt hàng."}</p></div><Link className="cart-continue-link" href={ROUTES.catalog.index}>Tiếp tục mua sắm</Link></div>
    {actionError && <p className="notice" role="alert">{actionError}</p>}
    {cart.error && <ErrorState cause={cart.error} onRetry={cart.reload} />}
    {stock.error && <ErrorState cause={stock.error} onRetry={stock.reload} />}
    <div className="buyer-cart-layout">
      <div className="buyer-cart-items">
        {items.length ? <>
          {validation && !validation.isValid && <div className="notice" role="alert" style={{ marginBottom: 14 }}><strong>Giỏ hàng cần chỉnh trước khi đặt hàng:</strong><ul>{validation.issues.map((issue) => <li key={`${issue.cartItemId}-${issue.issueType}`}>{describeCartIssue(issue, items.find((item) => item.id === issue.cartItemId)?.productName ?? "Sản phẩm")}</li>)}</ul></div>}
          <div className="cart-select-all">
            <label className="cart-select-all-toggle">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleAll}
              />
              <span>Chọn tất cả ({selectedItems.length}/{items.length})</span>
            </label>
            <div className="cart-bulk-actions">
              <button type="button" className="button button-secondary button-small" disabled={!selectedItems.length || bulkBusy} onClick={() => void removeSelected()}>{bulkBusy ? "Đang xóa…" : `Xóa mục đã chọn (${selectedItems.length})`}</button>
              <button type="button" className="button button-secondary button-small" disabled={bulkBusy} onClick={() => setClearOpen(true)}>Xóa cả giỏ hàng</button>
            </div>
          </div>
          {Object.entries(sellerGroups).map(([sellerId, group], groupIndex) => {
            const shopTitle = shops.data?.[sellerId] ?? `Gian hàng #${sellerId.slice(0, 8)}`;
            const shopItemIds = group.map((item) => item.id);
            const shopSelectedCount = shopItemIds.filter((id) => activeSelectedIds.has(id)).length;
            const shopAllSelected = shopItemIds.length > 0 && shopSelectedCount === shopItemIds.length;
            const shopPartial = shopSelectedCount > 0 && !shopAllSelected;
            return <section className="cart-seller-group" key={sellerId} aria-label={`Gian hàng ${groupIndex + 1}`}>
            <div className="cart-shop-header">
              <label className="cart-shop-select">
                <input
                  type="checkbox"
                  className="cart-shop-check"
                  checked={shopAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = shopPartial;
                  }}
                  onChange={() => toggleShop(shopItemIds)}
                  aria-label={`Chọn tất cả sản phẩm của ${shopTitle}`}
                />
                <Icon name="store" size={16} />
                <span className="cart-shop-name">{shopTitle}</span>
                <span className="cart-shop-count tabular-nums">({shopSelectedCount}/{group.length})</span>
              </label>
              {CART_UUID_REGEX.test(sellerId) && (
                <Link className="cart-shop-link" href={ROUTES.catalog.shop(sellerId)}>
                  Xem shop
                </Link>
              )}
            </div>
            {group.map((item) => {
              const draft = draftQuantities[item.id] ?? String(item.quantity);
              const available = stock.data?.[item.skuId];
              const desiredQuantity = Number(draft);
              const quantityError = quantityErrors[item.id] || (stock.data && !Number.isInteger(desiredQuantity) ? "Nhập số lượng nguyên hợp lệ." : stock.data && desiredQuantity < 1 ? "Số lượng phải từ 1 trở lên." : available !== undefined && desiredQuantity > available ? `Kho chỉ còn ${available} sản phẩm.` : stock.data && available === undefined ? "Sản phẩm hiện không có tồn kho." : "");
              const detail = productDetails.data?.[item.productId];
              const variant = detail?.variants?.find((entry) => entry.variantId === item.skuId);
              const image = variant?.primaryImageUrl ?? variant?.images?.find((entry) => entry.isActive !== false)?.url ?? detail?.images?.find((entry) => entry.isActive !== false)?.url ?? null;
              return <article className="cart-product" key={item.id}>
                <input className="cart-product-check" type="checkbox" checked={activeSelectedIds.has(item.id)} onChange={() => toggleItem(item.id)} aria-label={`Chọn ${item.productName}`} />
                <Link className="cart-product-image" href={ROUTES.catalog.product(item.productId)} aria-label={`Xem ${item.productName}`}><ThumbnailBox src={resolveImageUrl(image)} alt="" size={52} /></Link>
                <div className="cart-product-info">
                  <Link className="cart-product-title" href={ROUTES.catalog.product(item.productId)}><TruncatedText text={item.productName} label="Tên sản phẩm" block /></Link>
                  {(detail?.variants?.length ?? 0) > 1
                    ? <label className="field-wrap">Phiên bản<select className="field" value={item.skuId} disabled={busyId !== null} onChange={(event) => void changeVariant(item, event.target.value)}>{detail?.variants?.map((entry) => <option key={entry.variantId} value={entry.variantId}>{entry.name ?? entry.skuCode ?? entry.variantId}</option>)}</select></label>
                    : variant?.name && <p>Phiên bản: {variant.name}</p>}
                  <p>Mã SKU: {variant?.skuCode ?? item.skuId}</p>
                  <div className="cart-product-actions"><span className="cart-quantity-label">Số lượng</span><div className="cart-quantity-control" role="group" aria-label={`Số lượng ${item.productName}`}>
                    <button type="button" disabled={busyId !== null || stock.loading} aria-label={item.quantity === 1 ? `Xóa ${item.productName} khỏi giỏ hàng` : `Giảm số lượng ${item.productName}`} onClick={() => void (item.quantity === 1 ? removeItem(item) : updateQuantity(item, item.quantity - 1))}>
                      {item.quantity === 1 ? <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg> : <span aria-hidden="true">−</span>}
                    </button>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={draft} disabled={busyId !== null} aria-label={`Nhập số lượng ${item.productName}`} aria-invalid={Boolean(quantityError)} aria-describedby={quantityError ? `cart-quantity-error-${item.id}` : undefined} onChange={(event) => setDraft(item, event.target.value)} onBlur={() => commitDraft(item)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
                    <button type="button" disabled={busyId !== null || stock.loading} aria-label={`Tăng số lượng ${item.productName}`} onClick={() => {
                      const next = item.quantity + 1;
                      if (stock.data && next > (stock.data[item.skuId] ?? 0)) setDraft(item, String(next));
                      else void updateQuantity(item, next);
                    }}><span aria-hidden="true">+</span></button>
                  </div></div>
                  {quantityError && <p className="cart-quantity-error" id={`cart-quantity-error-${item.id}`} role="alert">{quantityError}</p>}
                </div>
                <div className="cart-product-price"><strong>{formatMoney(item.unitPriceSnapshot * item.quantity)}</strong><span>{formatMoney(item.unitPriceSnapshot)} / sản phẩm</span></div>
              </article>;
            })}
          </section>;
          })}
        </> : <div className="cart-empty">{cart.loading ? <LoadingState rows={4} label="Đang tải giỏ hàng…" /> : cart.error ? null : <EmptyState title="Giỏ hàng đang trống" description="Thêm sản phẩm để bắt đầu đặt hàng." actionLabel="Khám phá sản phẩm" actionHref={ROUTES.catalog.index} />}</div>}
      </div>
      <aside className="buyer-cart-summary"><h2>Tóm tắt đơn hàng</h2><div className="cart-summary-line"><span>Sản phẩm đã chọn ({selectedItems.length})</span><strong>{formatMoney(selectedTotal)}</strong></div><div className="cart-summary-line"><span>Phí vận chuyển</span><strong>{selectedItems.length ? "Tính khi báo giá" : "—"}</strong></div><div className="cart-summary-total"><span>Tạm tính tiền hàng</span><strong>{formatMoney(selectedTotal)}</strong></div><button className="button button-primary" type="button" disabled={!selectedItems.length || hasQuantityError || stock.loading || Boolean(stock.error) || busyId !== null || validating} onClick={() => void continueToCheckout()}>{validating ? "Đang kiểm tra giỏ hàng…" : "Tiếp tục đặt hàng"}</button><p>{stock.error ? "Chưa kiểm tra được tồn kho. Vui lòng tải lại trang." : hasQuantityError ? "Điều chỉnh số lượng theo tồn kho trước khi tiếp tục." : selectedItems.length ? "Bước tiếp theo nhập địa chỉ nhận hàng và thanh toán bằng Ví Nexus." : "Chọn ít nhất một sản phẩm để tiếp tục."}</p></aside>
    </div>
    <Modal open={clearOpen} title="Xóa toàn bộ giỏ hàng?" busy={bulkBusy} onClose={() => setClearOpen(false)}
      footer={<><button type="button" className="button button-secondary" disabled={bulkBusy} onClick={() => setClearOpen(false)}>Giữ lại</button><button type="button" className="button button-primary" disabled={bulkBusy} onClick={() => void clearCart()}>{bulkBusy ? "Đang xóa…" : "Xóa cả giỏ hàng"}</button></>}>
      <p>Tất cả {items.length} sản phẩm sẽ bị xóa khỏi giỏ hàng. Thao tác này không hoàn tác được.</p>
    </Modal>
  </div>;
}

type CartProductDetail = { primaryImageUrl?: string | null; images?: Array<{ url: string; isActive?: boolean }>; variants?: Array<{ variantId: string; name?: string; skuCode?: string; primaryImageUrl?: string | null; images?: Array<{ url: string; isActive?: boolean }> }> };
type InventoryBalance = { skuId: string; availableQuantity: number };

export function CheckoutScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const cart = useCart();
  const wallet = useApiResource("checkout-buyer-wallet", (signal) => walletService.getBalance(signal));
  const searchParams = useSearchParams();
  const selectedParam = searchParams.get("items");
  const [form, setForm] = useState<ShippingForm>(loadShipping);
  const [errors, setErrors] = useState<ShippingErrors>({});
  const [extra, setExtra] = useState<ShippingExtra>(loadShippingExtra);
  const [ghn, setGhn] = useState<GhnSelection>(loadGhn);
  // What the session kept is only a draft: the codes are checked against the GHN lists before a quote is asked for.
  const [ghnCheck, setGhnCheck] = useState<GhnCheck>({ state: "empty" });
  const [quoteState, setQuoteState] = useState<{ key: string; baseKey: string; data: CheckoutQuoteResponse } | null>(null);
  const [shippingConfirmed, setShippingConfirmed] = useState(false);
  const [lastShippingQuote, setLastShippingQuote] = useState<CheckoutQuoteResponse | null>(null);
  const [editingShipping, setEditingShipping] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [voucherCodes, setVoucherCodes] = useState<string[]>([]);
  const [selectedVoucherDetails, setSelectedVoucherDetails] = useState<VoucherCalcInput[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"Wallet" | "Cod">("Wallet");
  // The result of the last order attempt is unknown: ordering stays locked (kept per browser tab) until the buyer has checked.
  const [unknownOutcome, setUnknownOutcome] = useState(() =>
    typeof window === "undefined" ? false : readUnknownOrderMarker(window.sessionStorage) !== null);
  const [now, setNow] = useState(0);
  const quoteLock = useRef(false);
  const orderLock = useRef(false);
  const [completedOrder, setCompletedOrder] = useState<{
    orderId: string;
    orderNo: string;
    totalAmount: number;
    shippingFee: number | null;
    receiverName: string;
    phone: string;
    fullAddress: string;
  } | null>(null);

  const currentErrors = validateShipping(form, ghn);
  const isShippingComplete = Object.keys(currentErrors).length === 0;
  const allItems = cart.data?.items ?? [];
  const selectedIds = selectedParam ? new Set(selectedParam.split(",").filter(Boolean)) : null;
  const items = selectedIds ? allItems.filter((item) => selectedIds.has(item.id)) : allItems;
  const subtotal = items.reduce((sum, item) => sum + item.unitPriceSnapshot * item.quantity, 0);
  const availableBalance = wallet.data?.availableBalance ?? wallet.data?.balance ?? 0;
  // What the price depends on besides the address. When only the address changed, the open quote is recalculated instead of replaced.
  const baseKey = JSON.stringify({ items: items.map((item) => [item.id, item.quantity, item.unitPriceSnapshot]), vouchers: [...voucherCodes].sort(), paymentMethod });
  const quoteKey = JSON.stringify({
    items: items.map((item) => [item.id, item.quantity, item.unitPriceSnapshot]),
    receiverName: form.receiverName.trim(), phone: form.phone.trim(), address: form.address.trim(),
    province: ghn.provinceId, district: ghn.districtId, ward: ghn.wardCode, vouchers: [...voucherCodes].sort(), paymentMethod,
  });
  const activeQuote = quoteState?.key === quoteKey ? quoteState.data : null;
  const displayQuote = activeQuote ?? (quoting ? quoteState?.data ?? null : null);
  const shippingReferenceQuote = activeQuote ?? (shippingConfirmed && !editingShipping ? lastShippingQuote : null);
  const quoteExpired = Boolean(activeQuote && now >= Date.parse(activeQuote.expiredAt));
  const quoteReady = Boolean(activeQuote && !quoteExpired);
  const quotedShippingFee = shippingReferenceQuote?.shops.reduce((sum, shop) => sum + shop.shippingFeeAmount, 0) ?? 0;
  const quotedDiscount = displayQuote?.shops.reduce((sum, shop) => sum + shop.discountAmount, 0) ?? 0;
  const quotedItemsAmount = shippingReferenceQuote?.shops.reduce((sum, shop) => sum + shop.itemsAmount, 0) ?? subtotal;
  const quotedProductDiscounts = displayQuote?.appliedVoucherDetails?.filter((v) => v.scopeType === "Product") ?? [];
  const quotedShopDiscounts = displayQuote?.appliedVoucherDetails?.filter((v) => v.scopeType === "Shop") ?? [];
  const quotedSystemDiscounts = displayQuote?.appliedVoucherDetails?.filter((v) => v.scopeType === "System") ?? [];
  const quotedProductTotal = quotedProductDiscounts.reduce((sum, v) => sum + v.discountAmount, 0) || (displayQuote?.shops.reduce((sum, s) => sum + (s.productDiscountAmount ?? 0), 0) ?? 0);
  const quotedShopTotal = quotedShopDiscounts.reduce((sum, v) => sum + v.discountAmount, 0) || (displayQuote?.shops.reduce((sum, s) => sum + (s.shopDiscountAmount ?? 0), 0) ?? 0);
  const quotedSystemTotal = quotedSystemDiscounts.reduce((sum, v) => sum + v.discountAmount, 0) || (displayQuote?.shops.reduce((sum, s) => sum + (s.systemDiscountAmount ?? 0), 0) ?? 0);
  const quotedOriginalTotal = shippingReferenceQuote ? quotedItemsAmount + quotedShippingFee : subtotal;
  const voucherEstimate = useMemo(
    () => estimateCheckoutDiscounts(items, selectedVoucherDetails),
    [items, selectedVoucherDetails],
  );
  const hasVoucherBlock = Boolean(quoteError) || Boolean(activeQuote?.rejectedVouchers?.length) || voucherEstimate.warnings.length > 0;
  const shippingForEstimate = shippingReferenceQuote ? quotedShippingFee : 0;
  const effectiveProductDiscount = activeQuote ? quotedProductTotal : voucherEstimate.productDiscount;
  const effectiveShopDiscount = activeQuote ? quotedShopTotal : voucherEstimate.shopDiscount;
  const effectiveSystemDiscount = activeQuote ? quotedSystemTotal : voucherEstimate.systemDiscount;
  const effectiveTotalDiscount = activeQuote ? quotedDiscount : voucherEstimate.totalDiscount;
  const effectiveProductCodes = activeQuote
    ? quotedProductDiscounts.map((v) => v.code)
    : voucherEstimate.productCodes;
  const effectiveShopCodes = activeQuote
    ? quotedShopDiscounts.map((v) => v.code)
    : voucherEstimate.shopCodes;
  const effectiveSystemCodes = activeQuote
    ? quotedSystemDiscounts.map((v) => v.code)
    : voucherEstimate.systemCodes;
  const effectiveOriginalTotal = activeQuote
    ? quotedOriginalTotal
    : quotedItemsAmount + shippingForEstimate;
  const effectiveGrandTotal = activeQuote
    ? activeQuote.grandTotal
    : Math.max(0, quotedItemsAmount - effectiveTotalDiscount) + shippingForEstimate;

  useEffect(() => {
    if (!quoteState) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [quoteState]);

  const lastAutoQuotedRef = useRef<string>("");
  useEffect(() => {
    if (!shippingConfirmed || editingShipping || quoteReady || quoting || quoteLock.current) return;
    if (!items.length || !isShippingComplete || ghnWriteBlock(ghnCheck)) return;
    if (lastAutoQuotedRef.current === quoteKey) return;
    lastAutoQuotedRef.current = quoteKey;
    void fetchQuote(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingConfirmed, editingShipping, quoteKey, quoteReady, isShippingComplete, ghnCheck.state, items.length]);

  const checkoutProductIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
  const checkoutProducts = useApiResource(checkoutProductIds.length ? `checkout-products:${checkoutProductIds.join(",")}` : null, async (signal) => {
    const pairs = await Promise.all(checkoutProductIds.map(async (id) => {
      try { return [id, unwrap(await api.get<ApiResponse<CartProductDetail> | CartProductDetail>(`/api/v1/products/${encodeURIComponent(id)}`, { signal }))] as const; }
      catch { return [id, null] as const; }
    }));
    return Object.fromEntries(pairs) as Record<string, CartProductDetail | null>;
  });

  function setField(field: keyof ShippingForm, value: string) {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);
    setSubmitError("");
    setQuoteError("");
    if (errors[field]) {
      const nextErrors = validateShipping(nextForm, ghn);
      setErrors((current) => ({ ...current, [field]: nextErrors[field] }));
    }
  }
  function blurField(field: keyof ShippingErrors) {
    const nextErrors = validateShipping(form, ghn);
    if (nextErrors[field]) {
      setErrors((current) => ({ ...current, [field]: nextErrors[field] }));
    }
  }
  async function fetchQuote(clearBefore: boolean) {
    if (quoteLock.current) return;
    setQuoteError("");
    setSubmitError("");
    if (!items.length) {
      setQuoteError("Không có sản phẩm nào trong giỏ hàng để báo giá.");
      return;
    }

    const previous = quoteState && quoteState.baseKey === baseKey && Date.now() < Date.parse(quoteState.data.expiredAt) ? quoteState.data : null;
    if (clearBefore) setQuoteState(null);

    quoteLock.current = true;
    setQuoting(true);
    try {
      try {
        window.sessionStorage.setItem(SHIPPING_STORAGE_KEY, JSON.stringify({ receiverName: form.receiverName.trim(), phone: form.phone.trim(), address: form.address.trim() }));
        window.sessionStorage.setItem(SHIPPING_EXTRA_KEY, JSON.stringify(extra));
        window.sessionStorage.setItem(SHIPPING_GHN_KEY, JSON.stringify(ghn));
      } catch {
        // Browser storage may be disabled; the current checkout can still continue.
      }
      const shippingAddress = buildShippingAddress({ receiverName: form.receiverName, phone: form.phone, street: form.address }, ghn);
      let quote: CheckoutQuoteResponse | null = null;
      if (previous) {
        try {
          const recalculated = unwrap(
            await api.post<ApiResponse<CheckoutQuoteResponse> | CheckoutQuoteResponse>(`/api/v1/checkouts/quote/${encodeURIComponent(previous.quoteId)}/recalculate`, { shippingAddress, contactPhone: form.phone.trim() }),
          );
          // Only the shipping part changes: keep the vouchers and the expiry of the quote that was already agreed.
          quote = { ...previous, ...recalculated, appliedVouchers: previous.appliedVouchers, appliedVoucherDetails: previous.appliedVoucherDetails, rejectedVouchers: previous.rejectedVouchers };
        } catch (cause) {
          // A quote that is gone is replaced by a new one; any other failure is shown.
          if (!(cause instanceof ApiError && cause.errorCode === "QUOTE_NOT_FOUND")) throw cause;
        }
      }
      if (!quote) {
        quote = unwrap(
          await api.post<ApiResponse<CheckoutQuoteResponse> | CheckoutQuoteResponse>("/api/v1/checkouts/quote", {
            cartItemIds: items.map((item) => item.id),
            voucherCodes,
            paymentMethod,
            shippingAddress,
            contactPhone: form.phone.trim(),
          }),
        );
      }

      if (!quote.quoteId || !Number.isFinite(quote.grandTotal) || quote.grandTotal <= 0 || !Number.isFinite(quote.walletBalance) || !Array.isArray(quote.shops) || !quote.shops.every((shop) => [shop.itemsAmount, shop.discountAmount, shop.shippingFeeAmount].every(Number.isFinite)) || !Number.isFinite(Date.parse(quote.expiredAt))) {
        throw new Error("Backend chưa trả tổng tiền báo giá hợp lệ.");
      }
      lastAutoQuotedRef.current = quoteKey;
      setQuoteState({ key: quoteKey, baseKey, data: quote });
      setLastShippingQuote(quote);
      setShippingConfirmed(true);
      setEditingShipping(false);
    } catch (reason) {
      setQuoteState(null);
      setQuoteError(describeQuoteFailure(reason).message);
    } finally {
      quoteLock.current = false;
      setQuoting(false);
    }
  }

  async function handleCheckoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (quoteLock.current || (quoteReady && !editingShipping)) return;
    setQuoteError("");
    setSubmitError("");
    const found = validateShipping(form, ghn);
    setErrors(found);
    // A quote is a write: it needs the current codes confirmed by a trusted GHN list ("valid"), not only present.
    const locationBlock = Object.keys(found).length === 0 ? ghnWriteBlock(ghnCheck) : undefined;
    if (locationBlock) {
      setQuoteError(locationBlock);
      return;
    }
    if (Object.keys(found).length) {
      const order: Array<keyof ShippingErrors> = ["receiverName", "phone", "address", "province", "district", "ward"];
      const firstKey = order.find((key) => Boolean(found[key]));
      if (firstKey) {
        event.currentTarget.querySelector<HTMLElement>(`[name="${firstKey}"]`)?.focus();
      }
      return;
    }

    await fetchQuote(true);
  }

  async function handlePlaceOrder() {
    if (orderLock.current || !activeQuote || unknownOutcome || hasVoucherBlock) return;
    setSubmitError("");
    if (Date.now() >= Date.parse(activeQuote.expiredAt)) {
      setQuoteState(null);
      setSubmitError("Báo giá đã hết hạn. Vui lòng lấy báo giá mới.");
      return;
    }
    if (!items.length || Object.keys(validateShipping(form, ghn)).length > 0) {
      setSubmitError("Thông tin giao hàng đã thay đổi. Vui lòng lấy báo giá mới.");
      return;
    }
    if (paymentMethod === "Wallet" && activeQuote.walletBalance < activeQuote.grandTotal) {
      setSubmitError(`Số dư Ví Nexus (${formatMoney(activeQuote.walletBalance)}) không đủ để thanh toán ${formatMoney(activeQuote.grandTotal)}.`);
      return;
    }
    const fullAddress = formatAddressLine(form.address, ghn);
    orderLock.current = true;
    setSubmitting(true);
    try {
      const expectedShippingFee = activeQuote.shops.reduce((sum, shop) => sum + shop.shippingFeeAmount, 0);
      const created = unwrap(
        await api.post<ApiResponse<CreateOrderResponse> | CreateOrderResponse>("/api/v1/orders", {
          quoteId: activeQuote.quoteId,
          paymentMethod,
          shippingAddress: fullAddress,
          contactPhone: form.phone.trim(),
          note: extra.note.trim() || undefined,
          expectedShippingFee,
        }),
      );

      try {
        // The order exists (paid or not, COD included): the address kept for this checkout is not offered again as if it were still being typed.
        window.sessionStorage.removeItem(SHIPPING_STORAGE_KEY);
        window.sessionStorage.removeItem(SHIPPING_EXTRA_KEY);
        window.sessionStorage.removeItem(SHIPPING_GHN_KEY);
      } catch {
        // Browser storage may be disabled.
      }

      if (created.status.replace(/[^a-z]/gi, "").toUpperCase() !== "PAID") {
        clearUnknownOrderMarker(window.sessionStorage);
        router.push(ROUTES.buyer.order(created.orderId));
        return;
      }

      setCompletedOrder({
        orderId: created.orderId,
        orderNo: created.orderNo,
        totalAmount: created.totalAmount,
        shippingFee: activeQuote.shops.reduce((sum, shop) => sum + shop.shippingFeeAmount, 0),
        receiverName: form.receiverName.trim(),
        phone: form.phone.trim(),
        fullAddress,
      });
      clearUnknownOrderMarker(window.sessionStorage);
      cart.reload();
      wallet.reload();
      showToast(`Thanh toán thành công đơn ${created.orderNo}.`, "success");
      notifyNotificationsChanged(true);
    } catch (reason) {
      const failure = describePlaceOrderFailure(reason);
      // The quote is used up in every case. A refusal needs a new quote; an unknown result locks ordering instead of inviting a second order.
      setQuoteState(null);
      setSubmitError(failure.message);
      if (failure.unknownOutcome) {
        writeUnknownOrderMarker(window.sessionStorage, Date.now());
        setUnknownOutcome(true);
      }
      if (failure.reloadCart) cart.reload();
    } finally {
      orderLock.current = false;
      setSubmitting(false);
    }
  }

  if (completedOrder) {
    return (
      <>
        <nav className="checkout-breadcrumb" aria-label="Đường dẫn">
          <Link href={ROUTES.buyer.cart}>Giỏ hàng</Link>
          <span aria-hidden="true">›</span>
          <span>Thông tin giao hàng</span>
          <span aria-hidden="true">›</span>
          <span aria-current="page">Thanh toán thành công</span>
        </nav>
        <ol className="checkout-progress" aria-label="Tiến trình đặt hàng"><li className="is-complete"><span aria-hidden="true">✓</span>Giỏ hàng</li><li className="is-complete"><span aria-hidden="true">✓</span>Giao hàng &amp; thanh toán</li><li className="is-current" aria-current="step"><span aria-hidden="true">✓</span>Xác nhận</li></ol>
        <Card className="card-pad checkout-success-card">
          <div className="checkout-success-badge" aria-hidden="true">✓</div>
          <h1>Thanh toán thành công</h1>
          <p className="checkout-success-lead">
            Đơn hàng của bạn sẽ sớm được giao và số tiền <strong>{formatMoney(completedOrder.totalAmount)}</strong> đã được trừ trực tiếp trên <strong>Ví Nexus</strong>. Đơn hàng đã được chuyển đến người bán (Seller) để xử lý; vận đơn sẽ cập nhật khi được tạo.
          </p>
          <div className="checkout-success-details">
            <div className="info-row">
              <span>Mã đơn hàng</span>
              <strong>{completedOrder.orderNo}</strong>
            </div>
            <div className="info-row">
              <span>Phương thức thanh toán</span>
              <strong>Ví trên nền tảng (Ví Nexus)</strong>
            </div>
            <div className="info-row">
              <span>Phí giao hàng</span>
              <strong>{completedOrder.shippingFee === null ? "Đã gồm trong tổng" : formatMoney(completedOrder.shippingFee)}</strong>
            </div>
            <div className="info-row">
              <span>Tổng tiền đã trừ ví</span>
              <strong style={{ color: "var(--primary-hover)" }}>{formatMoney(completedOrder.totalAmount)}</strong>
            </div>
            <div className="info-row">
              <span>Người nhận</span>
              <strong>{completedOrder.receiverName} · {completedOrder.phone}</strong>
            </div>
            <div className="info-row">
              <span>Địa chỉ giao hàng</span>
              <strong>{completedOrder.fullAddress}</strong>
            </div>
            <div className="info-row">
              <span>Trạng thái đơn hàng</span>
              <Badge>Đã thanh toán · Đã chuyển đến Seller</Badge>
            </div>
          </div>
          <div className="action-row" style={{ marginTop: 22 }}>
            <Link className="button button-primary" href={ROUTES.buyer.order(completedOrder.orderId)}>
              Xem chi tiết đơn mua
            </Link>
            <Link className="button button-secondary" href={ROUTES.buyer.orders}>
              Danh sách đơn mua
            </Link>
            <Link className="button button-secondary" href={ROUTES.catalog.index}>
              Tiếp tục mua sắm
            </Link>
          </div>
        </Card>
      </>
    );
  }

  return <>
    <nav className="checkout-breadcrumb" aria-label="Đường dẫn"><Link href={ROUTES.buyer.cart}>Giỏ hàng</Link><span aria-hidden="true">›</span><span aria-current="page">Thông tin giao hàng &amp; Thanh toán</span></nav>
    <ol className="checkout-progress" aria-label="Tiến trình đặt hàng"><li className="is-complete"><span aria-hidden="true">✓</span>Giỏ hàng</li><li className="is-current" aria-current="step"><span aria-hidden="true">2</span>Giao hàng &amp; thanh toán</li><li><span aria-hidden="true">3</span>Xác nhận</li></ol>
    {cart.error && <ErrorState cause={cart.error} onRetry={cart.reload} />}
    <div className="checkout-layout"><div className="checkout-main">
      <section className="checkout-panel" aria-labelledby="checkout-address-heading"><div className="checkout-panel-heading"><div><h1 id="checkout-address-heading">Địa chỉ nhận hàng</h1><p>Điền thông tin để xem tổng thanh toán trước khi đặt hàng.</p></div></div>
        {shippingConfirmed && !editingShipping && <div className="checkout-address-review"><div><span>Liên hệ</span><strong>{form.receiverName} · {form.phone}</strong>{extra.email && <small>{extra.email}</small>}</div><div><span>Giao tới</span><strong>{formatAddressLine(form.address, ghn)}</strong></div>{!submitting && !unknownOutcome && <button className="button button-secondary" type="button" onClick={() => { setEditingShipping(true); setSubmitError(""); setQuoteError(""); }}>Sửa thông tin</button>}</div>}
        <form className="checkout-form" onSubmit={(e) => void handleCheckoutSubmit(e)} noValidate>
          {(!shippingConfirmed || editingShipping) && <>
          <SavedAddressPicker onPick={(saved) => { setForm({ receiverName: saved.recipientName, phone: saved.phone, address: saved.addressLine }); setGhn(toGhnSelection(saved)); setErrors({}); setSubmitError(""); setQuoteError(""); }} />
          <label className="field-wrap"><span>Họ tên người nhận <abbr className="checkout-required" title="Bắt buộc">*</abbr></span><input className="field" name="receiverName" required autoComplete="name" value={form.receiverName} onChange={(event) => setField("receiverName", event.target.value)} onBlur={() => blurField("receiverName")} aria-invalid={Boolean(errors.receiverName)} placeholder="Ví dụ: Nguyễn Văn A" />{errors.receiverName && <small className="checkout-field-error" role="alert">{errors.receiverName}</small>}</label>
          <div className="checkout-contact-row"><EmailInput label="Email liên hệ" value={extra.email} onChange={(next) => setExtra((current) => ({ ...current, email: next }))} placeholder="contact@example.com" helpText="Tùy chọn: nhận thông báo trạng thái đơn hàng" />
          <label className="field-wrap"><span>Số điện thoại <abbr className="checkout-required" title="Bắt buộc">*</abbr></span><input className="field" name="phone" type="tel" required autoComplete="tel" inputMode="tel" value={form.phone} onChange={(event) => setField("phone", event.target.value)} onBlur={() => blurField("phone")} aria-invalid={Boolean(errors.phone)} placeholder="Ví dụ: 0901234567" />{errors.phone && <small className="checkout-field-error" role="alert">{errors.phone}</small>}</label></div>
          <label className="field-wrap"><span>Địa chỉ cụ thể <abbr className="checkout-required" title="Bắt buộc">*</abbr></span><input className="field" name="address" required autoComplete="street-address" value={form.address} onChange={(event) => setField("address", event.target.value)} onBlur={() => blurField("address")} aria-invalid={Boolean(errors.address)} placeholder="Số nhà, tên đường" />{errors.address && <small className="checkout-field-error" role="alert">{errors.address}</small>}</label>
          <label className="field-wrap">Quốc gia<input className="field checkout-country" value="Việt Nam" readOnly aria-readonly="true" /></label>
          <GhnLocationSelect value={ghn} errors={errors} onCheck={setGhnCheck} onChange={(next) => { setGhn(next); setErrors((current) => ({ ...current, province: undefined, district: undefined, ward: undefined })); setSubmitError(""); }} />
          <label className="field-wrap">Ghi chú giao hàng<textarea className="field" rows={3} value={extra.note} onChange={(event) => setExtra((current) => ({ ...current, note: event.target.value }))} placeholder="Ví dụ: Giao hàng ngoài giờ hành chính" /></label>
          </>}

          <fieldset className="checkout-payment-methods" disabled={unknownOutcome || quoting || submitting}><legend>Phương thức thanh toán</legend><label className={"checkout-payment-choice" + (paymentMethod === "Wallet" ? " is-selected" : "")}><input type="radio" name="paymentMethod" value="Wallet" checked={paymentMethod === "Wallet"} onChange={() => setPaymentMethod("Wallet")} /><span><strong>Ví Nexus</strong><small>Số dư khả dụng: {activeQuote ? formatMoney(activeQuote.walletBalance) : wallet.loading ? "Đang kiểm tra…" : wallet.data ? formatMoney(availableBalance) : "Không xác định"}</small></span></label><label className={"checkout-payment-choice" + (paymentMethod === "Cod" ? " is-selected" : "")}><input type="radio" name="paymentMethod" value="Cod" checked={paymentMethod === "Cod"} onChange={() => setPaymentMethod("Cod")} /><span><strong>Thanh toán khi nhận hàng (COD)</strong><small>Trả tiền mặt cho đơn vị giao hàng. Không dùng được mã giảm giá của sàn.</small></span></label><label className="checkout-payment-choice is-disabled"><input type="radio" name="paymentMethod" value="Stripe" disabled /><span><strong>Stripe <small>Chưa khả dụng</small></strong><small>Thanh toán trực tiếp qua Stripe đang hoàn thiện.</small></span></label></fieldset>

          {(!shippingConfirmed || editingShipping) && <div className="checkout-form-footer">
            <Link href={ROUTES.buyer.cart}>← Quay lại giỏ hàng</Link>
            <button
              className={`button button-primary${isShippingComplete && items.length > 0 ? "" : " checkout-submit-incomplete"}`}
              type="submit"
              disabled={quoting}
              aria-disabled={!isShippingComplete || items.length === 0}
            >
              {quoting ? "Đang lấy báo giá…" : "Xem tổng thanh toán"}
            </button>
          </div>}
          {quoteError && <p className="checkout-field-error" role="alert">{quoteError}</p>}
        </form>
      </section>
    </div>
    <aside className="checkout-summary"><h2>Tóm tắt đơn hàng</h2>{items.length ? <div className="checkout-items">{items.map((item) => {
      const detail = checkoutProducts.data?.[item.productId];
      const variant = detail?.variants?.find((entry) => entry.variantId === item.skuId);
      const image = variant?.primaryImageUrl ?? variant?.images?.find((entry) => entry.isActive !== false)?.url ?? detail?.images?.find((entry) => entry.isActive !== false)?.url ?? null;
      return <div className="checkout-item" key={item.id}><span className="checkout-item-image"><ThumbnailBox src={resolveImageUrl(image)} alt="" size={48} /><span className="checkout-item-count">{item.quantity}</span></span><div style={{ minWidth: 0 }}><strong><TruncatedText text={item.productName} label="Tên sản phẩm" block /></strong><span>{variant?.name ?? `Số lượng: ${item.quantity}`}</span></div><strong>{formatMoney(item.unitPriceSnapshot * item.quantity)}</strong></div>;
    })}</div> : cart.loading ? <LoadingState rows={2} label="Đang tải giỏ hàng…" /> : <EmptyState compact title="Chưa có sản phẩm được chọn" actionLabel="Về giỏ hàng" actionHref={ROUTES.buyer.cart} />}
      <div className="checkout-summary-line"><span>Tiền hàng</span><strong>{items.length ? formatMoney(quotedItemsAmount) : "—"}</strong></div>
      <div className="checkout-summary-line"><span>Phí giao hàng</span><strong>{shippingReferenceQuote ? formatMoney(quotedShippingFee) : items.length ? "Theo báo giá" : "—"}</strong></div>
      {items.length > 0 && (
        <CheckoutVoucherPanel
          cartItemIds={items.map((item) => item.id)}
          items={items}
          selectedCodes={voucherCodes}
          cashOnDelivery={paymentMethod === "Cod"}
          disabled={unknownOutcome || quoting || submitting}
          onChange={(next) => { setQuoteError(""); setVoucherCodes(next); }}
          onVouchersChange={setSelectedVoucherDetails}
        />
      )}
      {effectiveProductDiscount > 0 && (
        <div className="checkout-summary-line checkout-summary-discount-line">
          <span>Giảm giá sản phẩm{effectiveProductCodes.length ? ` (${effectiveProductCodes.join(", ")})` : ""}</span>
          <strong>−{formatMoney(effectiveProductDiscount)}</strong>
        </div>
      )}
      {effectiveShopDiscount > 0 && (
        <div className="checkout-summary-line checkout-summary-discount-line">
          <span>Giảm giá từ shop{effectiveShopCodes.length ? ` (${effectiveShopCodes.join(", ")})` : ""}</span>
          <strong>−{formatMoney(effectiveShopDiscount)}</strong>
        </div>
      )}
      {effectiveSystemDiscount > 0 && (
        <div className="checkout-summary-line checkout-summary-discount-line">
          <span>Giảm giá toàn sàn{effectiveSystemCodes.length ? ` (${effectiveSystemCodes.join(", ")})` : ""}</span>
          <strong>−{formatMoney(effectiveSystemDiscount)}</strong>
        </div>
      )}
      {activeQuote && quotedDiscount > 0 && quotedProductTotal === 0 && quotedShopTotal === 0 && quotedSystemTotal === 0 && (
        <div className="checkout-summary-line checkout-summary-discount-line"><span>Giảm giá</span><strong>−{formatMoney(quotedDiscount)}</strong></div>
      )}
      {!activeQuote && voucherEstimate.warnings.map((warning) => (
        <p className="checkout-field-error" role="status" key={warning.code}>{warning.reason}</p>
      ))}
      {displayQuote?.rejectedVouchers?.map((rejected) => <p className="checkout-field-error" role="status" key={rejected.code}>Mã {rejected.code} không được áp dụng: {describeRejectedVoucher(rejected.reasonCode)}</p>)}
      <div className="checkout-summary-total">
        <span>
          {activeQuote
            ? "Tổng thanh toán"
            : quoting
              ? "Đang cập nhật tổng…"
              : effectiveTotalDiscount > 0
                ? "Tạm tính sau giảm"
                : "Tạm tính tiền hàng"}
        </span>
        <strong className="price-stack-inline">
          {effectiveTotalDiscount > 0 && (
            <span className="price-strikethrough">{formatMoney(effectiveOriginalTotal)}</span>
          )}
          <span>{items.length ? formatMoney(effectiveGrandTotal) : "—"}</span>
        </strong>
      </div>
      {unknownOutcome ? <div className="notice state-error" role="alert"><strong>Chưa xác định được kết quả đặt đơn</strong><p>Yêu cầu đặt hàng gần nhất có thể đã được xử lý. Để tránh đặt trùng, nút đặt hàng đang bị khóa.</p><p>Hãy kiểm tra <Link href={ROUTES.buyer.orders}>Đơn mua</Link> và <Link href={ROUTES.buyer.wallet}>Ví của bạn</Link>. Nếu đã có đơn hoặc ví đã bị trừ tiền, bạn không cần đặt lại. Nếu vẫn không chắc chắn, hãy liên hệ hỗ trợ để được đối soát trước khi đặt lại.</p></div> : quoteReady && activeQuote ? <><p>Báo giá có hiệu lực đến {new Date(activeQuote.expiredAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}. {paymentMethod === "Wallet" ? `Số dư ví theo thời điểm báo giá: ${formatMoney(activeQuote.walletBalance)}.` : "Bạn sẽ trả tiền mặt khi nhận hàng."}</p><button className="button checkout-place-order" type="button" disabled={submitting || hasVoucherBlock || (paymentMethod === "Wallet" && activeQuote.walletBalance < activeQuote.grandTotal)} onClick={() => void handlePlaceOrder()}>{submitting ? "Đang đặt hàng…" : hasVoucherBlock ? "Vui lòng chọn lại mã giảm giá hợp lệ" : paymentMethod === "Wallet" ? `Đặt hàng bằng Ví Nexus · ${formatMoney(activeQuote.grandTotal)}` : `Đặt hàng (thanh toán khi nhận) · ${formatMoney(activeQuote.grandTotal)}`}</button>{paymentMethod === "Wallet" && activeQuote.walletBalance < activeQuote.grandTotal && <div style={{ display: "grid", gap: 8, marginTop: 8 }}><p className="checkout-field-error" style={{ margin: 0 }}>Số dư Ví Nexus không đủ. Vui lòng nạp thêm trước khi đặt hàng.</p><Link className="button button-secondary button-small" href={ROUTES.buyer.topUp}>Nạp tiền vào Ví Nexus</Link></div>}</> : quoteExpired ? <div style={{ display: "grid", gap: 8 }}><p style={{ margin: 0 }}>Báo giá đã hết hạn. Vui lòng lấy báo giá mới.</p><button className="button button-secondary" type="button" disabled={quoting} onClick={() => { lastAutoQuotedRef.current = ""; void fetchQuote(true); }}>{quoting ? "Đang lấy báo giá…" : "Lấy báo giá mới"}</button></div> : quoteError ? <p className="checkout-field-error" role="alert">Không thể đặt hàng khi mã giảm giá chưa hợp lệ. Hãy bỏ hoặc chọn mã khác.</p> : null}
      {submitError && !unknownOutcome && <><p className="checkout-field-error" role="alert">{submitError}</p><Link href={ROUTES.buyer.cart}>Quay lại giỏ hàng</Link></>}
    </aside></div>
  </>;
}

const BUYER_ORDER_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Chờ thanh toán" },
  { key: "confirm", label: "Chờ xác nhận" },
  { key: "shipping", label: "Đang giao" },
  { key: "delivered", label: "Đã giao" },
  { key: "completed", label: "Hoàn tất" },
  { key: "cancelled", label: "Đã hủy / Hoàn hàng" },
] as const;

type BuyerOrderTabKey = (typeof BUYER_ORDER_TABS)[number]["key"];

function matchesBuyerOrderTab(status: string, tab: BuyerOrderTabKey): boolean {
  if (tab === "all") return true;
  const key = status.replace(/[^a-z]/gi, "").toUpperCase();
  if (tab === "pending") return key === "PENDINGPAYMENT" || key === "PAYMENTPROCESSING";
  if (tab === "confirm") return key === "PAID" || key === "CONFIRMED" || key === "SELLERACCEPTED";
  if (tab === "shipping") return key === "SHIPPING" || key === "SHIPPED";
  if (tab === "delivered") return key === "DELIVERED";
  if (tab === "completed") return key === "COMPLETED";
  if (tab === "cancelled") return ["CANCELLED", "EXPIRED", "SELLERREJECTED", "REFUNDED", "RETURNING", "RETURNED"].includes(key);
  return true;
}

export function OrdersScreen() {
  const { user } = useSession();
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<BuyerOrderTabKey>("all");
  const buyerId = user?.id ?? "";
  const orders = useApiResource(
    buyerId ? `buyer-orders:${buyerId}:${page}` : null,
    (signal) =>
      api
        .get<ApiResponse<Paged<Order>> | Paged<Order>>(`/api/v1/orders?page=${page}&pageSize=20`, { signal })
        .then(unwrap),
  );
  const allItems = orders.data?.items ?? [];
  const visibleItems = allItems.filter((order) => matchesBuyerOrderTab(order.status, activeTab));

  return <div className="order-page-shell">
    <PageHeading
      title="Đơn mua của tôi"
      description="Theo dõi trạng thái giao hàng và xác nhận khi bạn đã nhận được hàng."
    />
    <div className="order-tabs" role="tablist" aria-label="Lọc trạng thái đơn mua">
      {BUYER_ORDER_TABS.map((tab) => {
        const count = tab.key === "all" ? allItems.length : allItems.filter((item) => matchesBuyerOrderTab(item.status, tab.key)).length;
        const selected = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`order-tab${selected ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.label}</span>
            {count > 0 && <span className="order-tab-count">{count}</span>}
          </button>
        );
      })}
    </div>
    {orders.error && <ErrorState cause={orders.error} onRetry={orders.reload} />}
    <Card className="card-pad">
      {visibleItems.length ? (
        visibleItems.map((order) => {
          const resolvedId = order.orderId ?? order.id ?? "";
          const resolvedNo = order.orderNo ?? `ORD-${resolvedId.slice(0, 8).toUpperCase()}`;
          return (
            <div className="info-row order-list-row" key={resolvedId}>
              <div>
                <Link href={ROUTES.buyer.order(resolvedId)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="package" size={16} />
                  <strong>Đơn hàng {resolvedNo}</strong>
                </Link>
                <p style={{ margin: "6px 0 0", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <Badge>{describeOrderStatus(order.status, order.subOrders?.[0]?.paymentMethod)}</Badge>
                  {order.createdAt ? <span style={{ color: "var(--muted)", fontSize: 13 }}>Đặt lúc {new Date(order.createdAt).toLocaleString("vi-VN")}</span> : null}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong style={{ display: "block", marginBottom: 6, fontVariantNumeric: "tabular-nums" }}>{formatMoney(order.totalAmount)}</strong>
                <Link className="button button-secondary" href={ROUTES.buyer.order(resolvedId)}>
                  Xem chi tiết
                </Link>
              </div>
            </div>
          );
        })
      ) : (
        orders.loading ? (
          <LoadingState rows={4} label="Đang tải đơn hàng…" />
        ) : orders.error ? null : (
          <EmptyState
            title={activeTab === "all" ? "Bạn chưa có đơn hàng" : "Không có đơn hàng ở mục này"}
            description={activeTab === "all" ? "Đơn hàng sau khi đặt sẽ xuất hiện tại đây." : "Thử chuyển sang mục Tất cả để xem các đơn khác."}
            actionLabel={activeTab === "all" ? "Bắt đầu mua sắm" : undefined}
            actionHref={activeTab === "all" ? ROUTES.catalog.index : undefined}
          />
        )
      )}
      {orders.data && orders.data.pagination.totalPages > 1 && (
        <AdminPagination
          page={page}
          pageSize={orders.data.pagination.pageSize}
          totalItems={orders.data.pagination.totalCount}
          totalPages={orders.data.pagination.totalPages}
          loading={orders.loading}
          onPageChange={setPage}
          itemLabel="đơn hàng"
        />
      )}
    </Card>
  </div>;
}

const SUBORDER_PROGRESS_TABS = [
  { key: "all", label: "Tất cả", icon: "orders" },
  { key: "pending", label: "Chờ thanh toán", icon: "clock" },
  { key: "paid", label: "Đã thanh toán", icon: "wallet" },
  { key: "confirmed", label: "Chờ lấy hàng", icon: "package" },
  { key: "shipping", label: "Đang giao hàng", icon: "truck" },
  { key: "delivered", label: "Đã giao / Hoàn tất", icon: "packageCheck" },
  { key: "cancelled", label: "Đã hủy / Hoàn hàng", icon: "xCircle" },
] as const;

type SubOrderProgressTabKey = (typeof SUBORDER_PROGRESS_TABS)[number]["key"];

function matchesSubOrderProgressTab(status: string, tab: SubOrderProgressTabKey): boolean {
  if (tab === "all") return true;
  const key = status.replace(/[^a-z]/gi, "").toUpperCase();
  if (tab === "pending") return key === "PENDINGPAYMENT" || key === "PAYMENTPROCESSING" || key === "AWAITINGPAYMENT";
  if (tab === "paid") return key === "PAID" || key === "PENDINGCONFIRMATION";
  if (tab === "confirmed") return key === "CONFIRMED" || key === "SELLERACCEPTED" || key === "READYTOPICK" || key === "PICKING" || key === "PACKED";
  if (tab === "shipping") return key === "SHIPPING" || key === "SHIPPED" || key === "HANDEDOVER" || key === "INTRANSIT" || key === "OUTFORDELIVERY" || key === "DELIVERYATTEMPTFAILED";
  if (tab === "delivered") return key === "DELIVERED" || key === "COMPLETED";
  if (tab === "cancelled") return ["CANCELLED", "CANCELED", "EXPIRED", "SELLERREJECTED", "REFUNDED", "RETURNING", "RETURNED", "DELIVERYFAILED"].includes(key);
  return true;
}

function isFallbackShopLabel(name: string | null | undefined, sellerId: string): boolean {
  if (!name || !name.trim()) return true;
  return name.trim().toLowerCase() === `shop ${sellerId.slice(0, 8).toLowerCase()}`;
}

export function OrderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const orderId = String(id ?? "");
  const order = useApiResource(
    orderId ? `buyer-order:${orderId}` : null,
    (signal) => api.get<ApiResponse<Order> | Order>(`/api/v1/orders/${encodeURIComponent(orderId)}`, { signal }).then(unwrap),
  );
  const [activeSubTab, setActiveSubTab] = useState<SubOrderProgressTabKey>("all");
  const [previewItem, setPreviewItem] = useState<OrderItemPreviewSnapshot | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [mountedAt] = useState(() => Date.now());

  const subOrders = useMemo(() => order.data?.subOrders ?? [], [order.data?.subOrders]);
  const fallbackSellerIds = useMemo(
    () =>
      [...new Set(
        subOrders
          .filter((s) => isFallbackShopLabel(s.shopName, s.sellerId))
          .map((s) => s.sellerId)
          .filter(Boolean),
      )],
    [subOrders],
  );

  const fallbackShops = useApiResource(
    fallbackSellerIds.length ? `order-shop-names:${fallbackSellerIds.join(",")}` : null,
    async (signal) => {
      const pairs = await Promise.all(
        fallbackSellerIds.map(async (sellerId) => {
          try {
            const profile = unwrap(
              await api.get<ApiResponse<{ shopName?: string | null }> | { shopName?: string | null }>(
                `/api/v1/sellers/${encodeURIComponent(sellerId)}`,
                { signal },
              ),
            );
            return [sellerId, profile?.shopName?.trim() || null] as const;
          } catch {
            return [sellerId, null] as const;
          }
        }),
      );
      return Object.fromEntries(pairs) as Record<string, string | null>;
    },
  );

  const firstProductIds = useMemo(
    () =>
      [...new Set(
        subOrders
          .map((s) => s.items?.[0]?.productId)
          .filter((pid): pid is string => Boolean(pid)),
      )],
    [subOrders],
  );

  const firstProductDetails = useApiResource(
    firstProductIds.length ? `order-first-products:${firstProductIds.join(",")}` : null,
    async (signal) => {
      const pairs = await Promise.all(
        firstProductIds.map(async (pid) => {
          try {
            const detail = unwrap(
              await api.get<ApiResponse<CartProductDetail> | CartProductDetail>(
                `/api/v1/products/${encodeURIComponent(pid)}`,
                { signal },
              ),
            );
            return [pid, detail] as const;
          } catch {
            return [pid, null] as const;
          }
        }),
      );
      return Object.fromEntries(pairs) as Record<string, CartProductDetail | null>;
    },
  );

  function afterAction(message: string) {
    setConfirmError("");
    setConfirmMessage(message);
    order.reload();
  }

  async function handleCancelOrder() {
    if (!orderId || cancellingOrder) return;
    setCancellingOrder(true);
    setConfirmMessage("");
    setConfirmError("");
    const payload = {
      reasonCode: "BuyerChangedMind",
      reasonText: "Người mua chủ động hủy đơn hàng trước khi giao",
    };
    try {
      try {
        await api.put(`/api/v1/orders/${encodeURIComponent(orderId)}/cancel`, payload);
      } catch {
        await api.post(`/api/v1/orders/${encodeURIComponent(orderId)}/cancel`, payload);
      }
      setConfirmMessage("Đã hủy đơn hàng. Nếu bạn đã thanh toán qua Ví Nexus, tiền sẽ được hoàn lại.");
      order.reload();
    } catch (reason) {
      setConfirmError(describeCartFailure(reason));
    } finally {
      setCancellingOrder(false);
    }
  }

  const primaryStatus = subOrders[0]?.status ?? order.data?.status ?? "—";
  const canCancel = Boolean(order.data && canBuyerCancelOrder(order.data.status, subOrders));
  const canPayAgain = Boolean(order.data && canRepay(order.data, subOrders, mountedAt));
  const canComplete = Boolean(order.data && canCompleteOrder(order.data, subOrders));
  const visibleSubOrders = subOrders.filter((sub) => matchesSubOrderProgressTab(sub.status, activeSubTab));

  const totalItemsAmount = subOrders.reduce((sum, s) => sum + s.itemsAmount, 0);
  const totalShippingFee = subOrders.reduce((sum, s) => sum + s.shippingFeeAmount, 0);
  const totalProductDiscount = subOrders.reduce((sum, s) => sum + (s.productDiscountAmount ?? 0), 0);
  const totalShopDiscount = subOrders.reduce((sum, s) => sum + (s.shopDiscountAmount ?? 0), 0);
  const totalSystemDiscount = subOrders.reduce((sum, s) => sum + (s.systemDiscountAmount ?? 0), 0);
  const totalOrderDiscount = totalProductDiscount + totalShopDiscount + totalSystemDiscount;
  const originalOrderTotal = totalItemsAmount + totalShippingFee;

  const orderAppliedVouchers = order.data?.appliedVouchers ?? [];
  const productCodes = [...new Set(orderAppliedVouchers.filter((v) => v.scopeType === "Product").map((v) => v.code))];
  const shopCodes = [...new Set(orderAppliedVouchers.filter((v) => v.scopeType === "Shop").map((v) => v.code))];
  const systemCodes = [...new Set(orderAppliedVouchers.filter((v) => v.scopeType === "System").map((v) => v.code))];
  const firstSub = subOrders[0];
  const deliveryAddressText = firstSub?.shippingAddress?.fullAddress
    || [firstSub?.shippingAddress?.street, firstSub?.shippingAddress?.ward, firstSub?.shippingAddress?.district, firstSub?.shippingAddress?.province]
      .filter((part) => part && part.trim())
      .join(", ")
    || "—";

  return (
    <div className="order-page-shell">
      <PageHeading
        title={order.data?.orderNo ? `Chi tiết đơn mua · ${order.data.orderNo}` : "Chi tiết đơn mua"}
        action={
          canCancel || canPayAgain || canComplete ? (
            <div className="action-row">
              {canPayAgain && order.data && <RepayButton orderId={orderId} total={order.data.totalAmount} onDone={afterAction} />}
              {canComplete && <CompleteOrderButton orderId={orderId} onDone={afterAction} />}
              {canCancel && (
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ borderColor: "var(--danger, #dc2626)", color: "var(--danger, #dc2626)" }}
                  disabled={cancellingOrder}
                  onClick={() => void handleCancelOrder()}
                >
                  {cancellingOrder ? "Đang hủy đơn…" : "Hủy đơn hàng"}
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      {confirmError && <p className="notice" role="alert">{confirmError}</p>}
      {order.error && <ErrorState cause={order.error} onRetry={order.reload} />}
      {confirmMessage && <p className="form-success" role="status">{confirmMessage}</p>}

      {order.data && (
        <section className="shipment-stepper-card" aria-label="Tiến trình các đơn hàng theo trạng thái">
          <div className="shipment-stepper-head">
            <span className="shipment-stepper-title">
              <Icon name="truck" size={18} />
              <span>Tiến trình đơn {order.data.orderNo} ({subOrders.length} gian hàng)</span>
            </span>
            <Badge>{describeOrderStatus(primaryStatus, firstSub?.paymentMethod)}</Badge>
          </div>
          <div className="order-progress-tabs" role="tablist" aria-label="Lọc đơn hàng shop theo trạng thái">
            {SUBORDER_PROGRESS_TABS.map((tab) => {
              const count = tab.key === "all"
                ? subOrders.length
                : subOrders.filter((s) => matchesSubOrderProgressTab(s.status, tab.key)).length;
              const selected = activeSubTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`order-progress-tab${selected ? " is-active" : ""}${count > 0 ? " has-items" : ""}`}
                  onClick={() => setActiveSubTab(tab.key)}
                >
                  <span className="order-progress-tab-icon">
                    <Icon name={tab.icon} size={16} />
                  </span>
                  <span className="order-progress-tab-label">{tab.label}</span>
                  <span className="order-progress-tab-count tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="order-detail-layout">
        {visibleSubOrders.length > 0 ? (
          visibleSubOrders.map((sub) => {
            const shopTitle = !isFallbackShopLabel(sub.shopName, sub.sellerId)
              ? sub.shopName
              : fallbackShops.data?.[sub.sellerId] || sub.shopName;
            const firstItem = sub.items?.[0];
            const firstDetail = firstItem ? firstProductDetails.data?.[firstItem.productId] : null;
            const firstVariant = firstItem
              ? firstDetail?.variants?.find((entry) => entry.variantId === firstItem.skuId)
              : undefined;
            const firstImage =
              firstVariant?.primaryImageUrl ??
              firstVariant?.images?.find((entry) => entry.isActive !== false)?.url ??
              firstDetail?.primaryImageUrl ??
              firstDetail?.images?.find((entry) => entry.isActive !== false)?.url ??
              null;
            const subDiscountTotal = (sub.productDiscountAmount ?? 0) + (sub.shopDiscountAmount ?? 0) + (sub.systemDiscountAmount ?? 0);
            const subOriginalTotal = sub.itemsAmount + sub.shippingFeeAmount;
            const hasFirstDiscount = Boolean(
              firstItem &&
                firstItem.unitPriceAfterDiscount != null &&
                firstItem.unitPriceAfterDiscount < firstItem.unitPrice,
            );
            const firstRecordedUnit = firstItem
              ? hasFirstDiscount
                ? firstItem.unitPriceAfterDiscount!
                : firstItem.unitPrice
              : 0;

            return (
              <Card className="card-pad suborder-summary-card" key={sub.subOrderId}>
                <div className="suborder-summary-head">
                  <div className="suborder-summary-shop">
                    <Icon name="store" size={17} />
                    <h2 style={{ margin: 0, minWidth: 0 }}>
                      <TruncatedText text={shopTitle} label="Tên gian hàng" block />
                    </h2>
                    <Badge>{describeOrderStatus(sub.status, sub.paymentMethod)}</Badge>
                  </div>
                  <span className="suborder-summary-no">{sub.subOrderNo}</span>
                </div>

                {firstItem && (
                  <button
                    type="button"
                    className="suborder-summary-item"
                    onClick={() =>
                      setPreviewItem({
                        productId: firstItem.productId,
                        skuId: firstItem.skuId,
                        productName: firstItem.productName,
                        skuCode: firstItem.skuCode,
                        quantity: firstItem.quantity,
                        unitPrice: firstItem.unitPrice,
                        unitPriceAfterDiscount: firstItem.unitPriceAfterDiscount,
                        lineTotal: firstItem.lineTotal,
                        shopName: shopTitle,
                        imageUrl: firstImage,
                      })
                    }
                  >
                    <ThumbnailBox src={resolveImageUrl(firstImage)} alt={firstItem.productName} size={48} />
                    <span className="suborder-item-content">
                      <span className="suborder-item-info">
                        <strong><TruncatedText text={firstItem.productName} label="Tên sản phẩm" block /></strong>
                        <small>
                          {firstItem.skuCode ? `SKU: ${firstItem.skuCode} · ` : ""}
                          Số lượng: <b className="suborder-item-qty">× {firstItem.quantity}</b>
                          {sub.items.length > 1 ? ` · Và ${sub.items.length - 1} sản phẩm khác` : ""}
                        </small>
                      </span>
                      <span className="suborder-item-price">
                        <span className="price-stack-inline">
                          {hasFirstDiscount && (
                            <span className="price-strikethrough">{formatMoney(firstItem.unitPrice)}</span>
                          )}
                          <strong>{formatMoney(firstRecordedUnit)}</strong>
                        </span>
                      </span>
                    </span>
                  </button>
                )}

                <div className="suborder-summary-foot">
                  <div className="suborder-summary-total">
                    <span>Tổng đơn shop:</span>
                    <strong className="price-stack-inline" style={{ color: "var(--primary-hover)" }}>
                      {subDiscountTotal > 0 && subOriginalTotal > sub.totalAmount && (
                        <span className="price-strikethrough">{formatMoney(subOriginalTotal)}</span>
                      )}
                      <span>{formatMoney(sub.totalAmount)}</span>
                    </strong>
                  </div>
                  <Link
                    className="button button-primary button-small"
                    href={ROUTES.buyer.subOrder(orderId, sub.subOrderId)}
                  >
                    Xem chi tiết đơn hàng shop
                  </Link>
                </div>
              </Card>
            );
          })
        ) : order.loading ? (
          <LoadingState rows={4} label="Đang tải đơn hàng…" />
        ) : order.data ? (
          <Card className="card-pad">
            <EmptyState
              compact
              title="Không có đơn hàng shop nào ở trạng thái này"
              description="Chọn mục Tất cả hoặc trạng thái khác trên thanh tiến trình để xem các đơn hàng con."
            />
          </Card>
        ) : null}

        {order.data && (
          <div className="split">
            <Card className="card-pad">
              <h2>Chi tiết thanh toán đơn hàng</h2>
              <div className="info-row">
                <span>Tiền hàng ({subOrders.length} gian hàng)</span>
                <strong>{formatMoney(totalItemsAmount)}</strong>
              </div>
              <div className="info-row">
                <span>Phí giao hàng</span>
                <strong>{formatMoney(totalShippingFee)}</strong>
              </div>
              {totalProductDiscount > 0 && (
                <div className="info-row suborder-discount-row">
                  <span>Giảm giá sản phẩm{productCodes.length ? ` (${productCodes.join(", ")})` : ""}</span>
                  <strong>−{formatMoney(totalProductDiscount)}</strong>
                </div>
              )}
              {totalShopDiscount > 0 && (
                <div className="info-row suborder-discount-row">
                  <span>Giảm giá từ shop{shopCodes.length ? ` (${shopCodes.join(", ")})` : ""}</span>
                  <strong>−{formatMoney(totalShopDiscount)}</strong>
                </div>
              )}
              {totalSystemDiscount > 0 && (
                <div className="info-row suborder-discount-row">
                  <span>Giảm giá toàn sàn{systemCodes.length ? ` (${systemCodes.join(", ")})` : ""}</span>
                  <strong>−{formatMoney(totalSystemDiscount)}</strong>
                </div>
              )}
              <div className="info-row">
                <span>Tổng gốc (gồm phí giao hàng)</span>
                <strong className={totalOrderDiscount > 0 ? "price-strikethrough" : undefined}>
                  {formatMoney(originalOrderTotal)}
                </strong>
              </div>
              <div className="info-row suborder-final-row">
                <span>Tổng thanh toán</span>
                <strong className="price-stack-inline">
                  {totalOrderDiscount > 0 && originalOrderTotal > order.data.totalAmount && (
                    <span className="price-strikethrough">{formatMoney(originalOrderTotal)}</span>
                  )}
                  <span>{formatMoney(order.data.totalAmount)}</span>
                </strong>
              </div>
            </Card>

            <Card className="card-pad">
              <h2>Thông tin giao hàng &amp; Đơn hàng</h2>
              <div className="info-row">
                <span>Mã đơn hàng</span>
                <strong className="seller-wrap-value">{order.data.orderNo ?? orderId}</strong>
              </div>
              <div className="info-row">
                <span>Thời gian tạo đơn</span>
                <strong>{order.data.createdAt ? new Date(order.data.createdAt).toLocaleString("vi-VN") : "—"}</strong>
              </div>
              <div className="info-row">
                <span>Phương thức thanh toán</span>
                <strong>{isCodPaymentMethod(firstSub?.paymentMethod) ? "Thanh toán khi nhận hàng (COD)" : "Ví Nexus"}</strong>
              </div>
              <div className="info-row">
                <span>Người nhận</span>
                <strong>{firstSub?.shippingAddress?.receiverName || "—"} · {firstSub?.contactPhone || "—"}</strong>
              </div>
              <div className="info-row">
                <span>Địa chỉ giao hàng</span>
                <strong>{deliveryAddressText}</strong>
              </div>
            </Card>
          </div>
        )}
      </div>

      <ProductQuickPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}
