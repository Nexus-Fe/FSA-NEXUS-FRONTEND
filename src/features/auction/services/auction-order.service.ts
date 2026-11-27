import { api, unwrap, type ApiResponse } from "@/lib/api/client";

export type AuctionOrderDetail = {
  id: string; orderNo: string; auctionId: string; productId?: string; productName: string;
  winningAmount: number; depositAmount: number; shippingFeeAmount: number | null; totalAmount: number | null;
  status: string; orderSource?: string; paymentDeadlineAt: string; sellerRespondDeadlineAt: string | null;
  paidAt: string | null; shippedAt: string | null; deliveredAt: string | null;
  shippingAddress?: string | null; contactPhone?: string | null;
  carrierCode?: string | null; trackingCode?: string | null; labelPrintUrl?: string | null; estimatedDeliveryAt?: string | null;
};
export type AuctionOrderSummary = Pick<AuctionOrderDetail, "id" | "orderNo" | "auctionId" | "productName" | "winningAmount" | "totalAmount" | "status" | "paymentDeadlineAt" | "carrierCode" | "trackingCode" | "labelPrintUrl"> & {
  imageUrl?: string | null;
  depositAmount?: number;
  shippingFeeAmount?: number | null;
  orderSource?: string | null;
  createdAt?: string;
};
export type ShippingAddress = { fullName: string; phoneNumber: string; addressLine: string; provinceName: string; districtName: string; wardName: string; provinceId: number; ghnDistrictId: number; ghnWardCode: string };
type OrdersPage = { items: AuctionOrderSummary[]; pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean };
type RawOrdersPage = OrdersPage | { items: AuctionOrderSummary[]; pagination?: Omit<OrdersPage, "items"> };

function normalizeOrdersPage(raw: RawOrdersPage, fallbackPage: number, fallbackSize = 10): OrdersPage {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const meta = "pagination" in raw && raw.pagination ? raw.pagination : (raw as Partial<OrdersPage>);
  const pageIndex = meta.pageIndex ?? fallbackPage;
  const pageSize = meta.pageSize ?? fallbackSize;
  const totalCount = meta.totalCount ?? items.length;
  const totalPages = meta.totalPages ?? Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));
  return {
    items,
    pageIndex,
    pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: meta.hasPreviousPage ?? pageIndex > 1,
    hasNextPage: meta.hasNextPage ?? pageIndex < totalPages,
  };
}

const path = (id: string) => `/api/v1/auction-orders/${encodeURIComponent(id)}`;

export const auctionOrderService = {
  detail: async (id: string, signal?: AbortSignal) => unwrap(await api.get<ApiResponse<AuctionOrderDetail> | AuctionOrderDetail>(path(id), { signal })),
  buyerList: async (page = 1, status?: string, signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (status) query.set("status", status);
    const raw = unwrap(await api.get<ApiResponse<RawOrdersPage> | RawOrdersPage>(`/api/v1/auction-orders/me?${query}`, { signal }));
    return normalizeOrdersPage(raw, page, 10);
  },
  sellerList: async (page = 1, signal?: AbortSignal) => {
    const raw = unwrap(await api.get<ApiResponse<RawOrdersPage> | RawOrdersPage>(`/api/v1/auction-orders/seller?page=${page}&pageSize=10`, { signal }));
    return normalizeOrdersPage(raw, page, 10);
  },
  submitShipping: (id: string, address: ShippingAddress) => api.put(`${path(id)}/shipping`, { shippingAddress: address, contactPhone: address.phoneNumber }),
  pay: async (id: string) => unwrap(await api.post<ApiResponse<{ status: string }> | { status: string }>(`${path(id)}/pay`)),
  accept: (id: string) => api.post(`${path(id)}/accept`, { note: null }),
  reject: (id: string, reasonNote: string) => api.post(`${path(id)}/reject`, { reasonNote, reasonCode: "SellerRejected" }),
  confirmReceipt: (id: string) => api.post(`${path(id)}/confirm-receipt`),
};
