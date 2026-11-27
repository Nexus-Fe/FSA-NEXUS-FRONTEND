"use client";

import Link from "next/link";
import { useState } from "react";
import { CopyableId } from "@/components/ui/CopyableId";
import { FluidChoiceBar } from "@/components/ui/FluidChoiceBar";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Badge, NoData, TruncatedText } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import type { PublicSellerSummary } from "@/features/catalog/services/catalog.service";
import type { ShipmentDetail } from "@/features/fulfillment";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import {
  AUCTION_ORDER_STATUS,
  ORDER_STATUS,
  SUB_ORDER_STATUS,
  semanticStatusTone,
  statusLabel,
} from "@/lib/status-labels";
import { userStatusLabel, userStatusTone } from "../services/admin-helpers";
import type { AdminUser } from "../services/admin-users.service";
import {
  adminShipmentsService,
  type AdminAuctionOrderDetail,
  type AdminOrderDetail,
  type AdminSubOrderDetail,
  type WarehouseDetail,
} from "../services/admin-shipments.service";

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN");
}

function displayUserName(user?: AdminUser | null): string {
  if (!user) return "—";
  const full = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return user.displayName?.trim() || full || user.username || user.email || "—";
}

function voucherScopeLabel(scopeType?: string | null): string {
  const key = (scopeType ?? "").toUpperCase();
  if (key === "SHOP") return "Voucher Shop";
  if (key === "SYSTEM" || key === "PLATFORM") return "Voucher Sàn";
  if (key === "FREESHIPPING" || key === "SHIPPING") return "Miễn phí vận chuyển";
  if (key === "PRODUCT") return "Voucher Sản phẩm";
  return scopeType || "Voucher";
}

function paymentMethodLabel(method?: string | null): string {
  const key = (method ?? "").toUpperCase();
  if (key === "WALLET") return "Ví Nexus";
  if (key === "COD") return "Thanh toán khi nhận hàng (COD)";
  return method || "—";
}

export type SellerDetailModalProps = {
  open: boolean;
  sellerId: string | null;
  warehouseId: string | null;
  initialTab?: "account" | "warehouse";
  warehouseData: WarehouseDetail | null;
  sellerAccountData: AdminUser | null;
  sellerPublicData: PublicSellerSummary | null;
  loading?: boolean;
  onClose: () => void;
};

