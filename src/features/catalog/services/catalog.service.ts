import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import type { ProductListQuery, ProductListResponse } from "../types";
import type { ProductSpecification } from "../types/product-specification";

export type AuctionCatalogProduct = { productId: string; name: string; saleType?: string; status: string; skuCode?: string };
export type AuctionCatalogVariant = { variantId: string; skuCode: string; name: string; price: number | null; status: string; isActive: boolean; attributes: Array<{ attrName: string; attrValue: string }>; primaryImageUrl?: string | null };
export type CatalogProductDetail = {
  productId: string;
  sellerId: string;
  name: string;
  description: string | null;
  brand: string | null;
  saleType: string;
  status: string;
  specifications: ProductSpecification[] | null;
  publishedAt: string | null;
  category: { categoryId: string; parentId: string | null; name: string; level: number } | null;
  variants: AuctionCatalogVariant[];
  images: Array<{ imageId: string; url: string; altText: string | null; isActive: boolean; sortOrder: number; variantId: string | null }>;
  rating: { avgRating: number | null; reviewCount: number };
};
export type AuctionCatalogDetail = CatalogProductDetail;
export type AuctionCatalogPage = { items: AuctionCatalogProduct[]; pagination: { pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasNextPage: boolean } };

export type PublicSellerSummary = {
  shopId: string;
  sellerId: string;
  shopName: string;
  logoUrl?: string | null;
  hotline?: string | null;
  ratingAvg?: number | null;
  totalProducts?: number | null;
  createdAt?: string | null;
};

export type PublicSellerPage = {
  items: PublicSellerSummary[];
  pagination: {
    pageIndex: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage?: boolean;
    hasNextPage: boolean;
  };
};

export type PublicSellerSearchQuery = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export function toShopSearchPath(query: PublicSellerSearchQuery = {}): string {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set("search", query.search.trim());
  params.set("page", String(query.page && query.page > 0 ? query.page : 1));
  params.set("pageSize", String(query.pageSize && query.pageSize > 0 ? query.pageSize : 12));
  return `/api/v1/sellers?${params.toString()}`;
}

function toQueryString(query: ProductListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("pageSize", String(query.limit));
  if (query.search) params.set("keyword", query.search);
  if (query.categoryId) params.set("categoryId", query.categoryId);

  const search = params.toString();
  return search ? `?${search}` : "";
}

export const catalogService = {
  getProducts: (query?: ProductListQuery) =>
    api.get<ApiResponse<ProductListResponse>>(
      `/api/v1/products${toQueryString(query)}`,
    ),
  getProductById: (id: string) =>
    api.get<ApiResponse<CatalogProductDetail>>(`/api/v1/products/${encodeURIComponent(id)}`),
  searchAuctionProducts: async (keyword = "", signal?: AbortSignal): Promise<ApiResponse<AuctionCatalogPage>> => ({ success: true, statusCode: 200, data: unwrap(await api.get<ApiResponse<AuctionCatalogPage> | AuctionCatalogPage>(`/api/v1/products/search?page=1&pageSize=100&saleType=Auction&keyword=${encodeURIComponent(keyword)}`, { signal })) }),
  listSellerAuctionProducts: async (keyword = "", signal?: AbortSignal): Promise<ApiResponse<AuctionCatalogPage>> => {
    const query = new URLSearchParams({ page: "1", pageSize: "100", status: "ACTIVE" });
    if (keyword.trim()) query.set("keyword", keyword.trim());
    return {
      success: true,
      statusCode: 200,
      data: unwrap(await api.get<ApiResponse<AuctionCatalogPage> | AuctionCatalogPage>(`/api/v1/seller/products/auctions?${query}`, { signal })),
    };
  },
  getAuctionProduct: async (id: string, signal?: AbortSignal): Promise<ApiResponse<CatalogProductDetail>> => ({ success: true, statusCode: 200, data: unwrap(await api.get<ApiResponse<CatalogProductDetail> | CatalogProductDetail>(`/api/v1/products/${encodeURIComponent(id)}`, { signal })) }),
  searchShops: async (query: PublicSellerSearchQuery = {}, signal?: AbortSignal): Promise<PublicSellerPage> =>
    unwrap(await api.get<ApiResponse<PublicSellerPage> | PublicSellerPage>(toShopSearchPath(query), { signal })),
};
