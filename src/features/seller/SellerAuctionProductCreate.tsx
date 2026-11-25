"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, PageHeading } from "@/components/ui/Primitives";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { ROUTES } from "@/constants/routes";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { sellerCatalogService } from "./services/catalog.service";
import { leafCategoryOptions } from "./services/category-options";

type AuctionProduct = { productId: string; variantId: string; skuCode: string; status: string; images?: Array<{ id: string }> };

export function SellerAuctionProductCreate() {
  const categories = useApiResource("auction-product-categories", sellerCatalogService.categories);
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [weightGrams, setWeightGrams] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<AuctionProduct | null>(null);
  const [imageUploaded, setImageUploaded] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const savedDraftId = new URLSearchParams(window.location.search).get("draftId");
    const resumableId = savedDraftId && /^[0-9a-f-]{36}$/i.test(savedDraftId) ? savedDraftId : null;
    const weight = Number(weightGrams);
    if (!resumableId && (!categoryId || !name.trim() || !Number.isSafeInteger(weight) || weight <= 0 || !image || !["image/jpeg", "image/png", "image/webp"].includes(image.type) || image.size > 5 * 1024 * 1024)) {
      setError("Điền tên, danh mục, khối lượng gram lớn hơn 0 và chọn ảnh JPG, PNG hoặc WEBP tối đa 5 MB."); return;
    }
    setBusy(true); setError("");
    try {
      const response = created || resumableId ? { id: created?.productId ?? resumableId! } : unwrap(await api.post<ApiResponse<{ id: string }> | { id: string }>("/api/v1/products/auction", { categoryId, name: name.trim(), brand: brand.trim() || null, description: description.trim() || null, skuCode: skuCode.trim() || null, specifications: [], weightGrams: weight }));
      const productId = response.id;
      if (!productId) throw new Error("Catalog chưa trả mã sản phẩm.");
      if (!savedDraftId) window.history.replaceState(null, "", `${window.location.pathname}?draftId=${encodeURIComponent(productId)}`);
      const detail = unwrap(await api.get<ApiResponse<AuctionProduct> | AuctionProduct>(`/api/v1/products/auctions/${encodeURIComponent(productId)}`));
      setCreated(detail);
      if (!imageUploaded && !detail.images?.length) { if (!image) throw new Error("Chọn ảnh để tiếp tục gửi duyệt bản nháp."); await sellerCatalogService.uploadImage(productId, image, name.trim() || detail.skuCode); setImageUploaded(true); }
      await sellerCatalogService.changeStatus(productId, "PENDING_APPROVAL");
      setSubmitted(true);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo sản phẩm đấu giá."); }
    finally { setBusy(false); }
  }

  return <><PageHeading title="Tạo sản phẩm đấu giá" description="Tạo SKU không cần giá bán. Staff cần duyệt sản phẩm trước khi bạn tạo phiên." />
    <Card className="card-pad"><form className="auth-fields" noValidate onSubmit={(event) => void submit(event)}>
      <label className="field-wrap">Tên sản phẩm<input className="field" required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <div className="form-grid"><label className="field-wrap">Danh mục<select className="select-field" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Chọn danh mục</option>{leafCategoryOptions(categories.data ?? []).map((category) => <option key={category.categoryId} value={category.categoryId}>{category.label}</option>)}</select></label>
        <label className="field-wrap">Khối lượng vận chuyển (gram)<input className="field" type="number" min="1" step="1" required value={weightGrams} onChange={(event) => setWeightGrams(event.target.value)} /></label>
        <label className="field-wrap">Thương hiệu<input className="field" value={brand} onChange={(event) => setBrand(event.target.value)} /></label>
        <label className="field-wrap">Mã SKU (có thể để trống)<input className="field" value={skuCode} onChange={(event) => setSkuCode(event.target.value)} /></label></div>
      <label className="field-wrap">Mô tả<textarea className="textarea-field" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <div className="field-wrap"><span>Ảnh sản phẩm</span><FileDropZone accept="image/jpeg,image/png,image/webp" required hint="JPG, PNG hoặc WEBP · tối đa 10 MB" onFilesChange={(files) => setImage(files[0] ?? null)} /></div>
      {categories.error && <p className="notice" role="alert">{categories.error.message}</p>}{error && <p className="notice" role="alert">{error}</p>}
      {created && <p className="form-success" role="status">Đã tạo SKU {created.skuCode}. Nếu bước tải ảnh hoặc gửi duyệt lỗi, sản phẩm vẫn tồn tại với mã {created.productId}.</p>}
      <div className="action-row"><button className="button button-primary" type="submit" disabled={busy || submitted}>{busy ? "Đang xử lý…" : submitted ? "Đã gửi duyệt" : created ? "Tiếp tục gửi duyệt" : "Tạo và gửi duyệt"}</button><Link className="button button-secondary" href={ROUTES.seller.auctions}>Về danh sách phiên</Link></div>
    </form></Card>
  </>;
}
