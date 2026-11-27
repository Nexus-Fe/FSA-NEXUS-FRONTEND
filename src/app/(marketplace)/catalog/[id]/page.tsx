import type { Metadata } from "next";
import { ProductDetailScreenClient } from "@/components/client/ClientScreens";

type PublicProductMeta = {
  name?: string;
  brand?: string | null;
  description?: string | null;
  variants?: Array<{ skuCode?: string; isActive?: boolean; status?: string; price?: number | null; currency?: string }>;
};

async function fetchPublicProductMeta(id: string): Promise<PublicProductMeta | null> {
  const gatewayUrl = process.env.API_GATEWAY_URL?.trim();
  if (!gatewayUrl) return null;
  try {
    const base = gatewayUrl.endsWith("/") ? gatewayUrl.slice(0, -1) : gatewayUrl;
    const response = await fetch(`${base}/api/v1/products/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: PublicProductMeta } | PublicProductMeta;
    const product = "data" in payload && payload.data ? payload.data : (payload as PublicProductMeta);
    return product?.name ? product : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchPublicProductMeta(id);
  if (!product?.name) return {};

  const activeSkus = (product.variants ?? [])
    .filter((variant) => variant.skuCode && variant.status?.toUpperCase() !== "INACTIVE")
    .map((variant) => variant.skuCode!.trim());
  const primarySku = activeSkus[0];
  const title = primarySku ? `${product.name} (${primarySku}) | Nexus` : `${product.name} | Nexus`;
  const description = [
    product.brand ? `Thương hiệu: ${product.brand}.` : "",
    activeSkus.length ? `Mã SKU: ${activeSkus.join(", ")}.` : "",
    product.description ? product.description.slice(0, 140) : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title,
    description: description || undefined,
    keywords: activeSkus.length ? [product.name, product.brand ?? "", ...activeSkus].filter(Boolean) : undefined,
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await fetchPublicProductMeta(id);
  const activeVariants = (product?.variants ?? []).filter((v) => v.skuCode && v.status?.toUpperCase() !== "INACTIVE");
  const primaryVariant = activeVariants.find((v) => v.isActive) ?? activeVariants[0];
  const jsonLd = product?.name
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        ...(product.description ? { description: product.description } : {}),
        ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
        ...(primaryVariant?.skuCode ? { sku: primaryVariant.skuCode.trim() } : {}),
        ...(primaryVariant?.price != null
          ? {
              offers: {
                "@type": "Offer",
                price: primaryVariant.price,
                priceCurrency: primaryVariant.currency || "VND",
              },
            }
          : {}),
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductDetailScreenClient />
    </>
  );
}
