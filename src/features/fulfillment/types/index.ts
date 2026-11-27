export type ShippingAddress = {
  recipientName: string;
  phoneNumber: string;
  address: string;
};

export type ShipmentItem = {
  skuId: string;
  quantity: number;
  name: string;
  price: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
};

export type SubOrderItemSummary = {
  orderItemId?: string;
  productId: string;
  skuId: string;
  productName: string;
  skuCode?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Shipment = {
  id: string;
  orderId: string;
  subOrderNo?: string | null;
  warehouseId: string;
  carrierId: string;
  trackingNumber: string | null;
  status: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
};

/** One sub-order (one shop's part of an order) as listed by Commerce `GET /api/v1/shipments/order/{orderId}`. */
export type SubOrderShipment = {
  subOrderId: string;
  subOrderNo: string;
  sellerId: string;
  shopName: string;
  status: string;
  carrierCode: string | null;
  trackingCode: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  labelPrintUrl: string | null;
  items?: SubOrderItemSummary[] | null;
};

export type OrderShipmentTracking = {
  orderId: string;
  orderNo: string;
  shipments: SubOrderShipment[];
};

export type TimelineEvent = {
  status: string;
  title: string;
  description: string;
  occurredAt: string;
  location: string | null;
};

/** Commerce `GET /api/v1/sub-orders/{id}/shipments/timeline`. */
export type ShipmentTimeline = {
  subOrderId: string;
  subOrderNo: string;
  orderId: string;
  carrierCode: string | null;
  carrierName: string | null;
  trackingCode: string | null;
  labelPrintUrl: string | null;
  currentStatus: string;
  estimatedDeliveryAt: string | null;
  timeline: TimelineEvent[];
  items?: SubOrderItemSummary[] | null;
};

export type ShipmentEvent = {
  id: string;
  carrierStatus: string | null;
  status: string;
  description: string | null;
  occurredAt: string;
  reasonCode: string | null;
  reason: string | null;
  shipperName: string | null;
  shipperPhone: string | null;
  podUrl: string | null;
  warehouseName: string | null;
};

/** Fulfillment shipment as returned by `GET /api/v1/shipments/tracking/{code}`, with the carrier's events and items. */
export type ShipmentDetail = Shipment & {
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  items?: ShipmentItem[] | null;
  events: ShipmentEvent[] | null;
};

export type SimulateShipperStatusParams = {
  trackingNumber: string;
  status: string;
  description?: string;
  shipperName?: string;
  shipperPhone?: string;
  reasonCode?: string;
  reason?: string;
  podUrl?: string;
  force?: boolean;
};

export type SimulateShipperStatusResult = {
  shipmentId?: string;
  trackingNumber: string;
  orderId?: string;
  previousStatus: string;
  currentStatus: string;
  newStatus?: string;
  commerceStatusNotified?: string | null;
  isSuccess: boolean;
  message: string;
};

export type ShipmentFilterQuery = {
  page?: number;
  pageSize?: number;
  trackingNumber?: string;
  search?: string;
  status?: string;
  orderId?: string;
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
};

export type PagedShipments = {
  items: ShipmentDetail[];
  pagination: {
    pageIndex: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};
