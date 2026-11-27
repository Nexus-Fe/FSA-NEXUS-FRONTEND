"use client";
/* Catalog and fulfillment responses are ungenerated Gateway JSON contracts. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ROUTES } from "@/constants/routes";
import { useSession } from "@/components/auth/SessionProvider";
import { Icon } from "@/components/ui/Icon";
import { FluidChoiceBar } from "@/components/ui/FluidChoiceBar";
import { AdminPagination, Badge, ButtonLink, Card, clickableRowProps, NoData, PageHeading, SectionHeading } from "@/components/ui/Primitives";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { describeProductStatus, formatMoney, resolveImageUrl, sellerProductStatusBadge } from "@/lib/presentation";
import { countFailedAttempts, fulfillmentService, hasShipmentToTrack, OrderProgressStepper, shipmentStatusLabel, ShipmentTimelineList, TrackingCodeBar } from "@/features/fulfillment";
import "@/features/fulfillment/components/shipping-tracking.css";
import { loadSafeRegistrationDraft, sellerService } from "./services/seller.service";
import { SavedShopArea, SellerShopAddressFields } from "./components/SellerShopAddressFields";
import { nextShopFormKey, shopFormSavedKey } from "./shop-form-key";
import { ghnWriteBlock, type GhnCheck } from "@/features/shipping/ghn-address";
import { ConfirmReturnButton } from "./components/ConfirmReturnButton";
import { canConfirmReturn } from "./return-rules";
import { SellerWarehouseGate } from "./components/SellerWarehouseForm";
import { describeShipmentRetryFailure, needsShipmentRetry } from "./shipment-retry-outcome";
import { useWarehouseReadiness } from "./use-warehouse-readiness";
import { acceptOrderBlock, warehouseReadiness } from "./warehouse-readiness";
import { isSellerWarehouse, sellerCatalogService, type InventoryBalance, type ProductVariant, type SellerProductDetail } from "./services/catalog.service";
import { sellerOrdersService } from "./services/seller-orders.service";
import { SellerBuyerReview } from "./SellerBuyerReview";
import { MAX_INVENTORY_QUANTITY } from "./services/inventory-quantity";
import { InventoryAlertsPanel } from "./components/InventoryAlertsPanel";
import { InventoryLedgerPanel } from "./components/InventoryLedgerPanel";
import { describeCategoryError, leafCategoryOptions } from "./services/category-options";
import { canSellerAccept, describeSellerOrderStatus, isCodPayment, paymentMethodLabel, sellerOrderStatusTone } from "./seller-order-rules";

export { BecomeSellerScreen } from "./BecomeSellerScreen";

type Obj = Record<string, any>;
const msg = (e: Error | null) => e?.message ?? "";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SPEC_PRESETS = ["Chất liệu", "Xuất xứ", "Bảo hành", "Kích thước", "Trọng lượng", "Bộ sản phẩm"];

type DraftImageItem = {
  id: string;
  file?: File;
  previewUrl: string;
  altText: string;
  isPrimary: boolean;
};

type DraftVariantItem = {
  id: string;
  variantId?: string;
  skuCode: string;
  name: string;
  price: string;
  weightGrams: string;
  currency: string;
  isActive: boolean;
  hasOrder?: boolean;
  attributes: Array<{ attrName: string; attrValue: string }>;
};

function canEditProductSku(product?: SellerProductDetail): boolean {
  if (!product) return true;
  const status = product.status.toUpperCase();
  if (status === "DRAFT") return true;
  if (status === "INACTIVE") {
    return product.statusReason?.toUpperCase() === "REJECTED" || Boolean(product.rejectionReason);
  }
  return false;
}

function buildAutoSku(productName: string, variantName: string, index: number): string {
  const clean = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toUpperCase();

  const pToken = clean(productName).split("-").slice(0, 3).join("-") || "NEX";
  const vToken = clean(variantName).split("-").slice(0, 2).join("-") || `V${index + 1}`;
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${pToken}-${vToken}-${suffix}`.slice(0, 48);
}

export function SellerProductsScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Resolve current active page: URL parameter has highest priority, then persistent sessionStorage
  const rawPage = searchParams.get("page");
  const page = useMemo(() => {
    if (rawPage && !isNaN(Number(rawPage)) && Number(rawPage) >= 1) {
      return Number(rawPage);
    }
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("seller_products_last_page");
      if (saved && !isNaN(Number(saved)) && Number(saved) >= 1) {
        return Number(saved);
      }
    }
    return 1;
  }, [rawPage]);

  const pageSize = useMemo(() => {
    const ps = searchParams.get("pageSize");
    if (ps && !isNaN(Number(ps)) && Number(ps) >= 1) return Number(ps);
    return 10;
  }, [searchParams]);

  const highlightParam = searchParams.get("highlight");
  const [clearedHighlightId, setClearedHighlightId] = useState<string | null>(null);

  const highlightedId = useMemo(() => {
    const rawId = highlightParam || (typeof window !== "undefined" ? sessionStorage.getItem("seller_products_highlight_id") : null);
    if (!rawId || rawId === clearedHighlightId) return null;
    return rawId;
  }, [highlightParam, clearedHighlightId]);

  const [q, setQ] = useState("");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const prevQRef = useRef(q);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const resource = useApiResource(
    `seller-products:${page}:${pageSize}:${keyword}:${statusFilter}`,
    (signal) => sellerCatalogService.list(page, keyword, signal, pageSize, statusFilter || undefined),
  );

  // Sync URL when page is restored from sessionStorage and not yet present in URL query
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!rawPage && page > 1) {
      const currentParams = new URLSearchParams(searchParams.toString());
      currentParams.set("page", String(page));
      router.replace(`${ROUTES.seller.products}?${currentParams.toString()}`);
    }
  }, [rawPage, page, searchParams, router]);

  // Keep sessionStorage in sync with current page
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("seller_products_last_page", String(page));
      sessionStorage.setItem("seller_products_page_size", String(pageSize));
    }
  }, [page, pageSize]);

  // Handle explicit page change (pushes history entry so browser Back goes to previous page)
  const handlePageChange = useCallback((newPage: number) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("seller_products_last_page", String(newPage));
    }
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.set("page", String(newPage));
    currentParams.delete("highlight");
    router.push(`${ROUTES.seller.products}?${currentParams.toString()}`);
  }, [searchParams, router]);

  // Live auto-search with debounce; only trigger when search query actually changes
  useEffect(() => {
    if (prevQRef.current === q) return;
    prevQRef.current = q;

    const timer = setTimeout(() => {
      const trimmed = q.trim();
      setKeyword(trimmed);
      handlePageChange(1);
    }, q.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [q, handlePageChange]);

  // Auto-scroll and flash green highlight effect on target product row (1.5s duration)
  useEffect(() => {
    if (!highlightedId || !resource.data?.items?.length) return;

    const targetId = highlightedId;
    const hasItem = resource.data.items.some((item) => item.productId === targetId);
    if (hasItem) {
      const scrollTimer = setTimeout(() => {
        const el = rowRefs.current.get(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 80);

      // Cleanup highlight animation after 1.5s so it only flashes once
      const clearTimer = setTimeout(() => {
        setClearedHighlightId(targetId);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("seller_products_highlight_id");
          const url = new URL(window.location.href);
          if (url.searchParams.has("highlight")) {
            url.searchParams.delete("highlight");
            window.history.replaceState(null, "", url.pathname + url.search);
          }
        }
      }, 1500);

      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [highlightedId, resource.data]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    setKeyword(trimmed);
    if (page !== 1) {
      handlePageChange(1);
    } else {
      resource.reload();
    }
  };

  const handleClear = () => {
    setQ("");
    setKeyword("");
    if (page !== 1) {
      handlePageChange(1);
    }
  };

  // Sort items prioritizing matches starting with keyword (prefix) then word prefix then contains
  const sortedItems = useMemo(() => {
    if (!resource.data?.items) return [];
    const items = [...resource.data.items];
    const kw = keyword.trim().toLowerCase();
    if (!kw) return items;

    const normalize = (str: string) =>
      str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d");
    const normKw = normalize(kw);

    return items.sort((a, b) => {
      const aName = (a.name || "").trim().toLowerCase();
      const bName = (b.name || "").trim().toLowerCase();
      const aNorm = normalize(aName);
      const bNorm = normalize(bName);

      // Ưu tiên 1: Tên sản phẩm bắt đầu bằng từ khóa (ví dụ "t" ở đầu tên)
      const aStarts = aName.startsWith(kw) || aNorm.startsWith(normKw);
      const bStarts = bName.startsWith(kw) || bNorm.startsWith(normKw);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Ưu tiên 2: Có từ trong tên bắt đầu bằng từ khóa (ví dụ: "Áo Thun" có từ "Thun" bắt đầu bằng "t")
      const aWordStarts = aNorm.split(/\s+/).some((w) => w.startsWith(normKw));
      const bWordStarts = bNorm.split(/\s+/).some((w) => w.startsWith(normKw));
      if (aWordStarts && !bWordStarts) return -1;
      if (!aWordStarts && bWordStarts) return 1;

      // Ưu tiên 3: Từ khóa xuất hiện càng sớm trong tên càng tốt
      const aIdx = aNorm.indexOf(normKw);
      const bIdx = bNorm.indexOf(normKw);
      if (aIdx !== -1 && bIdx !== -1 && aIdx !== bIdx) {
        return aIdx - bIdx;
      }

      return aName.localeCompare(bName, "vi");
    });
  }, [resource.data, keyword]);

  return (
    <>
      <PageHeading
        overline="Kênh người bán"
        title="Quản lý sản phẩm"
        description="Sản phẩm và trạng thái từ Catalog API."
      />
      <SectionHeading
        title="Danh sách sản phẩm"
        action={
          <ButtonLink href={ROUTES.seller.newProduct}>
            <Icon name="plus" size={17} /> Tạo sản phẩm mới
          </ButtonLink>
        }
      />
      <Card className="seller-products-list">
        <form
          className="toolbar seller-products-search"
          onSubmit={handleSearchSubmit}
        >
          <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
            <input
              className="field"
              placeholder="Tìm theo tên sản phẩm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: "100%", paddingRight: q ? 32 : undefined }}
            />
            {q && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  position: "absolute",
                  right: 8,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  fontSize: 14,
                  lineHeight: 1,
                }}
                title="Xóa tìm kiếm"
                aria-label="Xóa tìm kiếm"
              >
                ✕
              </button>
            )}
          </div>
          <select
            className="select-field"
            aria-label="Lọc theo trạng thái sản phẩm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              handlePageChange(1);
            }}
            style={{ width: "auto", minWidth: 170 }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="Active">Đang bán</option>
            <option value="PendingApproval">Chờ duyệt</option>
            <option value="Draft">Bản nháp / Bị từ chối</option>
            <option value="Inactive">Tạm ngưng / Bị đình chỉ</option>
          </select>
          <button type="submit" className="button button-secondary">Tìm kiếm</button>
        </form>
        {resource.error && (
          <p role="alert" className="notice">
            {msg(resource.error)}
          </p>
        )}
        {sortedItems.length ? (
          <div className="table-scroll">
            <table className="data-table seller-products-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Danh mục</th>
                  <th className="seller-product-price">Giá bán</th>
                  <th>Biến thể SKU</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((p) => {
                  const isTarget = highlightedId === p.productId;
                  return (
                    <tr
                      key={p.productId}
                      ref={(el) => {
                        if (el) rowRefs.current.set(p.productId, el);
                        else rowRefs.current.delete(p.productId);
                      }}
                      className={isTarget ? "seller-product-row-highlight" : undefined}
                    >
                      <td>
                        <Link
                          href={`${ROUTES.seller.product(p.productId)}?fromPage=${page}`}
                          onClick={() => {
                            if (typeof window !== "undefined") {
                              sessionStorage.setItem("seller_products_last_page", String(page));
                              sessionStorage.setItem("seller_products_highlight_id", p.productId);
                            }
                          }}
                        >
                          <strong>{p.name}</strong>
                        </Link>
                        {p.brand && <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.brand}</div>}
                      </td>
                      <td>{p.categoryName || "—"}</td>
                      <td className="seller-product-price">
                        <strong>{formatMoney(p.minPrice ?? null)}</strong>
                      </td>
                      <td>{p.variantCount} SKU</td>
                      <td>
                        {(() => {
                          const badge = sellerProductStatusBadge(p.status, p.statusReason);
                          const reason = p.rejectionReason ?? (p.statusReason && !["REJECTED", "ADMINLOCKED"].includes(p.statusReason.toUpperCase()) ? p.statusReason : null);
                          return (
                            <>
                              <Badge tone={badge.tone}>{badge.label}</Badge>
                              {reason && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{reason}</div>}
                            </>
                          );
                        })()}
                      </td>
                      <td>
                        <ButtonLink
                          href={`${ROUTES.seller.editProduct(p.productId)}?fromPage=${page}`}
                          variant="secondary"
                          onClick={() => {
                            if (typeof window !== "undefined") {
                              sessionStorage.setItem("seller_products_last_page", String(page));
                              sessionStorage.setItem("seller_products_highlight_id", p.productId);
                            }
                          }}
                        >
                          Điều chỉnh
                        </ButtonLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : resource.loading ? (
          <TableSkeleton rows={6} cols={6} label="Đang tải sản phẩm…" />
        ) : (
          <NoData
            title={
              resource.error
                ? "Không tải được sản phẩm"
                : "Chưa có sản phẩm"
            }
          />
        )}
        {resource.data && <div className="seller-products-pagination">
          <label className="seller-products-page-size">Hiển thị
            <select
              className="select-field"
              value={pageSize}
              onChange={(event) => {
                const newSize = Number(event.target.value);
                const currentParams = new URLSearchParams(searchParams.toString());
                currentParams.set("page", "1");
                currentParams.set("pageSize", String(newSize));
                router.push(`${ROUTES.seller.products}?${currentParams.toString()}`);
              }}
            >
              <option value={10}>10</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
            sản phẩm/trang
          </label>
          <nav className="seller-products-page-controls" aria-label="Phân trang sản phẩm">
            <PaginationBar page={page} totalPages={Math.max(1, resource.data.pagination.totalPages)} onPageChange={handlePageChange} disabled={resource.loading} />
          </nav>
        </div>}
      </Card>
    </>
  );
}

export function SellerProductEditScreen() {
  const { id } = useParams<{ id: string }>();
  const product = useApiResource(id ? `seller-product-edit:${id}` : null,
    (signal) => sellerCatalogService.detail(id, signal));
  if (product.error) return <p className="notice" role="alert">Không tải được sản phẩm: {msg(product.error)}</p>;
  if (!product.data) return <NoData title="Đang tải sản phẩm để chỉnh sửa…" />;
  return <SellerProductEditorScreen key={product.data.productId} initialProduct={product.data} />;
}

export function SellerProductEditorScreen({ initialProduct }: { initialProduct?: SellerProductDetail }) {
  const { user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState(initialProduct?.name ?? "");
  const [categoryId, setCategoryId] = useState(initialProduct?.categoryId ?? "");
  const [brand, setBrand] = useState(initialProduct?.brand ?? "");
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [weightGrams, setWeightGrams] = useState(String(initialProduct?.weightGrams ?? ""));

  // Track session for back navigation and row flash highlight
  useEffect(() => {
    if (typeof window !== "undefined") {
      const fromPage = searchParams?.get("fromPage");
      if (fromPage && !isNaN(Number(fromPage)) && Number(fromPage) >= 1) {
        sessionStorage.setItem("seller_products_last_page", fromPage);
      }
      if (initialProduct?.productId) {
        sessionStorage.setItem("seller_products_highlight_id", initialProduct.productId);
      }
    }
  }, [searchParams, initialProduct?.productId]);

  const handleBackToList = () => {
    let targetPage = 1;
    if (typeof window !== "undefined") {
      const fromPage = searchParams?.get("fromPage");
      const savedPage = sessionStorage.getItem("seller_products_last_page");
      if (fromPage && !isNaN(Number(fromPage)) && Number(fromPage) >= 1) {
        targetPage = Number(fromPage);
      } else if (savedPage && !isNaN(Number(savedPage)) && Number(savedPage) >= 1) {
        targetPage = Number(savedPage);
      }
      if (initialProduct?.productId) {
        sessionStorage.setItem("seller_products_highlight_id", initialProduct.productId);
      }
      sessionStorage.setItem("seller_products_last_page", String(targetPage));
    }
    const highlightQuery = initialProduct?.productId ? `&highlight=${encodeURIComponent(initialProduct.productId)}` : "";
    router.push(`${ROUTES.seller.products}?page=${targetPage}${highlightQuery}`);
  };

  // Dynamic specifications (JSON object per R105_POST_PRODUCTS.md)
  const [specs, setSpecs] = useState<Array<{ key: string; value: string }>>(() => initialProduct
    ? (Array.isArray(initialProduct.specifications) ? initialProduct.specifications : []).map((spec) => ({ key: spec.name, value: spec.value }))
    : [{ key: "Bảo hành", value: "12 tháng chính hãng" }, { key: "Xuất xứ", value: "Việt Nam" }]);

  // Product images (1-5 images uploaded during creation)
  const [images, setImages] = useState<DraftImageItem[]>(() => initialProduct?.images
    .filter((image) => !image.variantId)
    .map((image) => ({ id: image.id, previewUrl: resolveImageUrl(image.url) ?? image.url, altText: image.altText ?? "", isPrimary: image.isActive })) ?? []);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]);

  // Product variants (1-10 variants with custom attributes & initial stock)
  const [variants, setVariants] = useState<DraftVariantItem[]>(() => initialProduct
    ? initialProduct.variants.map((variant) => ({
        id: variant.variantId,
        variantId: variant.variantId,
        skuCode: variant.skuCode,
        name: variant.name,
        price: String(variant.price ?? ""),
        weightGrams: variant.weightGrams == null ? "" : String(variant.weightGrams),
        currency: variant.currency || "VND",
        isActive: variant.isActive,
        hasOrder: variant.hasOrder,
        attributes: variant.attributes ?? [],
      }))
    : [{
        id: "var-1", skuCode: "", name: "Tiêu chuẩn", price: "", weightGrams: "",
        currency: "VND", isActive: true,
        attributes: [{ attrName: "Màu sắc", attrValue: "" }, { attrName: "Kích cỡ", attrValue: "" }],
      }]);

  const [error, setError] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [busy, setBusy] = useState(false);

  const categories = useApiResource("seller-product-categories", sellerCatalogService.categories);
  const categoryOptions = leafCategoryOptions(categories.data ?? []);
  const selectedCategory = categoryOptions.find((c) => c.categoryId === categoryId)
    ?? (initialProduct && categoryId === initialProduct.categoryId
      ? { categoryId, label: initialProduct.categoryName ?? categoryId }
      : undefined);

  function handleSelectImages(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError("");
    const next: DraftImageItem[] = [...images];
    for (const file of Array.from(fileList)) {
      if (next.length >= 5) {
        setError("Một sản phẩm hỗ trợ tối đa 5 ảnh đại diện chung.");
        break;
      }
      if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
        setError(`Ảnh "${file.name}" không hợp lệ. Chỉ nhận JPG, PNG, WEBP tối đa 5 MB.`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl,
        altText: name.trim() || file.name.replace(/\.[^.]+$/, ""),
        isPrimary: next.length === 0,
      });
    }
    setImages(next);
  }

  function setPrimaryDraftImage(targetId: string) {
    setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === targetId })));
  }

  function removeDraftImage(targetId: string) {
    if (initialProduct?.images.some((image) => image.id === targetId)) {
      setDeletedImageIds((current) => [...current, targetId]);
    }
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== targetId);
      if (filtered.length > 0 && !filtered.some((img) => img.isPrimary)) {
        filtered[0] = { ...filtered[0], isPrimary: true };
      }
      return filtered;
    });
  }

  function addSpecRow(presetKey = "") {
    if (presetKey && specs.some((s) => s.key.toLowerCase() === presetKey.toLowerCase())) return;
    setSpecs((prev) => [...prev, { key: presetKey, value: "" }]);
  }

  function updateSpecRow(index: number, field: "key" | "value", val: string) {
    setSpecs((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: val } : item)));
  }

  function removeSpecRow(index: number) {
    setSpecs((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addVariantCard() {
    if (variants.length >= 10) return;
    const nextIdx = variants.length + 1;
    setVariants((prev) => [
      ...prev,
      {
        id: `var-${Date.now()}-${nextIdx}`,
        skuCode: "",
        name: `Phiên bản #${nextIdx}`,
        price: prev[0]?.price || "",
        weightGrams: "",
        currency: "VND",
        isActive: false,
        attributes: [{ attrName: "Màu sắc", attrValue: "" }],
      },
    ]);
  }

  function updateVariantField(index: number, field: keyof DraftVariantItem, value: any) {
    setVariants((prev) =>
      prev.map((v, idx) => {
        if (field === "isActive") {
          return { ...v, isActive: idx === index };
        }
        return idx === index ? { ...v, [field]: value } : v;
      }),
    );
  }

  function addVariantAttribute(variantIdx: number, presetName = "") {
    setVariants((prev) =>
      prev.map((v, idx) =>
        idx === variantIdx
          ? { ...v, attributes: [...v.attributes, { attrName: presetName, attrValue: "" }] }
          : v,
      ),
    );
  }

  function updateVariantAttribute(
    variantIdx: number,
    attrIdx: number,
    field: "attrName" | "attrValue",
    value: string,
  ) {
    setVariants((prev) =>
      prev.map((v, idx) =>
        idx === variantIdx
          ? {
              ...v,
              attributes: v.attributes.map((a, aIdx) => (aIdx === attrIdx ? { ...a, [field]: value } : a)),
            }
          : v,
      ),
    );
  }

  function removeVariantAttribute(variantIdx: number, attrIdx: number) {
    setVariants((prev) =>
      prev.map((v, idx) =>
        idx === variantIdx
          ? { ...v, attributes: v.attributes.filter((_, aIdx) => aIdx !== attrIdx) }
          : v,
      ),
    );
  }

  function removeVariantCard(index: number) {
    if (variants.length <= 1) return;
    if (variants[index].variantId) setDeletedVariantIds((current) => [...current, variants[index].variantId!]);
    setVariants((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      if (!next.some((v) => v.isActive) && next.length > 0) {
        next[0] = { ...next[0], isActive: true };
      }
      return next;
    });
  }

  async function submitProduct(publishImmediately: boolean) {
    setBusy(true);
    setError("");
    setProgressNote("");
    try {
      if (!user?.id) throw new Error("Bạn cần đăng nhập tài khoản Seller để tạo sản phẩm.");
      if (!name.trim()) throw new Error("Vui lòng nhập tên sản phẩm.");
      if (!categoryId) throw new Error("Vui lòng chọn một danh mục ngành hàng lá.");
      const shippingWeight = Number(weightGrams);
      if (!Number.isSafeInteger(shippingWeight) || shippingWeight <= 0) throw new Error("Khối lượng vận chuyển phải là số nguyên lớn hơn 0 gram.");

      if (publishImmediately && images.length === 0 && !(initialProduct?.images.some((image) => image.variantId && !deletedImageIds.includes(image.id)))) {
        throw new Error(
          "Để gửi sản phẩm cho staff duyệt, cần ít nhất 1 ảnh đại diện. Vui lòng chọn ảnh ở Mục 2 hoặc lưu bản nháp.",
        );
      }

      const specifications = specs
        .map((row) => ({ name: row.key.trim(), value: row.value.trim() }))
        .filter((row) => row.name && row.value);
      // Validate and normalize variants
      const preparedVariants = variants.map((v, idx) => {
        const sku = v.skuCode.trim();
        if (!sku) {
          throw new Error(`Biến thể #${idx + 1}: Vui lòng nhập mã SKU của shop (hoặc bấm nút gợi ý).`);
        }
        const parsedPrice = Number(v.price);
        if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
          throw new Error(`Biến thể #${idx + 1} (${sku}): Giá bán phải lớn hơn 0 ₫.`);
        }
        const variantWeight = v.weightGrams.trim() ? Number(v.weightGrams) : null;
        if (variantWeight !== null && (!Number.isSafeInteger(variantWeight) || variantWeight <= 0)) {
          throw new Error(`Biến thể #${idx + 1} (${sku}): Khối lượng phải là số nguyên lớn hơn 0 gram.`);
        }
        const cleanAttrs = v.attributes
          .map((a) => ({ attrName: a.attrName.trim(), attrValue: a.attrValue.trim() }))
          .filter((a) => a.attrName && a.attrValue);

        return {
          variantId: v.variantId,
          skuCode: sku,
          name: v.name.trim() || name.trim(),
          price: parsedPrice,
          currency: v.currency || "VND",
          isActive: v.isActive,
          hasOrder: v.hasOrder,
          weightGrams: variantWeight,
          attributes: cleanAttrs,
        };
      });

      if (initialProduct) {
        setProgressNote("Đang cập nhật thông tin và biến thể sản phẩm…");
        await sellerCatalogService.update(initialProduct.productId, {
          name: name.trim(), description: description.trim(), brand: brand.trim(), categoryId, specifications, weightGrams: shippingWeight,
        });
        let defaultVariantId = "";
        const canEditExistingSku = canEditProductSku(initialProduct);
        for (const variant of preparedVariants) {
          if (variant.variantId) {
            await sellerCatalogService.updateVariant(variant.variantId, {
              ...(canEditExistingSku && !variant.hasOrder ? { skuCode: variant.skuCode } : {}),
              name: variant.name, price: variant.price, currency: variant.currency, attributes: variant.attributes, weightGrams: variant.weightGrams,
            });
            if (variant.isActive) defaultVariantId = variant.variantId;
          } else {
            const createdVariant = await sellerCatalogService.addVariant(initialProduct.productId, variant);
            if (variant.isActive) defaultVariantId = createdVariant.variantId;
          }
        }
        for (const variantId of deletedVariantIds) await sellerCatalogService.deleteVariant(variantId);
        if (defaultVariantId && defaultVariantId !== initialProduct.variants.find((variant) => variant.isActive)?.variantId) {
          await sellerCatalogService.setDefaultVariant(initialProduct.productId, defaultVariantId);
        }
        for (const imageId of deletedImageIds) await sellerCatalogService.deleteImage(initialProduct.productId, imageId);
        const newImages = images.filter((image) => image.file);
        for (let index = 0; index < newImages.length; index += 1) {
          const image = newImages[index];
          const uploaded = await sellerCatalogService.uploadImage(initialProduct.productId, image.file!, image.altText.trim() || name.trim(), index);
          if (image.isPrimary && uploaded.id) await sellerCatalogService.setPrimaryImage(uploaded.id, image.altText.trim() || name.trim());
        }
        const selectedExistingImage = images.find((image) => image.isPrimary && !image.file);
        if (selectedExistingImage) await sellerCatalogService.setPrimaryImage(selectedExistingImage.id, selectedExistingImage.altText.trim() || name.trim());
        if (publishImmediately && initialProduct.status.toUpperCase() !== "ACTIVE") {
          await sellerCatalogService.changeStatus(initialProduct.productId, "PENDING_APPROVAL");
        }
        let targetPage = 1;
        if (typeof window !== "undefined") {
          const fromPage = searchParams?.get("fromPage");
          const savedPage = sessionStorage.getItem("seller_products_last_page");
          if (fromPage && !isNaN(Number(fromPage)) && Number(fromPage) >= 1) {
            targetPage = Number(fromPage);
          } else if (savedPage && !isNaN(Number(savedPage)) && Number(savedPage) >= 1) {
            targetPage = Number(savedPage);
          }
          sessionStorage.setItem("seller_products_last_page", String(targetPage));
          sessionStorage.setItem("seller_products_highlight_id", initialProduct.productId);
        }
        const targetUrl = `${ROUTES.seller.products}?page=${targetPage}&highlight=${encodeURIComponent(initialProduct.productId)}`;
        router.push(targetUrl);
        return;
      }

      setProgressNote("Bước 1/3: Đang tạo sản phẩm và SKU trong Catalog…");
      const created = await sellerCatalogService.create({
        sellerId: user.id,
        categoryId,
        name: name.trim(),
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        weightGrams: shippingWeight,
        specifications,
        variants: preparedVariants,
      });

      const productId = created.id || created.productId;
      if (!productId) throw new Error("Catalog API chưa trả về mã sản phẩm.");

      // Upload images sequentially so sortOrder and primary image are preserved
      if (images.length > 0) {
        // Put primary image first so it automatically becomes active cover image on upload
        const orderedImages = [...images].sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
        for (let i = 0; i < orderedImages.length; i++) {
          const item = orderedImages[i];
          setProgressNote(`Bước 2/3: Đang tải ảnh sản phẩm (${i + 1}/${orderedImages.length})…`);
          const uploaded = await sellerCatalogService.uploadImage(
            productId,
            item.file!,
            item.altText.trim() || name.trim(),
            i,
          );
          if (item.isPrimary && i > 0 && uploaded?.id) {
            await sellerCatalogService.setPrimaryImage(uploaded.id, item.altText.trim() || name.trim());
          }
        }
      }

      if (publishImmediately) {
        setProgressNote("Bước 3/3: Đang gửi sản phẩm để staff duyệt…");
        await sellerCatalogService.changeStatus(productId, "PENDING_APPROVAL");
      }

      router.push(ROUTES.seller.product(productId));
    } catch (ex) {
      setError(describeCategoryError(msg(ex as Error)));
      setBusy(false);
      setProgressNote("");
    }
  }

  // Live preview metrics
  const primaryPreviewImage = images.find((i) => i.isPrimary) ?? images[0];
  const validPrices = variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n) && n > 0);
  const minPreviewPrice = validPrices.length ? Math.min(...validPrices) : null;
  const maxPreviewPrice = validPrices.length ? Math.max(...validPrices) : null;
  const isBasicReady = Boolean(name.trim() && categoryId && Number.isSafeInteger(Number(weightGrams)) && Number(weightGrams) > 0);
  const isVariantsReady =
    variants.length > 0 &&
    variants.every(
      (v) =>
        Number.isFinite(Number(v.price)) &&
        Number(v.price) > 0 &&
        (!v.weightGrams.trim() || (Number.isSafeInteger(Number(v.weightGrams)) && Number(v.weightGrams) > 0)),
    );
  const isImageReady = images.length > 0 || Boolean(initialProduct?.images.some((image) => image.variantId && !deletedImageIds.includes(image.id)));

  return (
    <>
      <PageHeading
        overline="Kênh người bán"
        title={initialProduct ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm"}
        description={initialProduct ? "Chỉnh sửa thông tin, ảnh và biến thể sản phẩm." : "Tạo sản phẩm và SKU trước, sau đó nhập hàng tại Quản lý kho."}
      />

      {error && (
        <p role="alert" className="notice" style={{ marginBottom: 18 }}>
          {error}
        </p>
      )}
      {progressNote && (
        <p role="status" className="form-success" style={{ marginBottom: 18 }}>
          {progressNote}
        </p>
      )}

      <div className="seller-studio-layout">
        <div className="seller-studio-main">
          {/* SECTION 1: BASIC INFO */}
          <Card className="card-pad">
            <div className="seller-section-head">
              <div className="seller-section-title-group">
                <span className="seller-section-step">1</span>
                <div>
                  <h2>Thông tin cơ bản & Ngành hàng</h2>
                  <p>Tên sản phẩm rõ ràng, đúng danh mục giúp người mua dễ tìm kiếm và lọc trên sàn.</p>
                </div>
              </div>
              <Badge>{isBasicReady ? "Đã hoàn tất" : "Bắt buộc"}</Badge>
            </div>

            <div className="auth-fields">
              <label className="field-wrap">
                <span>
                  Tên sản phẩm <strong style={{ color: "#dc2626" }}>*</strong>
                </span>
                <input
                  className="field"
                  required
                  maxLength={255}
                  placeholder="Ví dụ: Đồng Hồ Cơ Orient Bambino Gen 4 Mặt Trắng Dây Da Nâu"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <div className="form-grid">
                <label className="field-wrap"><span>Khối lượng vận chuyển (gram) *</span><input className="field" type="number" min="1" step="1" required value={weightGrams} onChange={(event) => setWeightGrams(event.target.value)} /></label>
                <label className="field-wrap">
                  <span>
                    Danh mục ngành hàng <strong style={{ color: "#dc2626" }}>*</strong>
                  </span>
                  <select
                    className="select-field"
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Chọn danh mục</option>
                    {initialProduct && !categoryOptions.some((option) => option.categoryId === initialProduct.categoryId) && (
                      <option value={initialProduct.categoryId}>{initialProduct.categoryName ?? "Danh mục hiện tại"}</option>
                    )}
                    {categoryOptions.map((option) => (
                      <option key={option.categoryId} value={option.categoryId}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {categories.error && <small role="alert">{msg(categories.error)}</small>}
                </label>

                <label className="field-wrap">
                  <span>Thương hiệu (Brand)</span>
                  <input
                    className="field"
                    maxLength={150}
                    placeholder="Ví dụ: Orient, Seiko, Apple, Nexus Official…"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </label>
              </div>

              <label className="field-wrap">
                <span>Mô tả chi tiết sản phẩm</span>
                <textarea
                  className="textarea-field"
                  maxLength={4000}
                  placeholder="Mô tả đặc điểm nổi bật, công dụng, chính sách bảo hành và hướng dẫn sử dụng…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </div>
          </Card>

          {/* SECTION 2: IMAGES */}
          <Card className="card-pad">
            <div className="seller-section-head">
              <div className="seller-section-title-group">
                <span className="seller-section-step">2</span>
                <div>
                  <h2>Hình ảnh sản phẩm ({images.length}/5 ảnh)</h2>
                  <p>
                    Tải lên từ 1–5 ảnh (.jpg, .png, .webp, tối đa 5 MB/ảnh). Cần ít nhất 1 ảnh bìa để kích hoạt mở bán
                    ngay.
                  </p>
                </div>
              </div>
              <Badge>{isImageReady ? `Đã chọn ${images.length} ảnh` : "Cần khi gửi duyệt"}</Badge>
            </div>

            {images.length < 5 && (
              <label className="seller-image-dropzone">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    handleSelectImages(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
                <Icon name="plus" size={24} />
                <strong>Bấm để chọn ảnh sản phẩm (có thể chọn nhiều ảnh cùng lúc)</strong>
                <small>Hỗ trợ định dạng JPG, PNG, WEBP · Dung lượng tối đa 5 MB / ảnh</small>
              </label>
            )}

            {images.length > 0 && (
              <div className="seller-image-preview-grid">
                {images.map((img, index) => (
                  <div
                    key={img.id}
                    className={`seller-image-preview-card${img.isPrimary ? " is-primary" : ""}`}
                  >
                    <div
                      className="seller-image-preview-thumb"
                      style={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: "1",
                        background: "#f8fafc",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 4,
                        overflow: "hidden",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt={img.altText || `Ảnh ${index + 1}`}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                      {img.isPrimary && <span className="seller-image-cover-pill">★ Ảnh bìa chính</span>}
                    </div>
                    <input
                      className="field"
                      style={{ minHeight: 34, fontSize: 12 }}
                      placeholder="Mô tả ảnh (Alt text)"
                      value={img.altText}
                      onChange={(e) =>
                        setImages((prev) =>
                          prev.map((item) => (item.id === img.id ? { ...item, altText: e.target.value } : item)),
                        )
                      }
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      {!img.isPrimary && (
                        <button
                          type="button"
                          className="button button-secondary button-small"
                          style={{ flex: 1 }}
                          onClick={() => setPrimaryDraftImage(img.id)}
                        >
                          Đặt làm bìa
                        </button>
                      )}
                      <button
                        type="button"
                        className="button button-secondary button-small"
                        style={{ flex: img.isPrimary ? 1 : undefined }}
                        onClick={() => removeDraftImage(img.id)}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* SECTION 3: SPECIFICATIONS JSON */}
          <Card className="card-pad">
            <div className="seller-section-head">
              <div className="seller-section-title-group">
                <span className="seller-section-step">3</span>
                <div>
                  <h2>Thông số kỹ thuật (Specifications)</h2>
                  <p>Hiển thị tại bảng thông số chi tiết sản phẩm, tự động đóng gói chuẩn JSON Object.</p>
                </div>
              </div>
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => addSpecRow("")}
              >
                <Icon name="plus" size={14} /> Thêm thông số
              </button>
            </div>

            <div className="seller-preset-bar">
              <span>Gợi ý nhanh:</span>
              {SPEC_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="seller-preset-chip"
                  onClick={() => addSpecRow(preset)}
                >
                  + {preset}
                </button>
              ))}
            </div>

            <div className="seller-spec-list">
              {specs.map((row, idx) => (
                <div key={idx} className="seller-spec-row">
                  <input
                    className="field"
                    placeholder="Tên thông số (VD: Chất liệu)"
                    value={row.key}
                    onChange={(e) => updateSpecRow(idx, "key", e.target.value)}
                  />
                  <input
                    className="field"
                    placeholder="Giá trị (VD: Thép không gỉ 316L)"
                    value={row.value}
                    onChange={(e) => updateSpecRow(idx, "value", e.target.value)}
                  />
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={() => removeSpecRow(idx)}
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* SECTION 4: WAREHOUSE & SKU VARIANTS */}
          <Card className="card-pad">
            <div className="seller-section-head">
              <div className="seller-section-title-group">
                <span className="seller-section-step">4</span>
                <div>
                  <h2>Biến thể SKU ({variants.length}/10)</h2>
                  <p>Tạo SKU và giá bán. Số lượng được nhập riêng theo từng kho tại Quản lý kho.</p>
                </div>
              </div>
              {variants.length < 10 && (
                <button
                  type="button"
                  className="button button-secondary button-small"
                  onClick={addVariantCard}
                >
                  <Icon name="plus" size={14} /> Thêm biến thể SKU
                </button>
              )}
            </div>

            {/* Variants List */}
            <div className="seller-variant-stack">
              {variants.map((variant, vIdx) => (
                <div
                  key={variant.id}
                  className={`seller-variant-card${variant.isActive ? " is-default" : ""}`}
                >
                  <div className="seller-variant-card-header">
                    <div className="seller-variant-card-title">
                      <span>Biến thể #{vIdx + 1}</span>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: variant.isActive ? "var(--sky-dark)" : "var(--muted)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          name="defaultVariant"
                          checked={variant.isActive}
                          onChange={() => updateVariantField(vIdx, "isActive", true)}
                        />
                        {variant.isActive ? "★ Biến thể mặc định" : "Đặt làm mặc định"}
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {variants.length > 1 && (
                        <button
                          type="button"
                          className="button button-secondary button-small"
                          onClick={() => removeVariantCard(vIdx)}
                        >
                          Xóa biến thể
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-grid">
                    <label className="field-wrap">
                      <span>
                        Mã SKU <strong style={{ color: "#dc2626" }}>*</strong>
                      </span>
                      <div className="seller-sku-input-group">
                        <input
                          className="field"
                          required
                          placeholder="VD: TENSHOP-SANPHAM-MAU (duy nhất trong shop)"
                          value={variant.skuCode}
                          disabled={Boolean(variant.variantId) && (Boolean(variant.hasOrder) || !canEditProductSku(initialProduct))}
                          onChange={(e) => updateVariantField(vIdx, "skuCode", e.target.value)}
                        />
                        <button
                          type="button"
                          className="button button-secondary button-small seller-sku-generate"
                          aria-label="Gợi ý mã SKU"
                          title="Gợi ý mã SKU"
                          disabled={Boolean(variant.variantId) && (Boolean(variant.hasOrder) || !canEditProductSku(initialProduct))}
                          onClick={() => updateVariantField(vIdx, "skuCode", buildAutoSku(name, variant.name, vIdx))}
                        >
                          +
                        </button>
                      </div>
                    </label>

                    <label className="field-wrap">
                      <span>
                        Tên biến thể <strong style={{ color: "#dc2626" }}>*</strong>
                      </span>
                      <input
                        className="field"
                        required
                        placeholder="VD: Dây da nâu - Mặt trắng 40mm"
                        value={variant.name}
                        onChange={(e) => updateVariantField(vIdx, "name", e.target.value)}
                      />
                    </label>

                    <label className="field-wrap">
                      <span>
                        Giá bán (VND) <strong style={{ color: "#dc2626" }}>*</strong>
                      </span>
                      <input
                        type="number"
                        min="1"
                        required
                        className="field"
                        placeholder="VD: 3400000"
                        value={variant.price}
                        onChange={(e) => updateVariantField(vIdx, "price", e.target.value)}
                      />
                    </label>

                    <label className="field-wrap">
                      <span>Khối lượng riêng (gram)</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="field"
                        placeholder={`Để trống dùng ${weightGrams || "khối lượng sản phẩm"} gram`}
                        value={variant.weightGrams}
                        onChange={(e) => updateVariantField(vIdx, "weightGrams", e.target.value)}
                      />
                    </label>

                    <p className="status-note">Số lượng tồn được khai báo theo SKU và kho tại trang Quản lý kho sau khi tạo sản phẩm.</p>
                  </div>

                  {/* Variant Attributes */}
                  <div className="seller-attr-list">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                        Thuộc tính phân loại của biến thể (Màu sắc, Kích cỡ, Phiên bản…)
                      </span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {["Màu sắc", "Kích cỡ", "Dung lượng", "Chất liệu"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            className="seller-preset-chip"
                            onClick={() => addVariantAttribute(vIdx, preset)}
                          >
                            + {preset}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="seller-preset-chip"
                          onClick={() => addVariantAttribute(vIdx)}
                        >
                          + Thuộc tính
                        </button>
                      </div>
                    </div>

                    {variant.attributes.map((attr, aIdx) => (
                      <div key={aIdx} className="seller-attr-row">
                        <input
                          className="field"
                          placeholder="Tên thuộc tính (VD: Màu sắc)"
                          value={attr.attrName}
                          onChange={(e) => updateVariantAttribute(vIdx, aIdx, "attrName", e.target.value)}
                        />
                        <input
                          className="field"
                          placeholder="Giá trị (VD: Xanh Navy)"
                          value={attr.attrValue}
                          onChange={(e) => updateVariantAttribute(vIdx, aIdx, "attrValue", e.target.value)}
                        />
                        <button
                          type="button"
                          className="button button-secondary button-small"
                          onClick={() => removeVariantAttribute(vIdx, aIdx)}
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* STICKY RIGHT RAIL: LIVE PREVIEW & READINESS CHECKLIST */}
        <aside className="seller-studio-rail">
          <Card className="card-pad">
            <SectionHeading title="Xem trước" />
            <div className="seller-preview-card">
              <div
                className="seller-preview-media"
                style={{
                  minHeight: 180,
                  maxHeight: 360,
                  height: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f8fafc",
                  padding: 8,
                }}
              >
                {primaryPreviewImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={primaryPreviewImage.previewUrl}
                    alt={name || "Preview"}
                    style={{
                      maxWidth: "100%",
                      maxHeight: 340,
                      width: "auto",
                      height: "auto",
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                ) : (
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>Chưa chọn ảnh bìa</span>
                )}
              </div>
              <div className="seller-preview-body">
                <span className="seller-preview-brand">
                  {brand.trim() || selectedCategory?.label || "NEXUS MERCHANT"}
                </span>
                <h3 className="seller-preview-title">{name.trim() || "Tên sản phẩm sẽ hiển thị tại đây"}</h3>
                <div className="seller-preview-price">
                  {minPreviewPrice !== null
                    ? minPreviewPrice === maxPreviewPrice
                      ? formatMoney(minPreviewPrice)
                      : `${formatMoney(minPreviewPrice)} – ${formatMoney(maxPreviewPrice)}`
                    : "Chưa nhập giá"}
                </div>
                <div className="seller-preview-meta">
                  <span>{variants.length} biến thể SKU</span>
                  <strong>Tồn kho xem và nhập tại Quản lý kho</strong>
                </div>
              </div>
            </div>

            <ul className="seller-checklist">
              <li>
                <span className={`seller-check-indicator${isBasicReady ? " is-ready" : ""}`}>
                  {isBasicReady ? "✓" : "1"}
                </span>
                <span>
                  <strong>Thông tin & Danh mục:</strong>{" "}
                  {isBasicReady ? selectedCategory?.label : "Cần nhập tên & chọn danh mục"}
                </span>
              </li>
              <li>
                <span className={`seller-check-indicator${isVariantsReady ? " is-ready" : ""}`}>
                  {isVariantsReady ? "✓" : "2"}
                </span>
                <span>
                  <strong>Biến thể & Giá bán:</strong>{" "}
                  {isVariantsReady
                    ? `${variants.length} SKU hợp lệ`
                    : "Nhập giá bán lớn hơn 0"}
                </span>
              </li>
              <li>
                <span className={`seller-check-indicator${isImageReady ? " is-ready" : ""}`}>
                  {isImageReady ? "✓" : "!"}
                </span>
                <span>
                  <strong>Ảnh đại diện mở bán:</strong>{" "}
                  {isImageReady
                    ? `Đã sẵn sàng ${images.length} ảnh sản phẩm`
                    : "Cần ít nhất 1 ảnh nếu muốn gửi duyệt"}
                </span>
              </li>
            </ul>

            <div className="seller-studio-actions">
              <button
                type="button"
                className="button button-primary"
                disabled={busy || !isBasicReady || !isVariantsReady}
                onClick={() => void submitProduct(true)}
              >
                {busy ? "Đang lưu…" : "Gửi sản phẩm để staff duyệt"}
              </button>

              <button
                type="button"
                className="button button-secondary"
                disabled={busy || !isBasicReady || !isVariantsReady}
                onClick={() => void submitProduct(false)}
              >
                {busy ? "Đang lưu…" : initialProduct ? "Lưu thay đổi" : "Lưu bản nháp"}
              </button>

              <button
                type="button"
                className="button button-secondary"
                onClick={handleBackToList}
              >
                Quay lại danh sách
              </button>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}

const SELLER_INVENTORY_TABS = [
  { value: "stock", label: "Sản phẩm & SKU trong kho" },
  { value: "alerts", label: "Cảnh báo tồn kho" },
  { value: "ledger", label: "Sổ kho" },
] as const;

type SellerInventoryTabKey = (typeof SELLER_INVENTORY_TABS)[number]["value"];

export function SellerInventoryScreen() {
  const { user } = useSession();
  const sellerProfile = useApiResource(
    user?.id ? `seller-inventory-profile:${user.id}` : null,
    async (signal) => unwrap(await sellerService.getProfile(signal)),
  );
  const sellerId = sellerProfile.data?.sellerId ?? sellerProfile.data?.shopId;
  const shopName = sellerProfile.data?.shopName;
  const rawPickupAddress = sellerProfile.data?.pickupAddress;
  const pickupAddress =
    typeof rawPickupAddress === "string"
      ? rawPickupAddress
      : rawPickupAddress?.streetAddress ?? sellerProfile.data?.streetAddress ?? "";
  const warehouses = useApiResource(
    user?.id && !sellerProfile.loading
      ? `seller-inv-warehouses:${user.id}:${sellerId ?? ""}:${shopName ?? ""}`
      : null,
    (signal) =>
      sellerCatalogService.listWarehouses(user?.id, signal, {
        sellerId,
        shopName,
        pickupAddress,
      }),
  );
  const personalWarehouse = warehouses.data?.[0] ?? null;
  const activeWarehouseId = personalWarehouse?.id ?? "";

  // Load ALL products and their SKU variants belonging to the seller
  const allProductDetails = useApiResource(
    user?.id && !sellerProfile.loading ? `seller-inventory-all-details:${user.id}:${sellerId ?? ""}` : null,
    (signal) => sellerCatalogService.listAllProductDetails(signal),
  );

  const [activeTab, setActiveTab] = useState<SellerInventoryTabKey>("stock");
  const [productId, setProductId] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [stockFilter, setStockFilter] = useState<"ALL" | "IN_STOCK" | "OUT_OF_STOCK" | "UNDECLARED">("ALL");
  const [skuId, setSkuId] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [intakeModalOpen, setIntakeModalOpen] = useState(false);
  const [variantDrafts, setVariantDrafts] = useState<Record<string, { name: string; price: string; totalQuantity: string }>>({});
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null);
  const [detailsMessage, setDetailsMessage] = useState("");
  const [detailsError, setDetailsError] = useState("");
  const [intakeQuantity, setIntakeQuantity] = useState("");
  const [intakeNote, setIntakeNote] = useState("");
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [intakeError, setIntakeError] = useState("");
  const [intakeSuccess, setIntakeSuccess] = useState("");

  const allVariantRows = (allProductDetails.data ?? []).flatMap((product) =>
    (product.variants ?? []).map((variant) => ({
      product,
      variant,
    })),
  );

  const allVariantIdsKey = allVariantRows.map((row) => row.variant.variantId).join(",");
  const batchBalances = useApiResource(
    allVariantIdsKey ? `seller-inventory-batch-all:${allVariantIdsKey}` : null,
    (signal) => sellerCatalogService.inventoryBatch(allVariantRows.map((row) => row.variant.variantId), signal),
  );

  const balanceMap = new Map<string, InventoryBalance[]>();
  for (const item of batchBalances.data ?? []) {
    balanceMap.set(item.skuId, [...(balanceMap.get(item.skuId) ?? []), item]);
  }

  function resolveSellerWarehouseBalance(targetSkuId: string): InventoryBalance | undefined {
    const items = balanceMap.get(targetSkuId) ?? [];
    if (!items.length) return undefined;
    if (activeWarehouseId) {
      const exact = items.find((balance) => balance.warehouseId === activeWarehouseId);
      if (exact) return exact;
    }
    return items[0];
  }

  const filteredRows = allVariantRows.filter(({ product, variant }) => {
    if (productId && product.productId !== productId) return false;
    if (searchKeyword.trim()) {
      const q = searchKeyword.trim().toLowerCase();
      const matched =
        product.name.toLowerCase().includes(q) ||
        variant.skuCode.toLowerCase().includes(q) ||
        variant.name.toLowerCase().includes(q);
      if (!matched) return false;
    }
    const inv = resolveSellerWarehouseBalance(variant.variantId);
    if (stockFilter === "IN_STOCK") return Boolean(inv && inv.availableQuantity > 0);
    if (stockFilter === "OUT_OF_STOCK") return Boolean(inv && inv.availableQuantity <= 0);
    if (stockFilter === "UNDECLARED") return !inv;
    return true;
  });

  const activeSkuId = allVariantRows.some((row) => row.variant.variantId === skuId)
    ? skuId
    : (filteredRows[0]?.variant.variantId ?? allVariantRows[0]?.variant.variantId ?? "");
  const activeRow = allVariantRows.find((row) => row.variant.variantId === activeSkuId) ?? null;
  const selectedBalance = activeSkuId ? resolveSellerWarehouseBalance(activeSkuId) : undefined;
  const isOwnWarehouse = Boolean(personalWarehouse?.id && isSellerWarehouse(personalWarehouse, user?.id));
  const currentTotalQuantity = selectedBalance?.totalQuantity ?? 0;
  const intakeQuantityNumber = Number(intakeQuantity);
  const projectedTotal =
    intakeQuantity.trim() &&
    Number.isSafeInteger(intakeQuantityNumber) &&
    intakeQuantityNumber > 0 &&
    intakeQuantityNumber <= MAX_INVENTORY_QUANTITY - currentTotalQuantity
      ? currentTotalQuantity + intakeQuantityNumber
      : null;

  const totalProductsCount = allProductDetails.data?.length ?? 0;
  const totalSkusCount = allVariantRows.length;
  const totalPhysicalStock = allVariantRows.reduce(
    (sum, row) => sum + (resolveSellerWarehouseBalance(row.variant.variantId)?.totalQuantity ?? 0),
    0,
  );
  const totalAvailableStock = allVariantRows.reduce(
    (sum, row) => sum + (resolveSellerWarehouseBalance(row.variant.variantId)?.availableQuantity ?? 0),
    0,
  );
  const totalReservedStock = allVariantRows.reduce(
    (sum, row) => sum + (resolveSellerWarehouseBalance(row.variant.variantId)?.reservedQuantity ?? 0),
    0,
  );

  const warehouseDisplayLabel = personalWarehouse
    ? `[${personalWarehouse.code}] ${personalWarehouse.name}`
    : "Kho riêng của Shop";

  useEffect(() => {
    if (!detailsOpen && !intakeModalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailsOpen(false);
        setIntakeModalOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [detailsOpen, intakeModalOpen]);

  function openIntakeModal(targetSkuId?: string) {
    if (targetSkuId) {
      setSkuId(targetSkuId);
    } else if (!skuId && (filteredRows[0]?.variant.variantId || allVariantRows[0]?.variant.variantId)) {
      setSkuId(filteredRows[0]?.variant.variantId ?? allVariantRows[0]?.variant.variantId ?? "");
    }
    setIntakeQuantity("");
    setIntakeNote("");
    setIntakeError("");
    setIntakeSuccess("");
    setIntakeModalOpen(true);
  }

  function openProductDetails(variant: ProductVariant) {
    setSkuId(variant.variantId);
    setDetailsError("");
    setDetailsMessage("");
    const inventory = resolveSellerWarehouseBalance(variant.variantId);
    setVariantDrafts({
      [variant.variantId]: {
        name: variant.name,
        price: String(variant.price ?? ""),
        totalQuantity: String(inventory?.totalQuantity ?? ""),
      },
    });
    setDetailsOpen(true);
  }

  async function saveVariantDetails(variant: ProductVariant) {
    const draft = variantDrafts[variant.variantId];
    const inventory = resolveSellerWarehouseBalance(variant.variantId);
    if (!draft) {
      setDetailsError("Không có thay đổi để lưu.");
      return;
    }

    const nextPrice = Number(draft.price);
    if (!draft.name.trim() || !Number.isFinite(nextPrice) || nextPrice <= 0) {
      setDetailsError("Tên biến thể và giá bán phải hợp lệ; giá bán phải lớn hơn 0.");
      return;
    }

    const variantChanged = draft.name.trim() !== variant.name || nextPrice !== Number(variant.price);
    if (!variantChanged) {
      setDetailsError("Chưa có thay đổi tên hoặc giá bán để lưu.");
      return;
    }
    setSavingVariantId(variant.variantId);
    setDetailsError("");
    setDetailsMessage("");
    try {
      await sellerCatalogService.updateVariant(variant.variantId, {
        name: draft.name.trim(),
        price: nextPrice,
        currency: variant.currency || "VND",
        attributes: variant.attributes,
      });
      allProductDetails.reload();
      batchBalances.reload();
      setVariantDrafts((current) => ({
        ...current,
        [variant.variantId]: {
          name: draft.name.trim(),
          price: String(nextPrice),
          totalQuantity: inventory ? String(inventory.totalQuantity) : "",
        },
      }));
      setDetailsMessage("Đã lưu tên biến thể và giá bán.");
    } catch (cause) {
      allProductDetails.reload();
      batchBalances.reload();
      const failure = cause instanceof Error ? cause.message : "Không lưu được thay đổi.";
      setDetailsError(failure);
    } finally {
      setSavingVariantId(null);
    }
  }

  async function submitIntake() {
    if (intakeBusy) return;
    const quantity = Number(intakeQuantity);
    setIntakeError("");
    setIntakeSuccess("");
    if (!isOwnWarehouse || !activeWarehouseId || !activeSkuId) {
      setIntakeError("Vui lòng chọn biến thể SKU trong kho riêng của bạn để nhập hàng.");
      return;
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > MAX_INVENTORY_QUANTITY) {
      setIntakeError(`Nhập số nguyên từ 1 đến ${MAX_INVENTORY_QUANTITY.toLocaleString("vi-VN")}.`);
      return;
    }
    if (quantity > MAX_INVENTORY_QUANTITY - currentTotalQuantity) {
      setIntakeError("Tổng tồn sau nhập vượt giới hạn số lượng cho phép.");
      return;
    }
    setIntakeBusy(true);
    try {
      const noteText = intakeNote.trim() || "Seller nhập thêm hàng vào kho riêng";
      await sellerCatalogService.adjustInventory({
        skuId: activeSkuId,
        warehouseId: activeWarehouseId,
        type: "Intake",
        quantity,
        note: noteText,
      });
      setIntakeSuccess(`Đã nhập thêm ${quantity.toLocaleString("vi-VN")} sản phẩm vào ${warehouseDisplayLabel}.`);
      setIntakeQuantity("");
      setIntakeNote("");
      setIntakeModalOpen(false);
      batchBalances.reload();
    } catch (cause) {
      setIntakeError(`${cause instanceof Error ? cause.message : "Không nhập thêm được hàng."} Hãy kiểm tra tồn kho trước khi gửi lại.`);
      batchBalances.reload();
    } finally {
      setIntakeBusy(false);
    }
  }

  return (
    <>
      <div className="seller-inventory-top-header">
        <div>
          <h1>Quản lý kho</h1>
          <div className="seller-inventory-warehouse-meta">
            <span className="seller-inventory-warehouse-name">
              {warehouses.loading || sellerProfile.loading ? "Đang tải thông tin kho…" : warehouseDisplayLabel}
            </span>
            {(personalWarehouse?.address || pickupAddress) && (
              <span>Địa chỉ lấy hàng: {personalWarehouse?.address || pickupAddress}</span>
            )}
          </div>
        </div>
      </div>

      {sellerProfile.error && (
        <p className="notice" role="alert" style={{ marginBottom: 16 }}>
          Không tải được hồ sơ Seller: {sellerProfile.error.message}
        </p>
      )}
      {!warehouses.loading && !warehouses.error && !sellerProfile.loading && !sellerProfile.error && (
        <SellerWarehouseGate
          readiness={warehouseReadiness(personalWarehouse)}
          warehouse={personalWarehouse}
          profile={{
            provinceId: String(sellerProfile.data?.provinceId ?? ""),
            districtId: String(sellerProfile.data?.districtId ?? ""),
            wardCode: String(sellerProfile.data?.wardCode ?? ""),
            streetAddress: pickupAddress,
            phone: String(sellerProfile.data?.hotline ?? ""),
          }}
          onSaved={warehouses.reload}
        />
      )}
      {intakeSuccess && !intakeModalOpen && (
        <p className="form-success" role="status" style={{ marginBottom: 16 }}>
          {intakeSuccess}
        </p>
      )}

      {/* KPI Summary Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <Card className="card-pad">
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Sản phẩm trong kho</span>
          <strong style={{ display: "block", fontSize: 22, marginTop: 4 }}>
            {totalProductsCount.toLocaleString("vi-VN")}
          </strong>
        </Card>
        <Card className="card-pad">
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Tổng biến thể (SKU)</span>
          <strong style={{ display: "block", fontSize: 22, marginTop: 4 }}>
            {totalSkusCount.toLocaleString("vi-VN")}
          </strong>
        </Card>
        <Card className="card-pad">
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Tổng tồn vật lý (Total)</span>
          <strong style={{ display: "block", fontSize: 22, marginTop: 4 }}>
            {totalPhysicalStock.toLocaleString("vi-VN")}
          </strong>
        </Card>
        <Card className="card-pad">
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Khả dụng / Đang giữ</span>
          <strong style={{ display: "block", fontSize: 22, marginTop: 4, color: "#059669" }}>
            {totalAvailableStock.toLocaleString("vi-VN")}{" "}
            <span style={{ fontSize: 13, color: "#b45309", fontWeight: 600 }}>
              (Giữ: {totalReservedStock.toLocaleString("vi-VN")})
            </span>
          </strong>
        </Card>
      </div>

      <div style={{ marginBottom: 16 }}>
        <FluidChoiceBar
          options={SELLER_INVENTORY_TABS}
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="Chuyển đổi mục quản lý kho"
        />
      </div>

      {activeTab === "alerts" && <InventoryAlertsPanel />}
      {activeTab === "ledger" && <InventoryLedgerPanel />}

      {/* Full Warehouse Product & SKU Inventory Management */}
      {activeTab === "stock" && (
        <Card className="card-pad seller-inventory-selector" style={{ marginBottom: 20 }}>
        <SectionHeading
          title={`Danh sách toàn bộ Sản phẩm & SKU trong kho (${filteredRows.length}/${totalSkusCount} SKU)`}
        />

        {/* Filter & Search Bar */}
        <div className="seller-inventory-filter-grid">
          <label className="field-wrap">
            Lọc theo sản phẩm
            <select
              className="select-field"
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
                setIntakeError("");
                setIntakeSuccess("");
              }}
            >
              <option value="">Tất cả sản phẩm trong kho ({totalProductsCount})</option>
              {(allProductDetails.data ?? []).map((item) => (
                <option key={item.productId} value={item.productId}>
                  {item.name} ({item.variants?.length ?? item.variantCount ?? 0} SKU · {item.status})
                </option>
              ))}
            </select>
          </label>

          <label className="field-wrap">
            Tìm kiếm tên sản phẩm / Mã SKU
            <input
              className="field"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="Nhập tên sản phẩm, mã SKU hoặc tên phân loại…"
            />
          </label>

          <label className="field-wrap">
            Trạng thái tồn kho
            <select
              className="select-field"
              value={stockFilter}
              onChange={(event) => setStockFilter(event.target.value as typeof stockFilter)}
            >
              <option value="ALL">Tất cả biến thể SKU ({totalSkusCount})</option>
              <option value="IN_STOCK">Còn hàng khả dụng (&gt; 0)</option>
              <option value="OUT_OF_STOCK">Hết hàng khả dụng (0)</option>
              <option value="UNDECLARED">Chưa đồng bộ bản ghi tồn</option>
            </select>
          </label>
        </div>

        {allProductDetails.loading && <p className="status-note">Đang tải danh sách toàn bộ sản phẩm và biến thể trong kho…</p>}
        {allProductDetails.error && <p className="notice" role="alert">Không tải được sản phẩm: {allProductDetails.error.message}</p>}
        {!allProductDetails.loading && totalProductsCount === 0 && (
          <p className="status-note">Kho của bạn chưa có sản phẩm nào. Hãy tạo sản phẩm mới để khai báo tồn kho.</p>
        )}

        {/* Comprehensive Table of ALL Products & Variants in Seller's Personal Warehouse */}
        {filteredRows.length > 0 ? (
          <div className="table-scroll" style={{ marginTop: 18 }}>
            <table className="data-table seller-inventory-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Mã SKU</th>
                  <th>Phân loại biến thể</th>
                  <th>Giá bán</th>
                  <th>Tổng tồn</th>
                  <th>Khả dụng</th>
                  <th>Đang giữ</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ product, variant }) => {
                  const inv = resolveSellerWarehouseBalance(variant.variantId);
                  const isSelected = variant.variantId === activeSkuId;
                  const attrSummary =
                    variant.attributes?.length > 0
                      ? variant.attributes.map((a) => `${a.attrName}: ${a.attrValue}`).join(" · ")
                      : "";
                  return (
                    <tr
                      key={variant.variantId}
                      style={isSelected ? { background: "var(--primary-soft)" } : undefined}
                    >
                      <td>
                        <strong>{product.name}</strong>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                          Trạng thái SP: {product.status}
                        </div>
                      </td>
                      <td>
                        <strong>{variant.skuCode}</strong>
                      </td>
                      <td>
                        <div>{variant.name}</div>
                        {attrSummary && (
                          <small style={{ color: "var(--muted)", display: "block", marginTop: 2 }}>
                            {attrSummary}
                          </small>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatMoney(variant.price)}</td>
                      <td>
                        <strong>{inv ? inv.totalQuantity.toLocaleString("vi-VN") : "0"}</strong>
                      </td>
                      <td style={{ color: "#059669", fontWeight: 700 }}>
                        {inv ? inv.availableQuantity.toLocaleString("vi-VN") : "0"}
                      </td>
                      <td style={{ color: "#b45309", fontWeight: 700 }}>
                        {inv ? inv.reservedQuantity.toLocaleString("vi-VN") : "0"}
                      </td>
                      <td>
                        <div className="seller-inventory-row-actions">
                          <button
                            type="button"
                            className="button button-small button-primary"
                            disabled={!isOwnWarehouse || batchBalances.loading}
                            onClick={() => openIntakeModal(variant.variantId)}
                          >
                            + Nhập hàng
                          </button>
                          <button
                            type="button"
                            className="button button-small button-secondary"
                            disabled={batchBalances.loading}
                            onClick={() => openProductDetails(variant)}
                          >
                            Sửa / Chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !allProductDetails.loading &&
          totalSkusCount > 0 && (
            <p className="status-note" style={{ marginTop: 16 }}>
              Không tìm thấy biến thể SKU nào khớp với bộ lọc hiện tại.
            </p>
          )
        )}
        </Card>
      )}

      {/* Stock Intake Modal */}
      {intakeModalOpen && (
        <div
          className="seller-inventory-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIntakeModalOpen(false);
          }}
        >
          <section
            className="seller-inventory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-inventory-intake-modal-title"
            style={{ maxWidth: 620 }}
          >
            <header className="seller-inventory-modal-header">
              <div>
                <h2 id="seller-inventory-intake-modal-title">Nhập thêm hàng vào Kho riêng</h2>
                <p>{personalWarehouse ? warehouseDisplayLabel : "Kho riêng của Shop"}</p>
              </div>
              <button
                type="button"
                className="seller-inventory-modal-close"
                aria-label="Đóng hộp thoại nhập hàng"
                onClick={() => setIntakeModalOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="auth-fields" style={{ marginTop: 12 }}>
              <label className="field-wrap">
                <span>Chọn biến thể SKU cần nhập hàng</span>
                <select
                  className="select-field"
                  value={activeSkuId}
                  onChange={(event) => {
                    setSkuId(event.target.value);
                    setIntakeQuantity("");
                    setIntakeError("");
                    setIntakeSuccess("");
                  }}
                  disabled={allVariantRows.length === 0 || intakeBusy}
                >
                  <option value="">Chọn biến thể SKU</option>
                  {allVariantRows.map(({ product, variant }) => (
                    <option key={variant.variantId} value={variant.variantId}>
                      [{variant.skuCode}] {product.name} — {variant.name} ({formatMoney(variant.price)})
                    </option>
                  ))}
                </select>
              </label>

              {activeRow && (
                <div
                  className="mini-item"
                  style={{
                    background: "#f8fafc",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong>
                      [{activeRow.variant.skuCode}] {activeRow.product.name} ({activeRow.variant.name})
                    </strong>
                    <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                      Tồn hiện tại: <strong>{currentTotalQuantity.toLocaleString("vi-VN")}</strong>
                      {projectedTotal !== null && (
                        <>
                          {" "}
                          · Dự kiến sau khi nhập:{" "}
                          <strong style={{ color: "#059669" }}>
                            {projectedTotal.toLocaleString("vi-VN")}
                          </strong>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}

              <label className="field-wrap">
                <span>Số lượng nhập thêm</span>
                <input
                  className="field"
                  type="number"
                  min="1"
                  max={Math.max(1, MAX_INVENTORY_QUANTITY - currentTotalQuantity)}
                  step="1"
                  value={intakeQuantity}
                  placeholder="Nhập số lượng cần cộng thêm vào kho"
                  disabled={!isOwnWarehouse || !activeSkuId || intakeBusy}
                  onChange={(event) => {
                    setIntakeQuantity(event.target.value);
                    setIntakeError("");
                    setIntakeSuccess("");
                  }}
                />
              </label>

              <label className="field-wrap">
                <span>Ghi chú phiếu nhập</span>
                <input
                  className="field"
                  value={intakeNote}
                  placeholder="Ví dụ: Nhập bổ sung hàng đợt mới vào kho riêng"
                  disabled={!isOwnWarehouse || !activeSkuId || intakeBusy}
                  onChange={(event) => {
                    setIntakeNote(event.target.value);
                    setIntakeError("");
                    setIntakeSuccess("");
                  }}
                />
              </label>

              {intakeError && (
                <p className="notice" role="alert">
                  {intakeError}
                </p>
              )}
              {intakeSuccess && (
                <p className="form-success" role="status">
                  {intakeSuccess}
                </p>
              )}
            </div>

            <footer className="seller-inventory-modal-footer" style={{ gap: 10 }}>
              <button
                type="button"
                className="button button-secondary"
                disabled={intakeBusy}
                onClick={() => setIntakeModalOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={!isOwnWarehouse || !activeSkuId || intakeBusy}
                onClick={() => void submitIntake()}
              >
                {intakeBusy ? "Đang nhập…" : "+ Xác nhận nhập kho"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {detailsOpen && activeRow && (
        <div
          className="seller-inventory-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailsOpen(false);
          }}
        >
          <section
            className="seller-inventory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-inventory-modal-title"
          >
            <header className="seller-inventory-modal-header">
              <div>
                <h2 id="seller-inventory-modal-title">Chi tiết biến thể & tồn kho</h2>
                <p>
                  {activeRow.product.name} · Mã SKU: {activeRow.variant.skuCode}
                </p>
              </div>
              <button
                type="button"
                className="seller-inventory-modal-close"
                aria-label="Đóng chi tiết"
                onClick={() => setDetailsOpen(false)}
              >
                ×
              </button>
            </header>

            <p className="seller-inventory-modal-help">
              Bạn có thể sửa tên biến thể và giá bán tại đây. Để cộng thêm số lượng hàng mới, hãy dùng nút &quot;+ Nhập hàng&quot;.
            </p>

            {detailsError && <p className="notice" role="alert">{detailsError}</p>}
            {detailsMessage && <p className="form-success" role="status">{detailsMessage}</p>}

            <div className="table-scroll seller-inventory-modal-table-scroll">
              <table className="data-table seller-inventory-modal-table">
                <thead>
                  <tr>
                    <th>Tên biến thể</th>
                    <th>Kho riêng</th>
                    <th>Giá bán</th>
                    <th>Tổng tồn (Total)</th>
                    <th>Khả dụng (Available)</th>
                    <th>Đang giữ (Reserved)</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {[activeRow.variant].map((variant) => {
                    const draft = variantDrafts[variant.variantId];
                    const inv = resolveSellerWarehouseBalance(variant.variantId);
                    const hasChanges = Boolean(
                      draft &&
                        (draft.name.trim() !== variant.name ||
                          Number(draft.price) !== Number(variant.price)),
                    );
                    return (
                      <tr key={variant.variantId} className="is-selected">
                        <td>
                          <label className="seller-inventory-modal-name">
                            <span>{variant.skuCode}</span>
                            <input
                              className="field"
                              value={draft?.name ?? variant.name}
                              aria-label={`Tên biến thể ${variant.skuCode}`}
                              onChange={(event) =>
                                setVariantDrafts((current) => ({
                                  ...current,
                                  [variant.variantId]: {
                                    ...current[variant.variantId],
                                    name: event.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        </td>
                        <td>{warehouseDisplayLabel}</td>
                        <td>
                          <input
                            className="field seller-inventory-modal-number"
                            type="number"
                            min="1"
                            step="1"
                            value={draft?.price ?? String(variant.price ?? "")}
                            aria-label={`Giá bán ${variant.skuCode}`}
                            onChange={(event) =>
                              setVariantDrafts((current) => ({
                                ...current,
                                [variant.variantId]: {
                                  ...current[variant.variantId],
                                  price: event.target.value,
                                },
                              }))
                            }
                          />
                        </td>
                        <td className="seller-inventory-modal-readonly">
                          {inv ? inv.totalQuantity.toLocaleString("vi-VN") : "0"}
                        </td>
                        <td className="seller-inventory-modal-readonly">
                          {inv ? inv.availableQuantity.toLocaleString("vi-VN") : "0"}
                        </td>
                        <td className="seller-inventory-modal-readonly">
                          {inv ? inv.reservedQuantity.toLocaleString("vi-VN") : "0"}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="button button-primary button-small"
                            disabled={savingVariantId === variant.variantId || !hasChanges}
                            onClick={() => void saveVariantDetails(variant)}
                          >
                            {savingVariantId === variant.variantId ? "Đang lưu…" : "Lưu"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <footer className="seller-inventory-modal-footer">
              <button type="button" className="button button-secondary" onClick={() => setDetailsOpen(false)}>
                Đóng
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

const SELLER_SHIPMENT_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "ready", label: "Chờ lấy hàng" },
  { key: "shipping", label: "Đang giao" },
  { key: "delivered", label: "Đã giao" },
  { key: "completed", label: "Hoàn tất" },
  { key: "returned", label: "Hoàn hàng / Hoàn tiền" },
] as const;

type SellerShipmentTabKey = (typeof SELLER_SHIPMENT_TABS)[number]["key"];

function matchesSellerShipmentTab(status: string, tab: SellerShipmentTabKey): boolean {
  if (tab === "all") return true;
  const key = status.replace(/[^a-z]/gi, "").toUpperCase();
  if (tab === "ready") return key === "CONFIRMED" || key === "SELLERACCEPTED";
  if (tab === "shipping") return key === "SHIPPING" || key === "SHIPPED";
  if (tab === "delivered") return key === "DELIVERED";
  if (tab === "completed") return key === "COMPLETED";
  if (tab === "returned") return ["RETURNING", "RETURNED", "REFUNDED"].includes(key);
  return true;
}

export function SellerShipmentsScreen() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<SellerShipmentTabKey>("all");
  const resource = useApiResource(
    `seller-shipments-list:${page}`,
    (signal) => sellerOrdersService.list<SellerPaged<SellerSubOrderSummary>>(page, signal, 20),
  );
  const trackableRows = (resource.data?.items ?? []).filter((sub) => hasShipmentToTrack(sub.status));
  const rows = trackableRows.filter((sub) => matchesSellerShipmentTab(sub.status, activeTab));
  return (
    <>
      <PageHeading
        overline="Kênh người bán"
        title="Vận đơn & giao nhận"
        description="Quản lý vận đơn GHN cho các đơn bạn đã tiếp nhận. Chọn đơn để xem hành trình và in phiếu giao hàng."
      />
      <FluidChoiceBar
        mode="filter"
        ariaLabel="Lọc trạng thái vận đơn"
        options={SELLER_SHIPMENT_TABS.map((tab) => {
          const count = tab.key === "all"
            ? trackableRows.length
            : trackableRows.filter((item) => matchesSellerShipmentTab(item.status, tab.key)).length;
          return { value: tab.key, label: count > 0 ? `${tab.label} (${count})` : tab.label };
        })}
        value={activeTab}
        onChange={setActiveTab}
      />
      {resource.error && <p className="notice" role="alert">{msg(resource.error)}</p>}
      <Card>
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã đơn gian hàng</th>
                  <th>Mã vận đơn GHN</th>
                  <th>Sản phẩm</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((sub) => {
                  const shipmentHref = ROUTES.seller.shipment(sub.subOrderId);
                  const itemsPreview = sub.items?.length
                    ? sub.items.slice(0, 2).map((item) => `${item.productName} ×${item.quantity}`).join(", ") +
                      (sub.items.length > 2 ? ` (+${sub.items.length - 2})` : "")
                    : `${sub.itemCount} mặt hàng`;
                  return (
                    <tr key={sub.subOrderId} {...clickableRowProps(() => router.push(shipmentHref), "Nhấn để theo dõi vận đơn")}>
                      <td>
                        <Link href={shipmentHref} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Icon name="truck" size={15} />
                          <strong>{sub.subOrderNo}</strong>
                        </Link>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(sub.createdAt).toLocaleString("vi-VN")}</div>
                      </td>
                      <td>
                        {sub.trackingCode ? (
                          <strong className="mono">{sub.trackingCode}</strong>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>Chưa có mã vận đơn</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{itemsPreview}</div>
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>
                        <strong>{formatMoney(sub.totalAmount)}</strong>
                      </td>
                      <td><Badge tone={sellerOrderStatusTone(sub.status, sub.paymentMethod)}>{describeSellerOrderStatus(sub.status, sub.paymentMethod)}</Badge></td>
                      <td>
                        <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }} onClick={(event) => event.stopPropagation()}>
                          <Link className="tracking-icon-btn" href={shipmentHref}>
                            <Icon name="mapPin" size={14} />
                            Xem hành trình
                          </Link>
                          <Link className="tracking-icon-btn" href={ROUTES.seller.order(sub.subOrderId)}>
                            Chi tiết đơn
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : resource.loading ? (
          <TableSkeleton rows={5} cols={6} label="Đang tải danh sách vận đơn…" />
        ) : (
          <NoData
            title={
              resource.error
                ? "Không tải được danh sách vận đơn"
                : activeTab === "all"
                  ? "Chưa có vận đơn nào trong trang này"
                  : "Không có vận đơn ở trạng thái này"
            }
          />
        )}
        {resource.data && resource.data.pagination.totalPages > 1 && (
          <AdminPagination
            page={page}
            pageSize={resource.data.pagination.pageSize}
            totalItems={resource.data.pagination.totalCount}
            totalPages={resource.data.pagination.totalPages}
            loading={resource.loading}
            onPageChange={setPage}
            itemLabel="đơn hàng"
          />
        )}
      </Card>
    </>
  );
}

type SellerSubOrderItem = {
  orderItemId?: string;
  itemId?: string;
  productId: string;
  skuId: string;
  productName: string;
  skuCode?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type SellerSubOrder = {
  subOrderId: string;
  subOrderNo: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  shopName: string;
  status: string;
  paymentMethod: string;
  shippingAddress: {
    receiverName: string;
    receiverPhone: string;
    street: string;
    ward: string;
    district: string;
    province: string;
    fullAddress?: string | null;
  };
  contactPhone: string;
  itemsAmount: number;
  shippingFeeAmount: number;
  totalAmount: number;
  productDiscountAmount?: number;
  shopDiscountAmount?: number;
  systemDiscountAmount?: number;
  discountAmount?: number;
  createdAt: string;
  carrierCode?: string | null;
  trackingCode?: string | null;
  labelPrintUrl?: string | null;
  shipmentPendingCreation?: boolean;
  sellerAcceptedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  items: SellerSubOrderItem[];
};

type SellerSubOrderSummary = Pick<
  SellerSubOrder,
  "subOrderId" | "subOrderNo" | "orderId" | "buyerId" | "sellerId" | "status" | "paymentMethod" |
  "itemsAmount" | "shippingFeeAmount" | "totalAmount" | "createdAt" |
  "carrierCode" | "trackingCode" | "labelPrintUrl" | "shipmentPendingCreation"
> & { itemCount: number; items?: SellerSubOrderItem[] | null };

type SellerPaged<T> = {
  items: T[];
  pagination: { pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasNextPage: boolean };
};

export function SellerOrdersScreen() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const { showToast } = useToast();
  const acceptBlock = acceptOrderBlock(useWarehouseReadiness().readiness);
  const resource = useApiResource(
    `seller-sub-orders:${page}:${pageSize}:${statusFilter}`,
    (signal) =>
      sellerOrdersService.list<SellerPaged<SellerSubOrderSummary>>(page, signal, pageSize, statusFilter || undefined),
  );

  async function acceptOrder(sub: SellerSubOrderSummary) {
    setBusyId(sub.subOrderId);
    setFeedback("");
    setActionError("");
    try {
      const result = await sellerOrdersService.accept(sub.orderId, sub.subOrderId);
      const trackingInfo = result?.trackingCode ? ` · Mã vận đơn GHN: ${result.trackingCode}` : "";
      const okMsg = `Đã chấp nhận đơn ${sub.subOrderNo}${trackingInfo}.`;
      setFeedback(okMsg);
      showToast(okMsg, "success");
      resource.reload();
    } catch (reason) {
      setActionError(msg(reason as Error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeading
        overline="Kênh người bán"
        title="Đơn cần xử lý"
        description="Các đơn hàng người mua đã đặt (thanh toán bằng Ví Nexus hoặc COD) và chuyển tới gian hàng của bạn."
      />
      {(resource.error || actionError) && (
        <p role="alert" className="notice">
          {actionError || (/404/.test(msg(resource.error))
            ? "Danh sách đơn bán hiện chưa sẵn sàng. Vui lòng thử lại sau."
            : msg(resource.error))}
        </p>
      )}
      {feedback && (
        <p role="status" className="form-success">
          {feedback}
        </p>
      )}
      {acceptBlock && (
        <p role="alert" className="notice">
          {acceptBlock.message} <Link href={ROUTES.seller.inventory}>Mở Quản lý kho</Link>
        </p>
      )}
      <Card className="card-pad" style={{ marginBottom: 16 }}>
        <div className="ops-filters" style={{ margin: 0 }}>
          <label className="field-wrap">
            <span>Trạng thái đơn</span>
            <select className="select-field" value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}>
              <option value="">Tất cả trạng thái</option>
              <option value="PendingPayment">Chờ xác nhận (COD) / Chờ thanh toán</option>
              <option value="PendingConfirmation">Chờ người bán xác nhận</option>
              <option value="Paid">Đã thanh toán · Chờ xác nhận</option>
              <option value="Confirmed">Đã xác nhận</option>
              <option value="Shipped">Đang giao hàng</option>
              <option value="Delivered">Đã giao</option>
              <option value="Completed">Hoàn tất</option>
              <option value="SellerRejected">Người bán từ chối</option>
              <option value="Returning">Đang hoàn hàng</option>
              <option value="Returned">Đã hoàn hàng</option>
              <option value="Refunded">Đã hoàn tiền</option>
              <option value="Cancelled">Đã hủy</option>
            </select>
          </label>
        </div>
      </Card>
      <Card className="seller-orders-card">
        {resource.data?.items.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã đơn gian hàng</th>
                  <th>Mã người mua</th>
                  <th>Mặt hàng</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((sub) => {
                  const canAccept = canSellerAccept(sub);
                  return (
                    <tr
                      key={sub.subOrderId}
                      {...clickableRowProps(() => router.push(ROUTES.seller.order(sub.subOrderId)), "Nhấn để xem chi tiết đơn bán")}
                    >
                      <td>
                        <Link href={ROUTES.seller.order(sub.subOrderId)}>
                          <strong>{sub.subOrderNo}</strong>
                        </Link>
                        {sub.trackingCode && (
                          <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 2 }}>
                            GHN: <strong className="mono">{sub.trackingCode}</strong>
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {new Date(sub.createdAt).toLocaleString("vi-VN")}
                        </div>
                      </td>
                      <td>
                        <strong>{sub.buyerId}</strong>
                      </td>
                      <td>
                        <strong>{sub.itemCount} mặt hàng</strong>
                        {sub.items && sub.items.length > 0 && (
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {sub.items.map((item) => `${item.productName} ×${item.quantity}`).join(", ")}
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>{formatMoney(sub.totalAmount)}</strong>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          Ship: {formatMoney(sub.shippingFeeAmount)}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                          <Badge tone={isCodPayment(sub.paymentMethod) ? "amber" : "slate"}>{paymentMethodLabel(sub.paymentMethod)}</Badge>
                          {isCodPayment(sub.paymentMethod) && (
                            <span style={{ fontSize: 11, color: "var(--muted)" }}>Thu hộ: {formatMoney(sub.totalAmount)}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge tone={sellerOrderStatusTone(sub.status, sub.paymentMethod)}>
                          {describeSellerOrderStatus(sub.status, sub.paymentMethod)}
                        </Badge>
                      </td>
                      <td>
                        {canAccept || hasShipmentToTrack(sub.status) ? (
                          <RowActionsMenu
                            ariaLabel={`Thao tác đơn ${sub.subOrderNo}`}
                            primary={
                              canAccept
                                ? {
                                    label: busyId === sub.subOrderId ? "Đang xác nhận…" : "Chấp nhận đơn",
                                    variant: "primary",
                                    disabled: busyId === sub.subOrderId || Boolean(acceptBlock),
                                    onClick: () => void acceptOrder(sub),
                                  }
                                : {
                                    label: "Theo dõi vận đơn",
                                    href: ROUTES.seller.shipment(sub.subOrderId),
                                    variant: "secondary",
                                  }
                            }
                            items={
                              canAccept && hasShipmentToTrack(sub.status)
                                ? [{ label: "Theo dõi vận đơn", href: ROUTES.seller.shipment(sub.subOrderId) }]
                                : []
                            }
                          />
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : resource.loading ? (
          <TableSkeleton rows={5} cols={6} label="Đang tải danh sách đơn bán…" />
        ) : (
          <NoData
            title={
              resource.error
                ? "Không tải được danh sách đơn bán"
                : statusFilter ? "Không có đơn ở trạng thái đã chọn" : "Chưa có đơn hàng nào được chuyển đến shop"
            }
          />
        )}
        {resource.data && (
          <div className="seller-products-pagination seller-orders-pagination">
            <label className="seller-products-page-size">
              <span>Hiển thị</span>
              <select
                className="field"
                aria-label="Số đơn mỗi trang"
                value={pageSize}
                onChange={(event) => {
                  setPage(1);
                  setPageSize(Number(event.target.value));
                }}
              >
                {[10, 30, 50].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <PaginationBar
              page={page}
              totalPages={resource.data.pagination.totalPages}
              onPageChange={setPage}
              disabled={resource.loading}
            />
          </div>
        )}
      </Card>
    </>
  );
}

export function SellerOrderDetailScreen() {
  const params = useParams<{ id: string }>();
  const subOrderId = String(params.id ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const resource = useApiResource(
    subOrderId ? `seller-sub-order-detail:${subOrderId}` : null,
    (signal) =>
      sellerOrdersService.detail<SellerSubOrder>(subOrderId, signal),
  );
  const financial = useApiResource(
    subOrderId ? `seller-sub-order-breakdown:${subOrderId}` : null,
    (signal) => sellerOrdersService.financialBreakdown(subOrderId, signal),
  );

  const acceptBlock = acceptOrderBlock(useWarehouseReadiness().readiness);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryFailure, setRetryFailure] = useState<ReturnType<typeof describeShipmentRetryFailure> | null>(null);
  const sub = resource.data;
  const accepted = Boolean(sub && hasShipmentToTrack(sub.status));
  const shipmentInfo = useApiResource(
    sub && accepted ? `seller-order-shipment:${sub.subOrderId}` : null,
    (signal) => fulfillmentService.getSubOrderTimeline(subOrderId, signal),
  );
  const effectiveTrackingCode = sub?.trackingCode ?? shipmentInfo.data?.trackingCode ?? null;
  const effectiveCarrierCode = sub?.carrierCode ?? shipmentInfo.data?.carrierCode ?? null;
  const effectiveLabelPrintUrl = sub?.labelPrintUrl ?? shipmentInfo.data?.labelPrintUrl ?? null;
  const canRetryShipment = Boolean(
    sub &&
      needsShipmentRetry(sub.status, effectiveTrackingCode) &&
      (!accepted || shipmentInfo.data !== undefined),
  );
  const canAccept = Boolean(sub && canSellerAccept(sub));
  const pickShifts = useApiResource(canAccept ? "shipping-pick-shifts" : null, (signal) => fulfillmentService.getPickShifts(signal));
  const [selectedPickShiftId, setSelectedPickShiftId] = useState<number | null>(null);

  async function handleAccept() {
    if (!sub) return;
    setBusy(true);
    setFeedback("");
    setActionError("");
    try {
      const result = await sellerOrdersService.accept(sub.orderId, sub.subOrderId, selectedPickShiftId);
      const trackingNotice = result?.trackingCode ? ` Mã vận đơn GHN: ${result.trackingCode}.` : "";
      setFeedback(
        `Đã chấp nhận đơn hàng và đăng ký bưu tá GHN lấy hàng.${trackingNotice} Bạn có thể in phiếu giao hàng dán lên kiện hàng dưới đây.`,
      );
      resource.reload();
      shipmentInfo.reload();
    } catch (reason) {
      setActionError(msg(reason as Error));
      resource.reload();
      shipmentInfo.reload();
    } finally {
      setBusy(false);
    }
  }

  async function handleRetryShipment() {
    if (!sub || retryBusy) return;
    setRetryBusy(true);
    setRetryFailure(null);
    setFeedback("");
    try {
      const result = await fulfillmentService.retrySubOrderShipment(sub.subOrderId);
      setFeedback(`Đã tạo lại vận đơn ${result.trackingCode}.`);
      resource.reload();
      shipmentInfo.reload();
    } catch (reason) {
      setRetryFailure(describeShipmentRetryFailure(reason));
      resource.reload();
      shipmentInfo.reload();
    } finally {
      setRetryBusy(false);
    }
  }

  async function handleReject() {
    if (!sub || !canAccept || busy || !rejectReason.trim()) return;
    setBusy(true);
    setFeedback("");
    setActionError("");
    try {
      await sellerOrdersService.reject(sub.orderId, sub.subOrderId, rejectReason.trim());
      setFeedback(
        isCodPayment(sub.paymentMethod)
          ? "Đã từ chối đơn hàng COD."
          : "Đã từ chối đơn hàng. Vui lòng kiểm tra trạng thái hoàn tiền trên ví của người mua.",
      );
      setRejecting(false);
      setRejectReason("");
      resource.reload();
    } catch (reason) {
      setActionError(msg(reason as Error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        overline="Kênh người bán"
        title={sub ? `Chi tiết đơn bán ${sub.subOrderNo}` : "Chi tiết đơn bán"}
        description="Xác nhận đơn hàng để khởi tạo vận đơn và thông báo cho người mua."
      />
      {(resource.error || actionError) && (
        <p role="alert" className="notice">
          {actionError || msg(resource.error)}
        </p>
      )}
      {feedback && (
        <p role="status" className="form-success">
          {feedback}
        </p>
      )}
      <Card className="card-pad seller-order-detail-card">
        {sub ? (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <h2 style={{ margin: 0 }}>Đơn hàng {sub.subOrderNo}</h2>
              <Badge tone={sellerOrderStatusTone(sub.status, sub.paymentMethod)}>{describeSellerOrderStatus(sub.status, sub.paymentMethod)}</Badge>
            </div>
            <div className="seller-order-detail-columns">
              <div className="seller-order-detail-main">
            <div className="seller-order-detail-facts">
            <div className="info-row">
              <span>Phương thức thanh toán</span>
              <Badge tone={isCodPayment(sub.paymentMethod) ? "amber" : "slate"}>{paymentMethodLabel(sub.paymentMethod)}</Badge>
            </div>
            {isCodPayment(sub.paymentMethod) && (
              <div className="info-row">
                <span>Thu hộ (COD)</span>
                <strong>{formatMoney(sub.totalAmount)}</strong>
              </div>
            )}
            <div className="info-row">
              <span>Người nhận</span>
              <strong>
                {sub.shippingAddress?.receiverName} · {sub.contactPhone}
              </strong>
            </div>
            <div className="info-row">
              <span>Địa chỉ giao hàng</span>
              <strong>
                {sub.shippingAddress?.fullAddress ||
                  `${sub.shippingAddress?.street}, ${sub.shippingAddress?.ward}, ${sub.shippingAddress?.province}`}
              </strong>
            </div>
            </div>
            <div className="table-scroll seller-order-detail-items">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Số lượng</th>
                    <th>Đơn giá</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {sub.items.map((item, index) => (
                    <tr key={item.orderItemId ?? item.itemId ?? `${item.skuId}-${index}`}>
                      <td>
                        <strong>{item.productName}</strong>
                        {item.skuCode && (
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                            SKU: {item.skuCode}
                          </div>
                        )}
                      </td>
                      <td>{item.quantity}</td>
                      <td>{formatMoney(item.unitPrice)}</td>
                      <td>
                        <strong>{formatMoney(item.lineTotal)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              </div>
              <aside className="seller-order-detail-side">
            <h3>Tổng kết đơn hàng</h3>
            <div className="info-row">
              <span>Tiền hàng</span>
              <strong>{formatMoney(sub.itemsAmount)}</strong>
            </div>
            <div className="info-row">
              <span>Phí giao hàng</span>
              <strong>{formatMoney(sub.shippingFeeAmount)}</strong>
            </div>
            {([ ["Giảm sản phẩm", sub.productDiscountAmount], ["Giảm từ shop", sub.shopDiscountAmount], ["Giảm từ sàn", sub.systemDiscountAmount] ] as const).filter(([, amount]) => typeof amount === "number" && amount > 0).map(([label, amount]) => <div className="info-row" key={label}><span>{label}</span><strong>−{formatMoney(amount ?? 0)}</strong></div>)}
            <div className="info-row">
              <span>Tổng tiền đơn hàng</span>
              <strong style={{ color: "var(--sky-dark)" }}>{formatMoney(sub.totalAmount)}</strong>
            </div>
            {financial.data && (
              <>
                <div className="info-row">
                  <span>Phí nền tảng</span>
                  <strong>−{formatMoney(financial.data.platformFeeAmount)}</strong>
                </div>
                <div className="info-row">
                  <span>Thực nhận về ví</span>
                  <strong style={{ color: "var(--emerald-dark, #047857)" }}>
                    {formatMoney(financial.data.sellerReceiveAmount)}
                  </strong>
                </div>
                <div className="info-row">
                  <span>Trạng thái giải ngân</span>
                  <Badge tone={financial.data.isEscrowSettled ? "green" : "amber"}>
                    {financial.data.isEscrowSettled ? "Đã giải ngân" : "Chờ hoàn tất đơn"}
                  </Badge>
                </div>
              </>
            )}
            {acceptBlock && canAccept && (
              <p role="alert" className="notice" style={{ marginTop: 12 }}>
                {acceptBlock.message} <Link href={ROUTES.seller.inventory}>Mở Quản lý kho</Link>
              </p>
            )}
            {canAccept && (
              <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--primary-soft)", borderRadius: 10, border: "1px solid var(--primary-border)" }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                  Hẹn ca bưu tá GHN đến lấy hàng:
                </label>
                <select
                  className="field"
                  style={{ width: "100%", background: "#fff" }}
                  value={selectedPickShiftId ?? ""}
                  onChange={(e) => setSelectedPickShiftId(e.target.value ? Number(e.target.value) : null)}
                  disabled={busy}
                  aria-label="Ca lấy hàng GHN"
                >
                  <option value="">Ca sớm nhất của bưu tá GHN (Mặc định)</option>
                  {pickShifts.data?.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.title}
                    </option>
                  ))}
                </select>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                  Shipper GHN sẽ đến địa chỉ kho của bạn để nhận kiện hàng theo ca hẹn này.
                </span>
              </div>
            )}
            {sub && ["CONFIRMED", "SELLERACCEPTED", "SHIPPING", "SHIPPED"].includes(sub.status.replace(/[^a-z]/gi, "").toUpperCase()) && (
              <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, border: "1px solid var(--primary-border)", background: "var(--surface)" }}>
                <h4 style={{ margin: "0 0 6px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6, color: "var(--ink)" }}>
                  <Icon name="package" size={15} />
                  Chuẩn bị kiện hàng & Bàn giao bưu tá GHN
                </h4>
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45, marginBottom: 10 }}>
                  Đóng gói đúng {sub.items.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm trong đơn, in phiếu giao hàng dán lên bọc hàng và giao cho shipper khi tới lấy hàng.
                </div>
                {effectiveTrackingCode && (
                  <TrackingCodeBar
                    carrierCode={effectiveCarrierCode}
                    carrierName={shipmentInfo.data?.carrierName}
                    trackingCode={effectiveTrackingCode}
                    labelPrintUrl={effectiveLabelPrintUrl}
                    showPrintLabel
                  />
                )}
              </div>
            )}
            {retryFailure && (
              <p role="alert" className="notice" style={{ marginTop: 12 }}>
                {retryFailure.message}{" "}
                {retryFailure.fix === "warehouse-form" && <Link href={ROUTES.seller.inventory}>Mở Quản lý kho</Link>}
              </p>
            )}
            <div className="action-row" style={{ marginTop: 18 }}>
              {canAccept && (
                <>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={busy || Boolean(acceptBlock)}
                    title={acceptBlock?.message}
                    onClick={() => void handleAccept()}
                  >
                    {busy ? "Đang xử lý…" : "Chấp nhận đơn"}
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={busy}
                    aria-expanded={rejecting}
                    aria-controls="seller-order-reject-form"
                    onClick={() => {
                      setRejecting((value) => !value);
                      setActionError("");
                    }}
                  >
                    Từ chối đơn
                  </button>
                </>
              )}
              {canRetryShipment && (
                <button type="button" className="button button-primary" disabled={retryBusy} onClick={() => void handleRetryShipment()}>
                  {retryBusy ? "Đang tạo…" : "Tạo lại vận đơn"}
                </button>
              )}
              {hasShipmentToTrack(sub.status) && (
                <ButtonLink href={ROUTES.seller.shipment(sub.subOrderId)} variant="secondary">
                  Theo dõi vận đơn
                </ButtonLink>
              )}
              <ButtonLink href={ROUTES.seller.orders} variant="secondary">
                Quay lại đơn hàng
              </ButtonLink>
            </div>
            {canAccept && rejecting && (
              <div id="seller-order-reject-form" className="seller-order-reject-form">
                <label className="field-wrap">
                  <span>Lý do từ chối đơn</span>
                  <textarea
                    className="textarea-field"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="Nêu rõ lý do để người mua biết vì sao đơn bị từ chối"
                    disabled={busy}
                    required
                  />
                </label>
                <p>Đơn sẽ bị hủy. Nếu đã thanh toán, hệ thống sẽ xử lý hoàn tiền cho người mua.</p>
                <div className="action-row">
                  <button
                    type="button"
                    className="button auction-danger-button"
                    disabled={busy || !rejectReason.trim()}
                    onClick={() => void handleReject()}
                  >
                    {busy ? "Đang xử lý…" : "Xác nhận từ chối"}
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => {
                      setRejecting(false);
                      setRejectReason("");
                      setActionError("");
                    }}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
              </aside>
            </div>
          </>
        ) : (
          <NoData
            title={
              resource.loading
                ? "Đang tải chi tiết đơn bán…"
                : resource.error
                  ? "Không tải được chi tiết đơn bán"
                  : "Không tìm thấy đơn bán"
            }
          />
        )}
      </Card>
      {sub && sub.status.replace(/[^a-z]/gi, "").toUpperCase() === "COMPLETED" && <SellerBuyerReview buyerId={sub.buyerId} subOrderId={sub.subOrderId} />}
    </>
  );
}

export function SellerShipmentDetailScreen() {
  const params = useParams<{ id: string }>();
  const subOrderId = String(params.id ?? "");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [syncError, setSyncError] = useState("");

  const resource = useApiResource(
    subOrderId ? `seller-shipment-timeline:${subOrderId}` : null,
    (signal) => fulfillmentService.getSubOrderTimeline(subOrderId, signal),
  );
  const data = resource.data;
  // Fetch the carrier's own record whenever a tracking code exists so we have shipment id (for sync-status), shipper info, items, and failed attempts.
  const carrier = useApiResource(
    data?.trackingCode ? `seller-shipment-carrier:${data.trackingCode}` : null,
    (signal) => fulfillmentService.getShipmentByTracking(data?.trackingCode ?? "", signal),
  );
  const failedAttempts = countFailedAttempts(carrier.data?.events);
  const lastReason = [...(carrier.data?.events ?? [])].reverse().find((event) => event.status === "DeliveryAttemptFailed" && event.reason)?.reason;
  const shipmentItems = data?.items?.length
    ? data.items.map((item) => ({
        key: item.orderItemId ?? item.skuId,
        name: item.productName,
        skuCode: item.skuCode ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      }))
    : (carrier.data?.items ?? []).map((item, idx) => ({
        key: `${item.skuId}-${idx}`,
        name: item.name,
        skuCode: item.skuId,
        quantity: item.quantity,
        unitPrice: item.price,
        lineTotal: item.price * item.quantity,
      }));

  async function handleSyncFromCarrier() {
    if (!carrier.data?.id || syncBusy) return;
    setSyncBusy(true);
    setSyncNotice("");
    setSyncError("");
    try {
      await fulfillmentService.syncShipmentStatus(carrier.data.id);
      setSyncNotice("Đã đồng bộ trạng thái mới nhất từ GHN.");
      resource.reload();
      carrier.reload();
    } catch (cause) {
      setSyncError(cause instanceof Error ? msg(cause) : "Không thể đồng bộ trạng thái từ GHN lúc này.");
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        overline="Kênh người bán"
        title="Theo dõi vận đơn"
        description="Hành trình giao hàng và trạng thái cập nhật từ đơn vị vận chuyển GHN."
        action={
          carrier.data?.id ? (
            <button
              type="button"
              className="button button-secondary"
              disabled={syncBusy}
              onClick={() => void handleSyncFromCarrier()}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Icon name="refreshCw" size={15} />
              {syncBusy ? "Đang đồng bộ…" : "Đồng bộ từ GHN"}
            </button>
          ) : undefined
        }
      />
      {resource.error && (
        <p className="notice" role="alert">
          {msg(resource.error)}
        </p>
      )}
      {syncError && <p className="notice" role="alert">{syncError}</p>}
      {syncNotice && <p className="form-success" role="status">{syncNotice}</p>}

      {data && (
        <OrderProgressStepper
          status={data.currentStatus}
          deliveredAt={carrier.data?.deliveredAt}
          orderNo={data.subOrderNo}
        />
      )}

      <Card className="card-pad">
        {data ? (
          <>
            <div className="info-row">
              <span>Mã đơn gian hàng</span>
              <strong className="seller-wrap-value">{data.subOrderNo}</strong>
            </div>
            <div className="info-row">
              <span>Trạng thái hiện tại</span>
              <Badge>{shipmentStatusLabel(data.currentStatus)}</Badge>
            </div>
            {data.estimatedDeliveryAt && (
              <div className="info-row">
                <span>Dự kiến giao</span>
                <strong>{new Date(data.estimatedDeliveryAt).toLocaleString("vi-VN")}</strong>
              </div>
            )}
            {carrier.data && (
              <>
                <div className="info-row">
                  <span>Người nhận</span>
                  <strong>{carrier.data.receiverName} · {carrier.data.receiverPhone}</strong>
                </div>
                <div className="info-row">
                  <span>Địa chỉ nhận</span>
                  <span style={{ textAlign: "right" }}>{carrier.data.receiverAddress}</span>
                </div>
              </>
            )}

            <TrackingCodeBar
              carrierCode={data.carrierCode}
              carrierName={data.carrierName}
              trackingCode={data.trackingCode}
              labelPrintUrl={data.labelPrintUrl}
              shipmentId={carrier.data?.id}
              showPrintLabel
            />

            {shipmentItems.length > 0 && (
              <div style={{ marginTop: 14, marginBottom: 14 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Sản phẩm trong đơn vận chuyển</h3>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Sản phẩm</th>
                        <th>Số lượng</th>
                        <th>Đơn giá</th>
                        <th>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipmentItems.map((item) => (
                        <tr key={item.key}>
                          <td>
                            <strong>{item.name}</strong>
                            {item.skuCode && (
                              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                                SKU: {item.skuCode}
                              </div>
                            )}
                          </td>
                          <td className="tabular-nums">{item.quantity}</td>
                          <td className="tabular-nums">{formatMoney(item.unitPrice)}</td>
                          <td className="tabular-nums"><strong>{formatMoney(item.lineTotal)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {failedAttempts > 0 && !lastReason && (
              <div className="shipment-alert-strip is-danger" role="status" style={{ marginBottom: 12 }}>
                <Icon name="alertTriangle" size={16} />
                <span>Đã có {failedAttempts} lần giao không thành công.</span>
              </div>
            )}

            <ShipmentTimelineList
              events={data.timeline}
              carrierEvents={carrier.data?.events}
              loading={resource.loading}
              refreshing={resource.loading || carrier.loading}
              onRefresh={() => {
                resource.reload();
                if (data.trackingCode) carrier.reload();
              }}
            />
          </>
        ) : (
          <NoData
            title={
              resource.loading
                ? "Đang tải vận đơn…"
                : resource.error
                  ? "Không tải được vận đơn"
                  : "Không có dữ liệu vận đơn"
            }
          />
        )}
      </Card>
      <div className="action-row">
        {data && canConfirmReturn(data.timeline) && <ConfirmReturnButton subOrderId={subOrderId} onDone={() => { resource.reload(); }} />}
        <ButtonLink href={ROUTES.seller.order(subOrderId)} variant="secondary">
          Xem chi tiết đơn bán
        </ButtonLink>
        <ButtonLink href={ROUTES.seller.shipments} variant="secondary">
          Quay lại danh sách vận đơn
        </ButtonLink>
      </div>
    </>
  );
}

export function SellerShopScreen() {
  const { user } = useSession();
  const shop = useApiResource("/api/v1/sellers/profile", async () =>
    unwrap(await api.get<ApiResponse<Obj>>("/api/v1/sellers/profile")),
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  // Once the seller changes anything, a reload of the profile must not replace the form; a successful save hands the form back to the saved data.
  const [dirty, setDirty] = useState(false);
  const [locationCheck, setLocationCheck] = useState<GhnCheck>({ state: "empty" });

  useEffect(() => {
    if (!saved) return;
    const timeout = window.setTimeout(() => setSaved(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [saved]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setError("");
    setSaved("");
    const locationBlock = ghnWriteBlock(locationCheck);
    if (locationBlock) {
      setError(locationBlock);
      return;
    }
    setBusy(true);
    try {
      await api.patch("/api/v1/sellers/profile", {
        shopName: String(values.get("shopName") ?? ""),
        hotline: String(values.get("hotline") ?? ""),
        pickupAddress: String(values.get("streetAddress") ?? ""),
        provinceId: Number(values.get("provinceId")),
        districtId: Number(values.get("districtId")),
        wardCode: String(values.get("wardCode") ?? ""),
      });
      setSaved("Đã cập nhật hồ sơ gian hàng.");
      setDirty(false);
      shop.reload();
    } catch (reason) {
      setError(msg(reason as Error));
    } finally {
      setBusy(false);
    }
  }

  const draft = loadSafeRegistrationDraft(user?.id);
  const data = shop.data ?? {};
  const address =
    typeof data.pickupAddress === "object" && data.pickupAddress !== null
      ? (data.pickupAddress as Obj)
      : typeof data.warehouseAddress === "object" && data.warehouseAddress !== null
        ? (data.warehouseAddress as Obj)
        : {};

  const resolvedShopName = String(data.shopName ?? draft?.shopName ?? "");
  const resolvedHotline = String(data.hotline ?? draft?.hotline ?? "");
  const resolvedProvinceId = String(address.provinceId ?? data.provinceId ?? draft?.warehouseAddress.provinceId ?? "");
  const resolvedDistrictId = String(address.districtId ?? data.districtId ?? draft?.warehouseAddress.districtId ?? "");
  const resolvedWardCode = String(address.wardCode ?? data.wardCode ?? draft?.warehouseAddress.wardCode ?? "");

  const resolvedStreetAddress = String(
    address.streetAddress ??
      (typeof data.pickupAddress === "string" ? data.pickupAddress : "") ??
      draft?.warehouseAddress.streetAddress ??
      "",
  );

  // The form keeps its key while the seller edits (see nextShopFormKey): changing it would re-create the form and lose what was just typed.
  const savedKey = shopFormSavedKey({ shopName: resolvedShopName, hotline: resolvedHotline, provinceId: resolvedProvinceId, districtId: resolvedDistrictId, wardCode: resolvedWardCode, streetAddress: resolvedStreetAddress });
  const [formKey, setFormKey] = useState(savedKey);
  const nextKey = nextShopFormKey(formKey, savedKey, dirty);
  if (nextKey !== formKey) setFormKey(nextKey);

  return (
    <>
      <PageHeading
        overline="Kênh người bán"
        title="Hồ sơ gian hàng"
      />
      {shop.error && (
        <p role="alert" className="notice">
          {msg(shop.error)}
        </p>
      )}

      <div className="seller-shop-columns">
        <Card className="card-pad seller-shop-summary">
          <h2>Thông tin đã lưu</h2>
          <Badge>{String(data.status ?? "Chưa xác nhận")}</Badge>
          <dl className="seller-shop-facts">
            <div><dt>Tên gian hàng</dt><dd>{resolvedShopName || "—"}</dd></div>
            <div><dt>Hotline</dt><dd>{resolvedHotline || "—"}</dd></div>
            <div><dt>Địa chỉ lấy hàng</dt><dd>{resolvedStreetAddress || "—"}</dd></div>
            <div><dt>Khu vực lấy hàng</dt><dd>{resolvedProvinceId ? <SavedShopArea provinceId={resolvedProvinceId} districtId={resolvedDistrictId} wardCode={resolvedWardCode} /> : "Chưa khai báo"}</dd></div>
          </dl>
          <p className="status-note">Trạng thái hồ sơ UserService không chứng minh kho đã được tạo ở Fulfillment. Chỉ xác nhận đồng bộ khi backend cung cấp mã kho hoặc truy vấn kho theo Seller.</p>
        </Card>

        <Card className="card-pad seller-shop-editor">
        <h2>Chỉnh sửa gian hàng</h2>
        <form
          className="auth-fields"
          onChange={() => setDirty(true)}
          key={formKey}
          onSubmit={(e) => void submit(e)}
        >
          <label className="field-wrap">
            Tên gian hàng
            <input className="field" name="shopName" required defaultValue={resolvedShopName} />
          </label>
          <label className="field-wrap">
            Hotline
            <input className="field" name="hotline" required defaultValue={resolvedHotline} />
          </label>
          <SellerShopAddressFields provinceId={resolvedProvinceId} districtId={resolvedDistrictId}
            wardCode={resolvedWardCode} streetAddress={resolvedStreetAddress} onCheck={setLocationCheck} />
          {error && (
            <p role="alert" className="notice">
              {error}
            </p>
          )}
          <button className="button button-primary" disabled={busy || shop.loading}>
            {busy ? "Đang lưu…" : "Lưu hồ sơ shop"}
          </button>
        </form>
        </Card>
      </div>
      {saved && (
        <div className="app-notification" role="status" aria-live="polite" aria-atomic="true">
          <span className="app-notification-mark" aria-hidden="true">✓</span>
          <span className="app-notification-message">{saved}</span>
          <button type="button" className="app-notification-close" aria-label="Đóng thông báo" onClick={() => setSaved("")}>×</button>
        </div>
      )}
    </>
  );
}
