"use client";

import Link from "next/link";
import { ThumbnailBox } from "@/components/ui/BackendImage";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { ROUTES } from "@/constants/routes";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney, resolveImageUrl } from "@/lib/presentation";

export type OrderItemPreviewSnapshot = {
  productId: string;
  skuId: string;
  productName: string;
  skuCode?: string | null;
  quantity: number;
  unitPrice: number;
  unitPriceAfterDiscount?: number | null;
  lineTotal: number;
  shopName?: string;
  imageUrl?: string | null;
};

type ProductCatalogPreview = {
  id: string;
  name?: string;
  description?: string | null;
  categoryName?: string | null;
  brand?: string | null;
  status?: string | null;
  primaryImageUrl?: string | null;
  images?: Array<{ url: string; isActive?: boolean }>;
  variants?: Array<{
    variantId: string;
    name?: string | null;
    skuCode?: string | null;
    primaryImageUrl?: string | null;
    images?: Array<{ url: string; isActive?: boolean }>;
  }>;
};

export function ProductQuickPreviewModal({
  item,
  onClose,
}: {
  item: OrderItemPreviewSnapshot | null;
  onClose: () => void;
}) {
  const productId = item?.productId ?? "";
  const detail = useApiResource(
    productId ? `order-item-product-preview:${productId}` : null,
    async (signal) => {
      try {
        return unwrap(
          await api.get<ApiResponse<ProductCatalogPreview> | ProductCatalogPreview>(
            `/api/v1/products/${encodeURIComponent(productId)}`,
            { signal },
          ),
        );
      } catch {
        return null;
      }
    },
  );

  const variant = detail.data?.variants?.find((v) => v.variantId === item?.skuId);
  const resolvedImage =
    item?.imageUrl ??
    variant?.primaryImageUrl ??
    variant?.images?.find((img) => img.isActive !== false)?.url ??
    detail.data?.primaryImageUrl ??
    detail.data?.images?.find((img) => img.isActive !== false)?.url ??
    null;

  const hasDiscount = Boolean(
    item &&
      item.unitPriceAfterDiscount != null &&
      item.unitPriceAfterDiscount < item.unitPrice,
  );
  const unitRecorded = item
    ? hasDiscount
      ? item.unitPriceAfterDiscount!
      : item.unitPrice
    : 0;

  return (
    <Modal
      open={Boolean(item)}
      title="Thông tin sản phẩm"
      onClose={onClose}
      footer={
        <button type="button" className="button button-secondary" onClick={onClose}>
          Đóng
        </button>
      }
    >
      {item && (
        <div className="product-preview-modal">
          <div className="product-preview-top-actions">
            <Link
              className="button button-secondary button-small product-preview-detail-btn"
              href={ROUTES.catalog.product(item.productId)}
              onClick={onClose}
            >
              <span>Xem trang sản phẩm</span>
              <Icon name="externalLink" size={14} />
            </Link>
          </div>

          <div className="product-preview-hero">
            <ThumbnailBox src={resolveImageUrl(resolvedImage)} alt={item.productName} size={56} />
            <div className="product-preview-meta">
              <h3 className="product-preview-title">{detail.data?.name || item.productName}</h3>
              {item.shopName && (
                <p className="product-preview-shop">
                  <Icon name="store" size={14} />
                  <span>{item.shopName}</span>
                </p>
              )}
              <div className="product-preview-price">
                {hasDiscount && (
                  <span className="price-strikethrough">{formatMoney(item.unitPrice)}</span>
                )}
                <strong>{formatMoney(unitRecorded)}</strong>
                <span className="product-preview-qty">× {item.quantity}</span>
              </div>
            </div>
          </div>

          <div className="product-preview-rows">
            <div className="info-row">
              <span>Phân loại / SKU</span>
              <strong>{variant?.name || item.skuCode || item.skuId}</strong>
            </div>
            <div className="info-row">
              <span>Thành tiền lúc mua</span>
              <strong>{formatMoney(hasDiscount ? unitRecorded * item.quantity : item.lineTotal)}</strong>
            </div>
            {detail.data?.categoryName && (
              <div className="info-row">
                <span>Danh mục</span>
                <strong>{detail.data.categoryName}</strong>
              </div>
            )}
            {detail.data?.brand && (
              <div className="info-row">
                <span>Thương hiệu</span>
                <strong>{detail.data.brand}</strong>
              </div>
            )}
            {detail.data?.description && (
              <div className="product-preview-desc">
                <span>Mô tả cơ bản</span>
                <p>{detail.data.description}</p>
              </div>
            )}
            {detail.loading && (
              <p className="product-preview-note">Đang tải thêm thông tin sản phẩm…</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
