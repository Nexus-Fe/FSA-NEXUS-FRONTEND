import Link from "next/link";
import { ROUTES } from "@/constants/routes";

export default function RootNotFound() {
  return (
    <main className="page-container" style={{ paddingBlock: 56 }}>
      <div className="card card-pad" style={{ maxWidth: 560, marginInline: "auto", textAlign: "center" }}>
        <h1 style={{ marginTop: 0 }}>Không tìm thấy trang</h1>
        <p style={{ color: "var(--muted)" }}>
          Đường dẫn bạn truy cập không tồn tại hoặc nội dung đã được chuyển đi.
        </p>
        <div className="action-row" style={{ justifyContent: "center" }}>
          <Link className="button button-primary" href={ROUTES.catalog.index}>
            Xem sản phẩm
          </Link>
          <Link className="button button-secondary" href={ROUTES.home}>
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
