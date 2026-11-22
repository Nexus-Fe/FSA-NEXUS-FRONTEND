/** `POST /api/v1/admin/sellers/{sellerProfileId}/warehouse/retry` answers `{ sellerId, warehouseReady }`. */
export function describeWarehouseRetry(result: { warehouseReady?: boolean } | null | undefined): string {
  if (result?.warehouseReady === true) return "Kho đã sẵn sàng. Người bán có thể nhận đơn.";
  if (result?.warehouseReady === false) return "Chưa tạo được kho, dịch vụ kho vẫn lỗi. Thử lại sau.";
  return "Đã gửi yêu cầu tạo kho.";
}