export function SellerDetailModal({
  open,
  sellerId,
  warehouseId,
  initialTab = "account",
  warehouseData,
  sellerAccountData,
  sellerPublicData,
  loading = false,
  onClose,
}: SellerDetailModalProps) {
  const [tab, setTab] = useState<"account" | "warehouse">(initialTab);

  const needWarehouse = open && !warehouseData && Boolean(warehouseId);
  const needSeller = open && !sellerAccountData && !sellerPublicData && Boolean(sellerId);
  const fetchKey =
    needWarehouse || needSeller
      ? `admin-shipment-seller-modal:${sellerId ?? ""}:${warehouseId ?? ""}`
      : null;

  const fallbackResource = useApiResource(fetchKey, async (signal) => {
    const [wh, acc, pub] = await Promise.all([
      needWarehouse && warehouseId
        ? adminShipmentsService.getWarehouseById(warehouseId, signal).catch(() => null)
        : Promise.resolve(null),
      needSeller && sellerId
        ? adminShipmentsService.getAdminUserDetail(sellerId, signal)
        : Promise.resolve(null),
      needSeller && sellerId
        ? adminShipmentsService.getPublicSellerProfile(sellerId, signal)
        : Promise.resolve(null),
    ]);
    return { wh, acc, pub };
  });

  const warehouse = warehouseData ?? fallbackResource.data?.wh ?? null;
  const account = sellerAccountData ?? fallbackResource.data?.acc ?? null;
  const pub = sellerPublicData ?? fallbackResource.data?.pub ?? null;
  const shopName =
    account?.sellerProfile?.shopName ||
    pub?.shopName ||
    warehouse?.name ||
    (sellerId ? `Shop ${sellerId.slice(0, 8)}` : "Người bán");
  const isBusy = loading || fallbackResource.loading;

  return (
    <Modal
      open={open}
      title={`Người giao (Seller): ${shopName}`}
      onClose={onClose}
      panelClassName="admin-shipment-modal"
      footer={
        <div className="admin-shipment-modal-footer">
          {sellerId && (
            <Link
              href={ROUTES.catalog.shop(sellerId)}
              className="button button-secondary button-small"
            >
              <Icon name="store" size={14} />
              Xem trang gian hàng
            </Link>
          )}
          <button type="button" className="button button-primary button-small" onClick={onClose}>
            Đóng
          </button>
        </div>
      }
    >
      <div className="admin-shipment-modal-stack">
        <FluidChoiceBar
          ariaLabel="Thông tin người bán"
          mode="tabs"
          compact
          value={tab}
          onChange={setTab}
          options={[
            { value: "account", label: "Thông tin tài khoản" },
            { value: "warehouse", label: "Thông tin kho" },
          ]}
        />

        {isBusy && !account && !warehouse && !pub ? (
          <NoData title="Đang tải thông tin người giao…" />
        ) : tab === "account" ? (
          <div className="admin-shipment-modal-sections">
            <div className="admin-shipment-kv-grid">
              <div className="info-row">
                <span>Seller / User ID</span>
                <strong>{sellerId ? <CopyableId id={sellerId} showFull /> : "—"}</strong>
              </div>
              <div className="info-row">
                <span>Tên gian hàng</span>
                <strong>{shopName}</strong>
              </div>
              <div className="info-row">
                <span>Chủ tài khoản</span>
                <strong>{displayUserName(account)}</strong>
              </div>
              <div className="info-row">
                <span>Email tài khoản</span>
                <strong>{account?.email ?? "—"}</strong>
              </div>
              <div className="info-row">
                <span>Số điện thoại</span>
                <strong>{account?.phoneNumber ?? account?.sellerProfile?.hotline ?? pub?.hotline ?? "—"}</strong>
              </div>
              <div className="info-row">
                <span>Trạng thái tài khoản</span>
                <span>
                  {account?.status ? (
                    <Badge tone={userStatusTone(account.status)}>{userStatusLabel(account.status)}</Badge>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              <div className="info-row">
                <span>Vai trò</span>
                <strong>{account?.roles?.join(", ") || "Seller"}</strong>
              </div>
              <div className="info-row">
                <span>Điểm uy tín Seller</span>
                <strong className="tabular-nums">
                  {account?.sellerReputationScore != null
                    ? `${account.sellerReputationScore} (${account.sellerTrustLevel ?? "Standard"})`
                    : "—"}
                </strong>
              </div>
              <div className="info-row">
                <span>Hotline gian hàng</span>
                <strong>{account?.sellerProfile?.hotline ?? pub?.hotline ?? "—"}</strong>
              </div>
              <div className="info-row">
                <span>Email doanh nghiệp</span>
                <strong>{account?.sellerProfile?.businessEmail ?? "—"}</strong>
              </div>
              <div className="info-row">
                <span>Đánh giá & sản phẩm</span>
                <strong className="tabular-nums">
                  {pub?.ratingAvg != null ? `${pub.ratingAvg.toFixed(1)}★` : "—"} ·{" "}
                  {pub?.totalProducts != null ? `${pub.totalProducts} sản phẩm` : "—"}
                </strong>
              </div>
              <div className="info-row">
                <span>Trạng thái Shop</span>
                <span>
                  {account?.sellerProfile?.status ? (
                    <Badge tone={semanticStatusTone(account.sellerProfile.status)}>
                      {account.sellerProfile.status}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-shipment-modal-sections">
            {warehouse ? (
              <div className="admin-shipment-kv-grid">
                <div className="info-row">
                  <span>Warehouse ID</span>
                  <strong><CopyableId id={warehouse.id} showFull /></strong>
                </div>
                <div className="info-row">
                  <span>Mã kho</span>
                  <strong className="mono">{warehouse.code || "—"}</strong>
                </div>
                <div className="info-row">
                  <span>Tên kho lấy hàng</span>
                  <strong>{warehouse.name || "—"}</strong>
                </div>
                <div className="info-row">
                  <span>SĐT liên hệ kho</span>
                  <strong>{warehouse.contactPhone ?? "—"}</strong>
                </div>
                <div className="info-row">
                  <span>Trạng thái kho</span>
                  <span>
                    <Badge tone={warehouse.isDisabled ? "red" : "green"}>
                      {warehouse.isDisabled ? "Tạm ngưng" : "Đang hoạt động"}
                    </Badge>
                  </span>
                </div>
                <div className="info-row">
                  <span>Tỉnh / Thành phố</span>
                  <strong>
                    {warehouse.provinceName ?? "—"}
                    {warehouse.provinceId != null ? ` (#${warehouse.provinceId})` : ""}
                  </strong>
                </div>
                <div className="info-row">
                  <span>GHN District ID</span>
                  <strong className="tabular-nums">{warehouse.districtId ?? "—"}</strong>
                </div>
                <div className="info-row">
                  <span>GHN Ward Code</span>
                  <strong className="mono">{warehouse.wardCode ?? "—"}</strong>
                </div>
                <div className="info-row">
                  <span>GHN Shop ID</span>
                  <strong className="tabular-nums">{warehouse.ghnShopId ?? "Chưa gắn"}</strong>
                </div>
                <div className="info-row admin-shipment-kv-full">
                  <span>Địa chỉ lấy hàng</span>
                  <strong>{warehouse.address ?? account?.sellerProfile?.pickupAddress ?? "—"}</strong>
                </div>
              </div>
            ) : (
              <NoData title="Không tải được thông tin kho lấy hàng." />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export type BuyerDetailModalProps = {
  open: boolean;
  buyerId: string | null;
  shipment: ShipmentDetail | null;
  buyerAccountData: AdminUser | null;
  loading?: boolean;
  onClose: () => void;
};

export function BuyerDetailModal({
  open,
  buyerId,
  shipment,
  buyerAccountData,
  loading = false,
  onClose,
}: BuyerDetailModalProps) {
  const fetchKey = open && !buyerAccountData && buyerId ? `admin-shipment-buyer-modal:${buyerId}` : null;
  const buyerResource = useApiResource(fetchKey, (signal) =>
    adminShipmentsService.getAdminUserDetail(buyerId!, signal),
  );

  const account = buyerAccountData ?? buyerResource.data ?? null;
  const isBusy = loading || buyerResource.loading;

  return (
    <Modal
      open={open}
      title={`Người nhận (Buyer): ${shipment?.receiverName || displayUserName(account)}`}
      onClose={onClose}
      panelClassName="admin-shipment-modal"
      footer={
        <div className="admin-shipment-modal-footer">
          <button type="button" className="button button-primary button-small" onClick={onClose}>
            Đóng
          </button>
        </div>
      }
    >
      <div className="admin-shipment-modal-sections">
        <div className="admin-shipment-modal-block">
          <h3>Thông tin nhận hàng trên vận đơn</h3>
          <div className="admin-shipment-kv-grid">
            <div className="info-row">
              <span>Tên người nhận</span>
              <strong>{shipment?.receiverName ?? "—"}</strong>
            </div>
            <div className="info-row">
              <span>SĐT người nhận</span>
              <strong className="tabular-nums">{shipment?.receiverPhone ?? "—"}</strong>
            </div>
            <div className="info-row">
              <span>Tỉnh / Thành</span>
              <strong>{shipment?.toProvinceName ?? "—"}</strong>
            </div>
            <div className="info-row">
              <span>GHN District / Ward</span>
              <strong className="tabular-nums">
                {shipment?.toDistrictId ?? "—"} / {shipment?.toWardCode ?? "—"}
              </strong>
            </div>
            <div className="info-row admin-shipment-kv-full">
              <span>Địa chỉ giao hàng</span>
              <strong>{shipment?.receiverAddress ?? "—"}</strong>
            </div>
          </div>
        </div>

        <div className="admin-shipment-modal-block">
          <h3>Thông tin tài khoản người mua</h3>
          {isBusy && !account ? (
            <NoData title="Đang tải hồ sơ tài khoản người mua…" />
          ) : account ? (
            <div className="admin-shipment-kv-grid">
              <div className="info-row">
                <span>Buyer ID</span>
                <strong>{buyerId ? <CopyableId id={buyerId} showFull /> : "—"}</strong>
              </div>
              <div className="info-row">
                <span>Họ và tên</span>
                <strong>{displayUserName(account)}</strong>
              </div>
              <div className="info-row">
                <span>Email</span>
                <strong>{account.email}</strong>
              </div>
              <div className="info-row">
                <span>SĐT tài khoản</span>
                <strong className="tabular-nums">{account.phoneNumber ?? "—"}</strong>
              </div>
              <div className="info-row">
                <span>Trạng thái</span>
                <span>
                  <Badge tone={userStatusTone(account.status)}>{userStatusLabel(account.status)}</Badge>
                </span>
              </div>
              <div className="info-row">
                <span>Điểm uy tín Buyer</span>
                <strong className="tabular-nums">
                  {account.reputationScore ?? 50} ({account.trustLevel ?? "Standard"})
                </strong>
              </div>
              {account.address && (
                <div className="info-row admin-shipment-kv-full">
                  <span>Địa chỉ mặc định</span>
                  <strong>{account.address}</strong>
                </div>
              )}
            </div>
          ) : (
            <NoData title={buyerId ? "Không tải được hồ sơ người mua." : "Vận đơn chưa gắn Buyer ID."} />
          )}
        </div>
      </div>
    </Modal>
  );
}

export type OrderSubOrderDetailModalProps = {
  open: boolean;
  mode: "suborder" | "order";
  targetId: string | null;
  activeSubOrderId?: string | null;
  initialSubOrder?: AdminSubOrderDetail | null;
  initialOrder?: AdminOrderDetail | null;
  initialAuctionOrder?: AdminAuctionOrderDetail | null;
  onSwitchTarget: (nextMode: "suborder" | "order", nextTargetId: string) => void;
  onBeforeNavigateProduct?: () => void;
  onClose: () => void;
};

type OrderModalPayload = {
  subOrder: AdminSubOrderDetail | null;
  order: AdminOrderDetail | null;
  auctionOrder: AdminAuctionOrderDetail | null;
};

export function OrderSubOrderDetailModal({
  open,
  mode,
  targetId,
  activeSubOrderId,
  initialSubOrder,
  initialOrder,
  initialAuctionOrder,
  onSwitchTarget,
  onBeforeNavigateProduct,
  onClose,
}: OrderSubOrderDetailModalProps) {
  const preloadedSubOrder =
    mode === "suborder" && targetId
      ? initialSubOrder?.subOrderId === targetId
        ? initialSubOrder
        : initialOrder?.subOrders?.find((s) => s.subOrderId === targetId) ?? null
      : null;

  const preloadedAuctionOrder =
    mode === "suborder" && targetId && initialAuctionOrder?.id === targetId
      ? initialAuctionOrder
      : null;

  const preloadedOrder =
    mode === "order" && targetId && initialOrder?.id === targetId
      ? initialOrder
      : null;

  const needsFetch =
    open &&
    Boolean(targetId) &&
    ((mode === "suborder" && !preloadedSubOrder && !preloadedAuctionOrder) ||
      (mode === "order" && !preloadedOrder));

  const fetchKey = needsFetch ? `admin-shipment-order-modal:${mode}:${targetId}` : null;

  const orderResource = useApiResource<OrderModalPayload>(fetchKey, async (signal) => {
    if (!targetId) return { subOrder: null, order: null, auctionOrder: null };
    if (mode === "suborder") {
      try {
        const sub = await adminShipmentsService.getSubOrderDetail(targetId, signal);
        return { subOrder: sub, order: null, auctionOrder: null };
      } catch {
        const ao = await adminShipmentsService.getAuctionOrderDetail(targetId, signal);
        if (ao) return { subOrder: null, order: null, auctionOrder: ao };
        throw new Error("Không tải được chi tiết SubOrder từ Commerce.");
      }
    }
    const ord = await adminShipmentsService.getOrderDetail(targetId, signal);
    return { subOrder: null, order: ord, auctionOrder: null };
  });

  const subOrder = preloadedSubOrder ?? orderResource.data?.subOrder ?? null;
  const auctionOrder = preloadedAuctionOrder ?? orderResource.data?.auctionOrder ?? null;
  const order = preloadedOrder ?? orderResource.data?.order ?? null;

  const title =
    mode === "order"
      ? `Đơn hàng cha${order?.orderNo ? `: ${order.orderNo}` : ""}`
      : auctionOrder
        ? `Đơn đấu giá: ${auctionOrder.orderNo}`
        : `Chi tiết SubOrder${subOrder?.subOrderNo ? `: ${subOrder.subOrderNo}` : ""}`;

  const parentOrderIdForSub = subOrder?.orderId;

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      panelClassName="admin-shipment-modal admin-shipment-modal-wide"
      footer={
        <div className="admin-shipment-modal-footer">
          {mode === "suborder" && parentOrderIdForSub && (
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={() => onSwitchTarget("order", parentOrderIdForSub)}
            >
              <Icon name="layers" size={14} />
              Xem đơn cha ({`ORD-${parentOrderIdForSub.slice(0, 8).toUpperCase()}`})
            </button>
          )}
          <button type="button" className="button button-primary button-small" onClick={onClose}>
            Đóng
          </button>
        </div>
      }
    >
      {orderResource.loading ? (
        <NoData title="Đang tải dữ liệu đơn hàng…" />
      ) : orderResource.error ? (
        <p className="notice" role="alert">
          {orderResource.error.message}
        </p>
      ) : mode === "suborder" && auctionOrder ? (
        <div className="admin-shipment-modal-sections">
          <div className="admin-shipment-modal-head-strip">
            <div className="admin-shipment-modal-badges">
              <Badge tone={semanticStatusTone(auctionOrder.status)}>
                {statusLabel(AUCTION_ORDER_STATUS, auctionOrder.status)}
              </Badge>
              <Badge tone="indigo">{paymentMethodLabel(auctionOrder.paymentMethod)}</Badge>
              <Badge tone="slate">Đơn đấu giá</Badge>
            </div>
            <span className="admin-shipment-muted">Tạo lúc: {formatDateTime(auctionOrder.createdAt)}</span>
          </div>

          <div className="admin-shipment-kv-grid">
            <div className="info-row">
              <span>Mã đơn đấu giá</span>
              <strong className="mono">{auctionOrder.orderNo}</strong>
            </div>
            <div className="info-row">
              <span>Auction ID</span>
              <strong><CopyableId id={auctionOrder.auctionId} showFull /></strong>
            </div>
            <div className="info-row">
              <span>Buyer ID</span>
              <strong><CopyableId id={auctionOrder.buyerId} showFull /></strong>
            </div>
            <div className="info-row">
              <span>Seller ID</span>
              <strong><CopyableId id={auctionOrder.sellerId} showFull /></strong>
            </div>
            <div className="info-row admin-shipment-kv-full">
              <span>Địa chỉ giao hàng</span>
              <strong>{auctionOrder.shippingAddress ?? "—"}</strong>
            </div>
          </div>

          <div className="admin-shipment-modal-block">
            <h3>Sản phẩm đấu giá</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Giá trúng đấu giá</th>
                    <th>Tiền cọc</th>
                    <th>Phí ship</th>
                    <th className="text-right">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <Link
                        href={ROUTES.catalog.product(auctionOrder.productId)}
                        className="admin-shipment-product-link"
                        onClick={onBeforeNavigateProduct}
                      >
                        <TruncatedText text={auctionOrder.productName} label="Tên sản phẩm" maxWidth={260} />
                        <Icon name="externalLink" size={13} />
                      </Link>
                      {auctionOrder.skuAttributes && (
                        <div className="admin-shipment-muted">{auctionOrder.skuAttributes}</div>
                      )}
                    </td>
                    <td className="tabular-nums">{formatMoney(auctionOrder.winningAmount)}</td>
                    <td className="tabular-nums">{formatMoney(auctionOrder.depositAmount)}</td>
                    <td className="tabular-nums">{formatMoney(auctionOrder.shippingFeeAmount ?? 0)}</td>
                    <td className="text-right tabular-nums">
                      <strong>{formatMoney(auctionOrder.totalAmount ?? auctionOrder.winningAmount)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : mode === "suborder" && subOrder ? (
        <div className="admin-shipment-modal-sections">
          <div className="admin-shipment-modal-head-strip">
            <div className="admin-shipment-modal-badges">
              <Badge tone={semanticStatusTone(subOrder.status)}>
                {statusLabel(SUB_ORDER_STATUS, subOrder.status)}
              </Badge>
              <Badge tone="indigo">{paymentMethodLabel(subOrder.paymentMethod)}</Badge>
            </div>
            <span className="admin-shipment-muted">Tạo lúc: {formatDateTime(subOrder.createdAt)}</span>
          </div>

          <div className="admin-shipment-kv-grid">
            <div className="info-row">
              <span>SubOrder No</span>
              <strong className="mono">{subOrder.subOrderNo}</strong>
            </div>
            <div className="info-row">
              <span>Order cha (Master Order)</span>
              <button
                type="button"
                className="admin-shipment-inline-link"
                onClick={() => onSwitchTarget("order", subOrder.orderId)}
              >
                <span className="mono">{`ORD-${subOrder.orderId.slice(0, 8).toUpperCase()}`}</span>
                <Icon name="arrow" size={13} />
              </button>
            </div>
            <div className="info-row">
              <span>Gian hàng (Shop)</span>
              <strong>{subOrder.shopName}</strong>
            </div>
            <div className="info-row">
              <span>Seller ID</span>
              <strong><CopyableId id={subOrder.sellerId} showFull /></strong>
            </div>
            <div className="info-row">
              <span>Buyer ID</span>
              <strong><CopyableId id={subOrder.buyerId} showFull /></strong>
            </div>
            <div className="info-row">
              <span>Mã vận đơn GHN</span>
              <strong className="mono">{subOrder.trackingCode ?? "—"}</strong>
            </div>
            <div className="info-row admin-shipment-kv-full">
              <span>Địa chỉ giao hàng</span>
              <strong>
                {subOrder.shippingAddress?.fullAddressText ||
                  [
                    subOrder.shippingAddress?.receiverName,
                    subOrder.contactPhone || subOrder.shippingAddress?.contactPhone,
                    subOrder.shippingAddress?.street,
                    subOrder.shippingAddress?.ward,
                    subOrder.shippingAddress?.district,
                    subOrder.shippingAddress?.province,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
              </strong>
            </div>
          </div>

          <div className="admin-shipment-modal-block">
            <h3>Sản phẩm trong SubOrder ({subOrder.items.length})</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>SKU</th>
                    <th className="text-right">SL</th>
                    <th className="text-right">Đơn giá đặt</th>
                    <th className="text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {subOrder.items.map((item) => (
                    <tr key={item.orderItemId}>
                      <td>
                        <Link
                          href={ROUTES.catalog.product(item.productId)}
                          className="admin-shipment-product-link"
                          onClick={onBeforeNavigateProduct}
                        >
                          <TruncatedText text={item.productName} label="Tên sản phẩm" maxWidth={250} />
                          <Icon name="externalLink" size={13} />
                        </Link>
                      </td>
                      <td>
                        {item.skuCode ? <span className="mono">{item.skuCode}</span> : <CopyableId id={item.skuId} />}
                      </td>
                      <td className="text-right tabular-nums">{item.quantity}</td>
                      <td className="text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
                      <td className="text-right tabular-nums">
                        <strong>{formatMoney(item.lineTotal)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-shipment-modal-two-col">
            <div className="admin-shipment-modal-block">
              <h3>Mã giảm giá (Voucher) đã dùng</h3>
              {subOrder.appliedVouchers && subOrder.appliedVouchers.length > 0 ? (
                <ul className="admin-shipment-voucher-list">
                  {subOrder.appliedVouchers.map((v, idx) => (
                    <li key={`${v.code}-${idx}`} className="admin-shipment-voucher-item">
                      <div>
                        <strong className="mono">{v.code}</strong>
                        <span className="admin-shipment-muted">{voucherScopeLabel(v.scopeType)}</span>
                      </div>
                      <strong className="tabular-nums admin-shipment-discount">
                        -{formatMoney(v.discountAmount)}
                      </strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-shipment-muted">Không có mã giảm giá nào được áp dụng cho SubOrder này.</p>
              )}
            </div>

            <div className="admin-shipment-modal-block">
              <h3>Tổng hợp thanh toán</h3>
              <div className="info-row">
                <span>Tạm tính tiền hàng</span>
                <strong className="tabular-nums">{formatMoney(subOrder.itemsAmount)}</strong>
              </div>
              {subOrder.productDiscountAmount > 0 && (
                <div className="info-row">
                  <span>Giảm giá sản phẩm</span>
                  <strong className="tabular-nums admin-shipment-discount">
                    -{formatMoney(subOrder.productDiscountAmount)}
                  </strong>
                </div>
              )}
              {subOrder.shopDiscountAmount > 0 && (
                <div className="info-row">
                  <span>Voucher của Shop</span>
                  <strong className="tabular-nums admin-shipment-discount">
                    -{formatMoney(subOrder.shopDiscountAmount)}
                  </strong>
                </div>
              )}
              {subOrder.systemDiscountAmount > 0 && (
                <div className="info-row">
                  <span>Voucher của Sàn</span>
                  <strong className="tabular-nums admin-shipment-discount">
                    -{formatMoney(subOrder.systemDiscountAmount)}
                  </strong>
                </div>
              )}
              <div className="info-row">
                <span>Phí vận chuyển</span>
                <strong className="tabular-nums">{formatMoney(subOrder.shippingFeeAmount)}</strong>
              </div>
              <div className="info-row admin-shipment-total-row">
                <span>Tổng thanh toán</span>
                <strong className="tabular-nums">{formatMoney(subOrder.totalAmount)}</strong>
              </div>
            </div>
          </div>
        </div>
      ) : mode === "order" && order ? (
        <div className="admin-shipment-modal-sections">
          <div className="admin-shipment-modal-head-strip">
            <div className="admin-shipment-modal-badges">
              <Badge tone={semanticStatusTone(order.status)}>
                {statusLabel(ORDER_STATUS, order.status)}
              </Badge>
              <Badge tone="slate">{order.subOrders.length} đơn con (SubOrder)</Badge>
            </div>
            <span className="admin-shipment-muted">Đặt lúc: {formatDateTime(order.createdAt)}</span>
          </div>

          <div className="admin-shipment-kv-grid">
            <div className="info-row">
              <span>Order No (Đơn cha)</span>
              <strong className="mono">{order.orderNo}</strong>
            </div>
            <div className="info-row">
              <span>Order ID</span>
              <strong><CopyableId id={order.id} showFull /></strong>
            </div>
            <div className="info-row">
              <span>Buyer ID</span>
              <strong><CopyableId id={order.buyerId} showFull /></strong>
            </div>
            <div className="info-row">
              <span>Tổng tiền toàn đơn</span>
              <strong className="tabular-nums">{formatMoney(order.totalAmount)}</strong>
            </div>
          </div>

          {order.appliedVouchers && order.appliedVouchers.length > 0 && (
            <div className="admin-shipment-modal-block">
              <h3>Mã giảm giá áp dụng cho đơn cha ({order.appliedVouchers.length})</h3>
              <ul className="admin-shipment-voucher-list">
                {order.appliedVouchers.map((v, idx) => (
                  <li key={`${v.code}-${idx}`} className="admin-shipment-voucher-item">
                    <div>
                      <strong className="mono">{v.code}</strong>
                      <span className="admin-shipment-muted">{voucherScopeLabel(v.scopeType)}</span>
                    </div>
                    <strong className="tabular-nums admin-shipment-discount">
                      -{formatMoney(v.discountAmount)}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="admin-shipment-modal-block">
            <h3>Các đơn con (SubOrder) theo từng Shop / Seller</h3>
            <div className="admin-shipment-suborder-list">
              {order.subOrders.map((sub) => {
                const isCurrent = Boolean(activeSubOrderId && sub.subOrderId === activeSubOrderId);
                return (
                  <div
                    key={sub.subOrderId}
                    className={`admin-shipment-suborder-card${isCurrent ? " is-current" : ""}`}
                  >
                    <div className="admin-shipment-suborder-card-head">
                      <div className="admin-shipment-suborder-title">
                        <strong className="mono">{sub.subOrderNo}</strong>
                        <span>{sub.shopName}</span>
                        {isCurrent && <Badge tone="sky">Đang xem</Badge>}
                      </div>
                      <div className="admin-shipment-suborder-actions">
                        <Badge tone={semanticStatusTone(sub.status)}>
                          {statusLabel(SUB_ORDER_STATUS, sub.status)}
                        </Badge>
                        <button
                          type="button"
                          className="button button-secondary button-small"
                          onClick={() => onSwitchTarget("suborder", sub.subOrderId)}
                        >
                          Xem chi tiết SubOrder
                        </button>
                      </div>
                    </div>

                    <div className="admin-shipment-suborder-meta">
                      <span>Vận đơn: <strong className="mono">{sub.trackingCode ?? "Chưa tạo"}</strong></span>
                      <span>Tiền hàng: <strong className="tabular-nums">{formatMoney(sub.itemsAmount)}</strong></span>
                      <span>Ship: <strong className="tabular-nums">{formatMoney(sub.shippingFeeAmount)}</strong></span>
                      {sub.discountAmount > 0 && (
                        <span>Giảm giá: <strong className="tabular-nums admin-shipment-discount">-{formatMoney(sub.discountAmount)}</strong></span>
                      )}
                      <span>Tổng: <strong className="tabular-nums">{formatMoney(sub.totalAmount)}</strong></span>
                    </div>

                    {sub.items.length > 0 && (
                      <div className="admin-shipment-suborder-items">
                        {sub.items.map((item) => (
                          <Link
                            key={item.orderItemId}
                            href={ROUTES.catalog.product(item.productId)}
                            className="admin-shipment-product-chip"
                            onClick={onBeforeNavigateProduct}
                          >
                            <TruncatedText text={item.productName} label="Tên sản phẩm" maxWidth={220} />
                            <span className="tabular-nums">×{item.quantity}</span>
                            <span className="tabular-nums">{formatMoney(item.lineTotal)}</span>
                            <Icon name="externalLink" size={12} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <NoData title="Không có dữ liệu chi tiết đơn hàng." />
      )}
    </Modal>
  );
}
