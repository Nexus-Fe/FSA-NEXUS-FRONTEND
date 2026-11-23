export type ShippingAddress = {
  recipientName: string;
  phoneNumber: string;
  address: string;
};

export type Shipment = {
  id: string;
  orderId: string;
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

/** Fulfillment shipment as returned by `GET /api/v1/shipments/tracking/{code}`, with the carrier's events. */
export type ShipmentDetail = Shipment & {
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  events: ShipmentEvent[] | null;
};
