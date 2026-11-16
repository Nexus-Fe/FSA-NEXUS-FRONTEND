"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge, Card, NoData, PageHeading, SectionHeading } from "@/components/ui/Primitives";
import { BackendImage } from "@/components/ui/BackendImage";
import { useSession } from "@/components/auth/SessionProvider";
import { ROUTES } from "@/constants/routes";
import { unwrap } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney, resolveImageUrl } from "@/lib/presentation";
import { sellerService } from "./services/seller.service";
import {
  sellerCatalogService,
  type InventoryBalance,
  type ProductVariant,
  type SellerProductDetail,
} from "./services/catalog.service";
import type { ProductSpecification } from "@/features/catalog/types/product-specification";

const maxImageBytes = 5 * 1024 * 1024;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function parseSpecificationsToRows(specifications?: ProductSpecification[] | null): Array<{ key: string; value: string }> {
  return specifications?.map(({ name, value }) => ({ key: name, value })) ?? [];
}

function ProductDetailsForm({ product, onSaved }: { product: SellerProductDetail; onSaved: () => void }) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [brand, setBrand] = useState(product.brand ?? "");
  const [specRows, setSpecRows] = useState<Array<{ key: string; value: string }>>(() =>
    parseSpecificationsToRows(product.specifications),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const specifications = specRows
        .map((row) => ({ name: row.key.trim(), value: row.value.trim() }))
        .filter((row) => row.name && row.value);
      await sellerCatalogService.update(product.productId, {
        name: name.trim(),
        description: description.trim(),
        brand: brand.trim(),
        categoryId: product.categoryId,
        weightGrams: product.weightGrams ?? undefined,
        specifications,
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được sản phẩm.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="card-pad">
      <SectionHeading title="Thông tin sản phẩm & Thông số kỹ thuật" />
      <form className="auth-fields" onSubmit={(event) => void save(event)}>
        <label className="field-wrap">
          Tên sản phẩm
          <input className="field" required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="form-grid">
          <label className="field-wrap">
            Thương hiệu
            <input className="field" value={brand} onChange={(event) => setBrand(event.target.value)} />
          </label>
          <div className="field-wrap seller-product-category-field">
            <span>Danh mục ngành hàng</span>
            <strong className="seller-product-static-value">{product.categoryName ?? product.categoryId}</strong>
          </div>
        </div>
        <label className="field-wrap">
          Mô tả
          <textarea
            className="textarea-field"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <strong style={{ fontSize: 13 }}>Thông số kỹ thuật (Specifications JSON)</strong>
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={() => setSpecRows((prev) => [...prev, { key: "", value: "" }])}
            >
              + Thêm thông số
            </button>
          </div>
          {specRows.length > 0 ? (
            <div className="seller-spec-list">
              {specRows.map((row, idx) => (
                <div key={idx} className="seller-spec-row">
                  <input
                    className="field"
                    placeholder="Tên thông số"
                    value={row.key}
                    onChange={(e) =>
                      setSpecRows((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, key: e.target.value } : item)),
                      )
                    }
                  />
                  <input
                    className="field"
                    placeholder="Giá trị"
                    value={row.value}
                    onChange={(e) =>
                      setSpecRows((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, value: e.target.value } : item)),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={() => setSpecRows((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="status-note" style={{ marginTop: 0 }}>
              Chưa có thông số kỹ thuật nào. Bấm &quot;+ Thêm thông số&quot; để bổ sung.
            </p>
          )}
        </div>

        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu thay đổi sản phẩm"}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function SellerProductDetailScreen() {
  const { user } = useSession();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params.id ?? "");
  const sellerProfile = useApiResource(
    user?.id ? `seller-detail-profile:${user.id}` : null,
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
      ? `seller-detail-warehouses:${user.id}:${sellerId ?? ""}:${shopName ?? ""}`
      : null,
    (signal) =>
      sellerCatalogService.listWarehouses(user?.id, signal, {
        sellerId,
        shopName,
        pickupAddress,
      }),
  );
  const personalWarehouseId = warehouses.data?.[0]?.id ?? "";
  const product = useApiResource(
    id ? `seller-product:${id}` : null,
    (signal) => sellerCatalogService.detail(id, signal),
  );

  // Add new variant state
  const [skuCode, setSkuCode] = useState("");
  const [variantName, setVariantName] = useState("");
  const [price, setPrice] = useState("");
  const [variantWeight, setVariantWeight] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");

  // Edit existing variant state (R117_PATCH_VARIANT)
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editVariantName, setEditVariantName] = useState("");
  const [editVariantPrice, setEditVariantPrice] = useState("");
  const [editVariantWeight, setEditVariantWeight] = useState("");

  // Upload image state
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [imageVariantId, setImageVariantId] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const data = product.data;
  const generalImageCount = data?.images.filter((image) => !image.variantId).length ?? 0;
  const availableImageVariants = data?.variants.filter((variant) =>
    data.images.filter((image) => image.variantId === variant.variantId).length < 3,
  ) ?? [];
  const uploadVariantId = availableImageVariants.some((variant) => variant.variantId === imageVariantId)
    ? imageVariantId
    : generalImageCount < 5 ? "" : availableImageVariants[0]?.variantId ?? "";
  const activeVariants =
    data?.variants.filter((variant) => variant.status.toUpperCase() === "ACTIVE" && Number(variant.price) > 0) ?? [];
  const defaultVariant = activeVariants.find((variant) => variant.isActive) ?? activeVariants[0];
  const hasImage = data?.images.some((image) => image.isActive) ?? (data?.images.length ?? 0) > 0;

  const variantIdsKey = data?.variants.map((v) => v.variantId).join(",") ?? "";
  const batchInventory = useApiResource(
    variantIdsKey ? `seller-detail-stock-batch:${variantIdsKey}` : null,
    (signal) => sellerCatalogService.inventoryBatch(data?.variants.map((v) => v.variantId) ?? [], signal),
  );

  const stockMap = new Map<string, InventoryBalance>();
  for (const item of batchInventory.data ?? []) {
    const existing = stockMap.get(item.skuId);
    if (!existing || (personalWarehouseId && item.warehouseId === personalWarehouseId)) {
      stockMap.set(item.skuId, item);
    }
  }

  const defaultStock = defaultVariant ? stockMap.get(defaultVariant.variantId) : undefined;
  const inventoryPending = data?.variants.filter((variant) => variant.inventoryInitState === "Pending") ?? [];
  const inventoryBroken = data?.variants.filter((variant) => variant.inventoryInitState === "NeedsAttention") ?? [];
  const canActivate = Boolean(defaultVariant && hasImage);

  async function addVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const weight = variantWeight.trim() ? Number(variantWeight) : null;
      if (weight !== null && (!Number.isSafeInteger(weight) || weight <= 0)) {
        throw new Error("Khối lượng biến thể phải là số nguyên lớn hơn 0 gram.");
      }
      const createdVariant = await sellerCatalogService.addVariant(id, {
        skuCode: skuCode.trim(),
        name: variantName.trim(),
        price: Number(price),
        currency: "VND",
        weightGrams: weight,
        attributes: [
          color.trim() && { attrName: "Màu sắc", attrValue: color.trim() },
          size.trim() && { attrName: "Kích cỡ", attrValue: size.trim() },
        ].filter((attribute): attribute is { attrName: string; attrValue: string } => Boolean(attribute)),
      });
      setSkuCode("");
      setVariantName("");
      setPrice("");
      setVariantWeight("");
      setColor("");
      setSize("");
      setNotice(`Đã thêm biến thể ${createdVariant.skuCode}. Nhập tồn theo kho tại Quản lý kho.`);
      product.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thêm được biến thể.");
    } finally {
      setBusy(false);
    }
  }

  function startEditVariant(variant: ProductVariant) {
    setEditingVariantId(variant.variantId);
    setEditVariantName(variant.name);
    setEditVariantPrice(String(variant.price ?? ""));
    setEditVariantWeight(variant.weightGrams == null ? "" : String(variant.weightGrams));
  }

  async function saveEditVariant(variant: ProductVariant) {
    const parsedPrice = Number(editVariantPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Giá bán biến thể phải lớn hơn 0 ₫.");
      return;
    }
    const weight = editVariantWeight.trim() ? Number(editVariantWeight) : null;
    if (weight !== null && (!Number.isSafeInteger(weight) || weight <= 0)) {
      setError("Khối lượng biến thể phải là số nguyên lớn hơn 0 gram.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sellerCatalogService.updateVariant(variant.variantId, {
        name: editVariantName.trim() || variant.name,
        price: parsedPrice,
        currency: variant.currency || "VND",
        attributes: variant.attributes,
        weightGrams: weight,
      });
      setEditingVariantId(null);
      setNotice(`Đã cập nhật biến thể ${variant.skuCode}.`);
      product.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không cập nhật được biến thể.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteVariant(variant: ProductVariant) {
    if (!window.confirm(`Xóa biến thể SKU "${variant.skuCode}"?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sellerCatalogService.deleteVariant(variant.variantId);
      setNotice(`Đã xóa biến thể ${variant.skuCode}.`);
      product.reload();
      batchInventory.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xóa được biến thể.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !imageTypes.has(file.type) || file.size > maxImageBytes) {
      setError("Chọn ảnh JPG, PNG hoặc WEBP không quá 5 MB.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sellerCatalogService.uploadImage(id, file, altText, 0, uploadVariantId || undefined);
      setFile(null);
      setFileInputKey((value) => value + 1);
      setAltText("");
      setImageVariantId("");
      setNotice(uploadVariantId ? "Đã tải ảnh biến thể lên thành công." : "Đã tải ảnh sản phẩm lên thành công.");
      product.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được ảnh.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSetPrimaryImage(imageId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sellerCatalogService.setPrimaryImage(imageId);
      setNotice("Đã đặt làm ảnh đại diện chính của sản phẩm.");
      product.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đổi được ảnh đại diện.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: "PENDING_APPROVAL" | "INACTIVE") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sellerCatalogService.changeStatus(id, status);
      setNotice(
        status === "PENDING_APPROVAL"
          ? "Đã gửi sản phẩm để staff duyệt. Sản phẩm chỉ mở bán sau khi được phê duyệt."
          : "Sản phẩm đã chuyển sang trạng thái tạm ngừng bán (INACTIVE).",
      );
      product.reload();
      batchInventory.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đổi được trạng thái sản phẩm.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct() {
    if (!window.confirm("Xóa sản phẩm này? Thao tác sẽ ẩn sản phẩm và các biến thể khỏi sàn.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sellerCatalogService.deleteProduct(id);
      router.replace(ROUTES.seller.products);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xóa được sản phẩm.");
      setBusy(false);
    }
  }

  async function setDefaultVariant(variantId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sellerCatalogService.setDefaultVariant(id, variantId);
      setNotice("Đã chọn biến thể mặc định.");
      product.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không chọn được biến thể mặc định.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteImage(imageId: string) {
    if (!window.confirm("Xóa ảnh này khỏi sản phẩm?")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sellerCatalogService.deleteImage(id, imageId);
      setNotice("Đã xóa ảnh.");
      product.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xóa được ảnh.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading title={data?.name ?? "Chi tiết sản phẩm"} />
      {product.error && (
        <p className="notice" role="alert">
          {product.error.message}
        </p>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="form-success" role="status">
          {notice}
        </p>
      )}
      {!data ? (
        <Card>
          <NoData title={product.loading ? "Đang tải sản phẩm…" : "Chưa tải được sản phẩm"} />
        </Card>
      ) : (
        <div className="seller-product-workspace">
          <Card className="card-pad">
            <div className="seller-product-summary">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <Badge>{data.status}</Badge>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    Danh mục: <strong>{data.categoryName ?? data.categoryId}</strong>
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Mã sản phẩm: {data.productId}</p>
              </div>
              <div className="action-row" style={{ margin: 0 }}>
                <Link className="button button-secondary" href={ROUTES.seller.editProduct(data.productId)}>Chỉnh sửa sản phẩm</Link>
                <Link className="button button-secondary" href={ROUTES.seller.inventory}>
                  Quản lý kho
                </Link>
                {data.status.toUpperCase() === "ACTIVE" ? (
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => void changeStatus("INACTIVE")}
                  >
                    Tạm ngừng bán
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={busy || !canActivate}
                    onClick={() => void changeStatus("PENDING_APPROVAL")}
                  >
                    {data.status.toUpperCase() === "INACTIVE" ? "Gửi duyệt để mở bán lại" : "Gửi sản phẩm để staff duyệt"}
                  </button>
                )}
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => void deleteProduct()}
                >
                  Xóa sản phẩm
                </button>
              </div>
            </div>
          </Card>

          <ProductDetailsForm
            key={data.productId}
            product={data}
            onSaved={() => {
              setNotice("Đã lưu thông tin & thông số kỹ thuật sản phẩm.");
              product.reload();
            }}
          />

          <Card className="card-pad">
            <SectionHeading title={`Biến thể SKU & Tồn kho (${data.variants.length}/10)`} />
            <div className="table-scroll seller-product-table-scroll">
              <table className="data-table seller-product-variant-table">
                <thead>
                  <tr>
                    <th>Mã SKU</th>
                    <th>Tên biến thể</th>
                    <th>Thuộc tính</th>
                    <th>Giá bán</th>
                    <th>Khối lượng</th>
                    <th>Tồn kho</th>
                    <th>Mặc định</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.variants.map((variant) => {
                    const inv = stockMap.get(variant.variantId);
                    const isEditing = editingVariantId === variant.variantId;
                    return (
                      <tr key={variant.variantId}>
                        <td className="seller-product-sku-cell">
                          <strong>{variant.skuCode}</strong>
                        </td>
                        <td className="seller-product-name-cell">
                          {isEditing ? (
                            <input
                              className="field"
                              style={{ minWidth: 140 }}
                              value={editVariantName}
                              onChange={(e) => setEditVariantName(e.target.value)}
                            />
                          ) : (
                            variant.name
                          )}
                        </td>
                        <td className="seller-product-attributes-cell">
                          {variant.attributes.map((attribute) => `${attribute.attrName}: ${attribute.attrValue}`).join(", ") ||
                            "—"}
                        </td>
                        <td className="seller-product-price-cell">
                          {isEditing ? (
                            <input
                              className="field seller-product-number-input"
                              type="number"
                              min="1"
                              value={editVariantPrice}
                              onChange={(e) => setEditVariantPrice(e.target.value)}
                            />
                          ) : (
                            <strong>{formatMoney(variant.price)}</strong>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              className="field seller-product-number-input"
                              type="number"
                              min="1"
                              step="1"
                              value={editVariantWeight}
                              placeholder="Theo sản phẩm"
                              aria-label={`Khối lượng biến thể ${variant.skuCode} (gram)`}
                              onChange={(event) => setEditVariantWeight(event.target.value)}
                            />
                          ) : (
                            <span>{variant.weightGrams ?? data.weightGrams ?? "—"} g{variant.weightGrams == null ? " · Theo sản phẩm" : ""}</span>
                          )}
                        </td>
                        <td className="seller-product-stock-cell">
                          {inv ? (
                            <div className="seller-product-stock-values">
                              <span><strong>{inv.totalQuantity}</strong><small>Tổng</small></span>
                              <span><strong>{inv.availableQuantity}</strong><small>Khả dụng</small></span>
                              <span><strong>{inv.reservedQuantity}</strong><small>Đang giữ</small></span>
                            </div>
                          ) : variant.inventoryInitState === "NeedsAttention" ? (
                            <span className="seller-inventory-init seller-inventory-init-error" role="status">Chưa tạo được kho. Liên hệ hỗ trợ.</span>
                          ) : variant.inventoryInitState === "Pending" ? (
                            <span className="seller-inventory-init" role="status">Đang khởi tạo kho…</span>
                          ) : (
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>Đang đồng bộ…</span>
                          )}
                        </td>
                        <td>
                          {variant.isActive ? (
                            <Badge>Mặc định</Badge>
                          ) : (
                            <button
                              type="button"
                              className="button button-secondary button-small"
                              disabled={busy || variant.status.toUpperCase() !== "ACTIVE"}
                              onClick={() => void setDefaultVariant(variant.variantId)}
                            >
                              Đặt mặc định
                            </button>
                          )}
                        </td>
                        <td>
                          <div className="seller-product-row-actions">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  className="button button-primary button-small"
                                  disabled={busy}
                                  onClick={() => void saveEditVariant(variant)}
                                >
                                  Lưu
                                </button>
                                <button
                                  type="button"
                                  className="button button-secondary button-small"
                                  onClick={() => setEditingVariantId(null)}
                                >
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="button button-secondary button-small"
                                  disabled={busy}
                                  onClick={() => startEditVariant(variant)}
                                >
                                  Sửa giá/tên
                                </button>
                                {data.variants.length > 1 && !variant.hasOrder && (
                                  <button
                                    type="button"
                                    className="button button-secondary button-small"
                                    disabled={busy}
                                    onClick={() => void handleDeleteVariant(variant)}
                                  >
                                    Xóa
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data.variants.length < 10 && (
              <form className="auth-fields seller-product-form" onSubmit={(event) => void addVariant(event)}>
                <h3>Thêm biến thể SKU mới</h3>
                <div className="form-grid">
                  <label className="field-wrap">
                    Mã SKU
                    <input
                      className="field"
                      required
                      placeholder="VD: ORI-BAM-G4-BLK"
                      value={skuCode}
                      onChange={(event) => setSkuCode(event.target.value)}
                    />
                  </label>
                  <label className="field-wrap">
                    Tên biến thể
                    <input
                      className="field"
                      required
                      placeholder="VD: Dây da đen - Mặt đen"
                      value={variantName}
                      onChange={(event) => setVariantName(event.target.value)}
                    />
                  </label>
                  <label className="field-wrap">
                    Màu sắc
                    <input className="field" value={color} onChange={(event) => setColor(event.target.value)} />
                  </label>
                  <label className="field-wrap">
                    Kích cỡ
                    <input className="field" value={size} onChange={(event) => setSize(event.target.value)} />
                  </label>
                  <label className="field-wrap">
                    Giá bán (VND)
                    <input
                      className="field"
                      type="number"
                      min="1"
                      required
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                    />
                  </label>
                  <label className="field-wrap">
                    Khối lượng riêng (gram)
                    <input
                      className="field"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Để trống dùng khối lượng sản phẩm"
                      value={variantWeight}
                      onChange={(event) => setVariantWeight(event.target.value)}
                    />
                  </label>
                </div>
                <p className="status-note">Sau khi tạo SKU, nhập thêm hàng tại Quản lý kho và chọn đúng kho nhận.</p>
                <div>
                  <button
                    className="button button-primary"
                    disabled={
                      busy ||
                      !Number.isFinite(Number(price)) ||
                      Number(price) <= 0 ||
                      (variantWeight.trim() !== "" && (!Number.isSafeInteger(Number(variantWeight)) || Number(variantWeight) <= 0))
                    }
                  >
                    Thêm biến thể
                  </button>
                </div>
              </form>
            )}
          </Card>

          <Card className="card-pad">
            <SectionHeading title={`Ảnh sản phẩm (${generalImageCount}/5)`} />
            <div className="seller-product-images">
              {data.images.map((image) => (
                <div
                  className={`seller-product-image${image.isActive && !image.variantId ? " is-primary" : ""}${image.variantId ? " is-variant" : ""}`}
                  key={image.id}
                >
                  <BackendImage src={resolveImageUrl(image.url)} alt={image.altText || data.name} compact />
                  <span>{image.variantId
                    ? `Biến thể: ${data.variants.find((variant) => variant.variantId === image.variantId)?.name ?? image.variantId}`
                    : image.isActive ? "★ Ảnh đại diện chính" : image.altText || "Ảnh sản phẩm"}</span>
                  {!image.variantId && !image.isActive && (
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      disabled={busy}
                      onClick={() => void handleSetPrimaryImage(image.id)}
                    >
                      Đặt ảnh đại diện
                    </button>
                  )}
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    disabled={busy || (data.status.toUpperCase() === "ACTIVE" && data.images.length === 1)}
                    onClick={() => void deleteImage(image.id)}
                  >
                    Xóa ảnh
                  </button>
                </div>
              ))}
            </div>
            {data.images.length < 15 && (generalImageCount < 5 || availableImageVariants.length > 0) && (
              <form className="auth-fields seller-product-form" onSubmit={(event) => void upload(event)}>
                <label className="field-wrap">
                  Ảnh cho
                  <select className="select-field" value={uploadVariantId} onChange={(event) => { setImageVariantId(event.target.value); setFile(null); setFileInputKey((value) => value + 1); }}>
                    {generalImageCount < 5 && <option value="">Sản phẩm chung</option>}
                    {availableImageVariants.map((variant) => (
                      <option key={variant.variantId} value={variant.variantId}>{variant.name} ({variant.skuCode})</option>
                    ))}
                  </select>
                </label>
                <label className="field-wrap">
                  Tải thêm ảnh JPG, PNG hoặc WEBP (tối đa 5 MB)
                  <input
                    key={fileInputKey}
                    className="field"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                <label className="field-wrap">
                  Mô tả ảnh (Alt text)
                  <input className="field" value={altText} onChange={(event) => setAltText(event.target.value)} />
                </label>
                <div>
                  <button className="button button-primary" disabled={busy || !file}>
                    {uploadVariantId ? "Tải ảnh biến thể" : "Tải ảnh sản phẩm"}
                  </button>
                </div>
              </form>
            )}
            {data.status.toUpperCase() === "ACTIVE" && data.images.length === 1 && (
              <p className="status-note">Không thể xóa ảnh duy nhất khi sản phẩm đang ở trạng thái mở bán (ACTIVE).</p>
            )}
          </Card>

          <Card className="card-pad">
            <SectionHeading title="Trạng thái Mở bán & Liên thông Kho" />
            <p className="seller-product-status-copy">
              Sản phẩm đủ điều kiện mở bán khi có ít nhất 1 biến thể đang hoạt động (giá &gt; 0 ₫) và 1 ảnh đại diện.
            </p>
            {defaultVariant && (
              <p className="seller-product-status-copy">
                SKU mặc định: <strong>{defaultVariant.skuCode}</strong> · Tồn khả dụng:{" "}
                <strong>{defaultStock ? `${defaultStock.availableQuantity} sản phẩm` : defaultVariant.inventoryInitState === "Pending" ? "Đang khởi tạo kho" : "Chưa có dữ liệu kho"}</strong>
              </p>
            )}
            {inventoryPending.length > 0 && (
              <p className="seller-product-status-copy" role="status">
                Đang tạo kho cho {inventoryPending.length} SKU. Người mua chưa đặt được các SKU này cho tới khi kho sẵn sàng; hệ thống tự thử lại.
              </p>
            )}
            {inventoryBroken.length > 0 && (
              <p className="notice" role="alert">
                Chưa tạo được kho cho {inventoryBroken.map((variant) => variant.skuCode).join(", ")} sau nhiều lần thử. Kiểm tra kho của bạn đang hoạt động rồi liên hệ hỗ trợ.
              </p>
            )}
            <div className="seller-product-status-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={batchInventory.loading}
                onClick={() => batchInventory.reload()}
              >
                {batchInventory.loading ? "Đang đồng bộ kho…" : "Đồng bộ lại tồn kho"}
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={busy || ["ACTIVE", "PENDING_APPROVAL"].includes(data.status.toUpperCase()) || !canActivate}
                onClick={() => void changeStatus("PENDING_APPROVAL")}
              >
                {busy
                  ? "Đang xử lý…"
                  : data.status.toUpperCase() === "INACTIVE"
                    ? "Gửi duyệt để mở bán lại"
                    : data.status.toUpperCase() === "ACTIVE"
                      ? "Đang mở bán trên sàn"
                      : data.status.toUpperCase() === "PENDING_APPROVAL" ? "Đang chờ duyệt" : "Gửi sản phẩm để staff duyệt"}
              </button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
