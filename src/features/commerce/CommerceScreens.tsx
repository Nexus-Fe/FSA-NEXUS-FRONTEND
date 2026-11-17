"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { api, ApiError, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { BuyerReviewForm } from "./BuyerReviewForm";

const unwrap = <T,>(value: ApiResponse<T> | T): T => value && typeof value === "object" && "data" in value ? value.data : value;
const errorText = (error: Error | null) => error?.message ?? "";

type UserReport = { reportId?: string; targetType?: string; targetId?: string; reason?: string; status?: string; adminNote?: string; createdAt?: string };
const reportStatusLabel: Record<string, string> = { PENDING: "Chờ xử lý", UNDER_REVIEW: "Đang xem xét", RESOLVED: "Đã xử lý", REJECTED: "Đã từ chối" };

type ReviewOrderItem = {
  productId?: string;
  orderItemId?: string;
  productName?: string;
  name?: string;
};
type ReviewSubOrder = {
  subOrderId?: string;
  subOrderNo?: string;
  sellerId?: string;
  shopName?: string;
  status?: string;
  items?: ReviewOrderItem[];
};
type ReviewOrder = { subOrders?: ReviewSubOrder[] };

function reviewError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.errorCode === "PURCHASE_NOT_FOUND") return "Không tìm thấy lần mua hàng hoàn tất cho sản phẩm này. Vui lòng liên hệ hỗ trợ.";
    if (cause.errorCode === "REVIEW_WINDOW_EXPIRED") return "Đã hết thời hạn 30 ngày để đánh giá lần mua này.";
    if (cause.status === 409) return "Đánh giá cho đơn này đã tồn tại.";
  }
  return cause instanceof Error ? cause.message : "Không gửi được đánh giá. Vui lòng thử lại.";
}

