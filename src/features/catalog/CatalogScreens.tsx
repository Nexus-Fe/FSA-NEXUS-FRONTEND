"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ROUTES } from "@/constants/routes";
import { Icon } from "@/components/ui/Icon";
import { ErrorState } from "@/components/ui/States";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCards } from "@/components/ui/Skeletons";
import { describeError } from "@/lib/errors/error-messages";
import { AdminPagination, ButtonLink, Card, PageHeading, SectionHeading } from "@/components/ui/Primitives";
import { BackendImage } from "@/components/ui/BackendImage";
import { SwipeCarousel } from "@/components/ui/SwipeCarousel";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { SelectBox } from "@/components/ui/SelectBox";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney, resolveImageUrl } from "@/lib/presentation";
import { AuctionTile, auctionService } from "@/features/auction";
import { CatalogPromoBanner } from "./CatalogPromoBanner";
import { categoryGroups, loadCategories, type Category } from "./categories";
import { catalogService, toShopSearchPath, type PublicSellerSummary } from "./services/catalog.service";

type Product = { id: string; productId?: string; name: string; description?: string; price: number; minPrice?: number | null; maxPrice?: number | null; primaryImageUrl?: string | null; imageUrl?: string; brand?: string; status?: string; categoryId?: string; categoryName?: string; variantCount?: number; variants?: Array<{ id: string; skuId?: string; name?: string; sku?: string; price?: number | null; status?: string; stock?: number }> };
type ProductPage = { items: Product[]; pagination: { pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean } };
const problem = (error: Error | null) => (error ? describeError(error, { operation: "read" }).message : "");
const pageSizes = [10, 30, 50] as const;

type CatalogFilterValues = { keyword: string; categoryId: string; sortBy: string; minPrice: string; maxPrice: string; brand: string; minRating: string };
const emptyCatalogFilters: CatalogFilterValues = { keyword: "", categoryId: "", sortBy: "", minPrice: "", maxPrice: "", brand: "", minRating: "" };

function catalogHref(filters: CatalogFilterValues, page: number, pageSize: number, basePath: string = ROUTES.catalog.index): string {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.minRating) params.set("minRating", filters.minRating);
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 10) params.set("pageSize", String(pageSize));
  return `${basePath}${params.size ? `?${params}` : ""}`;
}

/** The catalog serves the status as the English word the back end uses; the card shows it in Vietnamese. */
function productStatusLabel(status?: string | null): string {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE": return "Đang bán";
    case "OUTOFSTOCK": case "OUT_OF_STOCK": return "Hết hàng";
    case "": return "";
    default: return status ?? "";
  }
}

function ProductCard({ product }: { product: Product }) {
  const hasPriceRange = typeof product.maxPrice === "number" && product.maxPrice > product.price;
  return <article className="product-card"><Link href={ROUTES.catalog.product(product.id)} className="product-media"><BackendImage src={resolveImageUrl(product.imageUrl ?? null)} alt={product.name} compact /></Link><div className="product-body"><p className="product-category">{product.brand ?? product.categoryName ?? ""}</p><h3><Link href={ROUTES.catalog.product(product.id)}>{product.name}</Link></h3><p className="product-seller">{productStatusLabel(product.status)}</p><div className="product-bottom"><div className="product-card-price"><span>{hasPriceRange ? "Giá từ" : "Giá bán"}</span><strong>{formatMoney(product.price)}</strong></div><Link aria-label={`Xem ${product.name}`} href={ROUTES.catalog.product(product.id)} className="round-link"><Icon name="arrow" size={18} /></Link></div></div></article>;
}

