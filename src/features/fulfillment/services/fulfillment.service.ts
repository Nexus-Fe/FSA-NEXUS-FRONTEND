import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import type { OrderShipmentTracking, Shipment, ShipmentDetail, ShipmentTimeline } from "../types";

export const fulfillmentService = {
  async getShipmentByTrackingNumber(trackingNumber: string, signal?: AbortSignal): Promise<Shipment> {
    return unwrap(await api.get<ApiResponse<Shipment> | Shipment>(`/api/v1/shipments/tracking/${encodeURIComponent(trackingNumber)}`, { signal }));
  },
  /** Every sub-order of an order with its own status and tracking code (Commerce). */
  async getOrderTracking(orderId: string, signal?: AbortSignal): Promise<OrderShipmentTracking> {
    return unwrap(await api.get<ApiResponse<OrderShipmentTracking> | OrderShipmentTracking>(`/api/v1/shipments/order/${encodeURIComponent(orderId)}`, { signal }));
  },
  /** Asks the carrier for a new shipment of an accepted sub-order that has none (seller only). */
  async retrySubOrderShipment(subOrderId: string): Promise<{ subOrderId: string; trackingCode: string; carrierCode: string }> {
    return unwrap(await api.post<ApiResponse<{ subOrderId: string; trackingCode: string; carrierCode: string }> | { subOrderId: string; trackingCode: string; carrierCode: string }>(
      `/api/v1/sub-orders/${encodeURIComponent(subOrderId)}/shipments/retry`, {}));
  },
  /** Status history of one sub-order's shipment (Commerce). */
  async getSubOrderTimeline(subOrderId: string, signal?: AbortSignal): Promise<ShipmentTimeline> {
    return unwrap(await api.get<ApiResponse<ShipmentTimeline> | ShipmentTimeline>(`/api/v1/sub-orders/${encodeURIComponent(subOrderId)}/shipments/timeline`, { signal }));
  },
  /** The carrier's own record of a parcel, including delivery-attempt reasons (Fulfillment). */
  async getShipmentByTracking(trackingCode: string, signal?: AbortSignal): Promise<ShipmentDetail> {
    return unwrap(await api.get<ApiResponse<ShipmentDetail> | ShipmentDetail>(`/api/v1/shipments/tracking/${encodeURIComponent(trackingCode)}`, { signal }));
  },
};
