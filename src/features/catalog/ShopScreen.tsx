"use client";

import Link from "next/link";
import { SellerAuctionStats } from "@/features/auction/SellerAuctionStats";
import { useParams } from "next/navigation";
import { BackendImage } from "@/components/ui/BackendImage";
import { Card } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { resolveImageUrl } from "@/lib/presentation";
import { CatalogScreen } from "./CatalogScreens";

type PublicSellerProfile = {
  shopName: string;
  logoUrl?: string | null;
  description?: string | null;
  hotline?: string | null;
  ratingAvg?: number | null;
  totalProducts?: number | null;
};

export function ShopScreen() {
  const { id } = useParams<{ id: string }>();
  const sellerId = String(id ?? "");
  const key = sellerId ? `/api/v1/sellers/${encodeURIComponent(sellerId)}` : null;
  const profile = useApiResource(key, async (signal) => {
    if (!key) throw new Error("Thiếu thông tin gian hàng.");
    return unwrap(await api.get<ApiResponse<PublicSellerProfile> | PublicSellerProfile>(key, { signal }));
  });
  const shopName = profile.data?.shopName?.trim();

  return <div className="public-shop-page">
    <nav className="public-shop-breadcrumb" aria-label="Đường dẫn">
      <Link href={ROUTES.home}>Trang chủ</Link><span aria-hidden="true">/</span>
      <Link href={ROUTES.catalog.index}>Sản phẩm</Link><span aria-hidden="true">/</span>
      <span aria-current="page">{shopName || "Gian hàng"}</span>
    </nav>

    <Card className="card-pad public-shop-profile">
      {shopName ? <>
        <div className="public-shop-logo" aria-hidden="true">
          {profile.data?.logoUrl
            ? <BackendImage src={resolveImageUrl(profile.data.logoUrl)} alt="" compact />
            : <span>{shopName.charAt(0).toLocaleUpperCase("vi-VN")}</span>}
        </div>
        <div className="public-shop-identity">
          <p className="overline">Gian hàng trên Nexus</p>
          <h1>{shopName}</h1>
          <p>{profile.data?.description || "Khám phá các sản phẩm đang được bán tại gian hàng này."}</p>
          <div className="product-detail-seller-facts">
            {typeof profile.data?.ratingAvg === "number" && profile.data.ratingAvg > 0 && <span>★ {profile.data.ratingAvg.toFixed(1)}/5</span>}
            {typeof profile.data?.totalProducts === "number" && <span>{profile.data.totalProducts} sản phẩm</span>}
          </div>
          <SellerAuctionStats sellerId={sellerId} />
          {profile.data?.hotline && <p className="public-shop-contact">Liên hệ gian hàng: <strong>{profile.data.hotline}</strong></p>}
        </div>
        <a className="button button-primary public-shop-action" href="#catalog-results">Xem sản phẩm</a>
      </> : <div className="public-shop-unavailable">
        <p className="overline">Gian hàng trên Nexus</p>
        <h1>Thông tin gian hàng</h1>
        <p role={profile.error ? "alert" : "status"}>
          {profile.error
            ? "Chưa tải được tên và thông tin gian hàng. Bạn vẫn có thể xem sản phẩm của gian hàng bên dưới."
            : "Đang tải thông tin gian hàng…"}
        </p>
        {profile.error && <button type="button" className="button button-secondary button-small" onClick={profile.reload}>Tải lại thông tin</button>}
      </div>}
    </Card>

    <CatalogScreen sellerId={sellerId} showHeading={false} />
  </div>;
}
