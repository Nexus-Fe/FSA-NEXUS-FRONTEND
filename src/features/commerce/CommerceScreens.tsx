"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ROUTES } from "@/constants/routes";
import { auctionService } from "@/features/auction/services/auction.service";
import type { MyAuctionReportItem } from "@/features/auction/types";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { evidenceRequired, parseReportPrefill } from "./order-report";
import { Badge, Card, PageHeading, TruncatedText } from "@/components/ui/Primitives";
import { FileDropZone, IMAGE_UPLOAD_PRESET } from "@/components/ui/FileDropZone";
import { api, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { REPORT_REFUND_STATUS, REPORT_STATUS, statusLabel } from "@/lib/status-labels";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { EmptyState } from "@/components/ui/EmptyState";

const unwrap = <T,>(value: ApiResponse<T> | T): T => value && typeof value === "object" && "data" in value ? value.data : value;

type UserReport = { reportId?: string; reportedUserId?: string; targetRole?: string; referenceType?: string | null; referenceId?: string | null; violationType?: string; description?: string; status?: string; resolutionNote?: string | null; refundStatus?: string; refundAmount?: number | null; createdAt?: string };
type BuyerProductReport = { id: string; productId?: string; productName?: string; reason?: string; description?: string; status?: string; resolutionNote?: string | null; createdAt?: string };
const VIOLATION_LABEL: Record<string, string> = { Fraud: "Gian lận", Harassment: "Quấy rối", Counterfeit: "Hàng giả", Spam: "Spam", Other: "Khác" };
const AUCTION_REPORT_REASON_LABEL: Record<string, string> = {
  SuspectedShillBidding: "Nghi vấn kích giá ảo",
  CounterfeitOrFake: "Nghi vấn hàng giả / nhái",
  MisleadingInfo: "Thông tin mô tả sai lệch",
  ExternalContact: "Lôi kéo giao dịch ngoài sàn",
  Other: "Lý do khác",
};


export function BuyerReportsScreen() {
  const prefill=parseReportPrefill(useSearchParams());
  const [targetId,setTargetId]=useState(prefill.reportedUserId);const [violationType,setType]=useState("Fraud");const [description,setDescription]=useState("");const [evidence,setEvidence]=useState<File[]>([]);const [error,setError]=useState("");const [success,setSuccess]=useState("");const [busy,setBusy]=useState(false);
  const [historyTab, setHistoryTab] = useState<"orders" | "products" | "auctions">("orders");
  const [statusFilter, setStatusFilter] = useState("");
  const reports=useApiResource("/api/v1/me/reports?page=1&pageSize=20",async()=>{const result=unwrap(await api.get<ApiResponse<{items:UserReport[]}>>('/api/v1/me/reports?page=1&pageSize=20'));return result.items??[];});
  const productReports=useApiResource("/api/v1/products/reports/mine",async()=>{const result=unwrap(await api.get<ApiResponse<BuyerProductReport[]>|BuyerProductReport[]>('/api/v1/products/reports/mine'));return Array.isArray(result)?result:[];});
  const auctionReports=useApiResource("/api/v1/me/auction-reports?page=1&pageSize=20",async(signal):Promise<MyAuctionReportItem[]>=>{const result=await auctionService.myReports(1,20,signal);return result.items??[];});
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;setBusy(true);setError("");setSuccess("");try{
    if(evidenceRequired(prefill.referenceType,violationType,evidence.length)){setError("Báo cáo gian lận hoặc hàng giả về một đơn cần ít nhất một ảnh bằng chứng.");setBusy(false);return;}
    let evidenceUrls:string[]=[];
    if(evidence.length){const form=new FormData();evidence.forEach(file=>form.append("files",file));const uploaded=unwrap(await api.post<ApiResponse<{fileUrls?:string[];urls?:string[]}>|{fileUrls?:string[];urls?:string[]}>("/api/v1/reports/files/upload",form));evidenceUrls=uploaded?.fileUrls??uploaded?.urls??[];}
    await api.post('/api/v1/users/reports',{reportedUserId:targetId.trim(),...(prefill.referenceType?{referenceType:prefill.referenceType,referenceId:prefill.referenceId}:{}),violationType,description:description.trim(),evidenceUrls});setSuccess("Đã gửi báo cáo. Trạng thái sẽ cập nhật khi được xử lý.");setTargetId("");setDescription("");setEvidence([]);reports.reload();}catch(reason){setError(formatError(describeError(reason,{operation:"write"})));}finally{setBusy(false);}}
  const matchesFilter = (value?: string) => !statusFilter || (value ?? "").toUpperCase() === statusFilter.toUpperCase();
  const filteredUserReports = (reports.data ?? []).filter((r) => matchesFilter(r.status));
  const filteredProductReports = (productReports.data ?? []).filter((r) => matchesFilter(r.status));
  const filteredAuctionReports = (auctionReports.data ?? []).filter((r) => matchesFilter(r.status));
  return <div className="buyer-reports-page">
    <PageHeading title="Báo cáo & Khiếu nại" />
    <div className="split buyer-reports-layout">
      <Card className="card-pad buyer-report-form-card">
        <h2>Thông tin báo cáo</h2>
        <form className="auth-fields" onSubmit={e=>void submit(e)}>
          <label className="field-wrap">Mã người dùng bị báo cáo<input className="field" required value={targetId} onChange={e=>setTargetId(e.target.value)} placeholder="UUID" /></label>
          <label className="field-wrap">Loại vi phạm<select className="select-field" value={violationType} onChange={e=>setType(e.target.value)}><option value="Fraud">Gian lận</option><option value="Harassment">Quấy rối</option><option value="Counterfeit">Hàng giả</option><option value="Spam">Spam</option><option value="Other">Khác</option></select></label>
          <label className="field-wrap">Mô tả<textarea className="textarea-field" required minLength={10} value={description} onChange={e=>setDescription(e.target.value)} /></label>
          <div className="field-wrap"><span>Ảnh bằng chứng (tối đa 5 ảnh)</span><FileDropZone {...IMAGE_UPLOAD_PRESET} onFilesChange={(files) => { setError(""); setEvidence(files); }} /></div>
          {error&&<p className="notice" role="alert">{error}</p>}
          {success&&<p className="form-success" role="status">{success}</p>}
          <button className="button button-primary" type="submit" disabled={busy||Boolean(error)}>{busy?"Đang gửi…":"Gửi báo cáo"}</button>
        </form>
      </Card>
      <Card className="buyer-report-history-card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2>Báo cáo đã gửi</h2>
          <div className="action-row" style={{ margin: 0 }}>
            <button type="button" className={`button button-small ${historyTab === "orders" ? "button-primary" : "button-secondary"}`} onClick={() => setHistoryTab("orders")}>Đơn hàng / Người dùng</button>
            <button type="button" className={`button button-small ${historyTab === "products" ? "button-primary" : "button-secondary"}`} onClick={() => setHistoryTab("products")}>Sản phẩm</button>
            <button type="button" className={`button button-small ${historyTab === "auctions" ? "button-primary" : "button-secondary"}`} onClick={() => setHistoryTab("auctions")}>Đấu giá</button>
          </div>
        </div>
        <div style={{ padding: "0 18px 12px" }}>
          <select className="select-field" aria-label="Lọc trạng thái báo cáo" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Tất cả trạng thái</option>
            <option value="Pending">Chờ xử lý</option>
            <option value="UnderReview">Đang xem xét</option>
            <option value="Investigating">Đang điều tra</option>
            <option value="Resolved">Đã xử lý</option>
            <option value="ActionTaken">Đã xử lý vi phạm</option>
            <option value="Rejected">Đã từ chối</option>
            <option value="Dismissed">Đã bác</option>
          </select>
        </div>
        {historyTab === "orders" ? (
          <>
            {reports.error&&<ErrorState cause={reports.error} onRetry={reports.reload} />}
            {filteredUserReports.length?filteredUserReports.map((report,index)=><div className="buyer-report-item" key={report.reportId??index}>
              <div className="buyer-report-item-content">
                <strong>{VIOLATION_LABEL[report.violationType??""]??report.violationType??"Báo cáo"}{report.targetRole?` · ${report.targetRole==="Seller"?"Người bán":report.targetRole==="Buyer"?"Người mua":"Tài khoản"}`:""}</strong>
                {report.description&&<p className="buyer-report-item-text">{report.description}</p>}
                <span className="buyer-report-item-id">{report.referenceType==="Order"&&report.referenceId?`Đơn ${report.referenceId.slice(0,8)}`:report.reportedUserId?`Người dùng ${report.reportedUserId.slice(0,8)}`:"—"}</span>
                {report.createdAt&&<time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString("vi-VN")}</time>}
                {report.resolutionNote&&<p>Phản hồi: {report.resolutionNote}</p>}
                {report.refundStatus&&report.refundStatus!=="None"&&<p>Hoàn tiền: {statusLabel(REPORT_REFUND_STATUS, report.refundStatus)}{typeof report.refundAmount==="number"&&report.refundAmount>0?` (${report.refundAmount.toLocaleString("vi-VN")} ₫)`:""}</p>}
              </div>
              <Badge>{statusLabel(REPORT_STATUS, report.status)}</Badge>
            </div>):reports.loading?<LoadingState rows={3} label="Đang tải báo cáo…"/>:reports.error?null:<EmptyState title="Chưa gửi báo cáo nào" description="Báo cáo bạn gửi sẽ hiện ở đây cùng trạng thái xử lý."/>}
          </>
        ) : historyTab === "products" ? (
          <>
            {productReports.error&&<ErrorState cause={productReports.error} onRetry={productReports.reload} />}
            {filteredProductReports.length?filteredProductReports.map((report)=><div className="buyer-report-item" key={report.id}>
              <div className="buyer-report-item-content">
                <strong><TruncatedText text={`${report.productName || "Sản phẩm"}${report.reason ? ` · ${report.reason}` : ""}`} label="Báo cáo sản phẩm" block /></strong>
                {report.description&&<p className="buyer-report-item-text">{report.description}</p>}
                {report.createdAt&&<time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString("vi-VN")}</time>}
                {report.resolutionNote&&<p>Phản hồi: {report.resolutionNote}</p>}
              </div>
              <Badge>{statusLabel(REPORT_STATUS, report.status)}</Badge>
            </div>):productReports.loading?<LoadingState rows={3} label="Đang tải báo cáo sản phẩm…"/>:productReports.error?null:<EmptyState title="Chưa có báo cáo sản phẩm nào" description="Các báo cáo sản phẩm bạn gửi sẽ hiện ở đây cùng trạng thái xử lý."/>}
          </>
        ) : (
          <>
            {auctionReports.error&&<ErrorState cause={auctionReports.error} onRetry={auctionReports.reload} />}
            {filteredAuctionReports.length?filteredAuctionReports.map((report)=><div className="buyer-report-item" key={report.reportId}>
              <div className="buyer-report-item-content">
                <strong>
                  <Link href={ROUTES.auction.room(report.auctionId)}>{report.auctionTitle || `Phiên ${report.auctionId.slice(0, 8)}`}</Link>
                  {` · ${AUCTION_REPORT_REASON_LABEL[report.reason] ?? report.reason}`}
                </strong>
                {report.description&&<p className="buyer-report-item-text">{report.description}</p>}
                {report.createdAt&&<time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString("vi-VN")}</time>}
                {report.adminNote&&<p>Phản hồi: {report.adminNote}</p>}
              </div>
              <Badge>{statusLabel(REPORT_STATUS, report.status)}</Badge>
            </div>):auctionReports.loading?<LoadingState rows={3} label="Đang tải báo cáo đấu giá…"/>:auctionReports.error?null:<EmptyState title="Chưa có báo cáo đấu giá nào" description="Báo cáo vi phạm phiên đấu giá bạn gửi tại phòng đấu giá sẽ hiện ở đây."/>}
          </>
        )}
      </Card>
    </div>
  </div>;
}
