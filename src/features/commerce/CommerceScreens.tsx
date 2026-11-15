"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { api, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";

type Obj = Record<string, unknown>;
const unwrap = <T,>(value: ApiResponse<T> | T): T => value && typeof value === "object" && "data" in value ? value.data : value;
const errorText = (error: Error | null) => error?.message ?? "";

type UserReport = { reportId?: string; targetType?: string; targetId?: string; reason?: string; status?: string; adminNote?: string; createdAt?: string };
const reportStatusLabel: Record<string, string> = { PENDING: "Chờ xử lý", UNDER_REVIEW: "Đang xem xét", RESOLVED: "Đã xử lý", REJECTED: "Đã từ chối" };

export function BuyerOrderReviewScreen() {
  const params=useParams<{id:string}>();const orderId=String(params.id??"");
  const order=useApiResource(orderId?`/api/v1/orders/${orderId}`:null,async()=>unwrap(await api.get<ApiResponse<Obj>>(`/api/v1/orders/${encodeURIComponent(orderId)}`)));
  const [productId,setProductId]=useState("");const [productRating,setProductRating]=useState("5");const [partnerRating,setPartnerRating]=useState("5");const [comment,setComment]=useState("");const [partnerComment,setPartnerComment]=useState("");const [error,setError]=useState("");const [success,setSuccess]=useState("");const [busy,setBusy]=useState(false);
  const [reviewImages,setReviewImages]=useState<File[]>([]);
  const subOrders=Array.isArray(order.data?.subOrders)?order.data.subOrders as Obj[]:[];
  const products:Obj[]=subOrders.flatMap(sub=>Array.isArray(sub.items)?(sub.items as Obj[]).map(item=>({...item,sellerId:sub.sellerId,subOrderId:sub.subOrderId,subOrderStatus:sub.status})):[]);
  const selected=products.find(item=>String(item.productId??item.id)===productId);
  const completed=String(selected?.subOrderStatus??"").toUpperCase()==="COMPLETED";
  async function submitProduct(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!selected)return;if(reviewImages.length>5||reviewImages.some(file=>!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024)){setError("Chọn tối đa 5 ảnh JPG, PNG hoặc WEBP, mỗi ảnh tối đa 5 MB.");return;}setBusy(true);setError("");setSuccess("");try{const form=new FormData();form.append("orderId",orderId);form.append("rating",productRating);form.append("comment",comment.trim());reviewImages.forEach(file=>form.append("reviewImages",file));await api.post(`/api/v1/products/${encodeURIComponent(productId)}/reviews`,form);setSuccess("Đã gửi đánh giá sản phẩm.");}catch(reason){setError(errorText(reason as Error));}finally{setBusy(false);}}
  async function submitPartner(){const targetUserId=String(selected?.sellerId??"");if(!targetUserId){setError("Đơn hàng chưa trả mã người bán để gửi đánh giá.");return;}setBusy(true);setError("");setSuccess("");try{await api.post("/api/v1/reviews",{revieweeId:targetUserId,reviewerRole:"Buyer",referenceType:"Order",referenceId:String(selected?.subOrderId??orderId),rating:Number(partnerRating),comment:partnerComment.trim(),mediaUrls:[]});setSuccess("Đã gửi đánh giá người bán.");}catch(reason){setError(errorText(reason as Error));}finally{setBusy(false);}}
  return <><PageHeading overline="Sau khi nhận hàng" title="Đánh giá đơn hàng" description="Đánh giá sản phẩm và người bán sau khi đơn hàng hoàn tất."/>{order.error&&<p className="notice" role="alert">{errorText(order.error)}</p>}{!completed&&<p className="notice" role="status">Chỉ gửi đánh giá khi backend xác nhận đơn đã hoàn tất.</p>}{error&&<p className="notice" role="alert">{error}</p>}{success&&<p className="form-success" role="status">{success}</p>}<div className="split"><Card className="card-pad"><h2>Đánh giá sản phẩm</h2><form className="auth-fields" onSubmit={e=>void submitProduct(e)}><label className="field-wrap">Sản phẩm<select className="select-field" required value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Chọn sản phẩm trong đơn</option>{products.map((item,index)=>{const id=String(item.productId??item.id??"");return <option key={id||index} value={id}>{String(item.productName??item.name??id)}</option>;})}</select></label><label className="field-wrap">Số sao<select className="select-field" value={productRating} onChange={e=>setProductRating(e.target.value)}>{[5,4,3,2,1].map(value=><option value={value} key={value}>{value} sao</option>)}</select></label><label className="field-wrap">Nhận xét<textarea className="textarea-field" minLength={3} required value={comment} onChange={e=>setComment(e.target.value)}/></label><label className="field-wrap">Ảnh đánh giá (tối đa 5)<input className="field" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setReviewImages(Array.from(e.target.files??[]))} /></label><button className="button button-primary" disabled={busy||!completed||!selected}>{busy?"Đang gửi…":"Gửi đánh giá sản phẩm"}</button></form></Card><Card className="card-pad"><h2>Đánh giá người bán</h2><label className="field-wrap">Số sao<select className="select-field" value={partnerRating} onChange={e=>setPartnerRating(e.target.value)}>{[5,4,3,2,1].map(value=><option value={value} key={value}>{value} sao</option>)}</select></label><label className="field-wrap">Nhận xét<textarea className="textarea-field" minLength={3} value={partnerComment} onChange={e=>setPartnerComment(e.target.value)}/></label><p>Gửi đánh giá cho người bán của sản phẩm đã chọn.</p><button className="button button-secondary" disabled={busy||!completed||!selected||!partnerComment.trim()} onClick={()=>void submitPartner()}>Gửi đánh giá người bán</button></Card></div></>;
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
