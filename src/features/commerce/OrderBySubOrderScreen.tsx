"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, NoData } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { ApiError, api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";

type SubOrder = { orderId?: string | null };

/**
 * A notification of a regular order carries the id of the sub-order (the seller's part), while the buyer's page is keyed by the parent order.
 * This page asks for the sub-order (the server only answers its buyer) and moves on to the order; otherwise it says why it cannot.
 */
export function OrderBySubOrderScreen() {
  const params = useParams<{ id: string }>();
  const subOrderId = String(params.id ?? "");
  const router = useRouter();
  const resource = useApiResource(
    subOrderId ? `buyer-order-by-sub:${subOrderId}` : null,
    async (signal) => unwrap(await api.get<ApiResponse<SubOrder> | SubOrder>(`/api/v1/sub-orders/${encodeURIComponent(subOrderId)}`, { signal })),
  );
  const orderId = resource.data?.orderId ?? null;

  useEffect(() => {
    if (orderId) router.replace(ROUTES.buyer.order(orderId));
  }, [orderId, router]);

  if (resource.error) {
    const status = resource.error instanceof ApiError ? resource.error.status : 0;
    const message = status === 404 || status === 403
      ? "Không tìm thấy đơn hàng này, hoặc đơn không thuộc tài khoản của bạn."
      : "Không mở được đơn hàng lúc này.";
    return <Card className="card-pad">
      <p className="notice" role="alert">{message}</p>
      <div className="action-row">
        {status !== 404 && status !== 403 && <button type="button" className="button button-secondary" onClick={resource.reload}>Thử lại</button>}
        <Link className="button button-primary" href={ROUTES.buyer.orders}>Về danh sách đơn mua</Link>
      </div>
    </Card>;
  }

  if (resource.data && !orderId)
    return <Card className="card-pad"><p className="notice" role="alert">Đơn hàng này chưa có mã đơn để mở.</p><Link className="button button-primary" href={ROUTES.buyer.orders}>Về danh sách đơn mua</Link></Card>;

  return <NoData title="Đang mở đơn hàng…" />;
}
