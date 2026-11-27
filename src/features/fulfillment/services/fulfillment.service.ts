import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import type {
  OrderShipmentTracking,
  PagedShipments,
  Shipment,
  ShipmentDetail,
  ShipmentFilterQuery,
  ShipmentTimeline,
  SimulateShipperStatusParams,
  SimulateShipperStatusResult,
} from "../types";

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
  /** Pulls the latest carrier status directly from GHN for a shipment (seller/staff/admin). */
  async syncShipmentStatus(shipmentId: string): Promise<ShipmentDetail> {
    return unwrap(await api.post<ApiResponse<ShipmentDetail> | ShipmentDetail>(`/api/v1/shipments/${encodeURIComponent(shipmentId)}/sync-status`, {}));
  },
  /** Status history of a winning auction order's shipment (Commerce). */
  async getAuctionOrderTimeline(auctionOrderId: string, signal?: AbortSignal): Promise<ShipmentTimeline> {
    return unwrap(await api.get<ApiResponse<ShipmentTimeline> | ShipmentTimeline>(`/api/v1/auction-orders/${encodeURIComponent(auctionOrderId)}/shipments/timeline`, { signal }));
  },
  /** Retries creating a GHN shipment for an accepted auction order (seller only). */
  async retryAuctionOrderShipment(auctionOrderId: string): Promise<{ subOrderId?: string; auctionOrderId?: string; trackingCode: string; carrierCode: string }> {
    return unwrap(await api.post<
      ApiResponse<{ subOrderId?: string; auctionOrderId?: string; trackingCode: string; carrierCode: string }>
      | { subOrderId?: string; auctionOrderId?: string; trackingCode: string; carrierCode: string }
    >(`/api/v1/auction-orders/${encodeURIComponent(auctionOrderId)}/shipments/retry`, {}));
  },
  /** Fetches available pickup shifts from GHN (Fulfillment). */
  async getPickShifts(signal?: AbortSignal): Promise<Array<{ id: number; title: string; fromTime: number; toTime: number }>> {
    return unwrap(await api.get<ApiResponse<Array<{ id: number; title: string; fromTime: number; toTime: number }>> | Array<{ id: number; title: string; fromTime: number; toTime: number }>>(
      "/api/v1/shipping/pick-shifts",
      { signal },
    ));
  },
  /** Generates a fresh print label token and URL from GHN (Fulfillment). */
  async getPrintLabel(shipmentId: string, pageSize: "A5" | "80x80" | "52x70" = "A5"): Promise<{ shipmentId: string; trackingCode: string; printToken: string; printUrl: string; pageSize: string }> {
    return unwrap(await api.get<ApiResponse<{ shipmentId: string; trackingCode: string; printToken: string; printUrl: string; pageSize: string }> | { shipmentId: string; trackingCode: string; printToken: string; printUrl: string; pageSize: string }>(
      `/api/v1/shipments/${encodeURIComponent(shipmentId)}/print-label?pageSize=${encodeURIComponent(pageSize)}`,
    ));
  },
  /** Lists shipments with optional filter query (admin/seller/staff). */
  async listShipments(query?: ShipmentFilterQuery, signal?: AbortSignal): Promise<PagedShipments> {
    const params = new URLSearchParams();
    if (query?.page) params.set("page", String(query.page));
    if (query?.pageSize) params.set("pageSize", String(query.pageSize));
    if (query?.trackingNumber) params.set("trackingNumber", query.trackingNumber);
    if (query?.search) params.set("search", query.search);
    if (query?.status) params.set("status", query.status);
    if (query?.orderId) params.set("orderId", query.orderId);
    if (query?.sortBy) params.set("sortBy", query.sortBy);
    if (query?.sortOrder) params.set("sortOrder", query.sortOrder);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return unwrap(await api.get<ApiResponse<PagedShipments> | PagedShipments>(`/api/v1/shipments${qs}`, { signal }));
  },
  /** Simulates shipper status updates for sandbox testing (admin/seller/staff). */
  async simulateShipperStatus(params: SimulateShipperStatusParams): Promise<SimulateShipperStatusResult> {
    return unwrap(await api.post<ApiResponse<SimulateShipperStatusResult> | SimulateShipperStatusResult>(
      `/api/v1/shipments/${encodeURIComponent(params.trackingNumber)}/simulate-shipper-status`,
      params,
    ));
  },
};
