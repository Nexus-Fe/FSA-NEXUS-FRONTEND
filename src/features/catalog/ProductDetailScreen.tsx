"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { BackendImage } from "@/components/ui/BackendImage";
import { Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { ROUTES } from "@/constants/routes";
import { commerceService } from "@/features/commerce";
import { ApiError, api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney, resolveImageUrl } from "@/lib/presentation";
import type { ProductSpecification } from "./types/product-specification";
import { ProductFeedback } from "./ProductFeedback";
import { ProductReportModal } from "./ProductReportModal";

type ProductImage = {
  url: string;
  altText?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  variantId?: string | null;
};

type ProductVariant = {
  variantId: string;
  skuCode: string;
  name: string;
  price: number | null;
  status: string;
  isActive: boolean;
  attributes?: Array<{ attrName: string; attrValue: string }>;
  primaryImageUrl?: string | null;
  images?: ProductImage[];
};

type ProductDetail = {
  productId: string;
  sellerId?: string | null;
  name: string;
  description?: string | null;
  brand?: string | null;
  saleType?: string;
  status?: string;
  specifications?: ProductSpecification[] | null;
  category?: { categoryId: string; name: string } | null;
  variants: ProductVariant[];
  images: ProductImage[];
  rating?: { avgRating: number | null; reviewCount: number } | null;
};

type SellerProfile = {
  shopName: string;
  logoUrl?: string | null;
  description?: string | null;
  ratingAvg?: number;
  totalProducts?: number;
};

type RelatedProduct = {
  productId: string;
  name: string;
  status: string;
  saleType: string;
  minPrice: number | null;
  primaryImageUrl: string | null;
};

type RelatedPage = {
  items: RelatedProduct[];
  pagination?: { hasNextPage: boolean };
};

function activeImages(images: ProductImage[] | undefined): ProductImage[] {
  return (Array.isArray(images) ? images : [])
    .filter((image) => image && typeof image.url === "string" && image.url.trim() && image.isActive !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function uniqueImages(images: ProductImage[]): ProductImage[] {
  return images.filter((image, index) => images.findIndex((candidate) => candidate.url === image.url) === index);
}

function purchasableVariant(variant: ProductVariant): boolean {
  return (
    variant.status?.toUpperCase() === "ACTIVE" &&
    typeof variant.price === "number" &&
    Number.isFinite(variant.price) &&
    variant.price > 0
  );
}

function normalizedAttributeName(name: string): string {
  return name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function variantAttribute(variant: ProductVariant, kind: "color" | "size"): string {
  const names = kind === "color" ? ["color", "colour", "mau", "mau sac"] : ["size", "kich co"];
  return (
    variant.attributes?.find((attribute) =>
      names.includes(normalizedAttributeName(attribute.attrName ?? ""))
    )?.attrValue?.trim() ?? ""
  );
}

function normalizeProduct(value: ProductDetail): ProductDetail {
  if (!value || typeof value.productId !== "string" || typeof value.name !== "string") {
    throw new Error("Dữ liệu sản phẩm không hợp lệ. Vui lòng tải lại trang.");
  }
  return {
    ...value,
    images: activeImages(value.images),
    variants: (Array.isArray(value.variants) ? value.variants : [])
      .filter((variant) => variant && typeof variant.variantId === "string")
      .map((variant) => ({ ...variant, images: activeImages(variant.images) })),
  };
}

const specificationLabels: Record<string, string> = {
  ram: "RAM",
  storage: "Bộ nhớ",
  chipset: "Chipset",
  material: "Chất liệu",
  color: "Màu sắc",
  size: "Kích cỡ",
  capacity: "Dung tích",
  power: "Công suất",
  weight: "Trọng lượng",
  pages: "Số trang",
  publisher: "Nhà xuất bản",
  language: "Ngôn ngữ",
};

function readSpecifications(value: ProductSpecification[] | null | undefined): {
  entries: Array<[string, string]>;
  text: string;
} {
  return {
    entries: (value ?? []).map(({ name, value: item }) => [
      specificationLabels[name.toLowerCase()] ?? name,
      item,
    ]),
    text: "",
  };
}

export function ProductDetailScreen() {
  const params = useParams<{ id: string }>();
  const id = String(params.id ?? "");
  const router = useRouter();
  const { user } = useSession();

  const productResource = useApiResource(id ? `/api/v1/products/${id}` : null, async (signal) =>
    normalizeProduct(
      unwrap(
        await api.get<ApiResponse<ProductDetail> | ProductDetail>(
          `/api/v1/products/${encodeURIComponent(id)}`,
          { signal }
        )
      )
    )
  );
  const product = productResource.data;

  const sellerKey = product?.sellerId ? `/api/v1/sellers/${encodeURIComponent(product.sellerId)}` : null;
  const sellerResource = useApiResource(sellerKey, async (signal) => {
    if (!sellerKey) throw new Error("Thiếu mã gian hàng.");
    return unwrap(await api.get<ApiResponse<SellerProfile> | SellerProfile>(sellerKey, { signal }));
  });

  const relatedKey = product?.category?.categoryId
    ? `/api/v1/products/search?saleType=REGULAR&minPrice=1&categoryId=${encodeURIComponent(product.category.categoryId)}`
    : null;
  const relatedResource = useApiResource(relatedKey, async (signal) => {
    if (!relatedKey) throw new Error("Thiếu danh mục sản phẩm.");
    const matches: RelatedProduct[] = [];
    let page = 1;
    let hasNextPage = true;
    while (matches.length < 5 && hasNextPage && !signal.aborted) {
      const response = unwrap(
        await api.get<ApiResponse<RelatedPage> | RelatedPage>(
          `${relatedKey}&page=${page}&pageSize=20`,
          { signal }
        )
      );
      if (!Array.isArray(response?.items)) break;
      matches.push(
        ...response.items.filter(
          (item) =>
            item &&
            item.status?.toUpperCase() === "ACTIVE" &&
            item.saleType?.toUpperCase() === "REGULAR" &&
            typeof item.minPrice === "number" &&
            item.minPrice > 0
        )
      );
      hasNextPage = response.pagination?.hasNextPage === true;
      page += 1;
    }
    return matches.slice(0, 5);
  });

  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [selectionProductId, setSelectionProductId] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [adding, setAdding] = useState(false);
  const [cartError, setCartError] = useState("");
  const [cartNotice, setCartNotice] = useState<{ item: string } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    if (!cartNotice) return;
    const timeout = window.setTimeout(() => setCartNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [cartNotice]);

  if (!product) {
    return (
      <div className="product-detail-page">
        <PageHeading title="Chi tiết sản phẩm" />
        {productResource.error ? (
          <div className="notice" role="alert">
            <p>{productResource.error.message}</p>
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={productResource.reload}
            >
              Tải lại sản phẩm
            </button>
          </div>
        ) : (
          <NoData title={productResource.loading ? "Đang tải sản phẩm…" : "Không tìm thấy sản phẩm"} />
        )}
      </div>
    );
  }

  const regularProduct = product.saleType?.toUpperCase() === "REGULAR" && product.status?.toUpperCase() === "ACTIVE";
  const availableVariants = regularProduct ? product.variants.filter(purchasableVariant) : [];
  const colorChoice = selectionProductId === product.productId ? selectedColor : "";
  const sizeChoice = selectionProductId === product.productId ? selectedSize : "";
  const colors = [...new Set(availableVariants.map((variant) => variantAttribute(variant, "color")).filter(Boolean))];
  const sizes = [...new Set(availableVariants.map((variant) => variantAttribute(variant, "size")).filter(Boolean))];
  const canChooseAttributes =
    (colors.length > 0 || sizes.length > 0) &&
    availableVariants.every(
      (variant) =>
        (!colors.length || variantAttribute(variant, "color")) &&
        (!sizes.length || variantAttribute(variant, "size"))
    ) &&
    new Set(
      availableVariants.map(
        (variant) => `${variantAttribute(variant, "color")}\u0000${variantAttribute(variant, "size")}`
      )
    ).size === availableVariants.length;

  const matchingVariants = canChooseAttributes
    ? availableVariants.filter(
        (variant) =>
          (!colorChoice || variantAttribute(variant, "color") === colorChoice) &&
          (!sizeChoice || variantAttribute(variant, "size") === sizeChoice)
      )
    : availableVariants;

  const chosenVariant =
    canChooseAttributes && (!colors.length || colorChoice) && (!sizes.length || sizeChoice)
      ? matchingVariants[0]
      : undefined;

  const effectiveSkuId = canChooseAttributes
    ? chosenVariant?.variantId ?? ""
    : availableVariants.some((variant) => variant.variantId === selectedSkuId)
      ? selectedSkuId
      : availableVariants.length === 1
        ? availableVariants[0].variantId
        : "";

  const selectedVariant = product.variants.find((variant) => variant.variantId === effectiveSkuId);
  const variantImages = activeImages(selectedVariant?.images);
  const productImages = activeImages(product.images);
  const gallery = uniqueImages(
    selectedVariant
      ? [...variantImages, ...productImages.filter((image) => !image.variantId || image.variantId === selectedVariant.variantId)]
      : productImages
  );

  if (gallery.length === 0 && selectedVariant?.primaryImageUrl) {
    gallery.push({ url: selectedVariant.primaryImageUrl, altText: product.name });
  }

  const currentImage = gallery.find((image) => image.url === selectedImageUrl) ?? gallery[0];
  const validPrices = matchingVariants
    .map((variant) => variant.price)
    .filter((price): price is number => typeof price === "number");
  const price = selectedVariant?.price ?? (validPrices.length ? Math.min(...validPrices) : null);
  const parsedQuantity = Number(quantity);
  const validQuantity = Number.isInteger(parsedQuantity) && parsedQuantity > 0;
  const canAdd = regularProduct && Boolean(selectedVariant && purchasableVariant(selectedVariant)) && validQuantity;
  const reviewCount = product.rating?.reviewCount ?? 0;
  const specifications = readSpecifications(product.specifications);
  const relatedProducts = (relatedResource.data ?? []).filter((item) => item.productId !== product.productId).slice(0, 4);

  const canReport = Boolean(
    user &&
      (user.roles?.some((role) => /^(buyer|seller)$/i.test(role)) ||
        /^(buyer|seller)$/i.test(user.role ?? ""))
  );

  async function addToCart() {
    if (!canAdd || !selectedVariant || !product) return;
    if (!user) {
      router.push(ROUTES.auth.login);
      return;
    }
    setAdding(true);
    setCartError("");
    setCartNotice(null);
    try {
      await commerceService.addCartItem({
        skuId: selectedVariant.variantId,
        productId: product.productId,
        quantity: parsedQuantity,
      });
      setCartNotice({ item: `${parsedQuantity} × ${selectedVariant.name || selectedVariant.skuCode || product.name}` });
    } catch (cause) {
      setCartError(
        cause instanceof ApiError && cause.errorCode === "INSUFFICIENT_STOCK"
          ? "Kho hiện không đủ số lượng bạn chọn. Hãy giảm số lượng và thử lại."
          : cause instanceof ApiError && cause.status >= 500
            ? "Giỏ hàng đang gặp lỗi hệ thống. Vui lòng thử lại sau."
            : cause instanceof Error
              ? cause.message
              : "Không thêm được sản phẩm vào giỏ hàng."
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="product-detail-page">
      {cartNotice && (
        <div className="product-detail-toast" role="status" aria-live="polite" aria-atomic="true">
          <span className="product-detail-toast-mark" aria-hidden="true">✓</span>
          <div className="product-detail-toast-content">
            <strong>Đã thêm vào giỏ hàng</strong>
            <p>{cartNotice.item}</p>
            <Link href={ROUTES.buyer.cart}>Xem giỏ hàng</Link>
          </div>
          <button
            type="button"
            className="product-detail-toast-close"
            aria-label="Đóng thông báo"
            onClick={() => setCartNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Breadcrumb & Action Row */}
      <div className="product-detail-topbar">
        <nav className="product-detail-breadcrumb" aria-label="Đường dẫn">
          <Link href={ROUTES.home}>Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <Link href={ROUTES.catalog.index}>Sản phẩm</Link>
          {product.category?.categoryId && (
            <>
              <span aria-hidden="true">/</span>
              <Link href={`${ROUTES.catalog.index}?categoryId=${encodeURIComponent(product.category.categoryId)}`}>
                {product.category.name}
              </Link>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        {canReport && (
          <button
            type="button"
            className="product-detail-report-btn"
            onClick={() => setShowReportModal(true)}
            title="Báo cáo vi phạm sản phẩm này"
          >
            <Icon name="flag" size={13} />
            <span>Báo cáo</span>
          </button>
        )}
      </div>

      {/* 1. KHUNG SẢN PHẨM CHÍNH (Gallery + Info + CTA) */}
      <div className="product-detail-hero">
        <div className="product-detail-heading">
          {product.category?.name && <Badge>{product.category.name}</Badge>}
          <h1>{product.name}</h1>
          {product.brand && <p className="product-detail-brand">Thương hiệu: {product.brand}</p>}
          <p className="product-detail-rating">
            {reviewCount > 0 ? (
              <>
                <span aria-hidden="true" style={{ color: "#f59e0b" }}>★</span>{" "}
                {typeof product.rating?.avgRating === "number" && product.rating.avgRating > 0
                  ? product.rating.avgRating.toFixed(1)
                  : "5.0"}{" "}
                / 5.0 · {reviewCount} đánh giá
              </>
            ) : (
              "Chưa có đánh giá"
            )}
          </p>
        </div>

        <div className="product-detail-gallery">
          <div className="product-detail-image">
            <BackendImage src={resolveImageUrl(currentImage?.url ?? null)} alt={currentImage?.altText || product.name} />
          </div>
          {gallery.length > 1 && (
            <div className="product-detail-thumbnails" aria-label="Ảnh sản phẩm">
              {gallery.map((image, index) => (
                <button
                  type="button"
                  key={image.url}
                  className={`product-detail-thumbnail${currentImage?.url === image.url ? " active" : ""}`}
                  aria-label={`Xem ảnh sản phẩm ${index + 1}`}
                  aria-pressed={currentImage?.url === image.url}
                  onClick={() => setSelectedImageUrl(image.url)}
                >
                  <BackendImage src={resolveImageUrl(image.url)} alt="" compact />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-detail-purchase">
          <p className="product-detail-price-label">{selectedVariant || price === null ? "Giá bán" : "Giá từ"}</p>
          <p className="product-detail-price">{formatMoney(price)}</p>
          <div className="product-detail-divider" />

          {canChooseAttributes ? (
            <div className="product-detail-options">
              {colors.length > 0 && (
                <fieldset className="product-detail-option-group">
                  <legend>Màu sắc</legend>
                  <div className="product-detail-option-list">
                    {colors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`product-detail-option${colorChoice === color ? " active" : ""}`}
                        aria-pressed={colorChoice === color}
                        onClick={() => {
                          const nextColor = colorChoice === color ? "" : color;
                          setSelectionProductId(product.productId);
                          setSelectedColor(nextColor);
                          if (
                            nextColor &&
                            sizeChoice &&
                            !availableVariants.some(
                              (variant) =>
                                variantAttribute(variant, "color") === nextColor &&
                                variantAttribute(variant, "size") === sizeChoice
                            )
                          ) {
                            setSelectedSize("");
                          } else {
                            setSelectedSize(sizeChoice);
                          }
                          setSelectedImageUrl("");
                          setCartError("");
                        }}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              {sizes.length > 0 && (
                <fieldset className="product-detail-option-group">
                  <legend>Kích cỡ</legend>
                  <div className="product-detail-option-list">
                    {sizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`product-detail-option${sizeChoice === size ? " active" : ""}`}
                        aria-pressed={sizeChoice === size}
                        onClick={() => {
                          const nextSize = sizeChoice === size ? "" : size;
                          setSelectionProductId(product.productId);
                          setSelectedSize(nextSize);
                          if (
                            nextSize &&
                            colorChoice &&
                            !availableVariants.some(
                              (variant) =>
                                variantAttribute(variant, "size") === nextSize &&
                                variantAttribute(variant, "color") === colorChoice
                            )
                          ) {
                            setSelectedColor("");
                          } else {
                            setSelectedColor(colorChoice);
                          }
                          setSelectedImageUrl("");
                          setCartError("");
                        }}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          ) : (
            <label className="field-wrap" htmlFor="product-detail-variant">
              Phiên bản
              <select
                id="product-detail-variant"
                className="select-field"
                value={effectiveSkuId}
                onChange={(event) => {
                  setSelectedSkuId(event.target.value);
                  setSelectedImageUrl("");
                  setCartError("");
                }}
              >
                <option value="">Chọn phiên bản</option>
                {product.variants.map((variant) => (
                  <option
                    key={variant.variantId}
                    value={variant.variantId}
                    disabled={!regularProduct || !purchasableVariant(variant)}
                  >
                    {variant.name || variant.skuCode} ({variant.skuCode}) ·{" "}
                    {purchasableVariant(variant) ? formatMoney(variant.price) : "Chưa thể mua"}
                  </option>
                ))}
              </select>
            </label>
          )}

          {selectedVariant && (
            <div className="product-detail-variant-facts">
              <span>Mã SKU: {selectedVariant.skuCode}</span>
              {selectedVariant.attributes
                ?.filter(
                  (attribute) =>
                    attribute.attrName &&
                    attribute.attrValue &&
                    (!canChooseAttributes ||
                      !["color", "colour", "mau", "mau sac", "size", "kich co"].includes(
                        normalizedAttributeName(attribute.attrName)
                      ))
                )
                .map((attribute) => (
                  <span key={`${attribute.attrName}-${attribute.attrValue}`}>
                    <strong>{attribute.attrName}:</strong> {attribute.attrValue}
                  </span>
                ))}
            </div>
          )}

          <p className="product-detail-availability" role="status">
            {canAdd
              ? "Chưa xác định tồn kho tổng hợp. Hệ thống sẽ kiểm tra khi thêm vào giỏ."
              : !regularProduct || availableVariants.length === 0
                ? "Sản phẩm hiện chưa thể mua."
                : selectedVariant
                  ? "Phiên bản này chưa thể mua."
                  : canChooseAttributes
                    ? "Chọn màu sắc và kích cỡ để thêm vào giỏ."
                    : "Chọn phiên bản để thêm vào giỏ."}
          </p>

          <label className="field-wrap" htmlFor="product-detail-quantity">
            Số lượng
            <input
              id="product-detail-quantity"
              className="field product-detail-quantity"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              aria-invalid={!validQuantity}
            />
          </label>
          {!validQuantity && <p className="product-detail-field-error" role="alert">Nhập số lượng nguyên lớn hơn 0.</p>}

          <div className="product-detail-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={!canAdd || adding}
              onClick={() => void addToCart()}
            >
              {adding ? "Đang thêm…" : "Thêm vào giỏ"}
            </button>
            <Link className="button button-secondary" href={ROUTES.buyer.cart}>
              Xem giỏ hàng
            </Link>
          </div>
          {cartError && <p className="notice" role="alert">{cartError}</p>}
        </div>
      </div>

      {/* CÁC KHUNG NỘI DUNG TIẾP THEO (Cách nhau đúng 10px theo yêu cầu) */}
      <div className="product-detail-content">
        {/* 2. KHUNG SHOP (Bỏ tiêu đề 'Gian hàng', có Avatar, nút 'Xem Shop' dưới tên shop, Đánh giá, Tổng sản phẩm) */}
        {product.sellerId && (
          <Card className="card-pad product-detail-seller-card">
            <div className="product-detail-seller-inner">
              <div className="product-detail-seller-left">
                <div className="product-detail-seller-avatar">
                  {sellerResource.data?.logoUrl ? (
                    <BackendImage
                      src={resolveImageUrl(sellerResource.data.logoUrl)}
                      alt={`Logo ${sellerResource.data.shopName}`}
                      compact
                    />
                  ) : (
                    <div className="seller-avatar-fallback">
                      <Icon name="warehouse" size={26} />
                    </div>
                  )}
                </div>
                <div className="product-detail-seller-identity">
                  <h3 className="product-detail-seller-name">
                    {sellerResource.data?.shopName || "Gian hàng đối tác"}
                  </h3>
                  <Link
                    className="button button-secondary button-small seller-view-shop-btn"
                    href={ROUTES.catalog.shop(product.sellerId)}
                  >
                    Xem Shop
                  </Link>
                </div>
              </div>

              <div className="product-detail-seller-divider" />

              <div className="product-detail-seller-stats">
                <div className="seller-stat-box">
                  <span className="seller-stat-label">Đánh giá</span>
                  <span className="seller-stat-value">
                    ★ {typeof sellerResource.data?.ratingAvg === "number" && sellerResource.data.ratingAvg > 0
                      ? sellerResource.data.ratingAvg.toFixed(1)
                      : "5.0"}{" "}
                    / 5.0
                  </span>
                </div>
                <div className="seller-stat-box">
                  <span className="seller-stat-label">Tổng sản phẩm</span>
                  <span className="seller-stat-value">
                    {typeof sellerResource.data?.totalProducts === "number" && sellerResource.data.totalProducts > 0
                      ? `${sellerResource.data.totalProducts} sản phẩm`
                      : "—"}
                  </span>
                </div>
                {sellerResource.data?.description && (
                  <div className="seller-stat-box seller-stat-desc-box">
                    <span className="seller-stat-label">Giới thiệu shop</span>
                    <p className="seller-stat-desc-text">{sellerResource.data.description}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* 3. KHUNG MÔ TẢ SẢN PHẨM (Tiêu đề nằm bên trong khung trắng) */}
        <Card className="card-pad product-detail-card" aria-labelledby="product-description-title">
          <h2 id="product-description-title" className="product-detail-inner-title">
            Mô tả sản phẩm
          </h2>
          <p className="product-detail-copy">
            {product.description?.trim() || "Người bán chưa cung cấp mô tả sản phẩm."}
          </p>
        </Card>

        {/* 3B. KHUNG THÔNG SỐ SẢN PHẨM (Tiêu đề nằm bên trong khung trắng) */}
        <Card className="card-pad product-detail-card" aria-labelledby="product-specifications-title">
          <h2 id="product-specifications-title" className="product-detail-inner-title">
            Thông số sản phẩm
          </h2>
          {specifications.entries.length > 0 ? (
            <dl className="product-detail-specifications">
              {specifications.entries.map(([label, value], index) => (
                <div key={`${label}-${index}`}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="product-detail-copy">
              {specifications.text || "Người bán chưa cung cấp thông số sản phẩm."}
            </p>
          )}
        </Card>

        {/* 4. KHUNG ĐÁNH GIÁ SẢN PHẨM (Tiêu đề nằm bên trong khung trắng) */}
        <ProductFeedback productId={product.productId} />

        {/* 5. KHUNG SẢN PHẨM CÙNG DANH MỤC (Có nút 'Xem thêm ->' chuyển sang trang catalog lọc danh mục) */}
        {product.category?.categoryId && (
          <Card className="card-pad product-detail-card" aria-labelledby="related-products-title">
            <div className="product-detail-related-header">
              <h2 id="related-products-title" className="product-detail-inner-title" style={{ margin: 0 }}>
                Sản phẩm cùng danh mục
              </h2>
              <Link
                className="product-detail-more-link"
                href={`${ROUTES.catalog.index}?categoryId=${encodeURIComponent(product.category.categoryId)}`}
              >
                <span>Xem thêm</span>
                <Icon name="arrow" size={14} />
              </Link>
            </div>

            {relatedResource.error && (
              <p className="notice" role="alert">Không tải được sản phẩm cùng danh mục.</p>
            )}

            {relatedProducts.length > 0 ? (
              <div className="product-detail-related">
                {relatedProducts.map((item) => (
                  <Link
                    className="product-detail-related-item"
                    href={ROUTES.catalog.product(item.productId)}
                    key={item.productId}
                  >
                    <div className="product-detail-related-image">
                      <BackendImage src={resolveImageUrl(item.primaryImageUrl)} alt="" compact />
                    </div>
                    <span className="related-item-title">{item.name}</span>
                    <strong className="related-item-price">{formatMoney(item.minPrice)}</strong>
                  </Link>
                ))}
              </div>
            ) : (
              !relatedResource.error && (
                <p className="product-detail-muted">
                  {relatedResource.loading ? "Đang tìm sản phẩm cùng danh mục…" : "Chưa có sản phẩm cùng danh mục."}
                </p>
              )
            )}
          </Card>
        )}
      </div>

      {/* POPUP BẢN NHỎ BÁO CÁO SẢN PHẨM */}
      <ProductReportModal
        productId={product.productId}
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />
    </div>
  );
}