function HomeProductBanner({ products }: { products: Product[] }) {
  const [slides, setSlides] = useState<Product[]>([]);
  useEffect(() => {
    let current = true;
    const candidates = products.filter((product) => product.id && product.imageUrl).slice(0, 20);
    Promise.all(candidates.map((product) => new Promise<Product | null>((resolve) => {
      const url = resolveImageUrl(product.imageUrl ?? null);
      if (!url) { resolve(null); return; }
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth > 0 ? product : null);
      image.onerror = () => resolve(null);
      image.src = url;
    }))).then((verified) => { if (current) setSlides(verified.filter((product): product is Product => product !== null).slice(0, 5)); });
    return () => { current = false; };
  }, [products]);
  if (!slides.length) return null;
  return <section className="home-product-banner" aria-label="Sản phẩm nổi bật">
    <SwipeCarousel slides={slides} className="hero-banner" trackClassName="hero-banner-track" ariaLabel="Vuốt ngang để xem sản phẩm nổi bật" renderSlide={(product, index, isClone) =>
      <Link key={`${product.id}-${index}`} className="hero-banner-link" href={ROUTES.catalog.product(product.id)} aria-label={`Xem sản phẩm ${product.name}`} aria-hidden={isClone || undefined} tabIndex={isClone ? -1 : undefined} draggable={false}>
        <div className="hero-banner-image"><div className="hero-banner-backdrop" aria-hidden="true"><BackendImage src={resolveImageUrl(product.imageUrl ?? null)} alt="" compact /></div><BackendImage src={resolveImageUrl(product.imageUrl ?? null)} alt={product.name} compact /></div>
      </Link>
    } />
  </section>;
}

function useProducts(filters: CatalogFilterValues = emptyCatalogFilters, page = 1, pageSize = 10, sellerId = "") {
  const path = filters.keyword || filters.categoryId || filters.sortBy || filters.minPrice || filters.maxPrice || filters.brand || filters.minRating || sellerId
    ? "/api/v1/products/search" : "/api/v1/products";
  const key = `${path}?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), saleType: "REGULAR", status: "ACTIVE", ...(filters.keyword ? { keyword: filters.keyword } : {}), ...(filters.categoryId ? { categoryId: filters.categoryId } : {}), ...(filters.sortBy ? { sortBy: filters.sortBy } : {}), ...(filters.minPrice ? { minPrice: filters.minPrice } : {}), ...(filters.maxPrice ? { maxPrice: filters.maxPrice } : {}), ...(filters.brand ? { brand: filters.brand } : {}), ...(filters.minRating ? { minRating: filters.minRating } : {}), ...(sellerId ? { sellerId } : {}) })}`;
  return useApiResource(key, async (signal) => {
    const result = unwrap(await api.get<ApiResponse<ProductPage> | ProductPage>(key, { signal }));
    return {
      ...result,
      items: result.items.filter((product) => !product.status || product.status.toUpperCase() === "ACTIVE").map((product) => ({
        ...product,
        id: product.id ?? product.productId ?? "",
        price: product.minPrice ?? product.price ?? Number.NaN,
        imageUrl: product.primaryImageUrl ?? product.imageUrl,
      })),
    };
  });
}

function useMatchingShops(keyword: string, enabled: boolean) {
  const trimmed = keyword.trim();
  const key = enabled && trimmed ? toShopSearchPath({ search: trimmed, page: 1, pageSize: 4 }) : null;
  return useApiResource(key, async (signal) => catalogService.searchShops({ search: trimmed, page: 1, pageSize: 4 }, signal));
}

function useShopPreviewProducts(sellerId: string | null) {
  const key = sellerId
    ? `/api/v1/products/search?${new URLSearchParams({ page: "1", pageSize: "4", saleType: "REGULAR", status: "ACTIVE", sellerId })}`
    : null;
  return useApiResource(key, async (signal) => {
    if (!key) return [];
    const result = unwrap(await api.get<ApiResponse<ProductPage> | ProductPage>(key, { signal }));
    return result.items
      .filter((product) => !product.status || product.status.toUpperCase() === "ACTIVE")
      .slice(0, 4)
      .map((product) => ({
        ...product,
        id: product.id ?? product.productId ?? "",
        price: product.minPrice ?? product.price ?? Number.NaN,
        imageUrl: product.primaryImageUrl ?? product.imageUrl,
      }));
  });
}

function MatchingShopCard({ shop }: { shop: PublicSellerSummary }) {
  const shopName = shop.shopName?.trim() || "Gian hàng";
  return (
    <article className="matching-shop-card">
      <Link href={ROUTES.catalog.shop(shop.sellerId)} className="matching-shop-logo" aria-hidden="true" tabIndex={-1}>
        {shop.logoUrl
          ? <BackendImage src={resolveImageUrl(shop.logoUrl)} alt="" compact />
          : <span>{shopName.charAt(0).toLocaleUpperCase("vi-VN")}</span>}
      </Link>
      <div className="matching-shop-info">
        <span className="matching-shop-badge">Gian hàng trên Nexus</span>
        <h3>
          <Link href={ROUTES.catalog.shop(shop.sellerId)}>{shopName}</Link>
        </h3>
        <div className="matching-shop-meta">
          {typeof shop.ratingAvg === "number" && shop.ratingAvg > 0 && (
            <span className="matching-shop-rating">★ {shop.ratingAvg.toFixed(1)}/5</span>
          )}
          {shop.hotline && <span>Hotline: {shop.hotline}</span>}
        </div>
      </div>
      <Link href={ROUTES.catalog.shop(shop.sellerId)} className="button button-primary button-small matching-shop-cta">
        Vào gian hàng <Icon name="arrow" size={15} />
      </Link>
    </article>
  );
}

