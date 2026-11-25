"use client";

import { useParams } from "next/navigation";
import { NoData, PageHeading } from "@/components/ui/Primitives";
import { ErrorState } from "@/components/ui/States";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { PartnerReviewCard } from "./PartnerReviewCard";
import { ProductReviewCard } from "./ProductReviewCard";

type Item = { productId?: string; id?: string; productName?: string; name?: string };
type SubOrder = { subOrderId?: string; subOrderNo?: string; shopName?: string; sellerId?: string; status?: string; items?: Item[] };
type Order = { subOrders?: SubOrder[] };

function isCompleted(status: string | undefined) {
  return (status ?? "").replace(/[^a-z]/gi, "").toUpperCase() === "COMPLETED";
}

/** One distinct product per sub-order: several SKUs of the same product are one purchase and get one review. */
function distinctProducts(items: Item[] | undefined): { productId: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const item of items ?? []) {
    const productId = String(item.productId ?? item.id ?? "");
    if (productId && !seen.has(productId)) seen.set(productId, String(item.productName ?? item.name ?? productId));
  }
  return [...seen].map(([productId, name]) => ({ productId, name }));
}

/**
 * Reviews of one order, per sub-order (shop): the seller once, and each product once. Reviews are tied to the sub-order,
 * never to the parent order, so one product bought from two shops is two separate reviews.
 */
export function BuyerOrderReviewScreen() {
  const params = useParams<{ id: string }>();
  const orderId = String(params.id ?? "");
  const order = useApiResource(
    orderId ? `/api/v1/orders/${orderId}` : null,
    async () => unwrap(await api.get<ApiResponse<Order> | Order>(`/api/v1/orders/${encodeURIComponent(orderId)}`)),
  );
  const subOrders = order.data?.subOrders ?? [];

  return <>
    <PageHeading overline="Sau khi nhận hàng" title="Đánh giá đơn hàng" description="Đánh giá từng sản phẩm và người bán sau khi đơn hàng hoàn tất. Mỗi sản phẩm và mỗi người bán được đánh giá một lần cho mỗi đơn." />
    {order.error && <ErrorState cause={order.error} onRetry={order.reload} />}
    {order.loading && !order.data && <NoData title="Đang tải đơn hàng…" />}
    {order.data && !subOrders.length && <NoData title="Đơn hàng chưa có đơn gian hàng nào để đánh giá." />}
    {subOrders.map((sub, index) => {
      const subOrderId = sub.subOrderId;
      return <section key={subOrderId ?? index} className="review-suborder" aria-label={`Đơn gian hàng ${sub.subOrderNo ?? index + 1}`}>
        <h2>Đơn gian hàng {sub.subOrderNo ?? index + 1}{sub.shopName ? ` · ${sub.shopName}` : ""}</h2>
        {!subOrderId && <p className="notice" role="alert">Đơn gian hàng này chưa có mã nên chưa thể đánh giá. Hãy tải lại trang hoặc liên hệ hỗ trợ.</p>}
        {subOrderId && !isCompleted(sub.status) && <p className="status-note" role="status">Đơn gian hàng này chưa hoàn tất. Bạn có thể đánh giá sau khi xác nhận đã nhận hàng.</p>}
        <div className="split">
          <div>
            <h3>Sản phẩm</h3>
            {distinctProducts(sub.items).map((product) => <ProductReviewCard key={`${subOrderId}:${product.productId}`} productId={product.productId} productName={product.name} subOrderId={subOrderId} />)}
          </div>
          <PartnerReviewCard referenceType="Order" referenceId={subOrderId} title="Đánh giá người bán" counterpart="người bán" />
        </div>
      </section>;
    })}
  </>;
}