export function BuyerOrderReviewScreen() {
  const params = useParams<{ id: string }>();
  const orderId = String(params.id ?? "");
  const order = useApiResource(
    orderId ? `buyer-review-order:${orderId}` : null,
    async (signal) => unwrap(await api.get<ApiResponse<ReviewOrder> | ReviewOrder>(`/api/v1/orders/${encodeURIComponent(orderId)}`, { signal })),
  );
  const [activeProductKey, setActiveProductKey] = useState("");
  const [activeSellerId, setActiveSellerId] = useState("");
  const [productRating, setProductRating] = useState(0);
  const [partnerRating, setPartnerRating] = useState(0);
  const [comment, setComment] = useState("");
  const [partnerComment, setPartnerComment] = useState("");
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [reviewedProducts, setReviewedProducts] = useState<string[]>([]);
  const [reviewedPartners, setReviewedPartners] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const subOrders = order.data?.subOrders ?? [];
  const selected = subOrders.flatMap((sub) =>
    (sub.items ?? []).map((item) => ({ sub, item, key: `${sub.subOrderId}:${item.productId}` })),
  ).find(({ key }) => key === activeProductKey);
  const selectedSeller = subOrders.find((sub) => sub.subOrderId === activeSellerId);

  function openProduct(key: string) {
    setActiveProductKey((current) => current === key ? "" : key);
    setActiveSellerId("");
    setProductRating(0);
    setComment("");
    setReviewImages([]);
    setError("");
    setSuccess("");
  }

  function openSeller(id: string) {
    setActiveSellerId((current) => current === id ? "" : id);
    setActiveProductKey("");
    setPartnerRating(0);
    setPartnerComment("");
    setError("");
    setSuccess("");
  }

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selected?.sub.subOrderId || !selected.item.productId || productRating === 0) return;
    if (reviewImages.length > 5 || reviewImages.some((file) =>
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024
    )) {
      setError("Chọn tối đa 5 ảnh JPG, PNG hoặc WEBP, mỗi ảnh tối đa 5 MB.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const form = new FormData();
      form.append("orderId", selected.sub.subOrderId);
      form.append("rating", String(productRating));
      form.append("comment", comment.trim());
      reviewImages.forEach((file) => form.append("reviewImages", file));
      await api.post(`/api/v1/products/${encodeURIComponent(selected.item.productId)}/reviews`, form);
      setReviewedProducts((current) => [...current, selected.key]);
      setSuccess("Đã gửi đánh giá sản phẩm cho đơn này.");
    } catch (cause) {
      setError(reviewError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function submitPartner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selectedSeller?.subOrderId || partnerRating === 0) return;
    if (!selectedSeller.sellerId) {
      setError("Đơn hàng chưa có thông tin người bán để đánh giá.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/api/v1/reviews", {
        revieweeId: selectedSeller.sellerId,
        reviewerRole: "Buyer",
        referenceType: "Order",
        referenceId: selectedSeller.subOrderId,
        rating: partnerRating,
        comment: partnerComment.trim() || null,
        mediaUrls: [],
      });
      setReviewedPartners((current) => [...current, selectedSeller.subOrderId!]);
      setSuccess("Đã gửi đánh giá người bán cho đơn này.");
    } catch (cause) {
      setError(reviewError(cause));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageHeading
      overline="Sau khi nhận hàng"
      title="Đánh giá đơn hàng"
      description="Mỗi gian hàng và sản phẩm trong đơn được đánh giá riêng sau khi xác nhận đã nhận hàng."
      action={<Link className="button button-secondary" href={ROUTES.buyer.order(orderId)}>Về chi tiết đơn</Link>}
    />
    {order.loading && !order.data && <NoData title="Đang tải đơn hàng…" />}
    {order.error && <div className="notice" role="alert">
      <p>Không tải được thông tin đơn hàng để đánh giá. Vui lòng thử lại sau.</p>
      <button className="button button-secondary button-small" type="button" onClick={order.reload}>Thử lại</button>
    </div>}
    {error && <p className="notice" role="alert">{error}</p>}
    {success && <p className="form-success" role="status">{success}</p>}
    {!order.loading && !order.error && subOrders.length === 0 && <NoData title="Đơn hàng chưa có sản phẩm để đánh giá." />}
    <div className="buyer-review-groups">
      {subOrders.map((sub, index) => {
        const subOrderId = sub.subOrderId ?? "";
        const completed = String(sub.status ?? "").replace(/[^a-z]/gi, "").toUpperCase() === "COMPLETED";
        return <Card className="card-pad buyer-review-shop" key={subOrderId || index}>
          <div className="buyer-review-shop-heading">
            <div>
              <h2>{sub.shopName || `Gian hàng ${index + 1}`}</h2>
              {sub.subOrderNo && <p>Đơn bán {sub.subOrderNo}</p>}
            </div>
            <Badge tone={completed ? "green" : "slate"}>{completed ? "Đã hoàn tất" : "Chưa hoàn tất"}</Badge>
          </div>
          {!completed && <p className="notice" role="status">Bạn có thể đánh giá khi đơn bán này đã hoàn tất.</p>}
          <div className="buyer-review-products">
            {(sub.items ?? []).map((item, itemIndex) => {
              const key = `${subOrderId}:${item.productId}`;
              const isActive = activeProductKey === key;
              const sent = reviewedProducts.includes(key);
              return <article className="buyer-review-product" key={item.orderItemId ?? key ?? itemIndex}>
                <h3>{item.productName || item.name || "Sản phẩm"}</h3>
                <p>{sent ? "Đã gửi đánh giá trong phiên này." : "Chọn số sao và viết nhận xét về sản phẩm."}</p>
                <button className="button button-secondary button-small" type="button" disabled={!completed || !item.productId || sent || busy} onClick={() => openProduct(key)}>
                  {sent ? "Đã gửi đánh giá" : isActive ? "Đóng form" : "Đánh giá sản phẩm"}
                </button>
                {isActive && !sent && <BuyerReviewForm kind="product" rating={productRating} onRatingChange={setProductRating} comment={comment} onCommentChange={setComment} onImagesChange={setReviewImages} busy={busy} onSubmit={(event) => void submitProduct(event)} />}
              </article>;
            })}
          </div>
          {!(sub.items ?? []).length && <NoData title="Đơn bán này chưa có sản phẩm." />}
          <div className="buyer-review-seller">
            <h3>Đánh giá người bán</h3>
            {reviewedPartners.includes(subOrderId) && <p className="form-success" role="status">Đã gửi đánh giá người bán trong phiên này.</p>}
            <button className="button button-secondary button-small" type="button" disabled={!completed || !subOrderId || !sub.sellerId || reviewedPartners.includes(subOrderId) || busy} onClick={() => openSeller(subOrderId)}>
              {reviewedPartners.includes(subOrderId) ? "Đã gửi đánh giá" : activeSellerId === subOrderId ? "Đóng form" : "Đánh giá người bán"}
            </button>
            {activeSellerId === subOrderId && !reviewedPartners.includes(subOrderId) && <BuyerReviewForm kind="seller" rating={partnerRating} onRatingChange={setPartnerRating} comment={partnerComment} onCommentChange={setPartnerComment} busy={busy} onSubmit={(event) => void submitPartner(event)} />}
          </div>
        </Card>;
      })}
    </div>
  </>;
}

export function BuyerReportsScreen() {
  const [targetId,setTargetId]=useState("");const [violationType,setType]=useState("Fraud");const [description,setDescription]=useState("");const [evidence,setEvidence]=useState<File[]>([]);const [error,setError]=useState("");const [success,setSuccess]=useState("");const [busy,setBusy]=useState(false);
  const reports=useApiResource("/api/v1/me/reports?page=1&limit=20",async()=>{const result=unwrap(await api.get<ApiResponse<{items:UserReport[]}>>('/api/v1/me/reports?page=1&limit=20'));return result.items??[];});
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;setBusy(true);setError("");setSuccess("");try{
    let evidenceUrls:string[]=[];
    if(evidence.length){const form=new FormData();evidence.forEach(file=>form.append("files",file));const uploaded=unwrap(await api.post<ApiResponse<{urls:string[]}>|{urls:string[]}>("/api/v1/reports/files/upload",form));evidenceUrls=uploaded.urls;}
    await api.post('/api/v1/users/reports',{reportedUserId:targetId.trim(),violationType,description:description.trim(),evidenceUrls});setSuccess("Đã gửi báo cáo. Trạng thái sẽ cập nhật khi được xử lý.");setTargetId("");setDescription("");setEvidence([]);reports.reload();}catch(reason){setError(errorText(reason as Error));}finally{setBusy(false);}}
  return <div className="buyer-reports-page">
    <PageHeading title="Báo cáo người dùng" />
    <div className="split buyer-reports-layout">
      <Card className="card-pad buyer-report-form-card">
        <h2>Thông tin báo cáo</h2>
        <form className="auth-fields" onSubmit={e=>void submit(e)}>
          <label className="field-wrap">Mã người dùng bị báo cáo<input className="field" required value={targetId} onChange={e=>setTargetId(e.target.value)} placeholder="UUID" /></label>
          <label className="field-wrap">Loại vi phạm<select className="select-field" value={violationType} onChange={e=>setType(e.target.value)}><option value="Fraud">Gian lận</option><option value="Harassment">Quấy rối</option><option value="Counterfeit">Hàng giả</option><option value="Spam">Spam</option><option value="Other">Khác</option></select></label>
          <label className="field-wrap">Mô tả<textarea className="textarea-field" required minLength={10} value={description} onChange={e=>setDescription(e.target.value)} /></label>
          <label className="field-wrap">Ảnh bằng chứng (tối đa 5 ảnh)<input className="field" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{const files=Array.from(e.target.files??[]);if(files.length>5||files.some(file=>file.size>5*1024*1024)){setError("Chọn tối đa 5 ảnh JPG, PNG hoặc WEBP, mỗi ảnh không quá 5 MB.");setEvidence([]);}else{setError("");setEvidence(files);}}} /></label>
          {error&&<p className="notice" role="alert">{error}</p>}
          {success&&<p className="form-success" role="status">{success}</p>}
          <button className="button button-primary" type="submit" disabled={busy||Boolean(error)}>{busy?"Đang gửi…":"Gửi báo cáo"}</button>
        </form>
      </Card>
      <Card className="buyer-report-history-card">
        <div className="card-header"><h2>Báo cáo đã gửi</h2></div>
        {reports.error&&<p className="notice" role="alert">{errorText(reports.error)}</p>}
        {reports.data?.length?reports.data.map((report,index)=><div className="buyer-report-item" key={report.reportId??index}>
          <div className="buyer-report-item-content">
            <strong>{report.reason??report.targetType??"Báo cáo"}</strong>
            <span className="buyer-report-item-id">{report.targetId??"—"}</span>
            {report.createdAt&&<time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString("vi-VN")}</time>}
            {report.adminNote&&<p>Phản hồi: {report.adminNote}</p>}
          </div>
          <Badge>{reportStatusLabel[report.status?.toUpperCase() ?? ""] ?? report.status ?? "—"}</Badge>
        </div>):<NoData title={reports.loading?"Đang tải báo cáo…":reports.error?"Không tải được báo cáo":"Chưa gửi báo cáo nào"}/>}
      </Card>
    </div>
  </div>;
}