export function HomeScreen() {
  const products = useProducts();
  const auctions = useApiResource("/api/v1/auctions?page=1&pageSize=3", async (signal) => (await auctionService.list(1, 3, undefined, signal)).data.items);
  const categories = useApiResource("/api/v1/categories", loadCategories);
  return <div className="buyer-home-glass">
    <div className="hero">
      <div className="hero-copy">
        <p className="overline">Nexus Marketplace</p>
        <h1>Khám phá món đồ bạn muốn sở hữu.</h1>
        <p>Tìm kiếm sản phẩm và theo dõi các phiên đấu giá trong một không gian rõ ràng, dễ sử dụng.</p>
        <div className="action-row"><ButtonLink href={ROUTES.catalog.index}>Khám phá sản phẩm <Icon name="arrow" /></ButtonLink><ButtonLink href="#home-auctions" variant="secondary">Xem phiên đấu giá</ButtonLink></div>
      </div>
      <div className="hero-visual" aria-hidden="true"><span className="hero-orbit hero-orbit-one"/><span className="hero-orbit hero-orbit-two"/><span className="hero-icon"><Icon name="gavel" size={58} /></span></div>
    </div>

    <HomeProductBanner products={products.data?.items ?? []} />

    <section id="home-auctions" className="home-section" aria-label="Phiên đấu giá">
      <SectionHeading id="home-auctions-title" title="Phiên đấu giá trực tuyến" hint="Theo dõi các phiên đang diễn ra và sắp mở." />
      <div className="auction-list-grid">
        {auctions.data?.length ? auctions.data.map((auction) => <AuctionTile key={auction.auctionId} auction={auction} href={ROUTES.auction.room(auction.auctionId)} />) : auctions.loading ? <SkeletonCards count={3} /> : <div className="empty-grid">{auctions.error ? <ErrorState cause={auctions.error} onRetry={auctions.reload} /> : <EmptyState title="Chưa có phiên đấu giá" description="Các phiên mới sẽ xuất hiện tại đây khi người bán mở đấu giá." />}</div>}
      </div>
    </section>

    <section className="home-section" aria-labelledby="home-products-title">
      <SectionHeading id="home-products-title" title="Sản phẩm niêm yết mua ngay" hint="Xem các sản phẩm đang được đăng bán." action={<Link href={ROUTES.catalog.index}>Tất cả sản phẩm <Icon name="arrow" size={15}/></Link>} />
      <div className="product-grid">{products.data?.items.length ? products.data.items.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />) : products.loading ? <SkeletonCards count={4} /> : <div className="empty-grid">{products.error ? <ErrorState cause={products.error} onRetry={products.reload} /> : <EmptyState title="Chưa có sản phẩm" description="Sản phẩm đang bán sẽ hiển thị tại đây." />}</div>}</div>
    </section>

    <section className="home-section home-categories" aria-labelledby="home-categories-title">
      <SectionHeading id="home-categories-title" title="Danh mục khám phá" hint="Tìm nhanh theo danh mục sản phẩm." action={<Link href={ROUTES.catalog.index}>Mở danh mục <Icon name="arrow" size={15}/></Link>} />
      {categories.error ? <ErrorState cause={categories.error} onRetry={categories.reload} /> : categories.data?.length ? <div className="category-rail">{categoryGroups(categories.data).map(({ parent, children }) => <div className="category-tile" key={parent.id}><span className="category-tile-mark"><Icon name="grid" size={20}/></span>{children.length ? <><strong>{parent.name}</strong><div className="category-tile-children">{children.map((child) => <Link key={child.id} href={`${ROUTES.catalog.index}?categoryId=${encodeURIComponent(child.id)}`}>{child.name}</Link>)}</div></> : <Link href={`${ROUTES.catalog.index}?categoryId=${encodeURIComponent(parent.id)}`}><strong>{parent.name}</strong></Link>}</div>)}</div> : categories.loading ? <SkeletonCards count={4} /> : <EmptyState className="empty-grid" title="Chưa có danh mục" />}
    </section>
  </div>;
}

