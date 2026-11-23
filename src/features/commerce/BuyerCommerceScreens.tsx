"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { BackendImage } from "@/components/ui/BackendImage";
import { Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { ApiError, api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney, resolveImageUrl } from "@/lib/presentation";
import { OrderShipmentsCard } from "@/features/fulfillment/components/OrderShipmentsCard";
import { walletService } from "@/features/wallet";
import { CheckoutVoucherPanel } from "@/features/coupons/CheckoutVoucherPanel";
import { describeRejectedVoucher } from "@/features/coupons/voucher-outcome";
import { Modal } from "@/components/ui/Modal";
import { cartService } from "@/features/commerce/services/cart.service";
import { canContinueToCheckout, describeCartIssue, type CartValidation } from "@/features/commerce/cart-rules";
import { ChangeAddressButton, CompleteOrderButton, RepayButton } from "@/features/commerce/OrderActions";
import { canReportSubOrder, orderReportHref } from "@/features/commerce/order-report";
import { canChangeAddress, canCompleteOrder, canRepay } from "@/features/commerce/order-rules";
import { clearUnknownOrderMarker, describeCartFailure, describePlaceOrderFailure, describeQuoteFailure, readUnknownOrderMarker, writeUnknownOrderMarker } from "@/features/commerce/checkout-outcome";
import { GhnLocationSelect } from "@/features/shipping/GhnLocationSelect";
import { SavedAddressPicker } from "@/features/profile/SavedAddressPicker";
import { toGhnSelection } from "@/features/profile/address-rules";
import { EMPTY_GHN_SELECTION, buildShippingAddress, formatAddressLine, parseGhnSelection, validateGhnSelection, type GhnSelection } from "@/features/shipping/ghn-address";


type CartItem = { id: string; productId: string; skuId: string; sellerId: string; productName: string; quantity: number; unitPriceSnapshot: number };
type Cart = { id: string; buyerId: string; status: string; itemCount: number; subtotalAmount: number; items: CartItem[] };
type SubOrderItem = { orderItemId?: string; itemId?: string; productId: string; skuId: string; productName: string; skuCode?: string | null; quantity: number; unitPrice: number; lineTotal: number };
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
  shippingFeeAmount: number;
  totalAmount: number;
  createdAt: string;
  items: SubOrderItem[];
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
};
type CheckoutQuoteResponse = {
  quoteId: string;
  grandTotal: number;
  walletBalance: number;
  shops: Array<{ sellerId: string; shopName: string; itemsAmount: number; discountAmount: number; shippingFeeAmount: number; totalAmount: number }>;
  expiredAt: string;
  /** Vouchers the back end really applied, with what each took off. A code asked for but not listed here was left out. */
  appliedVouchers?: string[] | null;
  appliedVoucherDetails?: Array<{ code: string; scopeType: string; ownerSellerId?: string | null; discountAmount: number }> | null;
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

export function describeOrderStatus(status: string): string {
  const key = status.replace(/[^a-z]/gi, "").toUpperCase();
  return (
    {
      PENDINGPAYMENT: "Chờ thanh toán",
      PAID: "Đã thanh toán · Đã chuyển đến Seller",
      CONFIRMED: "Đơn hàng đã được khởi tạo thành công",
      SELLERACCEPTED: "Đơn hàng đã được khởi tạo thành công",
      SHIPPING: "Đang giao hàng",
      SHIPPED: "Đang giao hàng",
      DELIVERED: "Đã giao hàng · Chờ xác nhận nhận hàng",
      COMPLETED: "Đã nhận hàng · Hoàn tất",
      SELLERREJECTED: "Đã bị từ chối · Đã hoàn tiền",
      CANCELLED: "Đã hủy",
      REFUNDED: "Đã hoàn tiền",
    } as Record<string, string>
  )[key] ?? status;
}

function isSellerRejected(status: string): boolean {
  return status.replace(/[^a-z]/gi, "").toUpperCase() === "SELLERREJECTED";
}

function isSellerConfirmedOrDelivering(status: string): boolean {
  const key = status.replace(/[^a-z]/gi, "").toUpperCase();
  return key === "CONFIRMED" || key === "SELLERACCEPTED" || key === "SHIPPING" || key === "SHIPPED" || key === "DELIVERED";
}

function isSubOrderCompleted(status: string): boolean {
  return status.replace(/[^a-z]/gi, "").toUpperCase() === "COMPLETED";
}

function isOrderCancelled(status: string): boolean {
  const key = status.replace(/[^a-z]/gi, "").toUpperCase();
  return key === "CANCELLED" || key === "REFUNDED";
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
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string> | null>(null);
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
  const activeSelectedIds = selectedIds ?? new Set(itemIds);
  const selectedItems = items.filter((item) => activeSelectedIds.has(item.id));
  const allSelected = items.length > 0 && selectedItems.length === items.length;
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

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(itemIds));
  }
  function toggleItem(itemId: string) {
    const next = new Set(activeSelectedIds);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setSelectedIds(next);
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
      setSelectedIds((current) => {
        if (!current) return null;
        const next = new Set(current);
        next.delete(item.id);
        return next;
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
      await cartService.bulkRemove(selectedItems.map((item) => item.id));
      setSelectedIds(null);
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
      setSelectedIds(null);
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

  return <>
    <nav className="checkout-breadcrumb" aria-label="Đường dẫn"><Link href={ROUTES.home}>Trang chủ</Link><span aria-hidden="true">›</span><span aria-current="page">Giỏ hàng</span></nav>
    <div className="cart-page-heading"><div><h1>Giỏ hàng</h1><p>{items.length ? `${items.length} sản phẩm trong giỏ` : "Chọn sản phẩm cần mua trước khi đặt hàng."}</p></div><Link className="cart-continue-link" href={ROUTES.catalog.index}>Tiếp tục mua sắm</Link></div>
    {(cart.error || stock.error || actionError) && <p className="notice" role="alert">{actionError || cart.error?.message || stock.error?.message}</p>}
    <div className="buyer-cart-layout">
      <div className="buyer-cart-items">
        {items.length ? <>
          <label className="cart-select-all"><input type="checkbox" checked={allSelected} onChange={toggleAll} /><span>Chọn tất cả ({selectedItems.length}/{items.length})</span></label>
          <div className="action-row">
            <button type="button" className="button button-secondary button-small" disabled={!selectedItems.length || bulkBusy} onClick={() => void removeSelected()}>{bulkBusy ? "Đang xóa…" : `Xóa mục đã chọn (${selectedItems.length})`}</button>
            <button type="button" className="button button-secondary button-small" disabled={bulkBusy} onClick={() => setClearOpen(true)}>Xóa cả giỏ hàng</button>
          </div>
          {validation && !validation.isValid && <div className="notice" role="alert"><strong>Giỏ hàng cần chỉnh trước khi đặt hàng:</strong><ul>{validation.issues.map((issue) => <li key={`${issue.cartItemId}-${issue.issueType}`}>{describeCartIssue(issue, items.find((item) => item.id === issue.cartItemId)?.productName ?? "Sản phẩm")}</li>)}</ul></div>}
          {Object.entries(sellerGroups).map(([sellerId, group], groupIndex) => <section className="cart-seller-group" key={sellerId} aria-label={`Gian hàng ${groupIndex + 1}`}>
            <h2>{shops.data?.[sellerId] ?? `Gian hàng #${sellerId.slice(0, 8)}`}</h2>
            {group.map((item) => {
              const draft = draftQuantities[item.id] ?? String(item.quantity);
              const available = stock.data?.[item.skuId];
              const desiredQuantity = Number(draft);
              const quantityError = quantityErrors[item.id] || (stock.data && !Number.isInteger(desiredQuantity) ? "Nhập số lượng nguyên hợp lệ." : stock.data && desiredQuantity < 1 ? "Số lượng phải từ 1 trở lên." : available !== undefined && desiredQuantity > available ? `Kho chỉ còn ${available} sản phẩm.` : stock.data && available === undefined ? "Sản phẩm hiện không có tồn kho." : "");
              const detail = productDetails.data?.[item.productId];
              const variant = detail?.variants?.find((entry) => entry.variantId === item.skuId);
              const image = variant?.primaryImageUrl ?? variant?.images?.find((entry) => entry.isActive !== false)?.url ?? detail?.images?.find((entry) => entry.isActive !== false)?.url ?? null;
              return <article className="cart-product" key={item.id}>
                <input className="cart-product-check" type="checkbox" checked={selectedIds === null || selectedIds.has(item.id)} onChange={() => toggleItem(item.id)} aria-label={`Chọn ${item.productName}`} />
                <Link className="cart-product-image" href={ROUTES.catalog.product(item.productId)} aria-label={`Xem ${item.productName}`}><BackendImage src={resolveImageUrl(image)} alt="" compact /></Link>
                <div className="cart-product-info">
                  <Link className="cart-product-title" href={ROUTES.catalog.product(item.productId)}>{item.productName}</Link>
                  {(detail?.variants?.length ?? 0) > 1
                    ? <label className="field-wrap">Phiên bản<select className="field" value={item.skuId} disabled={busyId !== null} onChange={(event) => void changeVariant(item, event.target.value)}>{detail?.variants?.map((entry) => <option key={entry.variantId} value={entry.variantId}>{entry.name ?? entry.skuCode ?? entry.variantId}</option>)}</select></label>
                    : variant?.name && <p>Phiên bản: {variant.name}</p>}
                  <p>Mã SKU: {variant?.skuCode ?? item.skuId}</p>
                  <div className="cart-product-actions"><span className="cart-quantity-label">Số lượng</span><div className="cart-quantity-control" role="group" aria-label={`Số lượng ${item.productName}`}>
                    <button type="button" disabled={busyId !== null || stock.loading} aria-label={item.quantity === 1 ? `Xóa ${item.productName} khỏi giỏ hàng` : `Giảm số lượng ${item.productName}`} onClick={() => void (item.quantity === 1 ? removeItem(item) : updateQuantity(item, item.quantity - 1))}>
                      {item.quantity === 1 ? <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg> : <span aria-hidden="true">−</span>}
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
          </section>)}
        </> : <div className="cart-empty"><NoData title={cart.loading ? "Đang tải giỏ hàng…" : cart.error ? "Không tải được giỏ hàng" : "Giỏ hàng đang trống"} />{!cart.loading && !cart.error && <Link className="button button-primary" href={ROUTES.catalog.index}>Khám phá sản phẩm</Link>}</div>}
      </div>
      <aside className="buyer-cart-summary"><h2>Tóm tắt đơn hàng</h2><div className="cart-summary-line"><span>Sản phẩm đã chọn ({selectedItems.length})</span><strong>{formatMoney(selectedTotal)}</strong></div><div className="cart-summary-line"><span>Phí vận chuyển</span><strong>{selectedItems.length ? "Tính khi báo giá" : "—"}</strong></div><div className="cart-summary-total"><span>Tạm tính tiền hàng</span><strong>{formatMoney(selectedTotal)}</strong></div><button className="button button-primary" type="button" disabled={!selectedItems.length || hasQuantityError || stock.loading || Boolean(stock.error) || busyId !== null || validating} onClick={() => void continueToCheckout()}>{validating ? "Đang kiểm tra giỏ hàng…" : "Tiếp tục đặt hàng"}</button><p>{stock.error ? "Chưa kiểm tra được tồn kho. Vui lòng tải lại trang." : hasQuantityError ? "Điều chỉnh số lượng theo tồn kho trước khi tiếp tục." : selectedItems.length ? "Bước tiếp theo nhập địa chỉ nhận hàng và thanh toán bằng Ví Nexus." : "Chọn ít nhất một sản phẩm để tiếp tục."}</p></aside>
    </div>
    <Modal open={clearOpen} title="Xóa toàn bộ giỏ hàng?" busy={bulkBusy} onClose={() => setClearOpen(false)}
      footer={<><button type="button" className="button button-secondary" disabled={bulkBusy} onClick={() => setClearOpen(false)}>Giữ lại</button><button type="button" className="button button-primary" disabled={bulkBusy} onClick={() => void clearCart()}>{bulkBusy ? "Đang xóa…" : "Xóa cả giỏ hàng"}</button></>}>
      <p>Tất cả {items.length} sản phẩm sẽ bị xóa khỏi giỏ hàng. Thao tác này không hoàn tác được.</p>
    </Modal>
  </>;
}

type CartProductDetail = { images?: Array<{ url: string; isActive?: boolean }>; variants?: Array<{ variantId: string; name?: string; skuCode?: string; primaryImageUrl?: string | null; images?: Array<{ url: string; isActive?: boolean }> }> };
type InventoryBalance = { skuId: string; availableQuantity: number };

export function CheckoutScreen() {
  const router = useRouter();
  const cart = useCart();
  const wallet = useApiResource("checkout-buyer-wallet", (signal) => walletService.getBalance(signal));
  const searchParams = useSearchParams();
  const selectedParam = searchParams.get("items");
  const [form, setForm] = useState<ShippingForm>(loadShipping);
  const [errors, setErrors] = useState<ShippingErrors>({});
  const [extra, setExtra] = useState<ShippingExtra>(loadShippingExtra);
  const [ghn, setGhn] = useState<GhnSelection>(loadGhn);
  const [quoteState, setQuoteState] = useState<{ key: string; baseKey: string; data: CheckoutQuoteResponse } | null>(null);
  const [editingShipping, setEditingShipping] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [voucherCodes, setVoucherCodes] = useState<string[]>([]);
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
  const quoteExpired = Boolean(activeQuote && now >= Date.parse(activeQuote.expiredAt));
  const quoteReady = Boolean(activeQuote && !quoteExpired);
  const quotedShippingFee = activeQuote?.shops.reduce((sum, shop) => sum + shop.shippingFeeAmount, 0) ?? 0;
  const quotedDiscount = activeQuote?.shops.reduce((sum, shop) => sum + shop.discountAmount, 0) ?? 0;
  const quotedItemsAmount = activeQuote?.shops.reduce((sum, shop) => sum + shop.itemsAmount, 0) ?? 0;

  useEffect(() => {
    if (!quoteState) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [quoteState]);

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
  async function handleCheckoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (quoteLock.current || (quoteReady && !editingShipping)) return;
    setQuoteError("");
    setSubmitError("");
    const found = validateShipping(form, ghn);
    setErrors(found);
    if (Object.keys(found).length) {
      const order: Array<keyof ShippingErrors> = ["receiverName", "phone", "address", "province", "district", "ward"];
      const firstKey = order.find((key) => Boolean(found[key]));
      if (firstKey) {
        event.currentTarget.querySelector<HTMLElement>(`[name="${firstKey}"]`)?.focus();
      }
      return;
    }

    if (!items.length) {
      setQuoteError("Không có sản phẩm nào trong giỏ hàng để báo giá.");
      return;
    }

    const previous = quoteState && quoteState.baseKey === baseKey && Date.now() < Date.parse(quoteState.data.expiredAt) ? quoteState.data : null;
    setQuoteState(null);

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
      setQuoteState({ key: quoteKey, baseKey, data: quote });
      setEditingShipping(false);
    } catch (reason) {
      setQuoteError(describeQuoteFailure(reason).message);
    } finally {
      quoteLock.current = false;
      setQuoting(false);
    }
  }

  async function handlePlaceOrder() {
    if (orderLock.current || !activeQuote || unknownOutcome) return;
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
      const created = unwrap(
        await api.post<ApiResponse<CreateOrderResponse> | CreateOrderResponse>("/api/v1/orders", {
          quoteId: activeQuote.quoteId,
          paymentMethod,
          shippingAddress: fullAddress,
          contactPhone: form.phone.trim(),
          note: extra.note.trim() || undefined,
        }),
      );

      if (created.status.replace(/[^a-z]/gi, "").toUpperCase() !== "PAID") {
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
              <strong style={{ color: "var(--sky-dark)" }}>{formatMoney(completedOrder.totalAmount)}</strong>
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
    {cart.error && <p className="notice" role="alert">{cart.error.message}</p>}
    <div className="checkout-layout"><div className="checkout-main">
      <section className="checkout-panel" aria-labelledby="checkout-address-heading"><div className="checkout-panel-heading"><div><h1 id="checkout-address-heading">Địa chỉ nhận hàng</h1><p>Điền thông tin để xem tổng thanh toán trước khi đặt hàng.</p></div></div>
        {quoteReady && !editingShipping && <div className="checkout-address-review"><div><span>Liên hệ</span><strong>{form.receiverName} · {form.phone}</strong>{extra.email && <small>{extra.email}</small>}</div><div><span>Giao tới</span><strong>{formatAddressLine(form.address, ghn)}</strong></div><button className="button button-secondary" type="button" onClick={() => { setEditingShipping(true); setSubmitError(""); }}>Sửa thông tin</button></div>}
        <form className="checkout-form" onSubmit={(e) => void handleCheckoutSubmit(e)} noValidate>
          {(!quoteReady || editingShipping) && <>
          <SavedAddressPicker onPick={(saved) => { setForm({ receiverName: saved.recipientName, phone: saved.phone, address: saved.addressLine }); setGhn(toGhnSelection(saved)); setErrors({}); setSubmitError(""); setQuoteError(""); }} />
          <label className="field-wrap"><span>Họ tên người nhận <abbr className="checkout-required" title="Bắt buộc">*</abbr></span><input className="field" name="receiverName" required autoComplete="name" value={form.receiverName} onChange={(event) => setField("receiverName", event.target.value)} onBlur={() => blurField("receiverName")} aria-invalid={Boolean(errors.receiverName)} placeholder="Ví dụ: Nguyễn Văn A" />{errors.receiverName && <small className="checkout-field-error" role="alert">{errors.receiverName}</small>}</label>
          <div className="checkout-contact-row"><label className="field-wrap">Email liên hệ<input className="field" type="email" autoComplete="email" value={extra.email} onChange={(event) => setExtra((current) => ({ ...current, email: event.target.value }))} placeholder="contact@example.com" /></label>
          <label className="field-wrap"><span>Số điện thoại <abbr className="checkout-required" title="Bắt buộc">*</abbr></span><input className="field" name="phone" type="tel" required autoComplete="tel" inputMode="tel" value={form.phone} onChange={(event) => setField("phone", event.target.value)} onBlur={() => blurField("phone")} aria-invalid={Boolean(errors.phone)} placeholder="Ví dụ: 0901234567" />{errors.phone && <small className="checkout-field-error" role="alert">{errors.phone}</small>}</label></div>
          <label className="field-wrap"><span>Địa chỉ cụ thể <abbr className="checkout-required" title="Bắt buộc">*</abbr></span><input className="field" name="address" required autoComplete="street-address" value={form.address} onChange={(event) => setField("address", event.target.value)} onBlur={() => blurField("address")} aria-invalid={Boolean(errors.address)} placeholder="Số nhà, tên đường" />{errors.address && <small className="checkout-field-error" role="alert">{errors.address}</small>}</label>
          <label className="field-wrap">Quốc gia<input className="field checkout-country" value="Việt Nam" readOnly aria-readonly="true" /></label>
          <GhnLocationSelect value={ghn} errors={errors} onChange={(next) => { setGhn(next); setErrors((current) => ({ ...current, province: undefined, district: undefined, ward: undefined })); setSubmitError(""); }} />
          <label className="field-wrap">Ghi chú giao hàng<textarea className="field" rows={3} value={extra.note} onChange={(event) => setExtra((current) => ({ ...current, note: event.target.value }))} placeholder="Ví dụ: Giao hàng ngoài giờ hành chính" /></label>
          </>}

          <fieldset className="checkout-payment-methods" disabled={unknownOutcome || quoting || submitting}><legend>Phương thức thanh toán</legend><label className={"checkout-payment-choice" + (paymentMethod === "Wallet" ? " is-selected" : "")}><input type="radio" name="paymentMethod" value="Wallet" checked={paymentMethod === "Wallet"} onChange={() => setPaymentMethod("Wallet")} /><span><strong>Ví Nexus</strong><small>Số dư khả dụng: {activeQuote ? formatMoney(activeQuote.walletBalance) : wallet.loading ? "Đang kiểm tra…" : wallet.data ? formatMoney(availableBalance) : "Không xác định"}</small></span></label><label className={"checkout-payment-choice" + (paymentMethod === "Cod" ? " is-selected" : "")}><input type="radio" name="paymentMethod" value="Cod" checked={paymentMethod === "Cod"} onChange={() => setPaymentMethod("Cod")} /><span><strong>Thanh toán khi nhận hàng (COD)</strong><small>Trả tiền mặt cho đơn vị giao hàng. Không dùng được mã giảm giá của sàn.</small></span></label><label className="checkout-payment-choice is-disabled"><input type="radio" name="paymentMethod" value="Stripe" disabled /><span><strong>Stripe <small>Chưa khả dụng</small></strong><small>Thanh toán trực tiếp qua Stripe đang hoàn thiện.</small></span></label></fieldset>

          {(!quoteReady || editingShipping) && <div className="checkout-form-footer">
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
      return <div className="checkout-item" key={item.id}><span className="checkout-item-image"><BackendImage src={resolveImageUrl(image)} alt="" compact /><span className="checkout-item-count">{item.quantity}</span></span><div><strong>{item.productName}</strong><span>{variant?.name ?? `Số lượng: ${item.quantity}`}</span></div><strong>{formatMoney(item.unitPriceSnapshot * item.quantity)}</strong></div>;
    })}</div> : <NoData title={cart.loading ? "Đang tải giỏ hàng…" : "Chưa có sản phẩm được chọn"} />}
      <div className="checkout-summary-line"><span>Tiền hàng</span><strong>{items.length ? formatMoney(activeQuote ? quotedItemsAmount : subtotal) : "—"}</strong></div>
      <div className="checkout-summary-line"><span>Phí giao hàng</span><strong>{activeQuote ? formatMoney(quotedShippingFee) : items.length ? "Theo báo giá" : "—"}</strong></div>
      {items.length > 0 && <CheckoutVoucherPanel cartItemIds={items.map((item) => item.id)} selectedCodes={voucherCodes} cashOnDelivery={paymentMethod === "Cod"} disabled={unknownOutcome || quoting || submitting} onChange={setVoucherCodes} />}
      {activeQuote?.appliedVoucherDetails?.map((applied) => <div className="checkout-summary-line" key={applied.code}><span>Mã {applied.code}</span><strong>−{formatMoney(applied.discountAmount)}</strong></div>)}
      {activeQuote && quotedDiscount > 0 && !activeQuote.appliedVoucherDetails?.length && <div className="checkout-summary-line"><span>Giảm giá</span><strong>−{formatMoney(quotedDiscount)}</strong></div>}
      {activeQuote?.rejectedVouchers?.map((rejected) => <p className="checkout-field-error" role="status" key={rejected.code}>Mã {rejected.code} không được áp dụng: {describeRejectedVoucher(rejected.reasonCode)}</p>)}
      <div className="checkout-summary-total"><span>{activeQuote ? "Tổng thanh toán" : "Tạm tính tiền hàng"}</span><strong>{items.length ? formatMoney(activeQuote?.grandTotal ?? subtotal) : "—"}</strong></div>
      {unknownOutcome ? <div className="notice state-error" role="alert"><strong>Chưa xác định được kết quả đặt đơn</strong><p>Yêu cầu đặt hàng gần nhất có thể đã được xử lý. Để tránh đặt trùng, nút đặt hàng đang bị khóa.</p><p>Hãy kiểm tra <Link href={ROUTES.buyer.orders}>Đơn mua</Link> và <Link href={ROUTES.buyer.wallet}>Ví của bạn</Link>. Nếu đã có đơn hoặc ví đã bị trừ tiền, bạn không cần đặt lại. Nếu vẫn không chắc chắn, hãy liên hệ hỗ trợ để được đối soát trước khi đặt lại.</p></div> : quoteReady && activeQuote ? <><p>Báo giá có hiệu lực đến {new Date(activeQuote.expiredAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}. {paymentMethod === "Wallet" ? `Số dư ví theo thời điểm báo giá: ${formatMoney(activeQuote.walletBalance)}.` : "Bạn sẽ trả tiền mặt khi nhận hàng."}</p><button className="button checkout-place-order" type="button" disabled={submitting || (paymentMethod === "Wallet" && activeQuote.walletBalance < activeQuote.grandTotal)} onClick={() => void handlePlaceOrder()}>{submitting ? "Đang đặt hàng…" : paymentMethod === "Wallet" ? `Đặt hàng bằng Ví Nexus · ${formatMoney(activeQuote.grandTotal)}` : `Đặt hàng (thanh toán khi nhận) · ${formatMoney(activeQuote.grandTotal)}`}</button>{paymentMethod === "Wallet" && activeQuote.walletBalance < activeQuote.grandTotal && <p className="checkout-field-error">Số dư Ví Nexus không đủ. Vui lòng nạp thêm trước khi đặt hàng.</p>}</> : quoteExpired ? <p>Báo giá đã hết hạn. Vui lòng lấy báo giá mới.</p> : null}
      {submitError && !unknownOutcome && <><p className="checkout-field-error" role="alert">{submitError}</p><Link href={ROUTES.buyer.cart}>Quay lại giỏ hàng</Link></>}
    </aside></div>
  </>;
}

export function OrdersScreen() {
  const { user } = useSession();
  const [page, setPage] = useState(1);
  const buyerId = user?.id ?? "";
  const orders = useApiResource(
    buyerId ? `buyer-orders:${buyerId}:${page}` : null,
    (signal) =>
      api
        .get<ApiResponse<Paged<Order>> | Paged<Order>>(`/api/v1/orders?page=${page}&pageSize=20`, { signal })
        .then(unwrap),
  );
  return <>
    <PageHeading
      title="Đơn mua của tôi"
      description="Theo dõi trạng thái người bán xác nhận và bấm xác nhận khi bạn đã nhận được hàng."
    />
    {orders.error && <p className="notice" role="alert">{orders.error.message}</p>}
    <Card className="card-pad">
      {orders.data?.items.length ? (
        orders.data.items.map((order) => {
          const resolvedId = order.orderId ?? order.id ?? "";
          const resolvedNo = order.orderNo ?? `ORD-${resolvedId.slice(0, 8).toUpperCase()}`;
          return (
            <div className="info-row" key={resolvedId}>
              <div>
                <Link href={ROUTES.buyer.order(resolvedId)}>
                  <strong>Đơn hàng {resolvedNo}</strong>
                </Link>
                <p style={{ margin: "4px 0 0" }}>
                  <Badge>{describeOrderStatus(order.status)}</Badge>
                  {order.createdAt ? ` · Đặt lúc ${new Date(order.createdAt).toLocaleString("vi-VN")}` : ""}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong style={{ display: "block", marginBottom: 6 }}>{formatMoney(order.totalAmount)}</strong>
                <Link className="button button-secondary" href={ROUTES.buyer.order(resolvedId)}>
                  Xem &amp; Nhận hàng
                </Link>
              </div>
            </div>
          );
        })
      ) : (
        <NoData title={orders.loading ? "Đang tải đơn hàng…" : orders.error ? "Không tải được đơn hàng" : "Bạn chưa có đơn hàng"} />
      )}
      {orders.data && orders.data.pagination.totalPages > 1 && <div className="action-row"><button type="button" className="button button-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trang trước</button><span>Trang {page}/{orders.data.pagination.totalPages}</span><button type="button" className="button button-secondary" disabled={!orders.data.pagination.hasNextPage} onClick={() => setPage((value) => value + 1)}>Trang sau</button></div>}
    </Card>
  </>;
}

export function OrderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const orderId = String(id ?? "");
  const order = useApiResource(orderId ? `buyer-order:${orderId}` : null, (signal) => api.get<ApiResponse<Order> | Order>(`/api/v1/orders/${encodeURIComponent(orderId)}`, { signal }).then(unwrap));
  const [shipmentRefresh, setShipmentRefresh] = useState(0);
  const [confirmingSubOrderId, setConfirmingSubOrderId] = useState<string | null>(null);
  const [receiptConfirmationId, setReceiptConfirmationId] = useState<string | null>(null);
  const [confirmedSubOrderIds, setConfirmedSubOrderIds] = useState<string[]>([]);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [mountedAt] = useState(() => Date.now());

  function afterAction(message: string) {
    setConfirmError("");
    setConfirmMessage(message);
    order.reload();
    setShipmentRefresh((value) => value + 1);
  }

  async function confirmDelivery(subOrderId: string) {
    if (receiptConfirmationId !== subOrderId || confirmingSubOrderId) return;
    setConfirmingSubOrderId(subOrderId);
    setConfirmMessage("");
    setConfirmError("");
    try {
      await api.post(`/api/v1/sub-orders/${encodeURIComponent(subOrderId)}/confirm-receipt`, {});
      setConfirmedSubOrderIds((ids) => [...ids, subOrderId]);
      setReceiptConfirmationId(null);
      setConfirmMessage("Đã xác nhận nhận hàng. Hệ thống đang cập nhật trạng thái giải ngân cho người bán.");
      order.reload();
    } catch (reason) {
      setConfirmError(describeCartFailure(reason));
    } finally {
      setConfirmingSubOrderId(null);
    }
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
      setConfirmMessage("Đã hủy đơn hàng thành công! Tồn kho tạm giữ (Reserved) đã được nhả lại vào khả dụng (Available) và tiền đơn hàng (nếu đã thanh toán qua Ví) đã được hoàn trả.");
      order.reload();
      setShipmentRefresh((value) => value + 1);
    } catch (reason) {
      setConfirmError(describeCartFailure(reason));
    } finally {
      setCancellingOrder(false);
    }
  }

  const subOrders = order.data?.subOrders ?? [];
  const primaryStatus = subOrders[0]?.status ?? order.data?.status ?? "—";
  const canCancel = Boolean(order.data && canBuyerCancelOrder(order.data.status, subOrders));
  const canPayAgain = Boolean(order.data && canRepay(order.data, subOrders, mountedAt));
  const canComplete = Boolean(order.data && canCompleteOrder(order.data, subOrders));

  return <>
    <PageHeading
      title="Chi tiết đơn mua"
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
    {(order.error || confirmError) && <p className="notice" role="alert">{confirmError || order.error?.message}</p>}
    {confirmMessage && <p className="form-success" role="status">{confirmMessage}</p>}
    <div className="order-detail-layout">
      {subOrders.map((sub) => {
        const sellerAccepted = isSellerConfirmedOrDelivering(sub.status);
        const canConfirmReceipt = ["SHIPPING", "SHIPPED", "DELIVERED"].includes(sub.status.replace(/[^a-z]/gi, "").toUpperCase());
        const completed = isSubOrderCompleted(sub.status);
        const rejected = isSellerRejected(sub.status);
        const cancelled = isOrderCancelled(sub.status);
        const showReceiptAction = !completed && !rejected && !cancelled && !confirmedSubOrderIds.includes(sub.subOrderId);
        const awaitingReceiptConfirmation = receiptConfirmationId === sub.subOrderId;
        return (
          <Card className="card-pad" key={sub.subOrderId}>
            {showReceiptAction && (
              <div className="order-status-banner" role="status">
                <div>
                  <strong>{sellerAccepted ? `Người bán đang xử lý đơn hàng ${sub.subOrderNo}` : `Đơn hàng ${sub.subOrderNo} đang chờ xử lý`}</strong>
                  <p>
                    {canConfirmReceipt
                      ? "Chỉ xác nhận khi bạn đã thực sự nhận được hàng."
                      : "Bạn có thể xác nhận sau khi đơn chuyển sang đang giao hoặc đã giao và bạn thực sự nhận được hàng."}
                  </p>
                  {awaitingReceiptConfirmation && (
                    <p role="alert" style={{ marginTop: 8 }}>
                      Xác nhận sẽ hoàn tất đơn và bắt đầu giải ngân cho người bán. Chỉ tiếp tục khi bạn đã nhận được hàng.
                    </p>
                  )}
                </div>
                <div className="action-row" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={!canConfirmReceipt || confirmingSubOrderId !== null}
                    title={!canConfirmReceipt ? "Chờ đơn chuyển sang đang giao hoặc đã giao" : undefined}
                    onClick={() => {
                      if (awaitingReceiptConfirmation) void confirmDelivery(sub.subOrderId);
                      else {
                        setConfirmError("");
                        setReceiptConfirmationId(sub.subOrderId);
                      }
                    }}
                  >
                    {confirmingSubOrderId === sub.subOrderId ? "Đang xác nhận…" : awaitingReceiptConfirmation ? "Xác nhận đã nhận hàng" : "Đã nhận được hàng"}
                  </button>
                  {awaitingReceiptConfirmation && (
                    <button type="button" className="button button-secondary" disabled={confirmingSubOrderId !== null} onClick={() => setReceiptConfirmationId(null)}>
                      Quay lại
                    </button>
                  )}
                </div>
              </div>
            )}
            {rejected && (
              <div className="notice" role="alert" style={{ marginBottom: 16 }}>
                <strong>Đơn hàng đã bị người bán từ chối.</strong> Vui lòng kiểm tra lịch sử <strong>Ví Nexus</strong> để xác nhận khoản hoàn tiền của đơn này.
              </div>
            )}
            {cancelled && !rejected && (
              <div className="notice" role="status" style={{ marginBottom: 16 }}>
                <strong>Đơn hàng đã hủy.</strong> Tồn kho giữ chỗ của đơn đã được nhả lại vào kho khả dụng và khoản thanh toán Ví (nếu có) đã được hoàn trả.
              </div>
            )}
            {completed && (
              <>
                <div className="form-success" role="status" style={{ marginBottom: 16 }}>
                  <strong>Đơn hàng đã hoàn tất!</strong> Bạn đã xác nhận nhận hàng thành công. Trạng thái giải ngân được cập nhật trong ví của người bán.
                </div>
                <div className="action-row" style={{ marginBottom: 16 }}>
                  <Link className="button button-secondary" href={ROUTES.buyer.orderReview(orderId)}>
                    Đánh giá sản phẩm và gian hàng
                  </Link>
                </div>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Đơn gian hàng {sub.subOrderNo} · {sub.shopName}</h2>
              <Badge>{describeOrderStatus(sub.status)}</Badge>
            </div>
            {canChangeAddress(sub) && <div className="action-row" style={{ marginBottom: 12 }}><ChangeAddressButton subOrderId={sub.subOrderId} onDone={afterAction} /></div>}
            <div className="info-row">
              <span>Phương thức thanh toán</span>
              <strong>Ví Nexus ({sub.paymentMethod})</strong>
            </div>
            <div className="info-row">
              <span>Người nhận</span>
              <strong>{sub.shippingAddress?.receiverName} · {sub.contactPhone}</strong>
            </div>
            <div className="info-row">
              <span>Địa chỉ nhận hàng</span>
              <strong>{sub.shippingAddress?.fullAddress || `${sub.shippingAddress?.street}, ${sub.shippingAddress?.ward}, ${sub.shippingAddress?.province}`}</strong>
            </div>
            <div className="table-scroll" style={{ marginTop: 14 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Số lượng</th>
                    <th>Đơn giá</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {sub.items.map((item, idx) => (
                    <tr key={item.orderItemId ?? item.itemId ?? `${item.skuId}-${idx}`}>
                      <td><strong>{item.productName}</strong></td>
                      <td>{item.quantity}</td>
                      <td>{formatMoney(item.unitPrice)}</td>
                      <td><strong>{formatMoney(item.lineTotal)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="info-row" style={{ marginTop: 12 }}>
              <span>Tiền hàng</span>
              <strong>{formatMoney(sub.itemsAmount)}</strong>
            </div>
            <div className="info-row">
              <span>Phí giao hàng</span>
              <strong>{formatMoney(sub.shippingFeeAmount)}</strong>
            </div>
            <div className="info-row">
              <span>Tổng thanh toán đơn</span>
              <strong style={{ color: "var(--sky-dark)" }}>{formatMoney(sub.totalAmount)}</strong>
            </div>
          </Card>
        );
      })}
      <div className="grid-3">
        <Card className="card-pad"><h2>Trạng thái</h2><Badge>{describeOrderStatus(primaryStatus)}</Badge></Card>
        <Card className="card-pad"><h2>Mã đơn hàng</h2><strong className="seller-wrap-value">{order.data?.orderNo ?? orderId}</strong></Card>
        <Card className="card-pad"><h2>Tổng thanh toán</h2><strong>{order.data ? formatMoney(order.data.totalAmount) : "—"}</strong></Card>
      </div>
      <div className="split">
        <Card className="card-pad">
          <h2>Thông tin đơn</h2>
          {order.data ? (
            <>
              <div className="info-row"><span>Mã Buyer</span><strong>{order.data.buyerId}</strong></div>
              <div className="info-row"><span>Ngày tạo đơn</span><strong>{order.data.createdAt ? new Date(order.data.createdAt).toLocaleString("vi-VN") : "—"}</strong></div>
              {subOrders.filter((sub) => canReportSubOrder(sub.status)).map((sub) => (
                <div className="info-row" key={sub.subOrderId}><span>{sub.shopName || sub.subOrderNo}</span><Link href={orderReportHref(sub)}>Báo cáo vấn đề với người bán</Link></div>
              ))}
            </>
          ) : (
            <NoData title={order.loading ? "Đang tải đơn hàng…" : "Không có dữ liệu đơn hàng"} />
          )}
        </Card>
        <OrderShipmentsCard key={shipmentRefresh} orderId={orderId} />
      </div>
    </div>
  </>;
}
