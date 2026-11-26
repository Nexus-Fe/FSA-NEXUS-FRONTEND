"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BackendImage } from "@/components/ui/BackendImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { AdminPagination, Card, PageHeading } from "@/components/ui/Primitives";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { resolveImageUrl } from "@/lib/presentation";
import { catalogService, toShopSearchPath, type PublicSellerSummary } from "./services/catalog.service";

const pageSize = 12;

function shopsHref(search: string, page: number): string {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (page > 1) params.set("page", String(page));
  return `${ROUTES.catalog.shops}${params.size ? `?${params}` : ""}`;
}

function ShopDirectoryCard({ shop }: { shop: PublicSellerSummary }) {
  const shopName = shop.shopName?.trim() || "Gian hàng";
  return (
    <Card className="card-pad shop-directory-card">
      <div className="shop-directory-card-head">
        <div className="shop-directory-logo" aria-hidden="true">
          {shop.logoUrl
            ? <BackendImage src={resolveImageUrl(shop.logoUrl)} alt="" compact />
            : <span>{shopName.charAt(0).toLocaleUpperCase("vi-VN")}</span>}
        </div>
        <div className="shop-directory-identity">
          <h2>
            <Link href={ROUTES.catalog.shop(shop.sellerId)}>{shopName}</Link>
          </h2>
          <div className="product-detail-seller-facts">
            {typeof shop.ratingAvg === "number" && shop.ratingAvg > 0 && (
              <span>★ {shop.ratingAvg.toFixed(1)}/5</span>
            )}
            {shop.hotline && <span>Hotline: {shop.hotline}</span>}
          </div>
        </div>
      </div>
      <Link className="button button-secondary button-small shop-directory-link" href={ROUTES.catalog.shop(shop.sellerId)}>
        Xem gian hàng <Icon name="arrow" size={15} />
      </Link>
    </Card>
  );
}

function ShopSearchForm({ initialSearch, onSearch, onClear }: {
  initialSearch: string;
  onSearch: (keyword: string) => void;
  onClear: () => void;
}) {
  const [input, setInput] = useState(initialSearch);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(input.trim());
  }

  return (
    <form className="shop-directory-search" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="shop-directory-search-input">Tìm tên gian hàng</label>
      <input
        id="shop-directory-search-input"
        type="search"
        className="field"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Nhập tên gian hàng cần tìm…"
        maxLength={100}
      />
      <button type="submit" className="button button-primary">Tìm gian hàng</button>
      {initialSearch && (
        <button type="button" className="button button-secondary" onClick={onClear}>Xóa lọc</button>
      )}
    </form>
  );
}

export function ShopsDirectoryScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = (searchParams.get("search") ?? "").trim();
  const requestedPage = Number(searchParams.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const key = toShopSearchPath({ search, page, pageSize });
  const shops = useApiResource(key, async (signal) =>
    catalogService.searchShops({ search, page, pageSize }, signal),
  );

  const items = shops.data?.items ?? [];
  const pagination = shops.data?.pagination;
  const totalPages = pagination?.totalPages ?? 0;
  const pageIndex = pagination?.pageIndex ?? page;

  return (
    <div className="shop-directory-page">
      <nav className="public-shop-breadcrumb" aria-label="Đường dẫn">
        <Link href={ROUTES.home}>Trang chủ</Link><span aria-hidden="true">/</span>
        <Link href={ROUTES.catalog.index}>Sản phẩm</Link><span aria-hidden="true">/</span>
        <span aria-current="page">Gian hàng</span>
      </nav>

      <PageHeading
        title="Gian hàng trên Nexus"
        description="Tìm kiếm và khám phá các gian hàng đang hoạt động trên sàn."
      />

      <Card className="card-pad shop-directory-toolbar">
        <ShopSearchForm
          key={search}
          initialSearch={search}
          onSearch={(keyword) => router.push(shopsHref(keyword, 1), { scroll: false })}
          onClear={() => router.push(ROUTES.catalog.shops, { scroll: false })}
        />
        <p className="shop-directory-count" aria-live="polite">
          {shops.loading
            ? "Đang tải danh sách gian hàng…"
            : `Tìm thấy ${pagination?.totalCount ?? items.length} gian hàng${search ? ` cho "${search}"` : ""}.`}
        </p>
      </Card>

      {shops.error && <ErrorState cause={shops.error} onRetry={shops.reload} />}

      {shops.loading && !items.length ? (
        <CardGridSkeleton count={6} label="Đang tải gian hàng…" />
      ) : items.length > 0 ? (
        <div className="shop-directory-grid">
          {items.map((shop) => <ShopDirectoryCard key={shop.sellerId} shop={shop} />)}
        </div>
      ) : shops.error ? null : (
        <EmptyState
          className="empty-grid"
          title="Không tìm thấy gian hàng"
          description={search ? `Không có gian hàng nào khớp với "${search}".` : "Hiện chưa có gian hàng nào đang hoạt động."}
          actionLabel={search ? "Xem tất cả gian hàng" : "Về danh sách sản phẩm"}
          actionHref={search ? ROUTES.catalog.shops : ROUTES.catalog.index}
        />
      )}

      {totalPages > 1 && (
        <AdminPagination
          page={pageIndex}
          pageSize={pageSize}
          totalItems={pagination?.totalCount}
          totalPages={totalPages}
          loading={shops.loading}
          onPageChange={(target) => router.push(shopsHref(search, target))}
          itemLabel="gian hàng"
        />
      )}
    </div>
  );
}