function CatalogFilters({ initialFilters, pageSize, categories, categoriesError, basePath }: {
  initialFilters: CatalogFilterValues;
  pageSize: number;
  categories: Category[];
  categoriesError: Error | null;
  basePath: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialFilters.keyword);
  const [categoryId, setCategoryId] = useState(initialFilters.categoryId);
  const [sortBy, setSortBy] = useState(initialFilters.sortBy);
  const [minPrice, setMinPrice] = useState(initialFilters.minPrice);
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice);
  const [brand, setBrand] = useState(initialFilters.brand);
  const [minRating, setMinRating] = useState(initialFilters.minRating);
  const [filterError, setFilterError] = useState("");
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const activeFilterCount = [
    initialFilters.keyword,
    initialFilters.categoryId,
    initialFilters.sortBy,
    initialFilters.minPrice,
    initialFilters.maxPrice,
    initialFilters.brand,
    initialFilters.minRating,
  ].filter(Boolean).length;

  const applyFilters = () => {
    if ((minPrice && !Number.isSafeInteger(Number(minPrice))) || (maxPrice && !Number.isSafeInteger(Number(maxPrice))) ||
      (minPrice && Number(minPrice) < 0) || (maxPrice && Number(maxPrice) < 0) ||
      (minPrice && maxPrice && Number(minPrice) > Number(maxPrice))) {
      setFilterError("Khoảng giá phải là số nguyên không âm và giá thấp nhất không vượt giá cao nhất.");
      return;
    }
    setFilterError("");
    router.push(catalogHref({ keyword: search.trim(), categoryId, sortBy, minPrice, maxPrice, brand: brand.trim(), minRating }, 1, pageSize, basePath), { scroll: false });
  };

  const clearFilters = () => {
    setSearch(""); setCategoryId(""); setSortBy(""); setMinPrice(""); setMaxPrice(""); setBrand(""); setMinRating(""); setFilterError("");
    router.push(catalogHref(emptyCatalogFilters, 1, pageSize, basePath), { scroll: false });
  };

  const categoryOptions = [
    { value: "", label: "Tất cả danh mục" },
    ...categoryGroups(categories).flatMap(({ parent, children }) =>
      children.length
        ? children.map((child) => ({ value: child.id, label: child.name, group: parent.name }))
        : [{ value: parent.id, label: parent.name }],
    ),
  ];

  return <Card className="card-pad catalog-filters"><h2 className="catalog-filters-heading" style={{fontSize:16}}>Bộ lọc tìm kiếm</h2><button type="button" className="catalog-filters-toggle" aria-expanded={mobileExpanded} aria-controls="catalog-filters-form" onClick={() => setMobileExpanded((prev) => !prev)}><span className="catalog-filters-toggle-label"><span>Bộ lọc tìm kiếm</span>{activeFilterCount > 0 && <span className="catalog-filters-badge">{activeFilterCount}</span>}</span><span className={`catalog-filters-chevron${mobileExpanded ? " is-open" : ""}`} aria-hidden="true"><Icon name="chevronDown" size={16} /></span></button><form id="catalog-filters-form" className={`catalog-filters-form${mobileExpanded ? " is-open" : ""}`} onSubmit={(e) => { e.preventDefault(); applyFilters(); }}><div className="field-wrap"><label htmlFor="catalog-search">Tìm kiếm</label><input id="catalog-search" value={search} onChange={(e) => setSearch(e.target.value)} type="search" className="field" placeholder={basePath === ROUTES.catalog.index ? "Tên sản phẩm hoặc gian hàng" : "Tên sản phẩm trong gian hàng"} maxLength={100} /></div><div className="field-wrap" style={{marginTop:18}}><label htmlFor="catalog-category">Danh mục sản phẩm</label><SelectBox id="catalog-category" ariaLabel="Danh mục sản phẩm" value={categoryId} options={categoryOptions} onChange={setCategoryId} placeholder="Tất cả danh mục" />{categoriesError && <small role="alert">{problem(categoriesError)}</small>}</div><div className="field-wrap" style={{marginTop:18}}><label htmlFor="catalog-sort">Sắp xếp giá</label><SelectBox id="catalog-sort" ariaLabel="Sắp xếp giá" value={sortBy} options={[{ value: "", label: "Mặc định" }, { value: "price_asc", label: "Giá thấp đến cao" }, { value: "price_desc", label: "Giá cao đến thấp" }]} onChange={setSortBy} /></div><div className="catalog-price-fields"><label className="field-wrap" htmlFor="catalog-min-price">Giá từ<input id="catalog-min-price" className="field" type="number" min="0" step="1" inputMode="numeric" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="₫" /></label><label className="field-wrap" htmlFor="catalog-max-price">Giá đến<input id="catalog-max-price" className="field" type="number" min="0" step="1" inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="₫" /></label></div><div className="field-wrap" style={{marginTop:18}}><label htmlFor="catalog-brand">Thương hiệu</label><input id="catalog-brand" className="field" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} placeholder="Tên thương hiệu" /></div><div className="field-wrap" style={{marginTop:18, marginBottom:18}}><label htmlFor="catalog-rating">Đánh giá tối thiểu</label><SelectBox id="catalog-rating" ariaLabel="Đánh giá tối thiểu" value={minRating} options={[{ value: "", label: "Tất cả đánh giá" }, { value: "3", label: "Từ 3 sao" }, { value: "4", label: "Từ 4 sao" }, { value: "5", label: "5 sao" }]} onChange={setMinRating} /></div>{filterError && <p className="notice" role="alert">{filterError}</p>}<div className="action-row"><button className="button button-primary" type="submit">Tìm kiếm</button><button className="button button-secondary" type="button" onClick={clearFilters}>Xóa lọc</button></div></form></Card>;
}

