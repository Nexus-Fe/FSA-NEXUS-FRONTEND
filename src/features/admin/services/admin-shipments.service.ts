import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import type { PublicSellerSummary } from "@/features/catalog/services/catalog.service";
import { adminUsersService, type AdminUser } from "./admin-users.service";

export type WarehouseDetail = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  contactPhone: string | null;
  provinceName: string | null;
  districtId: number | null;
  wardCode: string | null;
  ghnShopId: number | null;
  isDisabled: boolean;
  sellerId?: string | null;
  provinceId?: number | null;
};

export type AppliedVoucherDetail = {
  code: string;
  scopeType: string;
  ownerSellerId?: string | null;
  discountAmount: number;
};

export type SubOrderItemDetail = {
  orderItemId: string;
  productId: string;
  skuId: string;
  productName: string;
  skuCode?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type ShippingAddressSnapshot = {
  receiverName: string;
  contactPhone: string;
  street: string;
  ward: string;
  district: string;
  province: string;
  ghnDistrictId: number;
  ghnWardCode: string;
  fullAddressText?: string | null;
  provinceId?: number | null;
};

export type AdminSubOrderDetail = {
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
  productDiscountAmount: number;
  shopDiscountAmount: number;
  systemDiscountAmount: number;
  discountAmount: number;
  shippingFeeAmount: number;
  totalAmount: number;
  createdAt: string;
  items: SubOrderItemDetail[];
  carrierCode?: string | null;
  trackingCode?: string | null;
  shipmentPendingCreation?: boolean;
  labelPrintUrl?: string | null;
  sellerAcceptedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  appliedVouchers?: AppliedVoucherDetail[] | null;
};

export type AdminOrderDetail = {
  id: string;
  orderNo: string;
  buyerId: string;
  status: string;
  totalAmount: number;
  paymentDeadlineAt: string;
  createdAt: string;
  subOrders: AdminSubOrderDetail[];
  appliedVouchers?: AppliedVoucherDetail[] | null;
};

export type AdminAuctionOrderDetail = {
  id: string;
  orderNo: string;
  auctionId: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  skuId?: string | null;
  productName: string;
  imageUrl?: string | null;
  skuAttributes?: string | null;
  winningAmount: number;
  depositAmount: number;
  remainingAmount: number;
  orderSource: string;
  shippingAddress?: string | null;
  contactPhone?: string | null;
  shippingFeeAmount?: number | null;
  totalAmount?: number | null;
  sellerReceiveAmount: number;
  platformFeeAmount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  carrierCode?: string | null;
  trackingCode?: string | null;
  labelPrintUrl?: string | null;
  estimatedDeliveryAt?: string | null;
};

export const adminShipmentsService = {
  async getWarehouseById(warehouseId: string, signal?: AbortSignal): Promise<WarehouseDetail> {
    return unwrap(
      await api.get<ApiResponse<WarehouseDetail> | WarehouseDetail>(
        `/api/v1/warehouses/${encodeURIComponent(warehouseId)}`,
        { signal },
      ),
    );
  },

  async getSubOrderDetail(subOrderId: string, signal?: AbortSignal): Promise<AdminSubOrderDetail> {
    return unwrap(
      await api.get<ApiResponse<AdminSubOrderDetail> | AdminSubOrderDetail>(
        `/api/v1/sub-orders/${encodeURIComponent(subOrderId)}`,
        { signal },
      ),
    );
  },

  async getOrderDetail(orderId: string, signal?: AbortSignal): Promise<AdminOrderDetail> {
    return unwrap(
      await api.get<ApiResponse<AdminOrderDetail> | AdminOrderDetail>(
        `/api/v1/orders/${encodeURIComponent(orderId)}`,
        { signal },
      ),
    );
  },

  async getAuctionOrderDetail(auctionOrderId: string, signal?: AbortSignal): Promise<AdminAuctionOrderDetail | null> {
    try {
      return unwrap(
        await api.get<ApiResponse<AdminAuctionOrderDetail> | AdminAuctionOrderDetail>(
          `/api/v1/auction-orders/${encodeURIComponent(auctionOrderId)}`,
          { signal },
        ),
      );
    } catch {
      return null;
    }
  },

  async getPublicSellerProfile(sellerId: string, signal?: AbortSignal): Promise<PublicSellerSummary | null> {
    try {
      return unwrap(
        await api.get<ApiResponse<PublicSellerSummary> | PublicSellerSummary>(
          `/api/v1/sellers/${encodeURIComponent(sellerId)}`,
          { signal },
        ),
      );
    } catch {
      return null;
    }
  },

  async getAdminUserDetail(userId: string, signal?: AbortSignal): Promise<AdminUser | null> {
    try {
      return await adminUsersService.detail(userId, signal);
    } catch {
      return null;
    }
  },

  async getVariantProductId(skuId: string, signal?: AbortSignal): Promise<string | null> {
    try {
      const variant = unwrap(
        await api.get<ApiResponse<{ productId?: string }> | { productId?: string }>(
          `/api/v1/variants/${encodeURIComponent(skuId)}`,
          { signal },
        ),
      );
      return variant?.productId ?? null;
    } catch {
      return null;
    }
  },
};
