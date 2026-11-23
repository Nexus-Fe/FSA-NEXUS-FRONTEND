"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { evidenceRequired, parseReportPrefill } from "./order-report";
import { Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { api, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { REPORT_REFUND_STATUS, REPORT_STATUS, statusLabel } from "@/lib/status-labels";
import { ErrorState } from "@/components/ui/States";

const unwrap = <T,>(value: ApiResponse<T> | T): T => value && typeof value === "object" && "data" in value ? value.data : value;

type UserReport = { reportId?: string; reportedUserId?: string; targetRole?: string; referenceType?: string | null; referenceId?: string | null; violationType?: string; description?: string; status?: string; resolutionNote?: string | null; refundStatus?: string; refundAmount?: number | null; createdAt?: string };
const VIOLATION_LABEL: Record<string, string> = { Fraud: "Gian lận", Harassment: "Quấy rối", Counterfeit: "Hàng giả", Spam: "Spam", Other: "Khác" };


export function BuyerReportsScreen() {
  const prefill=parseReportPrefill(useSearchParams());
  const [targetId,setTargetId]=useState(prefill.reportedUserId);const [violationType,setType]=useState("Fraud");const [description,setDescription]=useState("");const [evidence,setEvidence]=useState<File[]>([]);const [error,setError]=useState("");const [success,setSuccess]=useState("");const [busy,setBusy]=useState(false);
  const reports=useApiResource("/api/v1/me/reports?page=1&limit=20",async()=>{const result=unwrap(await api.get<ApiResponse<{items:UserReport[]}>>('/api/v1/me/reports?page=1&limit=20'));return result.items??[];});
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;setBusy(true);setError("");setSuccess("");try{
    if(evidenceRequired(prefill.referenceType,violationType,evidence.length)){setError("Báo cáo gian lận hoặc hàng giả về một đơn cần ít nhất một ảnh bằng chứng.");setBusy(false);return;}
    let evidenceUrls:string[]=[];
    if(evidence.length){const form=new FormData();evidence.forEach(file=>form.append("files",file));const uploaded=unwrap(await api.post<ApiResponse<{urls:string[]}>|{urls:string[]}>("/api/v1/reports/files/upload",form));evidenceUrls=uploaded.urls;}
    await api.post('/api/v1/users/reports',{reportedUserId:targetId.trim(),...(prefill.referenceType?{referenceType:prefill.referenceType,referenceId:prefill.referenceId}:{}),violationType,description:description.trim(),evidenceUrls});setSuccess("Đã gửi báo cáo. Trạng thái sẽ cập nhật khi được xử lý.");setTargetId("");setDescription("");setEvidence([]);reports.reload();}catch(reason){setError(formatError(describeError(reason,{operation:"write"})));}finally{setBusy(false);}}
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
        {reports.error&&<ErrorState cause={reports.error} onRetry={reports.reload} />}
        {reports.data?.length?reports.data.map((report,index)=><div className="buyer-report-item" key={report.reportId??index}>
          <div className="buyer-report-item-content">
            <strong>{VIOLATION_LABEL[report.violationType??""]??report.violationType??"Báo cáo"}{report.targetRole?` · ${report.targetRole==="Seller"?"Người bán":report.targetRole==="Buyer"?"Người mua":"Tài khoản"}`:""}</strong>
            {report.description&&<p className="buyer-report-item-text">{report.description}</p>}
            <span className="buyer-report-item-id">{report.referenceType==="Order"&&report.referenceId?`Đơn ${report.referenceId.slice(0,8)}`:report.reportedUserId?`Người dùng ${report.reportedUserId.slice(0,8)}`:"—"}</span>
            {report.createdAt&&<time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString("vi-VN")}</time>}
            {report.resolutionNote&&<p>Phản hồi: {report.resolutionNote}</p>}
            {report.refundStatus&&report.refundStatus!=="None"&&<p>Hoàn tiền: {statusLabel(REPORT_REFUND_STATUS, report.refundStatus)}{typeof report.refundAmount==="number"&&report.refundAmount>0?` (${report.refundAmount.toLocaleString("vi-VN")} ₫)`:""}</p>}
          </div>
          <Badge>{statusLabel(REPORT_STATUS, report.status)}</Badge>
        </div>):<NoData title={reports.loading?"Đang tải báo cáo…":reports.error?"Không tải được báo cáo":"Chưa gửi báo cáo nào"}/>}
      </Card>
    </div>
  </div>;
}