export function CatalogScreen({ sellerId = "", title = "Danh sách sản phẩm", description = "Khám phá các sản phẩm đang được bán trên sàn.", showHeading = true }: { sellerId?: string; title?: string; description?: string; showHeading?: boolean } = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filters: CatalogFilterValues = {
    keyword: searchParams.get("keyword") ?? "",
    categoryId: searchParams.get("categoryId") ?? "",
    sortBy: ["price_asc", "price_desc"].includes(searchParams.get("sortBy") ?? "") ? searchParams.get("sortBy")! : "",
    minPrice: searchParams.get("minPrice") ?? "",
    maxPrice: searchParams.get("maxPrice") ?? "",
    brand: searchParams.get("brand") ?? "",
    minRating: searchParams.get("minRating") ?? "",
  };
  const requestedPage = Number(searchParams.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedPageSize = Number(searchParams.get("pageSize"));
  const pageSize = pageSizes.find((size) => size === requestedPageSize) ?? 10;
  const categories = useApiResource("/api/v1/categories", loadCategories);
  const products = useProducts(filters, page, pageSize, sellerId);
  const matchingShops = useMatchingShops(filters.keyword, !sellerId);
  const shopRows = matchingShops.data?.items ?? [];
  const featuredShop = !sellerId && filters.keyword.trim() && shopRows.length > 0 ? shopRows[0] : null;
  const categoryRows = categories.data ?? []; const productRows = products.data?.items ?? [];
  const shouldShowShopPreview = Boolean(featuredShop && !products.loading && productRows.length === 0);
  const shopPreview = useShopPreviewProducts(shouldShowShopPreview ? featuredShop?.sellerId ?? null : null);
  const shopPreviewRows = shopPreview.data ?? [];
  const selectedCategory = categoryRows.find((item) => item.id === filters.categoryId);
  const parentName = categoryRows.find((item) => item.id === selectedCategory?.parentId)?.name;
  const categoryName = selectedCategory ? [parentName, selectedCategory.name].filter(Boolean).join(" / ") : "";
  const pagination = products.data?.pagination;
  const totalPages = pagination?.totalPages ?? 0;
  const pageIndex = pagination?.pageIndex ?? page;
  const firstItem = productRows.length ? (pageIndex - 1) * pageSize + 1 : 0;
  const lastItem = productRows.length ? firstItem + productRows.length - 1 : 0;
  const basePath = sellerId ? ROUTES.catalog.shop(sellerId) : ROUTES.catalog.index;
  const goToPage = (target: number) => router.push(`${catalogHref(filters, target, pageSize, basePath)}#catalog-results`);
  const heading = <PageHeading title={title} description={description} />;

  return <>
    {sellerId ? showHeading && heading : <div className="catalog-intro">{heading}<CatalogPromoBanner /></div>}
    <div className="split catalog-layout">
      <CatalogFilters key={JSON.stringify(filters)} initialFilters={filters} pageSize={pageSize} categories={categoryRows} categoriesError={categories.error} basePath={basePath} />
      <div id="catalog-results" className="catalog-results">
        {!sellerId && filters.keyword.trim() && shopRows.length > 0 && (
          <section className="matching-shops-section" aria-label="Gian hàng phù hợp">
            <div className="section-heading matching-shops-heading">
              <div>
                <h2>Gian hàng phù hợp</h2>
                <p>{`Tìm thấy ${matchingShops.data?.pagination.totalCount ?? shopRows.length} gian hàng khớp "${filters.keyword.trim()}".`}</p>
              </div>
              <Link href={`${ROUTES.catalog.shops}?search=${encodeURIComponent(filters.keyword.trim())}`}>
                Xem tất cả gian hàng <Icon name="arrow" size={15} />
              </Link>
            </div>
            <div className="matching-shops-grid">
              {shopRows.map((shop) => <MatchingShopCard key={shop.sellerId} shop={shop} />)}
            </div>
          </section>
        )}
        {shouldShowShopPreview && featuredShop ? (
          <section className="shop-preview-products" aria-label={`Sản phẩm của ${featuredShop.shopName}`}>
            <div className="section-heading catalog-results-heading">
              <div>
                <h2>Sản phẩm từ {featuredShop.shopName}</h2>
                <p>Gợi ý các sản phẩm đang được bán tại gian hàng này.</p>
              </div>
              <Link href={ROUTES.catalog.shop(featuredShop.sellerId)}>
                Xem tất cả sản phẩm <Icon name="arrow" size={15} />
              </Link>
            </div>
            {shopPreview.loading && !shopPreviewRows.length ? (
              <CardGridSkeleton count={4} label="Đang tải sản phẩm của gian hàng…" />
            ) : shopPreviewRows.length > 0 ? (
              <div className="product-grid catalog-products">
                {shopPreviewRows.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            ) : (
              <EmptyState
                className="empty-grid"
                title="Gian hàng chưa có sản phẩm đang bán"
                description={`Bạn có thể ghé trang gian hàng ${featuredShop.shopName} hoặc xóa bộ lọc để xem sản phẩm khác.`}
                actionLabel="Vào gian hàng"
                actionHref={ROUTES.catalog.shop(featuredShop.sellerId)}
              />
            )}
          </section>
        ) : (
          <>
            <div className="section-heading catalog-results-heading">
              <div><h2>{sellerId && !showHeading ? "Sản phẩm của gian hàng" : "Sản phẩm đang bán"}</h2><p aria-live="polite">{products.loading ? "Đang tải…" : `Hiển thị ${firstItem}–${lastItem} / ${pagination?.totalCount ?? 0} sản phẩm${categoryName ? ` · ${categoryName}` : ""}`}</p></div>
              <label className="catalog-page-size" htmlFor="catalog-page-size">Sản phẩm / trang
                <select id="catalog-page-size" className="select-field" value={pageSize} onChange={(event) => router.push(catalogHref(filters, 1, Number(event.target.value), basePath), { scroll: false })}>
                  {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>
            {products.error && <ErrorState cause={products.error} onRetry={products.reload} />}
            {products.loading && !productRows.length ? <CardGridSkeleton count={8} label="Đang tải sản phẩm…" /> : <div className="product-grid catalog-products">{productRows.length ? productRows.map((product) => <ProductCard key={product.id} product={product} />) : products.error ? null : <EmptyState className="empty-grid" title="Không tìm thấy sản phẩm" description="Thử bỏ bớt bộ lọc hoặc dùng từ khoá khác." actionLabel="Xoá bộ lọc" actionHref={basePath} />}</div>}
            {totalPages > 1 && (
              <AdminPagination
                page={pageIndex}
                pageSize={pageSize}
                totalItems={pagination?.totalCount}
                totalPages={totalPages}
                loading={products.loading}
                onPageChange={goToPage}
                itemLabel="sản phẩm"
              />
            )}
          </>
        )}
      </div>
    </div>
  </>;
}

export { ProductDetailScreen } from './ProductDetailScreen';
